'use client';
import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-app)' }}>
      <div className="max-w-md w-full mx-4 p-8 rounded-2xl text-center" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)' }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--red-soft)' }}>
          <AlertTriangle className="w-6 h-6" style={{ color: 'var(--red)' }} />
        </div>
        <h1 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Terjadi Kesalahan</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Halaman tidak dapat dimuat. Silakan coba lagi.
        </p>
        {error.digest && (
          <p className="text-xs font-mono mb-4 px-3 py-2 rounded-lg" style={{ color: 'var(--text-faint)', background: 'var(--bg-subtle)' }}>
            {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--brand)', color: '#fff' }}
        >
          <RefreshCw className="w-4 h-4" />
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
