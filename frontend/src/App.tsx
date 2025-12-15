import { useEffect, useRef, useState } from "react";
import {
  adminCredit,
  adminListUsers,
  fetchPaytable,
  getInventory,
  listItems,
  login,
  me as fetchMe,
  purchaseItem,
  register,
} from "./api";
import { connect, WsEvent } from "./ws";

type User = {
  id: number;
  username: string;
  balance: number;
  avatarUrl?: string;
  role?: string;
};
type PaySymbol = { key: string; icon: string; multiplier: number };
type Item = {
  id: number;
  code: string;
  name: string;
  description?: string;
  price: number;
  quantity?: number;
};

const reelsArt = [
  ["💎", "7️⃣", "🔔", "🍒", "🍋", "☘️"],
  ["🔔", "🍋", "7️⃣", "💎", "☘️", "🍒"],
  ["🍋", "🍒", "☘️", "7️⃣", "🔔", "💎"],
];

export default function App() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [online, setOnline] = useState<User[]>([]);
  const [roundState, setRoundState] = useState<string>("IDLE");
  const [reels, setReels] = useState(["💎", "💎", "💎"]);
  const [spinning, setSpinning] = useState(false);
  const [message, setMessage] = useState("");
  const [betAmount, setBetAmount] = useState(50);
  const [paytable, setPaytable] = useState<PaySymbol[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [inventory, setInventory] = useState<Item[]>([]);
  const [shopMessage, setShopMessage] = useState("");
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [creditAmount, setCreditAmount] = useState(500);
  const [creditUserId, setCreditUserId] = useState<number | undefined>();
  const [creditUsername, setCreditUsername] = useState("");
  const [creditReason, setCreditReason] = useState("");

  const wsRef = useRef<ReturnType<typeof connect> | null>(null);
  const handlerRef = useRef<(ev: WsEvent) => void>();

  function handleEvent(ev: WsEvent) {
    if (ev.type === "WELCOME") {
      setMe(ev.user);
    } else if (ev.type === "ONLINE_USERS") {
      setOnline(ev.users);
    } else if (ev.type === "ROUND_STATE") {
      setRoundState(ev.state);
      if (ev.state === "SPINNING") {
        setSpinning(true);
        setMessage("Spinning...");
      } else if (ev.state === "BETTING") {
        setMessage("Place your bets");
      }
    } else if (ev.type === "ROUND_RESULT") {
      setSpinning(false);
      setReels(ev.result.reels);
      if (ev.result.lineWin) {
        setMessage(
          `3x ${ev.result.winningSymbol || "match"} (x${
            ev.result.payoutMultiplier
          })`
        );
      } else {
        setMessage("No win");
      }
    } else if (ev.type === "BET_PLACED") {
      setMe((prev) =>
        prev && prev.id === ev.user.id
          ? { ...prev, balance: ev.user.balance }
          : prev
      );
      setOnline((prev) =>
        prev.map((u) =>
          u.id === ev.user.id ? { ...u, balance: ev.user.balance } : u
        )
      );
    } else if (ev.type === "USER_BALANCE") {
      setMe((prev) =>
        prev && prev.id === ev.user.id
          ? { ...prev, balance: ev.user.balance }
          : prev
      );
      setOnline((prev) =>
        prev.map((u) =>
          u.id === ev.user.id ? { ...u, balance: ev.user.balance } : u
        )
      );
    } else if (ev.type === "PAYOUT") {
      setMe((prev) =>
        prev && prev.id === ev.user.id
          ? { ...prev, balance: ev.user.balance }
          : prev
      );
      setOnline((prev) =>
        prev.map((u) =>
          u.id === ev.user.id ? { ...u, balance: ev.user.balance } : u
        )
      );
      setMessage(
        `Win ${ev.amount} on ${ev.symbol || "line"} (x${ev.multiplier})`
      );
    } else if (ev.type === "ERROR") {
      setMessage(ev.message);
    }
  }

  handlerRef.current = handleEvent;

  useEffect(() => {
    if (!token) return;
    const socket = connect(token, (ev) => handlerRef.current?.(ev));
    wsRef.current = socket;
    return () => socket.close();
  }, [token]);

  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    fetchPaytable()
      .then((res) => setPaytable(res.paytable || []))
      .catch(() => setPaytable([]));
    listItems()
      .then((res) => setItems(res.items || []))
      .catch(() => setShopMessage("Failed to load shop items"));
  }, []);

  useEffect(() => {
    if (!token) {
      setMe(null);
      setInventory([]);
      return;
    }
    (async () => {
      try {
        const profile = await fetchMe(token);
        setMe(profile);
        await loadInventory(token);
        if (profile.role === "admin") {
          const res = await adminListUsers(token);
          setAdminUsers(res.users || []);
        } else {
          setAdminUsers([]);
        }
      } catch (err) {
        setMessage("Session expired, please log in again");
        setToken(null);
        localStorage.removeItem("token");
      }
    })();
  }, [token]);

  async function loadInventory(currentToken = token) {
    if (!currentToken) return;
    try {
      const res = await getInventory(currentToken);
      setInventory(res.inventory || []);
    } catch (err) {
      setShopMessage("Failed to load inventory");
    }
  }

  async function submitAuth() {
    try {
      const fn = mode === "login" ? login : register;
      const res =
        mode === "login"
          ? await fn(username, password)
          : await fn(
              username,
              password,
              avatarUrl || undefined,
              adminKey || undefined
            );
      setToken(res.token);
      setMe(res.user);
      localStorage.setItem("token", res.token);
      setMessage("");
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function buyItem(itemId: number) {
    if (!token) return;
    try {
      const res = await purchaseItem(token, itemId);
      setShopMessage(`Purchased ${res.item.name}`);
      setMe((prev) => (prev ? { ...prev, balance: res.balance } : prev));
      await loadInventory(token);
    } catch (err) {
      setShopMessage((err as Error).message);
    }
  }

  async function sendCredit() {
    if (!token) return;
    if (!creditUserId && !creditUsername) {
      setMessage("Choose a user to credit");
      return;
    }
    try {
      const res = await adminCredit(token, {
        userId: creditUserId,
        username: creditUsername || undefined,
        amount: creditAmount,
        reason: creditReason || undefined,
      });
      setMessage(`Credited ${res.user.username} with ${creditAmount} coins`);
      setMe((prev) =>
        prev && prev.id === res.user.id
          ? { ...prev, balance: res.user.balance }
          : prev
      );
      const users = await adminListUsers(token);
      setAdminUsers(users.users || []);
      setOnline((prev) =>
        prev.map((u) =>
          u.id === res.user.id ? { ...u, balance: res.user.balance } : u
        )
      );
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  const isAdmin = me?.role === "admin";

  return (
    <div className="page">
      <div className="layout">
        <aside className="panel">
          <h2>Players Online</h2>
          <ul>
            {online.map((u) => (
              <li key={u.id}>
                <span className="avatar">
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} style={{ width: "100%" }}></img>
                  ) : (
                    "🎰"
                  )}
                </span>
                <div>
                  <div className="name">
                    {u.username}
                    {u.role === "admin" && <span className="pill">admin</span>}
                  </div>
                  <div className="balance">{u.balance} cr</div>
                </div>
              </li>
            ))}
          </ul>
        </aside>
        <main className="panel">
          <header className="top">
            <div>
              <h1>Orchestrated Slots</h1>
              <p>Paytable wins with admin-controlled credits</p>
            </div>
            <div className="auth">
              {!token ? (
                <div className="auth-form">
                  <div className="tabs">
                    <button
                      className={mode === "login" ? "active" : ""}
                      onClick={() => setMode("login")}
                    >
                      Login
                    </button>
                    <button
                      className={mode === "register" ? "active" : ""}
                      onClick={() => setMode("register")}
                    >
                      Register
                    </button>
                  </div>
                  <input
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <input
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {mode === "register" && (
                    <>
                      <input
                        placeholder="Avatar URL (optional)"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                      />
                      <input
                        placeholder="Admin key (optional)"
                        value={adminKey}
                        onChange={(e) => setAdminKey(e.target.value)}
                      />
                    </>
                  )}
                  <button onClick={submitAuth}>
                    {mode === "login" ? "Login" : "Register"}
                  </button>
                </div>
              ) : (
                <div className="me">
                  <div className="name">
                    {me?.username}{" "}
                    {isAdmin && <span className="pill">admin</span>}
                  </div>
                  <div className="balance">{me?.balance} cr</div>
                  <button
                    onClick={() => {
                      setToken(null);
                      localStorage.removeItem("token");
                      wsRef.current?.close();
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </header>

          <section className="slot">
            <div className="status">{roundState}</div>
            <div className={`reels ${spinning ? "spinning" : ""}`}>
              {spinning
                ? reelsArt.map((col, i) => (
                    <div key={i} className="reel-track">
                      {col.map((s, j) => (
                        <span key={j}>{s}</span>
                      ))}
                    </div>
                  ))
                : reels.map((s, i) => (
                    <div key={i} className="reel-stop">
                      <span>{s}</span>
                    </div>
                  ))}
            </div>
            <div className="controls">
              <input
                type="number"
                min={10}
                step={10}
                value={betAmount}
                onChange={(e) => setBetAmount(Number(e.target.value))}
              />
              <button
                disabled={!token || roundState !== "BETTING"}
                onClick={() => wsRef.current?.sendBet(betAmount)}
              >
                Bet
              </button>
            </div>
            <div className="message">{message}</div>
          </section>

          <div className="grid">
            <section className="subpanel">
              <div className="subhead">
                <h3>Paytable</h3>
                <span className="hint">Higher tiers win more often now</span>
              </div>
              <div className="paytable">
                {paytable.map((p) => (
                  <div key={p.key} className="pay-row">
                    <span className="symbol">{p.icon}</span>
                    <span className="label">{p.key}</span>
                    <span className="multiplier">
                      3 of a kind x{p.multiplier}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="subpanel">
              <div className="subhead">
                <h3>Shop</h3>
                <span className="hint">Spend winnings on perks</span>
              </div>
              <div className="shop-list">
                {items.map((item) => (
                  <div key={item.id} className="shop-item">
                    <div>
                      <div className="label">{item.name}</div>
                      <div className="small">{item.description}</div>
                    </div>
                    <div className="price-block">
                      <div className="price">{item.price} cr</div>
                      <button
                        disabled={!token}
                        onClick={() => buyItem(item.id)}
                      >
                        Buy
                      </button>
                    </div>
                  </div>
                ))}
                {shopMessage && <div className="message">{shopMessage}</div>}
              </div>
              <div className="inventory">
                <h4>Your inventory</h4>
                {inventory.length === 0 ? (
                  <div className="small">No purchases yet.</div>
                ) : (
                  <ul>
                    {inventory.map((i) => (
                      <li key={i.id}>
                        <span className="label">{i.name}</span>
                        <span className="pill">x{i.quantity}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          {isAdmin && (
            <section className="subpanel admin">
              <div className="subhead">
                <h3>Admin Credits</h3>
                <span className="hint">Only admins can mint chips</span>
              </div>
              <div className="admin-form">
                <select
                  value={creditUserId ?? ""}
                  onChange={(e) =>
                    setCreditUserId(
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                >
                  <option value="">Select a user</option>
                  {adminUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username} ({u.balance} cr)
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Or type username"
                  value={creditUsername}
                  onChange={(e) => setCreditUsername(e.target.value)}
                />
                <div className="split">
                  <input
                    type="number"
                    min={1}
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(Number(e.target.value))}
                  />
                  <input
                    placeholder="Reason"
                    value={creditReason}
                    onChange={(e) => setCreditReason(e.target.value)}
                  />
                  <button onClick={sendCredit}>Credit balance</button>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
