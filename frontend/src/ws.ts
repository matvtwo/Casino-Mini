const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export type WsEvent =
  | { type: 'WELCOME'; user: any }
  | { type: 'ONLINE_USERS'; users: any[] }
  | { type: 'ROUND_STATE'; state: string; roundId: number }
  | { type: 'ROUND_RESULT'; roundId: number; result: any }
  | { type: 'BET_PLACED'; roundId: number; user: any; amount: number }
  | { type: 'BET_ACCEPTED'; betId: number }
  | { type: 'USER_BALANCE'; user: any }
  | { type: 'PAYOUT'; roundId: number; user: any; amount: number; multiplier: number; symbol?: string }
  | { type: 'ERROR'; message: string };

export function connect(token: string, onEvent: (ev: WsEvent) => void) {
  const socket = new WebSocket(`${WS_URL}?token=${token}`);
  socket.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);
      onEvent(data);
    } catch (err) {
      console.error('ws parse', err);
    }
  };
  return {
    sendBet: (amount: number) => socket.send(JSON.stringify({ type: 'PLACE_BET', amount })),
    close: () => socket.close()
  };
}
