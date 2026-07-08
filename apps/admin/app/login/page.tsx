'use client';
import { useState } from 'react';
import { Zap } from 'lucide-react';
import { api } from '../../lib/api';

export default function Login() {
  const [email, setEmail] = useState('admin@pronto.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api<{ token: string; admin: unknown }>('/v1/auth/admin/login', {
        method: 'POST', body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('admin_token', r.token);
      localStorage.setItem('admin_user', JSON.stringify(r.admin));
      window.location.href = '/';
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form className="loginBox stack" onSubmit={submit}>
      <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Zap size={20} /> Pronto Ops</h1>
      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      {error && <div style={{ color: 'var(--red)' }}>{error}</div>}
      <button style={{ width: '100%' }}>Sign in</button>
      <div className="muted">Seeded: admin@pronto.local / admin123</div>
    </form>
  );
}
