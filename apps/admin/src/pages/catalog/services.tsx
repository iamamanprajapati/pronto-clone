import { useState } from 'react';
import { api, rupees } from '../../lib/api';
import { useLiveData } from '../../lib/useLiveData';
import { ServiceIcon } from '../../components/ServiceIcon';
import { useModals } from '../../lib/ModalContext';
import { Button } from '../../components/Button';

export default function Services() {
  const { prompt: modalPrompt, alert: modalAlert } = useModals();
  const [services, setServices] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any[]>([]);
  const [cityId, setCityId] = useState('');

  const loadServices = () => api<{ services: any[] }>('/v1/admin/services').then(r => setServices(r.services));
  const loadPricing = (cid: string) => api<{ pricing: any[] }>(`/v1/catalog/pricing?cityId=${cid}`).then(r => setPricing(r.pricing));

  useLiveData(async () => {
    await loadServices();
    const { cities } = await api<{ cities: any[] }>('/v1/admin/cities');
    setCities(cities);
    const cid = cityId || cities[0]?.id || '';
    if (cid) {
      if (!cityId) setCityId(cid);
      await loadPricing(cid);
    }
  });

  async function toggle(s: any) {
    await api(`/v1/admin/services/${s.id}`, { method: 'PATCH', body: JSON.stringify({ active: s.active === false }) });
    await loadServices();
  }

  async function editPrice(p: any) {
    const val = await modalPrompt(`Price for ${p.durationMin} min (₹):`, String(p.pricePaise / 100));
    if (!val) return;
    await api('/v1/admin/pricing', {
      method: 'PUT',
      body: JSON.stringify({ cityId, durationMin: p.durationMin, pricePaise: Math.round(Number(val) * 100), surgeMultiplier: p.surgeMultiplier }),
    });
    await loadPricing(cityId);
  }

  async function addService() {
    const name = await modalPrompt('Service name:');
    if (!name) return;
    const category = (await modalPrompt('Category (kitchen/cleaning/bathroom/laundry):')) ?? 'cleaning';
    await api('/v1/admin/services', {
      method: 'POST',
      body: JSON.stringify({ slug: name.toLowerCase().replace(/\s+/g, '-'), name, category }),
    }).catch(async e => await modalAlert(e.message));
    await loadServices();
  }

  return (
    <div>
      <h1>Services & Pricing</h1>
      <div className="row"><Button onClick={addService}>Add service</Button></div>
      <div className="split">
        <div className="tableWrap">
          <table>
            <thead><tr><th>Service</th><th>Category</th><th>Base min</th><th>Active</th></tr></thead>
            <tbody>
              {services.map(s => (
                <tr key={s.id}>
                  <td><ServiceIcon icon={s.icon} /> {s.name}</td><td>{s.category}</td><td>{s.baseMinutes}</td>
                  <td><Button className="ghost" onClick={() => toggle(s)}>{s.active !== false ? 'Disable' : 'Enable'}</Button></td>
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
                    <td><Button className="ghost" onClick={() => editPrice(p)}>Edit</Button></td>
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
