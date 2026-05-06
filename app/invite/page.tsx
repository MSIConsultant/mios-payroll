'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { acceptInvite } from '@/lib/actions/workspace';
import Link from 'next/link';

function InvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading'|'ready'|'accepting'|'done'|'error'>('loading');
  const [invite, setInvite] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      if (!token) { setStatus('error'); setError('Token tidak ditemukan.'); return; }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const { data: inv } = await supabase.from('workspace_invitations')
        .select('*, workspaces(name)').eq('token', token).is('accepted_at', null).single();

      if (!inv) { setStatus('error'); setError('Undangan tidak valid atau sudah digunakan.'); return; }
      if (new Date(inv.expires_at) < new Date()) { setStatus('error'); setError('Undangan sudah kadaluarsa (7 hari).'); return; }

      setInvite(inv);
      setStatus('ready');
    }
    load();
  }, [token]);

  async function handleAccept() {
    setStatus('accepting');
    const res = await acceptInvite(token!);
    if (res.error) { setError(res.error); setStatus('error'); }
    else {
      localStorage.setItem('active_workspace_id', res.workspaceId!);
      setStatus('done');
      setTimeout(() => router.push('/dashboard'), 2000);
    }
  }

  const wsName = (invite?.workspaces as any)?.name ?? '—';

  return (
    <div className="min-h-screen bg-[#080809] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="animate-scanline absolute inset-0 w-full h-8 bg-white/[0.02] pointer-events-none z-0" />
      <div className="absolute inset-0 z-0" style={{
        backgroundImage: 'linear-gradient(rgba(37,99,235,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />

      <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#2563EB] rounded mb-4"
            style={{ boxShadow: '0 0 40px rgba(37,99,235,0.3)' }}>
            <span className="text-[#0A0A0B] font-black text-xl">M</span>
          </div>
          <p className="text-[11px] text-zinc-600 uppercase tracking-widest font-mono">MIOS Payroll · Undangan Workspace</p>
        </div>

        <div className="bg-[#0A0A0B] border border-[#1A1A1C] rounded-lg overflow-hidden"
          style={{ boxShadow: '0 0 60px rgba(0,0,0,0.8)' }}>
          <div className="px-4 py-2.5 bg-[#0F0F11] border-b border-[#1A1A1C] flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            <span className="ml-3 text-[10px] text-zinc-700 font-mono uppercase tracking-widest">workspace.invite</span>
            <span className="ml-1 text-[#2563EB] animate-blink font-mono text-xs">_</span>
          </div>

          <div className="p-6 font-mono">
            {status === 'loading' && (
              <div className="text-center py-4">
                <div className="w-5 h-5 border border-zinc-700 border-t-[#2563EB] rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-zinc-600">Memverifikasi undangan...</p>
              </div>
            )}

            {status === 'ready' && (
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Anda diundang ke workspace</p>
                  <p className="text-lg font-bold text-zinc-100">{wsName}</p>
                </div>

                <div className="bg-[#0D0D0F] border border-[#1A1A1C] rounded p-3 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">undangan untuk</span>
                    <span className="text-zinc-300">{invite?.invited_email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">akun anda</span>
                    <span className={user ? 'text-green-400' : 'text-amber-400'}>
                      {user ? user.email : 'belum login'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">role</span>
                    <span className="text-sky-400">member</span>
                  </div>
                </div>

                {user && user.email !== invite?.invited_email && (
                  <div className="p-3 bg-red-900/20 border border-red-800/30 rounded text-xs text-red-400">
                    <span className="text-red-500">ERR </span>
                    Anda login sebagai {user.email}, bukan {invite?.invited_email}.
                    Logout dan login dengan akun yang benar.
                  </div>
                )}

                {!user ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-zinc-600">Login atau daftar untuk menerima undangan ini.</p>
                    <Link href={`/login?next=/invite?token=${token}`}
                      className="flex items-center justify-center w-full py-2.5 bg-[#2563EB] text-[#0A0A0B] rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-[#1D4ED8] transition-colors">
                      $ login →
                    </Link>
                    <Link href={`/register`}
                      className="flex items-center justify-center w-full py-2.5 bg-[#0D0D0F] border border-[#1A1A1C] text-zinc-500 rounded-lg font-bold text-xs uppercase tracking-widest hover:text-zinc-300 transition-colors">
                      Daftar Akun Baru
                    </Link>
                  </div>
                ) : user.email === invite?.invited_email ? (
                  <button onClick={handleAccept}
                    className="w-full py-3 bg-[#2563EB] text-[#0A0A0B] rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-[#1D4ED8] transition-colors relative overflow-hidden group">
                    <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }} />
                    $ terima undangan →
                  </button>
                ) : (
                  <Link href="/auth/signout"
                    className="flex items-center justify-center w-full py-2.5 bg-[#0D0D0F] border border-[#1A1A1C] text-zinc-500 rounded-lg font-bold text-xs uppercase tracking-widest hover:text-zinc-300 transition-colors">
                    Logout & Ganti Akun
                  </Link>
                )}
              </div>
            )}

            {status === 'accepting' && (
              <div className="text-center py-4 space-y-3">
                <div className="w-5 h-5 border border-zinc-700 border-t-[#2563EB] rounded-full animate-spin mx-auto" />
                <p className="text-xs text-zinc-500">Memproses...</p>
              </div>
            )}

            {status === 'done' && (
              <div className="text-center py-4 space-y-3">
                <div className="w-10 h-10 bg-green-900/30 border border-green-800/40 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-green-400 text-lg">✓</span>
                </div>
                <p className="text-sm font-bold text-zinc-100">Berhasil bergabung!</p>
                <p className="text-xs text-zinc-600">Mengalihkan ke dashboard <span className="text-[#2563EB]">{wsName}</span>...</p>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <div className="p-3 bg-red-900/20 border border-red-800/30 rounded text-xs text-red-400">
                  <span className="text-red-500">ERR </span>{error}
                </div>
                <Link href="/dashboard"
                  className="flex items-center justify-center w-full py-2.5 bg-[#0D0D0F] border border-[#1A1A1C] text-zinc-500 rounded-lg text-xs font-bold uppercase tracking-widest hover:text-zinc-300 transition-colors">
                  ← Kembali ke Dashboard
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvitePageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#080809] flex items-center justify-center">
        <span className="text-zinc-700 font-mono text-xs animate-blink">Loading_</span>
      </div>
    }>
      <InvitePage />
    </Suspense>
  );
}
