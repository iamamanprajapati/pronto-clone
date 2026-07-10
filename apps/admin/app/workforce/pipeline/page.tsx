'use client';
import { useState } from 'react';
import { api } from '../../../lib/api';
import { useLiveData } from '../../../lib/useLiveData';

const STAGES = ['NEW', 'UNDER_REVIEW', 'TRAINING', 'ACTIVE'] as const;

export default function Pipeline() {
  const [workers, setWorkers] = useState<any[]>([]);
  const load = () => api<{ workers: any[] }>('/v1/admin/workers').then(r => setWorkers(r.workers));
  useLiveData(load);

  return (
    <div>
      <h1>Onboarding Pipeline</h1>
      <div className="cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {STAGES.map(stage => (
          <div key={stage} className="card">
            <div className="label">{stage} ({workers.filter(w => w.status === stage).length})</div>
            <div className="stack" style={{ marginTop: 8 }}>
              {workers.filter(w => w.status === stage).map(w => (
                <a key={w.id} href={`/workforce/workers/${w.id}`} className="card" style={{ display: 'block', padding: 10 }}>
                  <b>{w.user.name ?? w.user.phone}</b>
                  <div className="muted">{w.skills.join(', ') || 'no skills yet'} · {w.hub?.name ?? 'no hub'}</div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
