import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, rupees, fmtTime } from '../../lib/api';
import { useModals } from '../../lib/ModalContext';
import { Button } from '../../components/Button';

export default function Worker360() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { confirm: modalConfirm, prompt: modalPrompt, alert: modalAlert } = useModals();
  const [w, setW] = useState<any>(null);
  const [hubs, setHubs] = useState<any[]>([]);

  const load = () => api<{ worker: any }>(`/v1/admin/workers/${id}`).then(r => setW(r.worker));

  useEffect(() => {
    load();
    api<{ cities: any[] }>('/v1/admin/cities')
      .then(r => setHubs(r.cities.flatMap(c => c.hubs.map((h: any) => ({ ...h, cityName: c.name })))))
      .catch(() => {});
  }, [id]);

  if (!w) return <div className="muted">Loading…</div>;

  async function assignHub(hubId: string) {
    if (!hubId) return;
    await api(`/v1/admin/workers/${id}/status`, { method: 'POST', body: JSON.stringify({ hubId }) })
      .then(load).catch(async e => await modalAlert(e.message));
  }

  async function kyc(docId: string, approve: boolean) {
    const reason = approve ? undefined : (await modalPrompt('Rejection reason:')) ?? undefined;
    if (!approve && reason === undefined) return; // user cancelled prompt
    await api(`/v1/admin/workers/${id}/kyc/${docId}`, { method: 'POST', body: JSON.stringify({ approve, reason }) });
    load();
  }

  async function setStatus(status: string) {
    const confirmed = await modalConfirm(`Set worker to ${status}?`);
    if (!confirmed) return;
    await api(`/v1/admin/workers/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
    load();
  }

  return (
    <div>
      <h1>{w.user.name ?? w.user.phone} <span className={`badge ${w.status}`}>{w.status}</span> <span className={`badge ${w.duty}`}>{w.duty}</span></h1>
      <div className="row">
        {w.status !== 'ACTIVE' && <Button onClick={() => setStatus('ACTIVE')}>Activate</Button>}
        {w.status === 'ACTIVE' && <Button className="danger" onClick={() => setStatus('SUSPENDED')}>Suspend</Button>}
        {w.status === 'SUSPENDED' && <Button className="danger" onClick={() => setStatus('TERMINATED')}>Terminate</Button>}
        <Button className="ghost" onClick={() => setStatus('TRAINING')}>Force retraining</Button>
        <select
          style={{ width: 220 }}
          value={w.hubId ?? ''}
          onChange={e => assignHub(e.target.value)}>
          <option value="" disabled>{w.hub ? `Hub: ${w.hub.name}` : 'Assign hub…'}</option>
          {hubs.map(h => (
            <option key={h.id} value={h.id}>{h.name} · {h.cityName}</option>
          ))}
        </select>
      </div>

      <div className="split">
        <div>
          <div className="card stack">
            <div><b>Phone:</b> {w.user.phone} · <b>Hub:</b> {w.hub?.name ?? '—'}</div>
            <div><b>Skills:</b> {w.skills.join(', ') || '—'} · <b>Languages:</b> {w.languages.join(', ') || '—'}</div>
            <div><b>Rating:</b> ⭐ {w.rating.toFixed(2)} ({w.ratingCount}) · <b>Jobs:</b> {w.jobsDone} · <b>Strikes:</b> {w.strikes}</div>
            <div><b>Bank:</b> {w.bankAccount ?? '—'} {w.bankIfsc ?? ''} · <b>UPI:</b> {w.upiId ?? '—'}</div>
          </div>

          <h2>KYC documents</h2>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Type</th><th>Ref</th><th>Status</th><th /></tr></thead>
              <tbody>
                {w.kycDocs.map((d: any) => (
                  <tr key={d.id}>
                    <td>{d.docType}</td><td>{d.docRef}</td>
                    <td><span className={`badge ${d.status}`}>{d.status}</span> {d.reason && <span className="muted">{d.reason}</span>}</td>
                    <td>
                      {d.status === 'SUBMITTED' && (
                        <div className="row" style={{ marginBottom: 0 }}>
                          <Button onClick={() => kyc(d.id, true)}>Approve</Button>
                          <Button className="danger" onClick={() => kyc(d.id, false)}>Reject</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Recent bookings</h2>
          <div className="tableWrap">
            <table>
              <thead><tr><th>ID</th><th>Status</th><th>Tasks</th><th>At</th></tr></thead>
              <tbody>
                {w.bookings.map((b: any) => (
                  <tr key={b.id} className="click" onClick={() => navigate(`/bookings/${b.id}`)}>
                    <td>{b.id.slice(-6)}</td><td><span className={`badge ${b.status}`}>{b.status}</span></td>
                    <td>{b.tasks.join(', ')}</td><td className="muted">{fmtTime(b.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 style={{ marginTop: 0 }}>Training</h2>
          {w.trainings.map((t: any) => (
            <div className="card" key={t.id} style={{ marginBottom: 8 }}>
              {t.module.title} — {t.passed ? `✅ ${t.scorePct}%` : `❌ ${t.scorePct ?? '—'}%`}
            </div>
          ))}
          <h2>Recent earnings</h2>
          {w.earnings.map((e: any) => (
            <div className="card" key={e.id} style={{ marginBottom: 8 }}>
              {rupees(e.totalPaise)} <span className="muted">(base {rupees(e.basePaise)} + inc {rupees(e.incentivePaise)} + tip {rupees(e.tipPaise)})</span>
            </div>
          ))}
          <h2>Attendance (14d)</h2>
          {w.attendance.map((a: any) => (
            <div className="muted" key={a.id}>{fmtTime(a.checkinAt)} → {a.checkoutAt ? fmtTime(a.checkoutAt) : 'on duty'}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
