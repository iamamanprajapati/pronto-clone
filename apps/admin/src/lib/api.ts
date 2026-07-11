// TODO(security): Storing sensitive authentication tokens in localStorage is vulnerable to XSS theft.
// In production, rely on secure, HttpOnly, Secure, and SameSite cookies for authentication.
export const API = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:4000';

export function token(): string | null {
  return typeof window === 'undefined' ? null : localStorage.getItem('admin_token');
}

export function admin(): { id: string; name: string; role: string; cityId: string | null } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('admin_user');
  return raw ? JSON.parse(raw) : null;
}

export async function api<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  let url = `${API}${path}`;
  if (method.toUpperCase() === 'GET') {
    const buster = `_cb=${Date.now()}`;
    url += (url.includes('?') ? '&' : '?') + buster;
  }

  const res = await fetch(url, {
    cache: 'no-store', // never serve a stale GET after a mutation
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...opts.headers,
    },
  });
  if (res.status === 401 && typeof window !== 'undefined' && !path.includes('/login')) {
    localStorage.removeItem('admin_token');
    window.location.href = '/login';
  }
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

export const rupees = (paise: number) => `₹${(paise / 100).toFixed(paise % 100 ? 2 : 0)}`;
export const fmtTime = (iso: string | Date) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
