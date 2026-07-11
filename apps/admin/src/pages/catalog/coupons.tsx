import { useState } from 'react';
import { api, rupees } from '../../lib/api';
import { useLiveData } from '../../lib/useLiveData';
import { useModals } from '../../lib/ModalContext';
import { Button } from '../../components/Button';

export default function Coupons() {
  const { prompt: modalPrompt, confirm: modalConfirm, alert: modalAlert } = useModals();
  const [coupons, setCoupons] = useState<any[]>([]);
  const load = () => api<{ coupons: any[] }>('/v1/admin/coupons').then(r => setCoupons(r.coupons));
  useLiveData(load);

  async function add() {
    const code = await modalPrompt('Code:');
    if (!code) return;
    const description = (await modalPrompt('Description:')) ?? code;
    const pctStr = await modalPrompt('Discount % (0 for flat):', '0');
    const pct = Number(pctStr ?? 0);
    const flat = pct === 0 ? Number((await modalPrompt('Flat discount ₹:', '0')) ?? 0) * 100 : 0;
    const firstOnly = await modalConfirm('First booking only?');
    await api('/v1/admin/coupons', {
      method: 'POST',
      body: JSON.stringify({ code, description, discountPct: pct, discountPaise: flat, firstBookingOnly: firstOnly }),
    }).then(load).catch(async e => await modalAlert(e.message));
  }

  async function toggle(c: any) {
    await api(`/v1/admin/coupons/${c.id}`, { method: 'PATCH', body: JSON.stringify({ active: !c.active }) });
    await load();
  }

  return (
    <div>
      <h1>Coupons</h1>
      <div className="row"><Button onClick={add}>Create coupon</Button></div>
      <div className="tableWrap">
        <table>
          <thead><tr><th>Code</th><th>Description</th><th>Discount</th><th>Used</th><th>First-only</th><th>Active</th></tr></thead>
          <tbody>
            {coupons.map(c => (
              <tr key={c.id}>
                <td><b>{c.code}</b></td><td>{c.description}</td>
                <td>{c.discountPct ? `${c.discountPct}%` : rupees(c.discountPaise)} (max {rupees(c.maxDiscountPaise)})</td>
                <td>{c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ''}</td>
                <td>{c.firstBookingOnly ? '✓' : ''}</td>
                <td><Button className="ghost" onClick={() => toggle(c)}>{c.active ? 'Disable' : 'Enable'}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
