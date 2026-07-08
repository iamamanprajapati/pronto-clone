'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, rupees, fmtTime } from '../../../../lib/api';

export default function Worker360() {
  const { id } = useParams<{ id: string }>();
  const [w, setW] = useState<any>(null);
  const load = () => api<{ worker: any }>(`/v1/admin/workers/${id}`).then(r => setW(r.worker));
  useEffect(() => { load(); }, [id]);
  if (!w) return <div className="muted">Loading…</div>;

  async function kyc(docId: string, approve: boolean) {
    const reason = approve ? undefined : prompt('Rejection reason:') ?? undefined;
    await api(`/v1/admin/workers/${id}/kyc/${docId}`, { method: 'POST', body: JSON.stringify({ approve, reason }) });
    load();
  }
  async function setStatus(status: string) {
    if (!confirm(`Set worker to ${status}?`)) return;
    await api(`/v1/admin/workers/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
    load();
  }

  return (
    <div>
      <h1>{w.user.name ?? w.user.phone} <span className={`badge ${w.status}`}>{w.status}</span> <span className={`badge ${w.duty}`}>{w.duty}</span></h1>
      <div className="row">
        {w.status !== 'ACTIVE' && <button onClick={() => setStatus('ACTIVE')}>Activate</button>}
        {w.status === 'ACTIVE' && <button className="danger" onClick={() => setStatus('SUSPENDED')}>Suspend</button>}
        {w.status === 'SUSPENDED' && <button className="danger" onClick={() => setStatus('TERMINATED')}>Terminate</button>}
        <button className="ghost" onClick={() => setStatus('TRAINING')}>Force retraining</button>
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
                          <button onClick={() => kyc(d.id, true)}>Approve</button>
                          <button className="danger" onClick={() => kyc(d.id, false)}>Reject</button>
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
                  <tr key={b.id} className="click" onClick={() => (window.location.href = `/bookings/${b.id}`)}>
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
