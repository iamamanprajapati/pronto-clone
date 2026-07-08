'use client';
import { useEffect, useState } from 'react';
import { api, fmtTime } from '../../lib/api';

export default function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() =>
      api<{ customers: any[] }>(`/v1/admin/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(r => setCustomers(r.customers)),
    300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <h1>Customers</h1>
      <div className="row"><input style={{ width: 300 }} placeholder="Search name or phone…" value={q} onChange={e => setQ(e.target.value)} /></div>
      <div className="tableWrap">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Bookings</th><th>Flags</th><th>Joined</th></tr></thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id} className="click" onClick={() => (window.location.href = `/customers/${c.id}`)}>
                <td>{c.name ?? '—'}</td><td>{c.phone}</td><td>{c._count.bookings}</td>
                <td>{c.banned && <span className="badge SUSPENDED">BANNED</span>} {c.fraudFlag && <span className="badge NO_EXPERT_FOUND">FRAUD</span>}</td>
                <td className="muted">{fmtTime(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
