import { useEffect, useMemo, useState } from 'react';
import { login, register } from './api';
import { connect, WsEvent } from './ws';

type User = { id: number; username: string; balance: number; avatarUrl?: string };

const reelsArt = [
  ['🍒', '🔔', '7️⃣', '🍋', '⭐', '💎'],
  ['🔔', '🍋', '🍒', '⭐', '💎', '7️⃣'],
  ['🍋', '7️⃣', '⭐', '🍒', '🔔', '💎']
];

export default function App() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [online, setOnline] = useState<User[]>([]);
  const [roundState, setRoundState] = useState<string>('IDLE');
  const [reels, setReels] = useState(['❔', '❔', '❔']);
  const [spinning, setSpinning] = useState(false);
  const [message, setMessage] = useState('');
  const [betAmount, setBetAmount] = useState(50);

  const ws = useMemo(() => {
    if (!token) return null;
    return connect(token, handleEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function handleEvent(ev: WsEvent) {
    if (ev.type === 'WELCOME') {
      setMe(ev.user);
    } else if (ev.type === 'ONLINE_USERS') {
      setOnline(ev.users);
    } else if (ev.type === 'ROUND_STATE') {
      setRoundState(ev.state);
      if (ev.state === 'SPINNING') {
        setSpinning(true);
        setMessage('Spinning...');
      } else if (ev.state === 'BETTING') {
        setMessage('Place your bets');
      }
    } else if (ev.type === 'ROUND_RESULT') {
      setSpinning(false);
      setReels(ev.result.reels);
      setMessage(ev.result.lineWin ? 'Jackpot!' : 'No win');
    } else if (ev.type === 'BET_PLACED') {
      if (me && me.id === ev.user.id) setMe({ ...me, balance: ev.user.balance });
    } else if (ev.type === 'ERROR') {
      setMessage(ev.message);
    }
  }

  useEffect(() => {
    return () => {
      ws?.close();
    };
  }, [ws]);

  async function submitAuth() {
    try {
      const fn = mode === 'login' ? login : register;
      const res = await fn(username, password);
      setToken(res.token);
      setMe(res.user);
      localStorage.setItem('token', res.token);
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (stored) setToken(stored);
  }, []);

  const reelsDisplay = spinning
    ? reelsArt.map((col) => col.join(' '))
    : reels.join('  ');

  return (
    <div className="page">
      <div className="layout">
        <aside className="panel">
          <h2>Players Online</h2>
          <ul>
            {online.map((u) => (
              <li key={u.id}>
                <span className="avatar">{u.avatarUrl || '🎲'}</span>
                <div>
                  <div className="name">{u.username}</div>
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
              <p>Server-controlled finite state machine demo</p>
            </div>
            <div className="auth">
              {!token ? (
                <div className="auth-form">
                  <div className="tabs">
                    <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
                      Login
                    </button>
                    <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
                      Register
                    </button>
                  </div>
                  <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                  <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button onClick={submitAuth}>{mode === 'login' ? 'Login' : 'Register'}</button>
                </div>
              ) : (
                <div className="me">
                  <div className="name">{me?.username}</div>
                  <div className="balance">{me?.balance} cr</div>
                  <button onClick={() => setToken(null)}>Logout</button>
                </div>
              )}
            </div>
          </header>

          <section className="slot">
            <div className="status">{roundState}</div>
            <div className={`reels ${spinning ? 'spinning' : ''}`}>
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
              <input type="number" min={10} step={10} value={betAmount} onChange={(e) => setBetAmount(Number(e.target.value))} />
              <button disabled={!token || roundState !== 'BETTING'} onClick={() => ws?.sendBet(betAmount)}>
                Bet
              </button>
            </div>
            <div className="message">{message}</div>
          </section>
        </main>
      </div>
    </div>
  );
}

