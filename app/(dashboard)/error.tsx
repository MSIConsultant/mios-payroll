'use client';
import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function DashboardError({
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
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--red-soft)' }}>
          <AlertTriangle className="w-6 h-6" style={{ color: 'var(--red)' }} />
        </div>
        <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Gagal memuat halaman</h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
          Terjadi kesalahan yang tidak terduga. Data Anda aman.
        </p>
        {error.digest && (
          <p className="text-xs font-mono mb-4 px-3 py-2 rounded-lg" style={{ color: 'var(--text-faint)', background: 'var(--bg-subtle)' }}>
            {error.digest}
          </p>
        )}
        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--brand)', color: '#fff' }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Coba Lagi
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
          >
            <Home className="w-3.5 h-3.5" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
