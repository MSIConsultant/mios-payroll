'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { MiosLogoAuth } from '@/components/ui/MiosLogo';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
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
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      router.push('/');
    }
  }

  const fields = [
    { id: 'password', label: 'Password Baru', val: password, set: setPassword },
    { id: 'confirm', label: 'Konfirmasi Password', val: confirm, set: setConfirm },
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
              Password Baru
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Pilih password baru untuk akun Anda.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
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
                  type="password"
                  value={f.val}
                  required
                  autoComplete="new-password"
                  onChange={(e) => f.set(e.target.value)}
                  placeholder="••••••••"
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
                  Menyimpan…
                </>
              ) : (
                'Simpan Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
