import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, rupees, fmtTime } from '../lib/api';
import { useLiveData } from '../lib/useLiveData';

const STATUSES = ['', 'SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'RATED', 'NO_EXPERT_FOUND', 'CANCELLED_CUSTOMER', 'CANCELLED_ADMIN'];

let cachedBookings: any[] = [];

export default function Bookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>(cachedBookings);
  const [status, setStatus] = useState('');

  const load = () =>
    api<{ bookings: any[] }>(`/v1/admin/bookings?take=100${status ? `&status=${status}` : ''}`)
      .then(r => {
        cachedBookings = r.bookings;
        setBookings(r.bookings);
      });
      
  useLiveData(load);

  useEffect(() => { 
    load(); 
  }, [status]);

  return (
    <div>
      <h1>Bookings</h1>
      <div className="row">
        <select style={{ width: 240 }} value={status} onChange={e => setStatus(e.target.value)}>
          {STATUSES.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
      </div>
      <div className="tableWrap">
        <table>
          <thead><tr><th>ID</th><th>Status</th><th>Tasks</th><th>Duration</th><th>Customer</th><th>Expert</th><th>Zone</th><th>Total</th><th>Created</th></tr></thead>
          <tbody>
            {bookings.map(b => (
              <tr key={b.id} className="click" onClick={() => navigate(`/bookings/${b.id}`)}>
                <td>{b.id.slice(-6)}</td>
                <td><span className={`badge ${b.status}`}>{b.status}</span></td>
                <td>{b.tasks.join(', ')}</td>
                <td>{b.durationMin}m</td>
                <td>{b.customer?.name ?? b.customer?.phone}</td>
                <td>{b.worker?.user?.name ?? '—'}</td>
                <td>{b.zone?.name}</td>
                <td>{rupees(b.totalPaise)}</td>
                <td className="muted">{fmtTime(b.createdAt)}</td>
              </tr>
            ))}
            {bookings.length === 0 && <tr><td colSpan={9} className="muted">No bookings found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
