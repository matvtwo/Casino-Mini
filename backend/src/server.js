import http from "http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";

import { sequelize } from "../db/index.js";
import authRouter, { authMiddleware } from "./routes/auth.js";
import { PORT } from "./config.js";
import { RoundManager } from "./roundManager.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/auth", authRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Map(); // ws -> user

const broadcast = (payload) => {
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(msg);
  }
};

const hasPlayers = () => wss.clients.size > 0;

const roundManager = new RoundManager({ broadcast, hasPlayers });
roundManager.start();

const sendOnlineUsers = () => {
  const users = Array.from(clients.values()).map((u) => ({
    id: u.id,
    username: u.username,
    balance: u.balance,
    avatarUrl: u.avatarUrl,
  }));
  broadcast({ type: "ONLINE_USERS", users });
};

wss.on("connection", async (ws, req) => {
  const token = new URL(req.url, "http://localhost").searchParams.get("token");

  try {
    const fakeReq = { headers: { authorization: `Bearer ${token}` } };
    const fakeRes = { status: () => ({ json: () => ws.close() }) };

    await new Promise((resolve, reject) =>
      authMiddleware(fakeReq, fakeRes, (err) => (err ? reject(err) : resolve()))
    );

    const user = fakeReq.user;
    clients.set(ws, user);

    ws.send(
      JSON.stringify({
        type: "WELCOME",
        user: {
          id: user.id,
          username: user.username,
          balance: user.balance,
          avatarUrl: user.avatarUrl,
        },
      })
    );

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

async function bootstrap() {
  await sequelize.sync();
  server.listen(PORT, () => console.log(`API + WS listening on ${PORT}`));
}

bootstrap();
