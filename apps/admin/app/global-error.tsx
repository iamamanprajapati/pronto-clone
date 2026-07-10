'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 40 }}>
        <h1>App error</h1>
        <p style={{ color: '#6B6B6B' }}>{error.message || 'Unexpected error.'}</p>
        <button
          onClick={() => reset()}
          style={{ marginTop: 12, background: '#1A1A1A', color: 'white', border: 0, padding: '9px 18px', borderRadius: 999, fontWeight: 700, cursor: 'pointer' }}>
          Try again
        </button>
      </body>
    </html>
  );
}
