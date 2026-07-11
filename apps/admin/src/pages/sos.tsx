import { useEffect, useState } from 'react';
import { api, fmtTime } from '../lib/api';
import { useLiveData } from '../lib/useLiveData';
import { useModals } from '../lib/ModalContext';

export default function SosConsole() {
  const { prompt: modalPrompt, alert: modalAlert } = useModals();
  const [events, setEvents] = useState<any[]>([]);
  const [filter, setFilter] = useState('OPEN');

  const load = () => api<{ events: any[] }>(`/v1/safety/sos?status=${filter}`).then(r => setEvents(r.events));
  
  useLiveData(load);

  useEffect(() => { 
    load(); 
  }, [filter]);

  async function ack(id: string) { 
    await api(`/v1/safety/sos/${id}/ack`, { method: 'POST' }); 
    load(); 
  }

  async function resolve(id: string) {
    const resolution = await modalPrompt('Resolution note (mandatory):');
    if (!resolution) return;
    await api(`/v1/safety/sos/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution }) })
      .then(load)
      .catch(async e => await modalAlert(e.message));
  }

  return (
    <div>
      <h1>SOS Console</h1>
      <div className="row">
        {['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ALL'].map(s => (
          <button key={s} className={filter === s ? '' : 'ghost'} onClick={() => setFilter(s)}>{s}</button>
        ))}
      </div>
      <div className="tableWrap">
        <table>
          <thead><tr><th>At</th><th>Raised by</th><th>Worker</th><th>Booking</th><th>Status</th><th>Resolution</th><th /></tr></thead>
          <tbody>
            {events.map(e => (
              <tr key={e.id}>
                <td className="muted">{fmtTime(e.createdAt)}</td>
                <td>{e.raisedBy}</td>
                <td>{e.worker?.user?.name ?? '—'}</td>
                <td>{e.bookingId ? e.bookingId.slice(-6) : '—'}</td>
                <td><span className={`badge ${e.status}`}>{e.status}</span></td>
                <td className="muted">{e.resolution ?? ''}</td>
                <td>
                  <div className="row" style={{ marginBottom: 0 }}>
                    {e.status === 'OPEN' && <button onClick={() => ack(e.id)}>Acknowledge</button>}
                    {e.status !== 'RESOLVED' && <button className="ghost" onClick={() => resolve(e.id)}>Resolve</button>}
                  </div>
                </td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan={7} className="muted">Nothing here 🎉</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
