import { useState } from 'react';
import { api } from '../../lib/api';
import { useLiveData } from '../../lib/useLiveData';
import { useModals } from '../../lib/ModalContext';

export default function Zones() {
  const { prompt: modalPrompt, alert: modalAlert } = useModals();
  const [cities, setCities] = useState<any[]>([]);
  const load = () => api<{ cities: any[] }>('/v1/admin/cities').then(r => setCities(r.cities));
  useLiveData(load);

  async function addZone(cityId: string) {
    const name = await modalPrompt('Zone name:');
    if (!name) return;
    const center = await modalPrompt('Center "lat,lng" (a ~4km square zone is created around it):');
    if (!center) return;
    const [lat, lng] = center.split(',').map(Number);
    const d = 0.02;
    await api('/v1/admin/zones', {
      method: 'POST',
      body: JSON.stringify({
        cityId, name,
        polygon: [[lat - d, lng - d], [lat - d, lng + d], [lat + d, lng + d], [lat + d, lng - d]],
      }),
    }).then(load).catch(async e => await modalAlert(e.message));
  }

  async function addHub(cityId: string, zoneId: string) {
    const name = await modalPrompt('Hub name:');
    if (!name) return;
    const center = await modalPrompt('Hub "lat,lng":');
    if (!center) return;
    const [lat, lng] = center.split(',').map(Number);
    await api('/v1/admin/hubs', { method: 'POST', body: JSON.stringify({ cityId, zoneId, name, lat, lng }) }).then(load);
  }

  const toggleZone = (z: any) =>
    api(`/v1/admin/zones/${z.id}`, { method: 'PATCH', body: JSON.stringify({ active: !z.active }) }).then(load);

  return (
    <div>
      <h1>Zones & Hubs</h1>
      {cities.map(c => (
        <div key={c.id} className="card" style={{ marginBottom: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>{c.name}</h2>
            <button onClick={() => addZone(c.id)}>Add zone</button>
          </div>
          <div className="tableWrap" style={{ marginTop: 10 }}>
            <table>
              <thead><tr><th>Zone</th><th>Hubs</th><th>Status</th><th /></tr></thead>
              <tbody>
                {c.zones.map((z: any) => (
                  <tr key={z.id}>
                    <td>{z.name}</td>
                    <td>{c.hubs.filter((h: any) => h.zoneId === z.id).map((h: any) => h.name).join(', ') || '—'}</td>
                    <td><span className={`badge ${z.active ? 'ACTIVE' : 'SUSPENDED'}`}>{z.active ? 'LIVE' : 'OFF'}</span></td>
                    <td><div className="row" style={{ marginBottom: 0 }}>
                      <button className="ghost" onClick={() => addHub(c.id, z.id)}>Add hub</button>
                      <button className="ghost" onClick={() => toggleZone(z)}>{z.active ? 'Disable' : 'Enable'}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
