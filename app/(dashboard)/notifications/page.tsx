'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell, CheckCheck } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  data: any;
  created_at: string;
}

const TYPE_CHIP: Record<string, string> = {
  ACCOUNT_APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  ACCOUNT_REJECTED: 'bg-red-50 text-red-700 ring-red-200',
  PAYROLL_LOCKED: 'bg-sky-50 text-sky-700 ring-sky-200',
  STAFF_JOINED: 'bg-violet-50 text-violet-700 ring-violet-200',
};

function chipClass(type: string) {
  return TYPE_CHIP[type] ?? 'bg-slate-100 text-slate-600 ring-slate-200';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} menit lalu`;
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
    setNotifs((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x)));
  }

  async function markAllRead() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('recipient_id', user.id);
    setNotifs((n) => n.map((x) => ({ ...x, read: true })));
  }

  const unread = notifs.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="max-w-2xl space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 bg-white border border-[var(--border-default)] rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in-up">
      <header className="flex items-center justify-between gap-4 pb-5 border-b border-[var(--border-default)]">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Notifikasi
          </h1>
          {unread > 0 && (
            <p className="text-sm text-[var(--text-muted)] mt-1">{unread} belum dibaca</p>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <CheckCheck size={14} />
            Tandai semua dibaca
          </button>
        )}
      </header>

      {notifs.length === 0 ? (
        <div className="bg-white border border-dashed border-[var(--border-default)] rounded-xl py-16 text-center">
          <Bell size={32} className="mx-auto text-[var(--text-faint)]" />
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Tidak ada notifikasi.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifs.map((n, i) => (
            <li
              key={n.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i, 8) * 0.03}s`, opacity: 0 }}
            >
              <button
                type="button"
                onClick={() => !n.read && markRead(n.id)}
                className={`w-full text-left flex gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                  n.read
                    ? 'bg-white border-[var(--border-default)] hover:border-[var(--border-strong)]'
                    : 'bg-[var(--brand-soft)] border-blue-200 hover:border-blue-300'
                }`}
              >
                <div className="mt-1.5 shrink-0">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      n.read ? 'bg-[var(--border-strong)]' : 'bg-[var(--brand)]'
                    }`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <p className="font-semibold text-[15px] text-[var(--text-primary)]">
                      {n.title}
                    </p>
                    <span className="text-[11px] font-mono text-[var(--text-muted)] shrink-0">
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  {n.message && (
                    <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                      {n.message}
                    </p>
                  )}
                  <span
                    className={`inline-block mt-2 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${chipClass(
                      n.type,
                    )}`}
                  >
                    {n.type.replace(/_/g, ' ')}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
