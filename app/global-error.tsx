'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{
          fontFamily: 'ui-monospace, monospace',
          background: '#F6F7F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          margin: 0,
        }}
      >
        <div style={{ textAlign: 'center', padding: '32px', maxWidth: 400 }}>
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 8 }}>MIOS Payroll</p>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
            Terjadi kesalahan tak terduga
          </h2>
          <p style={{ fontSize: 13, color: '#64748B', marginBottom: 24 }}>
            Error ini telah dicatat secara otomatis. Coba muat ulang halaman.
          </p>
          <button
            onClick={reset}
            style={{
              background: '#2563EB',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
