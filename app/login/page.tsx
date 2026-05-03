'use client';
import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MiosLogoAuth } from '@/components/ui/MiosLogo';

function LoginForm() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [focused, setFocused]   = useState<string | null>(null);
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setLoading(false); }
    else window.location.href = next || '/';
  };

  return (
    <div className="min-h-screen bg-[#080809] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated scanline */}
      <div className="animate-scanline absolute inset-0 w-full h-8 bg-white/[0.02] pointer-events-none z-0" />

      {/* Grid background */}
      <div className="absolute inset-0 z-0"
        style={{ backgroundImage: 'linear-gradient(rgba(212,175,55,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in-up stagger-1">
          <MiosLogoAuth />
        </div>

        {/* Terminal card */}
        <div className="bg-[#0A0A0B] border border-[#1A1A1C] rounded-lg overflow-hidden animate-fade-in-up stagger-2"
          style={{ boxShadow: '0 0 60px rgba(0,0,0,0.8)' }}>
          {/* Terminal bar */}
          <div className="px-4 py-2.5 bg-[#0F0F11] border-b border-[#1A1A1C] flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            <span className="ml-3 text-[10px] text-zinc-700 font-mono uppercase tracking-widest">
              auth.login
            </span>
            <span className="ml-1 text-[#D4AF37] animate-blink font-mono text-xs">_</span>
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-4 font-mono">
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-800/30 rounded text-xs text-red-400 animate-fade-in">
                <span className="text-red-600">ERR </span>{error}
              </div>
            )}

            <div className="animate-fade-in-up stagger-3">
              <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">
                <span className="text-[#D4AF37]">→</span> Email
              </label>
              <input type="email" value={email} required
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                placeholder="nama@perusahaan.com"
                className="w-full px-3 py-2.5 bg-[#0D0D0F] border rounded-lg text-sm text-zinc-200 placeholder:text-zinc-800 outline-none transition-all duration-300"
                style={{ borderColor: focused === 'email' ? 'rgba(212,175,55,0.5)' : '#1A1A1C' }} />
            </div>

            <div className="animate-fade-in-up stagger-4">
              <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">
                <span className="text-[#D4AF37]">→</span> Password
              </label>
              <input type="password" value={password} required
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 bg-[#0D0D0F] border rounded-lg text-sm text-zinc-200 placeholder:text-zinc-800 outline-none transition-all duration-300"
                style={{ borderColor: focused === 'password' ? 'rgba(212,175,55,0.5)' : '#1A1A1C' }} />
            </div>

            <div className="pt-2 animate-fade-in-up stagger-5">
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-lg font-bold text-xs uppercase tracking-widest transition-all duration-300 relative overflow-hidden group disabled:opacity-50"
                style={{ background: loading ? '#1A1A1C' : '#D4AF37', color: loading ? '#666' : '#0A0A0B' }}>
                {/* Shimmer */}
                <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }} />
                <span className="relative">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3 h-3 border border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
                      Memproses...
                    </span>
                  ) : '$ masuk →'}
                </span>
              </button>
            </div>
            <div className="pt-2 text-center animate-fade-in stagger-5 space-y-2">
              <Link href="/forgot-password"
                className="block text-[11px] text-zinc-700 hover:text-zinc-500 transition-colors font-mono">
                Lupa password?
              </Link>
              <p className="text-[11px] text-zinc-700 font-mono">
                Belum punya akun?{' '}
                <Link href="/register" className="text-[#D4AF37] hover:text-yellow-300 transition-colors">
                  Daftar sekarang
                </Link>
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#080809] flex items-center justify-center">
        <span className="text-zinc-700 font-mono text-xs animate-blink">Loading_</span>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
