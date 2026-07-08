import './globals.css';
import { Sidebar } from '../components/Sidebar';

export const metadata = { title: 'Pronto Ops' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <Sidebar />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
