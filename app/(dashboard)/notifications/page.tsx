'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell, CheckCheck, Check } from 'lucide-react';

interface Notification {
  id:         string;
  type:       string;
  title:      string;
  message:    string | null;
  read:       boolean;
  data:       any;
  created_at: string;
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  ACCOUNT_APPROVED: { bg: 'rgba(34,197,94,0.1)',  text: '#4ADE80' },
  ACCOUNT_REJECTED: { bg: 'rgba(239,68,68,0.1)',  text: '#EF4444' },
  PAYROLL_LOCKED:   { bg: 'rgba(37,99,235,0.1)',  text: '#3B82F6' },
  STAFF_JOINED:     { bg: 'rgba(167,139,250,0.1)', text: '#A78BFA' },
};
const DEFAULT_TYPE = { bg: 'rgba(113,113,122,0.1)', text: '#71717A' };

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'baru saja';
  if (mins  < 60) return `${mins} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  return `${days} hari lalu`;
}

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifs();
  }, []);

  async function fetchNotifs() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNotifs(data as Notification[]);
    setLoading(false);
  }

  async function markRead(id: string) {
    const supabase = createClient();
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x));
  }

  async function markAllRead() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('recipient_id', user.id);
    setNotifs(n => n.map(x => ({ ...x, read: true })));
  }

  const unread = notifs.filter(n => !n.read).length;

  if (loading) return (
    <div className="space-y-3 max-w-2xl">
      {[1,2,3].map(i => (
        <div key={i} className="h-20 rounded-xl animate-pulse"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }} />
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in-up">

      {/* Header */}
      <div className="flex items-center justify-between border-b pb-6"
        style={{ borderColor: 'var(--border-default)' }}>
        <div>
          <h1 className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>
            Notifikasi
          </h1>
          {unread > 0 && (
            <p className="text-[14px] mt-1" style={{ color: 'var(--text-muted)' }}>
              {unread} belum dibaca
            </p>
          )}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-[13px] transition-colors"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
            <CheckCheck size={14} />
            Tandai semua dibaca
          </button>
        )}
      </div>

      {notifs.length === 0 ? (
        <div className="rounded-2xl p-12 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <Bell size={32} className="mx-auto mb-4" style={{ color: 'var(--text-ghost)' }} />
          <p className="text-[15px]" style={{ color: 'var(--text-muted)' }}>
            Tidak ada notifikasi.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map((n, i) => {
            const cfg = TYPE_COLORS[n.type] ?? DEFAULT_TYPE;
            return (
              <div
                key={n.id}
                className="rounded-xl p-5 flex gap-4 animate-fade-in-up cursor-pointer transition-all"
                style={{
                  background:     n.read ? 'var(--bg-card)' : 'rgba(37,99,235,0.04)',
                  border:         `1px solid ${n.read ? 'var(--border-default)' : 'rgba(37,99,235,0.2)'}`,
                  animationDelay: `${i * 0.03}s`,
                  opacity:        0,
                }}
                onClick={() => !n.read && markRead(n.id)}>

                {/* Dot */}
                <div className="mt-1 shrink-0">
                  {n.read
                    ? <div className="w-2 h-2 rounded-full" style={{ background: 'var(--border-strong)' }} />
                    : <div className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                  }
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-[15px]" style={{ color: 'var(--text-primary)' }}>
                      {n.title}
                    </p>
                    <span className="text-[11px] font-mono shrink-0" style={{ color: 'var(--text-ghost)' }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  {n.message && (
                    <p className="text-[13px] mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {n.message}
                    </p>
                  )}
                  <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-widest"
                    style={{ background: cfg.bg, color: cfg.text }}>
                    {n.type.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
