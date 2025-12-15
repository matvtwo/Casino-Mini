const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");

const db = require("../db/models");
const { sequelize, User, Item, UserItem, Transaction } = db;
const authRouter = require("./routes/auth");
const { authMiddleware, requireAdmin } = require("./routes/auth");
const PORT = process.env.PORT || 3001;

const { RoundManager, PAY_SYMBOLS } = require("./roundManager");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/auth", authRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/game/paytable", (_req, res) => res.json({ paytable: PAY_SYMBOLS }));

app.get("/shop/items", async (_req, res) => {
  const items = await Item.findAll({ order: [["price", "ASC"]] });
  return res.json({ items });
});

app.get("/shop/inventory", authMiddleware, async (req, res) => {
  const inventory = await UserItem.findAll({
    where: { userId: req.user.id },
    include: [{ model: Item }],
  });

  return res.json({
    inventory: inventory.map((entry) => ({
      id: entry.itemId,
      code: entry.Item?.code,
      name: entry.Item?.name,
      description: entry.Item?.description,
      price: entry.Item?.price,
      quantity: entry.quantity,
    })),
  });
});

app.post("/shop/purchase", authMiddleware, async (req, res) => {
  const { itemId } = req.body;
  if (!itemId) return res.status(400).json({ message: "itemId required" });
  const item = await Item.findByPk(itemId);
  if (!item) return res.status(404).json({ message: "Item not found" });
  if (req.user.balance < item.price) {
    return res.status(400).json({ message: "Insufficient balance" });
  }

  const tx = await sequelize.transaction();
  try {
    req.user.balance -= item.price;
    await req.user.save({ transaction: tx });

    const [entry, created] = await UserItem.findOrCreate({
      where: { userId: req.user.id, itemId: item.id },
      defaults: { quantity: 1 },
      transaction: tx,
    });

    if (!created) {
      entry.quantity += 1;
      await entry.save({ transaction: tx });
    }

    await Transaction.create(
      {
        type: "PURCHASE",
        amount: -item.price,
        description: `Bought ${item.name}`,
        userId: req.user.id,
        actorId: req.user.id,
      },
      { transaction: tx }
    );

    await tx.commit();
    pushBalanceUpdate(req.user);
    return res.json({
      balance: req.user.balance,
      item: {
        id: item.id,
        code: item.code,
        name: item.name,
        description: item.description,
        price: item.price,
      },
      quantity: entry.quantity,
    });
  } catch (err) {
    await tx.rollback();
    console.error(err);
    return res.status(500).json({ message: "Purchase failed" });
  }
});

app.get("/admin/users", authMiddleware, requireAdmin, async (_req, res) => {
  const users = await User.findAll({
    attributes: ["id", "username", "balance", "role", "avatarUrl"],
    order: [["username", "ASC"]],
  });
  return res.json({ users });
});

app.post("/admin/credit", authMiddleware, requireAdmin, async (req, res) => {
  const { userId, username, amount, reason } = req.body;
  const amt = Number(amount);
  if (!amt || amt <= 0) {
    return res
      .status(400)
      .json({ message: "Amount must be a positive number" });
  }
  let target = null;
  if (userId) target = await User.findByPk(userId);
  if (!target && username) {
    target = await User.findOne({ where: { username } });
  }
  if (!target) return res.status(404).json({ message: "User not found" });

  const tx = await sequelize.transaction();
  try {
    target.balance += amt;
    await target.save({ transaction: tx });
    await Transaction.create(
      {
        type: "CREDIT",
        amount: amt,
        description: reason || "Admin credit",
        userId: target.id,
        actorId: req.user.id,
      },
      { transaction: tx }
    );
    await tx.commit();
    pushBalanceUpdate(target);
    return res.json({ user: normalizeUser(target) });
  } catch (err) {
    await tx.rollback();
    console.error(err);
    return res.status(500).json({ message: "Credit failed" });
  }
});

const publicDir = path.join(__dirname, "..", "dist", "public");

app.use(express.static(publicDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Map(); // ws -> user

const broadcast = (payload) => {
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(msg);
  }
};

const normalizeUser = (user) => ({
  id: user.id,
  username: user.username,
  balance: user.balance,
  avatarUrl: user.avatarUrl,
  role: user.role,
});

const updateCachedUser = (user) => {
  const normalized = normalizeUser(user);
  for (const [socket, cached] of clients.entries()) {
    if (cached.id === normalized.id) {
      clients.set(socket, normalized);
    }
  }
  return normalized;
};

const sendOnlineUsers = () => {
  const users = Array.from(clients.values());
  broadcast({ type: "ONLINE_USERS", users });
};

const pushBalanceUpdate = (user) => {
  const normalized = updateCachedUser(user);
  broadcast({ type: "USER_BALANCE", user: normalized });
  sendOnlineUsers();
};

const hasPlayers = () => wss.clients.size > 0;

const roundManager = new RoundManager({
  broadcast,
  hasPlayers,
  onBalanceChange: pushBalanceUpdate,
});
roundManager.start();

wss.on("connection", async (ws, req) => {
  const token = new URL(req.url, "http://localhost").searchParams.get("token");

  try {
    const fakeReq = { headers: { authorization: `Bearer ${token}` } };
    const fakeRes = { status: () => ({ json: () => ws.close() }) };

    await new Promise((resolve, reject) =>
      authMiddleware(fakeReq, fakeRes, (err) => (err ? reject(err) : resolve()))
    );

    const user = fakeReq.user;
    const normalized = normalizeUser(user);
    clients.set(ws, normalized);

    ws.send(JSON.stringify({ type: "WELCOME", user: normalized }));

    sendOnlineUsers();
  } catch {
    ws.close();
    return;
  }

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const user = clients.get(ws);
      if (!user) return;

      if (msg.type === "PLACE_BET") {
        const bet = await roundManager.placeBet(user.id, msg.amount);
        ws.send(JSON.stringify({ type: "BET_ACCEPTED", betId: bet.id }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: "ERROR", message: err.message }));
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    sendOnlineUsers();
  });
});

async function ensureDefaultItems() {
  const defaults = [
    {
      code: "lucky-charm",
      name: "Lucky Charm",
      description: "A shiny trinket that definitely boosts morale.",
      price: 300,
    },
    {
      code: "vip-card",
      name: "VIP Card",
      description: "Status symbol. Grants swagger in the lobby.",
      price: 750,
    },
    {
      code: "golden-ticket",
      name: "Golden Ticket",
      description: "One-time prize entry for special events.",
      price: 1200,
    },
  ];

  for (const item of defaults) {
    await Item.findOrCreate({ where: { code: item.code }, defaults: item });
  }
}

async function bootstrap() {
  await sequelize.sync();
  await ensureDefaultItems();
  server.listen(PORT, () => console.log(`API + WS listening on ${PORT}`));
}

bootstrap();
