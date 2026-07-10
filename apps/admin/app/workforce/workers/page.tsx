'use client';
import { useState } from 'react';
import { api } from '../../../lib/api';
import { useLiveData } from '../../../lib/useLiveData';

export default function Workers() {
  const [workers, setWorkers] = useState<any[]>([]);
  useLiveData(() => api<{ workers: any[] }>('/v1/admin/workers').then(r => setWorkers(r.workers)));

  return (
    <div>
      <h1>Workers</h1>
      <div className="tableWrap">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Status</th><th>Duty</th><th>Hub</th><th>Skills</th><th>Rating</th><th>Jobs</th><th>Strikes</th></tr></thead>
          <tbody>
            {workers.map(w => (
              <tr key={w.id} className="click" onClick={() => (window.location.href = `/workforce/workers/${w.id}`)}>
                <td>{w.user.name ?? '—'}</td>
                <td>{w.user.phone}</td>
                <td><span className={`badge ${w.status}`}>{w.status}</span></td>
                <td><span className={`badge ${w.duty}`}>{w.duty}</span></td>
                <td>{w.hub?.name ?? '—'}</td>
                <td>{w.skills.join(', ')}</td>
                <td>★ {w.rating.toFixed(1)}</td>
                <td>{w.jobsDone}</td>
                <td>{w.strikes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
