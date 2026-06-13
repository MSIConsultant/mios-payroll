import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)] p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center">
          <FileQuestion size={28} />
        </div>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)] font-mono">
          404
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          URL yang Anda buka tidak tersedia atau telah dipindahkan.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold transition-colors shadow-sm"
        >
          ← Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
