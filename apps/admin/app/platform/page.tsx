'use client';
import { useState } from 'react';
import { api, fmtTime } from '../../lib/api';
import { useLiveData } from '../../lib/useLiveData';

export default function Platform() {
  const [flags, setFlags] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const load = () => Promise.all([
    api<{ flags: any[] }>('/v1/admin/flags').then(r => setFlags(r.flags)),
    api<{ admins: any[] }>('/v1/admin/admins').then(r => setAdmins(r.admins)).catch(() => {}),
    api<{ logs: any[] }>('/v1/admin/audit').then(r => setLogs(r.logs)).catch(() => {}),
  ]);
  useLiveData(load);

  async function editFlag(f: any) {
    const val = prompt(`Value for ${f.key} (JSON):`, JSON.stringify(f.value));
    if (val === null) return;
    await api(`/v1/admin/flags/${f.key}`, { method: 'PUT', body: JSON.stringify({ value: JSON.parse(val) }) }).then(load).catch(e => alert(e.message));
  }
  async function addAdmin() {
    const email = prompt('Email:'); if (!email) return;
    const name = prompt('Name:') ?? email;
    const password = prompt('Password (min 6):') ?? '';
    const role = prompt('Role (SUPER_ADMIN/CITY_OPS/HUB_SUPERVISOR/SUPPORT/FINANCE/VERIFIER):') ?? 'SUPPORT';
    await api('/v1/admin/admins', { method: 'POST', body: JSON.stringify({ email, name, password, role }) }).then(load).catch(e => alert(e.message));
  }
  async function announce() {
    const audience = confirm('OK = workers, Cancel = customers') ? 'workers' : 'customers';
    const title = prompt('Title:'); if (!title) return;
    const body = prompt('Body:') ?? '';
    await api('/v1/admin/announcements', { method: 'POST', body: JSON.stringify({ audience, title, body }) }).then(() => alert('Sent'));
  }

  return (
    <div>
      <h1>Platform</h1>
      <div className="row"><button onClick={announce}>Send announcement</button></div>

      <h2>Feature flags</h2>
      <div className="tableWrap"><table><tbody>
        {flags.map(f => (
          <tr key={f.key}>
            <td><b>{f.key}</b></td><td>{JSON.stringify(f.value)}</td>
            <td><button className="ghost" onClick={() => editFlag(f)}>Edit</button></td>
          </tr>
        ))}
      </tbody></table></div>

      <h2>Admin users (RBAC)</h2>
      <div className="row"><button onClick={addAdmin}>Add admin</button></div>
      <div className="tableWrap"><table>
        <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Active</th></tr></thead>
        <tbody>
          {admins.map(a => (
            <tr key={a.id}><td>{a.email}</td><td>{a.name}</td><td><span className="badge">{a.role}</span></td><td>{a.active ? '✓' : '✗'}</td></tr>
          ))}
        </tbody>
      </table></div>

      <h2>Audit log (latest 200)</h2>
      <div className="tableWrap"><table>
        <thead><tr><th>At</th><th>Admin</th><th>Action</th><th>Entity</th><th>Change</th></tr></thead>
        <tbody>
          {logs.map(l => (
            <tr key={l.id}>
              <td className="muted">{fmtTime(l.at)}</td><td>{l.adminId.slice(-6)}</td>
              <td>{l.action}</td><td>{l.entity} {l.entityId?.slice(-6)}</td>
              <td className="muted">{l.after ? JSON.stringify(l.after).slice(0, 80) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
