'use client';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Route error:', error); }, [error]);
  return (
    <div style={{ padding: 40, maxWidth: 640 }}>
      <h1>Something went wrong</h1>
      <p className="muted" style={{ marginBottom: 12 }}>{error.message || 'Unexpected client error.'}</p>
      <div className="row">
        <button onClick={() => reset()}>Try again</button>
        <button className="ghost" onClick={() => location.reload()}>Reload page</button>
      </div>
    </div>
  );
}
