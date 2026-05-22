'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { MiosLogoAuth } from '@/components/ui/MiosLogo';
import { notifyPendingApproval } from '@/lib/actions/notify';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [done, setDone]         = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Password tidak cocok.');
      return;
    }
    if (password.length < 12) {
      setError('Password minimal 12 karakter.');
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password harus mengandung huruf besar, huruf kecil, dan angka.');
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    await notifyPendingApproval(email);
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      try {
        await fetch('/api/notify-registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
      } catch {}
      setDone(true);
    }
  };

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
            Link verifikasi dikirim ke{' '}
            <span className="font-semibold text-[var(--text-primary)]">{email}</span>.
            <br />
            Klik link tersebut untuk mengaktifkan akun.
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

  const fields: Array<{
    id: string;
    label: string;
    type: string;
    val: string;
    set: (v: string) => void;
    ph: string;
    autoComplete: string;
  }> = [
    { id: 'email',    label: 'Email',                type: 'email',    val: email,    set: setEmail,    ph: 'nama@perusahaan.com', autoComplete: 'email' },
    { id: 'password', label: 'Password',             type: 'password', val: password, set: setPassword, ph: '••••••••',             autoComplete: 'new-password' },
    { id: 'confirm',  label: 'Konfirmasi Password',  type: 'password', val: confirm,  set: setConfirm,  ph: '••••••••',             autoComplete: 'new-password' },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 animate-fade-in-up stagger-1">
          <MiosLogoAuth />
        </div>

        <div className="bg-white border border-[var(--border-default)] rounded-2xl shadow-sm overflow-hidden animate-fade-in-up stagger-2">
          <div className="px-6 pt-6 pb-2">
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Daftar Akun
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Buat akun baru untuk mulai mengelola payroll.
            </p>
          </div>

          <form onSubmit={handleRegister} className="p-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 animate-fade-in">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {fields.map((f) => (
              <div key={f.id}>
                <label
                  htmlFor={f.id}
                  className="block text-[13px] font-semibold text-[var(--text-secondary)] mb-1.5"
                >
                  {f.label}
                </label>
                <input
                  id={f.id}
                  type={f.type}
                  value={f.val}
                  required
                  autoComplete={f.autoComplete}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.ph}
                  className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all"
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Mendaftar…
                </>
              ) : (
                'Daftar'
              )}
            </button>

            <p className="text-center text-[13px] text-[var(--text-muted)] pt-2">
              Sudah punya akun?{' '}
              <Link
                href="/login"
                className="font-semibold text-[var(--brand)] hover:underline"
              >
                Masuk
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
