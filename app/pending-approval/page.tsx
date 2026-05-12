'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import MiosLogo from '@/components/ui/MiosLogo';

export default function PendingApprovalPage() {
  const [status, setStatus] = useState<string>('pending_approval');
  const [reason, setReason] = useState<string | null>(null);
  const [email, setEmail]   = useState<string>('');

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/login'; return; }
      setEmail(user.email ?? '');
      const { data } = await supabase
        .from('user_profiles').select('status, rejected_reason').eq('id', user.id).single();
      if (data) {
        setStatus(data.status);
        setReason(data.rejected_reason);
        if (data.status === 'approved') window.location.href = '/dashboard';
      }
    }
    check();

    // Poll every 10 seconds
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  const configs = {
    pending_approval: {
      icon:    '⏳',
      color:   '#FBB040',
      bg:      'rgba(251,176,64,0.06)',
      border:  'rgba(251,176,64,0.2)',
      title:   'Menunggu Persetujuan',
      message: 'Akun Anda telah terdaftar dan sedang menunggu verifikasi dari administrator. Anda akan mendapat notifikasi email setelah disetujui.',
    },
    rejected: {
      icon:    '✕',
      color:   '#EF4444',
      bg:      'rgba(239,68,68,0.06)',
      border:  'rgba(239,68,68,0.2)',
      title:   'Akun Ditolak',
      message: reason ?? 'Permohonan akun Anda tidak disetujui. Hubungi administrator untuk informasi lebih lanjut.',
    },
    suspended: {
      icon:    '⊘',
      color:   '#EF4444',
      bg:      'rgba(239,68,68,0.06)',
      border:  'rgba(239,68,68,0.2)',
      title:   'Akun Ditangguhkan',
      message: 'Akun Anda telah ditangguhkan. Hubungi administrator.',
    },
  };

  const cfg = configs[status as keyof typeof configs] ?? configs.pending_approval;

  return (
    <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0" style={{
        backgroundImage: 'linear-gradient(rgba(37,99,235,0.008) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.008) 1px, transparent 1px)',
        backgroundSize: '52px 52px'
      }} />
      <div className="relative z-10 w-full max-w-sm space-y-6 animate-fade-in-up">
        <div className="text-center">
          <MiosLogo size="md" showWordmark />
        </div>

        <div className="rounded-2xl p-8 text-center"
          style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
          <div className="text-4xl mb-4">{cfg.icon}</div>
          <h2 className="text-xl font-black mb-3" style={{ color: cfg.color }}>
            {cfg.title}
          </h2>
          <p className="text-[14px] leading-relaxed mb-4"
            style={{ color: 'var(--text-secondary)' }}>
            {cfg.message}
          </p>
          {email && (
            <p className="text-[12px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {email}
            </p>
          )}
        </div>

        {status === 'pending_approval' && (
          <p className="text-center text-[11px] font-mono" style={{ color: 'var(--text-ghost)' }}>
            Halaman ini otomatis refresh setiap 10 detik...
          </p>
        )}

        <div className="text-center">
          <form action="/auth/signout" method="post">
            <button type="submit"
              className="text-[12px] font-mono transition-colors"
              style={{ color: 'var(--text-ghost)' }}>
              Keluar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
