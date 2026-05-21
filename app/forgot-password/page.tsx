'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { MiosLogoAuth } from '@/components/ui/MiosLogo';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center animate-fade-in-up">
          <div className="w-14 h-14 bg-emerald-50 ring-1 ring-emerald-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={28} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Cek email Anda
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed">
            Link reset password dikirim ke{' '}
            <span className="font-semibold text-[var(--text-primary)]">{email}</span>.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-semibold text-[var(--brand)] hover:underline"
          >
            ← Kembali ke login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 animate-fade-in-up stagger-1">
          <MiosLogoAuth />
        </div>

        <div className="bg-white border border-[var(--border-default)] rounded-2xl shadow-sm overflow-hidden animate-fade-in-up stagger-2">
          <div className="px-6 pt-6 pb-2">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Reset Password
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Masukkan email akun Anda untuk menerima link reset.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
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

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Mengirim…
                </>
              ) : (
                'Kirim Link Reset'
              )}
            </button>

            <p className="text-center pt-2">
              <Link
                href="/login"
                className="text-[13px] font-semibold text-[var(--brand)] hover:underline"
              >
                ← Kembali ke login
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
