import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, rupees, fmtTime } from '../lib/api';
import { useModals } from '../lib/ModalContext';
import { Button } from '../components/Button';

export default function Customer360() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { prompt: modalPrompt } = useModals();
  const [data, setData] = useState<any>(null);

  const load = () => api<any>(`/v1/admin/customers/${id}`).then(setData);

  useEffect(() => { 
    load(); 
  }, [id]);

  if (!data) return <div className="muted">Loading…</div>;
  const c = data.customer;

  const flag = (body: object) =>
    api(`/v1/admin/customers/${id}/flags`, { method: 'POST', body: JSON.stringify(body) }).then(load);

  async function credit() {
    const amt = await modalPrompt('Credit amount ₹:');
    if (amt) await flag({ creditPaise: Math.round(Number(amt) * 100) });
  }

  return (
    <div>
      <h1>{c.name ?? c.phone} {c.banned && <span className="badge SUSPENDED">BANNED</span>}</h1>
      <div className="cards">
        <div className="card"><div className="label">Lifetime value</div><div className="value">{rupees(data.ltvPaise)}</div></div>
        <div className="card"><div className="label">Bookings</div><div className="value">{c.bookings.length}</div></div>
        <div className="card"><div className="label">Credits</div><div className="value">{rupees(c.creditsPaise)}</div></div>
      </div>
      <div className="row">
        <Button className="ghost" onClick={credit}>Issue credit</Button>
        <Button className={c.banned ? 'ghost' : 'danger'} onClick={() => flag({ banned: !c.banned })}>{c.banned ? 'Unban' : 'Ban'}</Button>
        <Button className="ghost" onClick={() => flag({ fraudFlag: !c.fraudFlag })}>{c.fraudFlag ? 'Clear fraud flag' : 'Flag fraud'}</Button>
      </div>
      <h2>Bookings</h2>
      <div className="tableWrap">
        <table>
          <thead><tr><th>ID</th><th>Status</th><th>Tasks</th><th>Zone</th><th>Total</th><th>At</th></tr></thead>
          <tbody>
            {c.bookings.map((b: any) => (
              <tr key={b.id} className="click" onClick={() => navigate(`/bookings/${b.id}`)}>
                <td>{b.id.slice(-6)}</td><td><span className={`badge ${b.status}`}>{b.status}</span></td>
                <td>{b.tasks.join(', ')}</td><td>{b.zone.name}</td><td>{rupees(b.totalPaise)}</td>
                <td className="muted">{fmtTime(b.createdAt)}</td>
              </tr>
            ))}
            {c.bookings.length === 0 && <tr><td colSpan={6} className="muted">No bookings found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
