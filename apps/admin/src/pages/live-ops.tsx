import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { api, API, token, rupees, fmtTime } from '../lib/api';
import { LiveMap, type MapWorker } from '../components/LiveMap';
import { useModals } from '../lib/ModalContext';
import { Button } from '../components/Button';

interface Overview {
  activeBookings: number; idleWorkers: number; openSos: number; unassignedLastHour: number;
  todayBookings: number; todayCompleted: number; todayGmvPaise: number;
}

// Persisted cache across page navigations (component unmounts/remounts)
let cachedOverview: Overview | null = null;
let cachedBookings: any[] = [];
let cachedWorkers: MapWorker[] = [];
let cachedAlerts: any[] = [];

export default function LiveOps() {
  const navigate = useNavigate();
  const { prompt } = useModals();
  const [overview, setOverview] = useState<Overview | null>(cachedOverview);
  const [bookings, setBookings] = useState<any[]>(cachedBookings);
  const [workers, setWorkers] = useState<MapWorker[]>(cachedWorkers);
  const [alerts, setAlerts] = useState<any[]>(cachedAlerts);

  async function refresh() {
    try {
      const [o, b] = await Promise.all([
        api<Overview>('/v1/admin/ops/overview'),
        api<{ bookings: any[] }>('/v1/admin/ops/active-bookings'),
      ]);
      cachedOverview = o;
      cachedBookings = b.bookings;
      setOverview(o);
      setBookings(b.bookings);
    } catch { /* API middleware handles 401 redirect */ }
  }

  useEffect(() => {
    if (!token()) { navigate('/login'); return; }
    refresh();
    const poll = setInterval(refresh, 10_000);

    let socket: Socket | undefined;
    api<{ cities: Array<{ id: string }> }>('/v1/admin/cities').then(({ cities }) => {
      socket = io(API, { auth: { token: token() } });
      socket.on('connect', () => {
        cities.forEach(c => socket!.emit('subscribe', `admin:${c.id}:firehose`));
      });
      socket.on('zone.snapshot', (snap: { workers: MapWorker[] }) => {
        cachedWorkers = snap.workers;
        setWorkers(snap.workers);
      });
      socket.on('sos.alert', (a: unknown) => {
        const nextAlerts = [a, ...cachedAlerts].slice(0, 20);
        cachedAlerts = nextAlerts;
        setAlerts(nextAlerts);
      });
      socket.on('admin.event', () => refresh());
    });
    return () => {
      clearInterval(poll);
      socket?.disconnect();
      cachedWorkers = [];
    };
  }, [navigate]);

  async function reassign(id: string) {
    await api(`/v1/admin/ops/bookings/${id}/reassign`, { method: 'POST' });
    refresh();
  }

  async function cancel(id: string) {
    const reason = await prompt('Cancellation reason (required):');
    if (!reason) return;
    await api(`/v1/admin/ops/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) });
    refresh();
  }

  return (
    <div>
      <h1>Live Ops</h1>
      {overview && (
        <div className="cards">
          <div className="card"><div className="label">Active bookings</div><div className="value">{overview.activeBookings}</div></div>
          <div className="card"><div className="label">Idle experts</div><div className="value good">{overview.idleWorkers}</div></div>
          <div className="card"><div className="label">Open SOS</div><div className={`value ${overview.openSos ? 'bad' : ''}`}>{overview.openSos}</div></div>
          <div className="card"><div className="label">Unassigned (1h)</div><div className={`value ${overview.unassignedLastHour ? 'warn' : ''}`}>{overview.unassignedLastHour}</div></div>
          <div className="card"><div className="label">Bookings today</div><div className="value">{overview.todayBookings}</div></div>
          <div className="card"><div className="label">GMV today</div><div className="value">{rupees(overview.todayGmvPaise)}</div></div>
        </div>
      )}

      <div className="split">
        <div>
          <LiveMap workers={workers} center={[12.9116, 77.6389]} />
          <h2>Active bookings</h2>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Booking</th><th>Status</th><th>Customer</th><th>Expert</th><th>Zone</th><th>Created</th><th /></tr></thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id} className="click" onClick={() => navigate(`/bookings/${b.id}`)}>
                    <td>{b.id.slice(-6)} · {b.tasks.join(', ')}</td>
                    <td><span className={`badge ${b.status}`}>{b.status}</span></td>
                    <td>{b.customer?.name ?? b.customer?.phone}</td>
                    <td>{b.worker?.user?.name ?? '—'}</td>
                    <td>{b.zone?.name}</td>
                    <td className="muted">{fmtTime(b.createdAt)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="row" style={{ marginBottom: 0 }}>
                        <Button className="ghost" onClick={() => reassign(b.id)}>Reassign</Button>
                        <Button className="danger" onClick={() => cancel(b.id)}>Cancel</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && <tr><td colSpan={7} className="muted">No active bookings</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 style={{ marginTop: 0 }}>Live alerts</h2>
          {alerts.length === 0 && <div className="muted">No alerts this session</div>}
          {alerts.map((a, i) => (
            <div key={i} className="alertItem">
              <b>SOS · {a.raisedBy}</b> {a.workerName && <span>— {a.workerName}</span>}
              <div className="muted">{a.bookingId ? `booking ${a.bookingId.slice(-6)}` : 'no booking'} · {fmtTime(a.at)}</div>
              <Button className="btn" style={{ display: 'inline-block', marginTop: 6 }} onClick={() => navigate('/sos')}>Open SOS console</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
