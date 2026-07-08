'use client';
import { useEffect, useState } from 'react';
import { api, rupees, fmtTime } from '../../../lib/api';

export default function Payouts() {
  const [runs, setRuns] = useState<any[]>([]);
  const load = () => api<{ runs: any[] }>('/v1/earnings/payout-runs').then(r => setRuns(r.runs)).catch(e => alert(e.message));
  useEffect(() => { load(); }, []);

  async function createRun() {
    const cycleLabel = prompt('Cycle label (e.g. "Week 28 · Jul 6–12"):');
    if (!cycleLabel) return;
    await api('/v1/earnings/payout-runs', { method: 'POST', body: JSON.stringify({ cycleLabel }) }).then(load).catch(e => alert(e.message));
  }
  const act = (id: string, action: string) =>
    api(`/v1/earnings/payout-runs/${id}/${action}`, { method: 'POST' }).then(load).catch(e => alert(e.message));

  return (
    <div>
      <h1>Payout Runs</h1>
      <div className="row"><button onClick={createRun}>Create run from unpaid earnings</button></div>
      <div className="muted" style={{ marginBottom: 10 }}>
        Maker-checker: the admin who creates a run cannot approve it. Disburse triggers the payout rail (RazorpayX in production).
      </div>
      <div className="tableWrap">
        <table>
          <thead><tr><th>Cycle</th><th>Status</th><th>Total</th><th>Earnings</th><th>Created</th><th /></tr></thead>
          <tbody>
            {runs.map(r => (
              <tr key={r.id}>
                <td>{r.cycleLabel}</td>
                <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                <td>{rupees(r.totalPaise)}</td>
                <td>{r._count.earnings}</td>
                <td className="muted">{fmtTime(r.createdAt)}</td>
                <td><div className="row" style={{ marginBottom: 0 }}>
                  {r.status === 'DRAFT' && <button onClick={() => act(r.id, 'approve')}>Approve</button>}
                  {r.status === 'APPROVED' && <button onClick={() => act(r.id, 'disburse')}>Disburse</button>}
                </div></td>
              </tr>
            ))}
            {runs.length === 0 && <tr><td colSpan={6} className="muted">No payout runs yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
