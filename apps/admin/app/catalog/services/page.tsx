'use client';
import { useEffect, useState } from 'react';
import { api, API, rupees } from '../../../lib/api';
import { ServiceIcon } from '../../../components/ServiceIcon';

export default function Services() {
  const [services, setServices] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any[]>([]);
  const [cityId, setCityId] = useState('');

  useEffect(() => {
    fetch(`${API}/v1/catalog/services`).then(r => r.json()).then(r => setServices(r.services));
    api<{ cities: any[] }>('/v1/admin/cities').then(r => {
      setCities(r.cities);
      if (r.cities[0]) setCityId(r.cities[0].id);
    });
  }, []);
  useEffect(() => {
    if (cityId) fetch(`${API}/v1/catalog/pricing?cityId=${cityId}`).then(r => r.json()).then(r => setPricing(r.pricing));
  }, [cityId]);

  async function toggle(s: any) {
    await api(`/v1/admin/services/${s.id}`, { method: 'PATCH', body: JSON.stringify({ active: !s.active }) });
    setServices(prev => prev.map(x => x.id === s.id ? { ...x, active: !x.active } : x));
  }
  async function editPrice(p: any) {
    const val = prompt(`Price for ${p.durationMin} min (₹):`, String(p.pricePaise / 100));
    if (!val) return;
    await api('/v1/admin/pricing', {
      method: 'PUT',
      body: JSON.stringify({ cityId, durationMin: p.durationMin, pricePaise: Math.round(Number(val) * 100), surgeMultiplier: p.surgeMultiplier }),
    });
    setPricing(prev => prev.map(x => x.id === p.id ? { ...x, pricePaise: Math.round(Number(val) * 100) } : x));
  }
  async function addService() {
    const name = prompt('Service name:'); if (!name) return;
    const category = prompt('Category (kitchen/cleaning/bathroom/laundry):') ?? 'cleaning';
    await api('/v1/admin/services', {
      method: 'POST',
      body: JSON.stringify({ slug: name.toLowerCase().replace(/\s+/g, '-'), name, category }),
    });
    fetch(`${API}/v1/catalog/services`).then(r => r.json()).then(r => setServices(r.services));
  }

  return (
    <div>
      <h1>Services & Pricing</h1>
      <div className="row"><button onClick={addService}>Add service</button></div>
      <div className="split">
        <div className="tableWrap">
          <table>
            <thead><tr><th>Service</th><th>Category</th><th>Base min</th><th>Active</th></tr></thead>
            <tbody>
              {services.map(s => (
                <tr key={s.id}>
                  <td><ServiceIcon icon={s.icon} /> {s.name}</td><td>{s.category}</td><td>{s.baseMinutes}</td>
                  <td><button className="ghost" onClick={() => toggle(s)}>{s.active !== false ? 'Disable' : 'Enable'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <select value={cityId} onChange={e => setCityId(e.target.value)} style={{ marginBottom: 10 }}>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Block</th><th>Price</th><th>Surge</th><th /></tr></thead>
              <tbody>
                {pricing.map(p => (
                  <tr key={p.id}>
                    <td>{p.durationMin} min</td><td>{rupees(p.pricePaise)}</td><td>×{p.surgeMultiplier}</td>
                    <td><button className="ghost" onClick={() => editPrice(p)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
