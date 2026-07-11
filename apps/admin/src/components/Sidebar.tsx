import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Activity, BarChart3, Headset, LogOut, Map, MapPinned, Package, Settings2,
  ShieldAlert, Tags, Users, Wallet, Wrench, Zap, CalendarClock, ClipboardList,
  type LucideIcon,
} from 'lucide-react';
import { admin } from '../lib/api';

const NAV: Array<{ group: string; items: Array<[string, string, LucideIcon]> }> = [
  { group: 'Operations', items: [['/', 'Live Ops', Activity], ['/bookings', 'Bookings', Package], ['/sos', 'SOS Alerts', ShieldAlert]] },
  { group: 'Workforce', items: [['/workforce/pipeline', 'Onboarding', ClipboardList], ['/workforce/workers', 'Workers', Wrench], ['/workforce/roster', 'Roster & Leave', CalendarClock]] },
  { group: 'Finance', items: [['/finance/payouts', 'Payout Runs', Wallet]] },
  { group: 'Catalog', items: [['/catalog/services', 'Services & Pricing', Map], ['/catalog/coupons', 'Coupons', Tags], ['/catalog/zones', 'Zones & Hubs', MapPinned]] },
  { group: 'People', items: [['/customers', 'Customers', Users], ['/support', 'Support', Headset]] },
  { group: 'Platform', items: [['/analytics', 'Analytics', BarChart3], ['/platform', 'Platform', Settings2]] },
];

export function Sidebar() {
  const location = useLocation();
  const path = location.pathname;
  const [me, setMe] = useState<ReturnType<typeof admin>>(null);
  
  useEffect(() => { 
    setMe(admin()); 
  }, []);

  if (path === '/login') return null;

  return (
    <nav className="sidebar">
      <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Zap size={18} /> Pronto Ops
      </div>
      {me && <div className="muted" style={{ padding: '0 10px 8px' }}>{me.name} · {me.role}</div>}
      {NAV.map(g => (
        <div key={g.group}>
          <div className="group">{g.group}</div>
          {g.items.map(([href, label, Icon]) => (
            <Link key={href} to={href} className={path === href ? 'active' : ''}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon size={15} /> {label}
            </Link>
          ))}
        </div>
      ))}
      <div className="group">Session</div>
      <a href="/login" onClick={() => localStorage.clear()} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <LogOut size={15} /> Logout
      </a>
    </nav>
  );
}
