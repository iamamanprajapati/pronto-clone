import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { ModalProvider } from './lib/ModalContext';

import LiveOps from './pages/live-ops';
import Bookings from './pages/bookings';
import BookingDetail from './pages/booking-detail';
import Customers from './pages/customers';
import Customer360 from './pages/customer-detail';
import SosConsole from './pages/sos';
import Pipeline from './pages/workforce/pipeline';
import Workers from './pages/workforce/workers';
import Worker360 from './pages/workforce/worker-detail';
import Roster from './pages/workforce/roster';
import Payouts from './pages/finance/payouts';
import Services from './pages/catalog/services';
import Coupons from './pages/catalog/coupons';
import Zones from './pages/catalog/zones';
import Support from './pages/support';
import Analytics from './pages/analytics';
import Platform from './pages/platform';
import Login from './pages/login';

function LayoutWrapper() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  if (isLoginPage) {
    return <main className="main" style={{ padding: 0 }}><Login /></main>;
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<LiveOps />} />
          <Route path="/bookings" element={<Bookings />} />
          <Route path="/bookings/:id" element={<BookingDetail />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<Customer360 />} />
          <Route path="/sos" element={<SosConsole />} />
          <Route path="/workforce/pipeline" element={<Pipeline />} />
          <Route path="/workforce/workers" element={<Workers />} />
          <Route path="/workforce/workers/:id" element={<Worker360 />} />
          <Route path="/workforce/roster" element={<Roster />} />
          <Route path="/finance/payouts" element={<Payouts />} />
          <Route path="/catalog/services" element={<Services />} />
          <Route path="/catalog/coupons" element={<Coupons />} />
          <Route path="/catalog/zones" element={<Zones />} />
          <Route path="/support" element={<Support />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/platform" element={<Platform />} />
          <Route path="*" element={<div className="muted">Page not found</div>} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  return (
    <ModalProvider>
      <BrowserRouter>
        <LayoutWrapper />
      </BrowserRouter>
    </ModalProvider>
  );
}
