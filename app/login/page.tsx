'use client';
import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MiosLogoAuth } from '@/components/ui/MiosLogo';
import { AlertCircle, Loader2 } from 'lucide-react';

function LoginForm() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      window.location.href = next || '/';
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 animate-fade-in-up stagger-1">
          <MiosLogoAuth />
        </div>

        <div className="bg-white border border-[var(--border-default)] rounded-2xl shadow-sm overflow-hidden animate-fade-in-up stagger-2">
          <div className="px-6 pt-6 pb-2">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Masuk
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Selamat datang kembali. Silakan masuk untuk melanjutkan.
            </p>
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 animate-fade-in">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-[13px] font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                required
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@perusahaan.com"
                className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="text-[13px] font-semibold text-[var(--text-secondary)]"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[12px] font-semibold text-[var(--brand)] hover:underline"
                >
                  Lupa password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                required
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Memproses…
                </>
              ) : (
                'Masuk'
              )}
            </button>

            <p className="text-center text-[13px] text-[var(--text-muted)] pt-2">
              Belum punya akun?{' '}
              <Link
                href="/register"
                className="font-semibold text-[var(--brand)] hover:underline"
              >
                Daftar sekarang
              </Link>
            </p>
          </form>
        </div>

        <p className="text-center text-[11px] text-[var(--text-muted)] mt-6 font-mono">
          PP 58/2023 · PMK 168/2023 · PPh 21 TER
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
