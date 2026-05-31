'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { acceptInvite } from '@/lib/actions/workspace';
import Link from 'next/link';
import MiosLogo from '@/components/ui/MiosLogo';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

function InvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'ready' | 'accepting' | 'done' | 'error'>('loading');
  const [invite, setInvite] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      if (!token) {
        setStatus('error');
        setError('Token tidak ditemukan.');
        return;
      }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const { data: inv } = await supabase
        .from('workspace_invitations')
        .select('*, workspaces(name)')
        .eq('token', token)
        .is('accepted_at', null)
        .single();

      if (!inv) {
        setStatus('error');
        setError('Undangan tidak valid atau sudah digunakan.');
        return;
      }
      if (new Date(inv.expires_at) < new Date()) {
        setStatus('error');
        setError('Undangan sudah kadaluarsa (7 hari).');
        return;
      }

      setInvite(inv);
      setStatus('ready');
    }
    load();
  }, [token]);

  async function handleAccept() {
    setStatus('accepting');
    const res = await acceptInvite(token!);
    if (res.error) {
      setError(res.error);
      setStatus('error');
    } else {
      setStatus('done');
      setTimeout(() => router.push('/dashboard'), 2000);
    }
  }

  const wsName = (invite?.workspaces as any)?.name ?? '—';

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="flex justify-center mb-6">
          <MiosLogo size="md" showWordmark />
        </div>

        <div className="bg-white border border-[var(--border-default)] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 pt-6 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Undangan Workspace
            </p>
          </div>

          <div className="px-6 pb-6 pt-2">
            {status === 'loading' && (
              <div className="text-center py-6">
                <Loader2 size={20} className="animate-spin mx-auto text-[var(--brand)] mb-3" />
                <p className="text-sm text-[var(--text-muted)]">Memverifikasi undangan…</p>
              </div>
            )}

            {status === 'ready' && (
              <div className="space-y-5">
                <div>
                  <p className="text-[12px] text-[var(--text-muted)]">Anda diundang ke workspace</p>
                  <p className="text-xl font-bold tracking-tight text-[var(--text-primary)] mt-0.5">
                    {wsName}
                  </p>
                </div>

                <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-lg p-3 text-[13px] space-y-1.5">
                  <Row label="Diundang untuk" value={invite?.invited_email} />
                  <Row
                    label="Akun Anda"
                    value={user ? user.email : 'Belum login'}
                    valueClass={user ? 'text-emerald-700' : 'text-amber-700'}
                  />
                  <Row label="Role" value="Member" valueClass="text-sky-700" />
                </div>

                {user && user.email !== invite?.invited_email && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>
                      Anda login sebagai {user.email}, bukan {invite?.invited_email}. Logout dan
                      login dengan akun yang benar.
                    </span>
                  </div>
                )}

                {!user ? (
                  <div className="space-y-2">
                    <p className="text-[13px] text-[var(--text-muted)]">
                      Login atau daftar untuk menerima undangan ini.
                    </p>
                    <Link
                      href={`/login?next=/invite?token=${token}`}
                      className="flex items-center justify-center w-full py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                    >
                      Login
                    </Link>
                    <Link
                      href="/register"
                      className="flex items-center justify-center w-full py-2.5 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] rounded-lg text-sm font-semibold transition-colors"
                    >
                      Daftar Akun Baru
                    </Link>
                  </div>
                ) : user.email === invite?.invited_email ? (
                  <button
                    onClick={handleAccept}
                    className="w-full py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                  >
                    Terima Undangan
                  </button>
                ) : (
                  <Link
                    href="/auth/signout"
                    className="flex items-center justify-center w-full py-2.5 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] rounded-lg text-sm font-semibold transition-colors"
                  >
                    Logout & Ganti Akun
                  </Link>
                )}
              </div>
            )}

            {status === 'accepting' && (
              <div className="text-center py-6 space-y-3">
                <Loader2 size={20} className="animate-spin mx-auto text-[var(--brand)]" />
                <p className="text-sm text-[var(--text-muted)]">Memproses…</p>
              </div>
            )}

            {status === 'done' && (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 mx-auto bg-emerald-50 ring-1 ring-emerald-200 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={22} className="text-emerald-600" />
                </div>
                <p className="text-base font-semibold text-[var(--text-primary)]">
                  Berhasil bergabung!
                </p>
                <p className="text-[13px] text-[var(--text-muted)]">
                  Mengalihkan ke dashboard{' '}
                  <span className="font-semibold text-[var(--brand)]">{wsName}</span>…
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
                <Link
                  href="/dashboard"
                  className="flex items-center justify-center w-full py-2.5 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] rounded-lg text-sm font-semibold transition-colors"
                >
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

function Row({
  label, value, valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span
        className={`font-semibold ${valueClass ?? 'text-[var(--text-primary)]'} font-mono text-[12px]`}
      >
        {value}
      </span>
    </div>
  );
}

export default function InvitePageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
        </div>
      }
    >
      <InvitePage />
    </Suspense>
  );
}
