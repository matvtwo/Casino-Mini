const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function handle(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText || 'Request failed';
    try {
      const data = JSON.parse(text);
      if (data?.message) message = data.message;
    } catch {
      // ignore parse errors and fall back to raw text
    }
    throw new Error(message);
  }
  return res.json();
}

export async function register(
  username: string,
  password: string,
  avatarUrl?: string,
  adminKey?: string
) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, avatarUrl, adminKey })
  });
  return handle(res);
}

export async function login(username: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return handle(res);
}

export async function me(token: string) {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handle(res);
}

export async function fetchPaytable() {
  const res = await fetch(`${API_URL}/game/paytable`);
  return handle(res);
}

export async function listItems() {
  const res = await fetch(`${API_URL}/shop/items`);
  return handle(res);
}

export async function getInventory(token: string) {
  const res = await fetch(`${API_URL}/shop/inventory`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handle(res);
}

export async function purchaseItem(token: string, itemId: number) {
  const res = await fetch(`${API_URL}/shop/purchase`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ itemId })
  });
  return handle(res);
}

export async function adminListUsers(token: string) {
  const res = await fetch(`${API_URL}/admin/users`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return handle(res);
}

export async function adminCredit(
  token: string,
  payload: { userId?: number; username?: string; amount: number; reason?: string }
) {
  const res = await fetch(`${API_URL}/admin/credit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  return handle(res);
}
