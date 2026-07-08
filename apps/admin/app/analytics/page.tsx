'use client';
import { useEffect, useState } from 'react';
import { api, rupees } from '../../lib/api';

export default function Analytics() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api<any>('/v1/admin/analytics').then(setData); }, []);
  if (!data) return <div className="muted">Loading…</div>;

  const days = Object.keys(data.byDay).sort();
  const max = Math.max(1, ...days.map(d => data.byDay[d].count));
  const totalGmv = days.reduce((s, d) => s + data.byDay[d].gmvPaise, 0);
  const totalBookings = days.reduce((s, d) => s + data.byDay[d].count, 0);

  return (
    <div>
      <h1>Analytics (30 days)</h1>
      <div className="cards">
        <div className="card"><div className="label">Bookings</div><div className="value">{totalBookings}</div></div>
        <div className="card"><div className="label">GMV</div><div className="value">{rupees(totalGmv)}</div></div>
        <div className="card"><div className="label">Fill rate</div><div className={`value ${data.fillRatePct < 90 ? 'warn' : 'good'}`}>{data.fillRatePct}%</div></div>
        <div className="card"><div className="label">Repeat customers</div><div className="value">{data.repeatCustomers}</div></div>
      </div>

      <h2>Bookings per day</h2>
      <div className="card">
        <div className="bar">
          {days.map(d => (
            <div key={d} title={`${d}: ${data.byDay[d].count} bookings, ${rupees(data.byDay[d].gmvPaise)}`}
              style={{ height: `${(data.byDay[d].count / max) * 100}%` }} />
          ))}
        </div>
        {days.length === 0 && <div className="muted">No bookings yet</div>}
      </div>

      <div className="split" style={{ marginTop: 16 }}>
        <div>
          <h2>Ratings distribution</h2>
          <div className="tableWrap"><table><tbody>
            {[5, 4, 3, 2, 1].map(s => {
              const row = data.ratings.find((r: any) => r.stars === s);
              return <tr key={s}><td>{'★'.repeat(s)}</td><td>{row?._count ?? 0}</td></tr>;
            })}
          </tbody></table></div>
        </div>
        <div>
          <h2>Cancellations</h2>
          <div className="tableWrap"><table><tbody>
            {data.cancellations.map((c: any) => (
              <tr key={c.toStatus}><td>{c.toStatus}</td><td>{c._count}</td></tr>
            ))}
            {data.cancellations.length === 0 && <tr><td className="muted">None</td></tr>}
          </tbody></table></div>
        </div>
      </div>
    </div>
  );
}
