'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import MiosLogo from '@/components/ui/MiosLogo';
import { Clock, XCircle, Ban } from 'lucide-react';

const CONFIGS = {
  pending_approval: {
    icon: Clock,
    title: 'Menunggu Persetujuan',
    message:
      'Akun Anda telah terdaftar dan sedang menunggu verifikasi dari administrator. Anda akan mendapat notifikasi email setelah disetujui.',
    accent: 'amber',
  },
  rejected: {
    icon: XCircle,
    title: 'Akun Ditolak',
    message:
      'Permohonan akun Anda tidak disetujui. Hubungi administrator untuk informasi lebih lanjut.',
    accent: 'red',
  },
  suspended: {
    icon: Ban,
    title: 'Akun Ditangguhkan',
    message: 'Akun Anda telah ditangguhkan. Hubungi administrator.',
    accent: 'red',
  },
} as const;

const ACCENT_CLASSES = {
  amber: { bg: 'bg-amber-50', ring: 'ring-amber-200', text: 'text-amber-700' },
  red: { bg: 'bg-red-50', ring: 'ring-red-200', text: 'text-red-700' },
} as const;

export default function PendingApprovalPage() {
  const [status, setStatus] = useState<keyof typeof CONFIGS>('pending_approval');
  const [reason, setReason] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      setEmail(user.email ?? '');
      const { data } = await supabase
        .from('user_profiles')
        .select('status, rejected_reason, workspace_id')
        .eq('id', user.id)
        .single();
      if (data) {
        setStatus(data.status as keyof typeof CONFIGS);
        setReason(data.rejected_reason);
        if (data.status === 'approved') {
          // Smart redirect: skip onboarding if workspace already exists
          // (covers re-approved suspended users who completed onboarding before)
          window.location.href = data.workspace_id ? '/dashboard' : '/onboarding';
          return;
        }
      }
    }
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  const cfg = CONFIGS[status] ?? CONFIGS.pending_approval;
  const Icon = cfg.icon;
  const acc = ACCENT_CLASSES[cfg.accent];
  const message = status === 'rejected' && reason ? reason : cfg.message;

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in-up">
        <div className="flex justify-center">
          <MiosLogo size="md" showWordmark />
        </div>

        <div className="bg-white border border-[var(--border-default)] rounded-2xl shadow-sm p-8 text-center">
          <div
            className={`w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center ring-1 ring-inset ${acc.bg} ${acc.ring}`}
          >
            <Icon size={24} className={acc.text} />
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${acc.text}`}>{cfg.title}</h2>
          <p className="text-[14px] text-[var(--text-secondary)] mt-3 leading-relaxed">
            {message}
          </p>
          {email && (
            <p className="text-[12px] font-mono text-[var(--text-muted)] mt-4">{email}</p>
          )}
        </div>

        {status === 'pending_approval' && (
          <p className="text-center text-[12px] text-[var(--text-muted)]">
            Halaman ini otomatis refresh setiap 10 detik…
          </p>
        )}

        <div className="text-center">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-[13px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Keluar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
