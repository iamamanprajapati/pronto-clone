'use client';
import { useState } from 'react';
import { api, fmtTime } from '../../../lib/api';
import { useLiveData } from '../../../lib/useLiveData';

export default function Roster() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [form, setForm] = useState({ workerId: '', hubId: '', date: '', from: '09:00', to: '18:00' });

  const load = () => Promise.all([
    api<{ shifts: any[] }>('/v1/admin/shifts').then(r => setShifts(r.shifts)),
    api<{ leaves: any[] }>('/v1/admin/leaves').then(r => setLeaves(r.leaves)),
    api<{ workers: any[] }>('/v1/admin/workers?status=ACTIVE').then(r => setWorkers(r.workers)),
    api<{ cities: any[] }>('/v1/admin/cities').then(r => setCities(r.cities)),
  ]);
  useLiveData(load);

  const hubs = cities.flatMap(c => c.hubs);

  async function addShift() {
    if (!form.workerId || !form.hubId || !form.date) return alert('Fill worker, hub and date');
    await api('/v1/admin/shifts', {
      method: 'POST',
      body: JSON.stringify({
        workerId: form.workerId, hubId: form.hubId,
        startAt: new Date(`${form.date}T${form.from}:00`).toISOString(),
        endAt: new Date(`${form.date}T${form.to}:00`).toISOString(),
      }),
    });
    load();
  }
  async function decide(id: string, approve: boolean) {
    await api(`/v1/admin/leaves/${id}/decide`, { method: 'POST', body: JSON.stringify({ approve }) });
    load();
  }

  return (
    <div>
      <h1>Roster & Leave</h1>
      <h2>Assign shift</h2>
      <div className="row">
        <select style={{ width: 180 }} value={form.workerId} onChange={e => setForm({ ...form, workerId: e.target.value })}>
          <option value="">Worker…</option>
          {workers.map(w => <option key={w.id} value={w.id}>{w.user.name ?? w.user.phone}</option>)}
        </select>
        <select style={{ width: 180 }} value={form.hubId} onChange={e => setForm({ ...form, hubId: e.target.value })}>
          <option value="">Hub…</option>
          {hubs.map((h: any) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <input type="date" style={{ width: 150 }} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        <input type="time" style={{ width: 110 }} value={form.from} onChange={e => setForm({ ...form, from: e.target.value })} />
        <input type="time" style={{ width: 110 }} value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} />
        <button onClick={addShift}>Add shift</button>
      </div>

      <h2>Upcoming shifts</h2>
      <div className="tableWrap">
        <table>
          <thead><tr><th>Worker</th><th>Hub</th><th>Start</th><th>End</th></tr></thead>
          <tbody>
            {shifts.map(s => (
              <tr key={s.id}><td>{s.worker.user.name}</td><td>{s.hub.name}</td><td>{fmtTime(s.startAt)}</td><td>{fmtTime(s.endAt)}</td></tr>
            ))}
            {shifts.length === 0 && <tr><td colSpan={4} className="muted">No shifts — workers without any shift rows can still go on duty (dev mode)</td></tr>}
          </tbody>
        </table>
      </div>

      <h2>Pending leave requests</h2>
      <div className="tableWrap">
        <table>
          <thead><tr><th>Worker</th><th>From</th><th>To</th><th>Reason</th><th /></tr></thead>
          <tbody>
            {leaves.map(l => (
              <tr key={l.id}>
                <td>{l.worker.user.name}</td><td>{fmtTime(l.fromDate)}</td><td>{fmtTime(l.toDate)}</td><td>{l.reason}</td>
                <td><div className="row" style={{ marginBottom: 0 }}>
                  <button onClick={() => decide(l.id, true)}>Approve</button>
                  <button className="danger" onClick={() => decide(l.id, false)}>Reject</button>
                </div></td>
              </tr>
            ))}
            {leaves.length === 0 && <tr><td colSpan={5} className="muted">No pending requests</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
