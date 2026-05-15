'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { MiosLogoAuth } from '@/components/ui/MiosLogo';
import { notifyPendingApproval } from '@/lib/actions/notify';

export default function RegisterPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [done, setDone]         = useState(false);
  const [focused, setFocused]   = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Password tidak cocok.'); return; }
    if (password.length < 6)  { setError('Password minimal 6 karakter.'); return; }
    setLoading(true); setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    await notifyPendingApproval(email);
    if (err) { setError(err.message); setLoading(false); }
    else setDone(true);
  };

  if (done) return (
    <div className="min-h-screen bg-[#080809] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="animate-scanline absolute inset-0 w-full h-8 bg-white/[0.02] pointer-events-none" />
      <div className="relative z-10 w-full max-w-sm text-center animate-fade-in-up">
        <div className="w-12 h-12 bg-green-900/30 border border-green-800/40 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-green-400 text-xl">✓</span>
        </div>
        <h2 className="text-lg font-bold text-zinc-100 mb-2">Cek email Anda</h2>
        <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
          Link verifikasi dikirim ke <span className="text-zinc-300">{email}</span>.<br />
          Klik link tersebut untuk mengaktifkan akun.
        </p>
        <Link href="/login" className="text-xs text-[#2563EB] hover:underline font-mono">← Kembali ke login</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080809] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="animate-scanline absolute inset-0 w-full h-8 bg-white/[0.02] pointer-events-none z-0" />
      <div className="absolute inset-0 z-0"
        style={{ backgroundImage: 'linear-gradient(rgba(37,99,235,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8 animate-fade-in-up stagger-1">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#2563EB] rounded mb-4"
            style={{ boxShadow: '0 0 40px rgba(37,99,235,0.3)' }}>
            <span className="text-[#0A0A0B] font-black text-xl">M</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100">Daftar Akun</h1>
          <p className="text-[11px] text-zinc-600 uppercase tracking-widest mt-1">MIOS Payroll · Indonesia</p>
        </div>

        <div className="bg-[#0A0A0B] border border-[#1A1A1C] rounded-lg overflow-hidden animate-fade-in-up stagger-2"
          style={{ boxShadow: '0 0 60px rgba(0,0,0,0.8)' }}>
          <div className="px-4 py-2.5 bg-[#0F0F11] border-b border-[#1A1A1C] flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            <span className="ml-3 text-[10px] text-zinc-700 font-mono uppercase tracking-widest">auth.register</span>
            <span className="ml-1 text-[#2563EB] animate-blink font-mono text-xs">_</span>
          </div>

          <form onSubmit={handleRegister} className="p-6 space-y-4 font-mono">
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-800/30 rounded text-xs text-red-400 animate-fade-in">
                <span className="text-red-600">ERR </span>{error}
              </div>
            )}

            {[
              { id: 'email',    label: 'Email',            type: 'email',    val: email,    set: setEmail,    ph: 'nama@perusahaan.com' },
              { id: 'password', label: 'Password',         type: 'password', val: password, set: setPassword, ph: '••••••••' },
              { id: 'confirm',  label: 'Konfirmasi Password', type: 'password', val: confirm, set: setConfirm, ph: '••••••••' },
            ].map((f, i) => (
              <div key={f.id} className={`animate-fade-in-up stagger-${i + 3}`}>
                <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">
                  <span className="text-[#2563EB]">→</span> {f.label}
                </label>
                <input type={f.type} value={f.val} required
                  onChange={e => f.set(e.target.value)}
                  onFocus={() => setFocused(f.id)}
                  onBlur={() => setFocused(null)}
                  placeholder={f.ph}
                  className="w-full px-3 py-2.5 bg-[#0D0D0F] border rounded-lg text-sm text-zinc-200 placeholder:text-zinc-800 outline-none transition-all duration-300"
                  style={{ borderColor: focused === f.id ? 'rgba(37,99,235,0.5)' : '#1A1A1C' }} />
              </div>
            ))}

            <div className="pt-2">
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-lg font-bold text-xs uppercase tracking-widest transition-all duration-300 relative overflow-hidden group disabled:opacity-50"
                style={{ background: loading ? '#1A1A1C' : '#2563EB', color: loading ? '#666' : '#0A0A0B' }}>
                <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }} />
                <span className="relative">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3 h-3 border border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
                      Mendaftar...
                    </span>
                  ) : '$ daftar →'}
                </span>
              </button>
            </div>

            <div className="pt-1 text-center">
              <p className="text-[11px] text-zinc-700">
                Sudah punya akun?{' '}
                <Link href="/login" className="text-[#2563EB] hover:text-yellow-300 transition-colors">Masuk</Link>
              </p>
            </div>
          </form>
        </div>

        <p className="text-center text-[10px] text-zinc-800 mt-6 font-mono animate-fade-in stagger-5">
          PP 58/2023 · PMK 168/2023 · PPh 21 TER
        </p>
      </div>
    </div>
  );
}
