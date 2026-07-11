import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, rupees, fmtTime } from '../lib/api';
import { useModals } from '../lib/ModalContext';

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const { prompt: modalPrompt, alert: modalAlert } = useModals();
  const [b, setB] = useState<any>(null);

  const load = () => api<{ booking: any }>(`/v1/admin/bookings/${id}`).then(r => setB(r.booking));
  
  useEffect(() => { 
    load(); 
  }, [id]);

  if (!b) return <div className="muted">Loading…</div>;

  async function refund() {
    const amt = await modalPrompt('Refund amount in ₹:');
    if (!amt) return;
    const reason = await modalPrompt('Reason:');
    if (!reason) return;
    await api(`/v1/admin/bookings/${id}/refund`, {
      method: 'POST', body: JSON.stringify({ amountPaise: Math.round(Number(amt) * 100), reason }),
    }).then(load).catch(async e => await modalAlert(e.message));
  }

  return (
    <div>
      <h1>Booking {b.id.slice(-6)} <span className={`badge ${b.status}`}>{b.status}</span></h1>
      <div className="split">
        <div>
          <div className="card stack">
            <div><b>Tasks:</b> {b.tasks.join(', ')} · {b.durationMin} min</div>
            <div><b>Customer:</b> {b.customer.name} ({b.customer.phone})</div>
            <div><b>Expert:</b> {b.worker ? `${b.worker.user.name} (${b.worker.user.phone})` : '—'}</div>
            <div><b>Address:</b> {b.address.flat}, {b.address.landmark} · {b.zone.name}</div>
            <div><b>Instructions:</b> {b.instructions ?? '—'}</div>
            <div><b>Bill:</b> base {rupees(b.basePaise)} + ext {rupees(b.extensionPaise)} − disc {rupees(b.discountPaise)} + tip {rupees(b.tipPaise)} = <b>{rupees(b.totalPaise)}</b></div>
            <div className="row"><button className="ghost" onClick={refund}>Issue refund</button></div>
          </div>

          <h2>Timeline (audit)</h2>
          <div className="tableWrap">
            <table>
              <thead><tr><th>At</th><th>Transition</th><th>Actor</th><th>Meta</th></tr></thead>
              <tbody>
                {b.events.map((e: any) => (
                  <tr key={e.id}>
                    <td className="muted">{fmtTime(e.at)}</td>
                    <td>{e.fromStatus} → <b>{e.toStatus}</b></td>
                    <td>{e.actor}</td>
                    <td className="muted">{e.meta ? JSON.stringify(e.meta) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 style={{ marginTop: 0 }}>Offers</h2>
          {b.offers.map((o: any) => (
            <div className="card" key={o.id} style={{ marginBottom: 8 }}>
              <div>{o.worker.user.name} · round {o.round} · {o.distanceM}m</div>
              <div className="muted">{o.response} {o.reason ? `(${o.reason})` : ''} · payout {rupees(o.payoutPaise)}</div>
            </div>
          ))}
          <h2>Payments</h2>
          {b.payments.map((p: any) => (
            <div className="card" key={p.id} style={{ marginBottom: 8 }}>
              <div>{p.purpose} · {rupees(p.amountPaise)} <span className={`badge ${p.status}`}>{p.status}</span></div>
              {p.refundPaise > 0 && <div className="muted">refunded {rupees(p.refundPaise)}</div>}
            </div>
          ))}
          <h2>Ratings</h2>
          {b.ratings.map((r: any) => (
            <div className="card" key={r.id}>{'★'.repeat(r.stars)} {r.tags.join(', ')} {r.comment && <div className="muted">{r.comment}</div>}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
