import { useEffect, useState } from 'react';
import { api, fmtTime } from '../lib/api';
import { useLiveData } from '../lib/useLiveData';

export default function Support() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [status, setStatus] = useState('OPEN');
  const [open, setOpen] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  const load = () => api<{ tickets: any[] }>(`/v1/support/admin/tickets?status=${status}`).then(r => setTickets(r.tickets));
  
  useLiveData(load);

  useEffect(() => { 
    load(); 
  }, [status]);

  async function send(id: string, newStatus?: string) {
    if (!reply && !newStatus) return;
    await api(`/v1/support/admin/tickets/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ body: reply || `Status → ${newStatus}`, status: newStatus }),
    });
    setReply('');
    load();
  }

  return (
    <div>
      <h1>Support Console</h1>
      <div className="row">
        {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ALL'].map(s => (
          <button key={s} className={status === s ? '' : 'ghost'} onClick={() => setStatus(s)}>{s}</button>
        ))}
      </div>
      {tickets.map(t => (
        <div key={t.id} className="card" style={{ marginBottom: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <b>{t.subject}</b>
            <span className={`badge ${t.status}`}>{t.status}</span>
          </div>
          <div className="muted">{t.user.role} · {t.user.name ?? t.user.phone} {t.bookingId && `· booking ${t.bookingId.slice(-6)}`} · {fmtTime(t.createdAt)}</div>
          <button className="ghost" style={{ marginTop: 8 }} onClick={() => setOpen(open === t.id ? null : t.id)}>
            {open === t.id ? 'Hide' : `Thread (${t.messages.length})`}
          </button>
          {open === t.id && (
            <div className="stack" style={{ marginTop: 10 }}>
              {t.messages.map((m: any) => (
                <div key={m.id} className="muted"><b>{m.author.startsWith('admin') ? 'Agent' : 'User'}:</b> {m.body}</div>
              ))}
              <textarea rows={2} placeholder="Reply…" value={reply} onChange={e => setReply(e.target.value)} />
              <div className="row" style={{ marginBottom: 0 }}>
                <button onClick={() => send(t.id)}>Reply</button>
                <button className="ghost" onClick={() => send(t.id, 'RESOLVED')}>Resolve</button>
              </div>
            </div>
          )}
        </div>
      ))}
      {tickets.length === 0 && <div className="muted">No tickets</div>}
    </div>
  );
}
