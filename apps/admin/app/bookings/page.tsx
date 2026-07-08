'use client';
import { useEffect, useState } from 'react';
import { api, rupees, fmtTime } from '../../lib/api';

const STATUSES = ['', 'SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'RATED', 'NO_EXPERT_FOUND', 'CANCELLED_CUSTOMER', 'CANCELLED_ADMIN'];

export default function Bookings() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    api<{ bookings: any[] }>(`/v1/admin/bookings?take=100${status ? `&status=${status}` : ''}`)
      .then(r => setBookings(r.bookings));
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
              <tr key={b.id} className="click" onClick={() => (window.location.href = `/bookings/${b.id}`)}>
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
