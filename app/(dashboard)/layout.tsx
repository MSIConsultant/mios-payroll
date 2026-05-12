'use client';
import { useEffect, useState } from 'react';
import NavLinks from '@/components/layout/NavLinks';
import MiosLogo from '@/components/ui/MiosLogo';
import { Toaster } from 'sonner';
import { LogOut, Bell } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/lib/types/roles';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser]         = useState<any>(null);
  const [profile, setProfile]   = useState<UserProfile | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady]       = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') setCollapsed(true);

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/login'; return; }
      setUser(user);
      const { data: p } = await supabase
        .from('user_profiles').select('*').eq('id', user.id).single();
      if (p) setProfile(p as UserProfile);

      // Unread notifications
      const { count } = await supabase
        .from('notifications').select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id).eq('read', false);
      setUnreadCount(count ?? 0);

      setReady(true);
    });
  }, []);

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  }

  if (!ready) return (
    <div style={{ minHeight: '100vh', background: '#0A0A0C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[['M','#E02020'],['I','#1B4FA8'],['O','#2DB44A'],['S','#1C1C1F']].map(([l, c], i) => (
          <div key={l} style={{ width: 28, height: 28, background: c, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 900, animation: `pulse 1.5s ease-in-out ${i * 0.12}s infinite` }}>{l}</div>
        ))}
      </div>
    </div>
  );

  const sw = collapsed ? 56 : 220;
  const role = profile?.role ?? 'staff';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0A0A0C' }}>
      <aside style={{ width: sw, minWidth: sw, maxWidth: sw, height: '100vh', background: '#09090B', borderRight: '1px solid #1C1C1F', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative', transition: 'width 0.3s ease, min-width 0.3s ease, max-width 0.3s ease', zIndex: 20 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #E02020 0%, #1B4FA8 50%, #2DB44A 100%)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '16px 8px' : '16px', borderBottom: '1px solid #1C1C1F', transition: 'padding 0.3s' }}>
          <MiosLogo size="sm" showWordmark collapsed={collapsed} />
        </div>

        {/* Role badge */}
        {!collapsed && (
          <div style={{ margin: '8px 12px 4px', padding: '4px 10px', borderRadius: 6, background: role === 'dev' ? 'rgba(239,68,68,0.1)' : role === 'accountant' ? 'rgba(37,99,235,0.1)' : 'rgba(34,197,94,0.08)', border: `1px solid ${role === 'dev' ? 'rgba(239,68,68,0.2)' : role === 'accountant' ? 'rgba(37,99,235,0.2)' : 'rgba(34,197,94,0.15)'}`, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: role === 'dev' ? '#EF4444' : role === 'accountant' ? '#3B82F6' : '#22C55E', display: 'inline-block' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: role === 'dev' ? '#EF4444' : role === 'accountant' ? '#3B82F6' : '#22C55E' }}>
              {role === 'dev' ? 'Developer' : role === 'accountant' ? 'Akuntan' : 'Staff'}
            </span>
          </div>
        )}

        <NavLinks collapsed={collapsed} onToggle={toggleSidebar} userRole={role} />

        <div style={{ borderTop: '1px solid #1C1C1F', padding: collapsed ? '8px 4px' : '8px 12px' }}>
          {!collapsed && (
            <div style={{ padding: '4px 8px 8px' }}>
              <p style={{ fontSize: 10, fontWeight: 500, color: '#3A3A3E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                {profile?.full_name ?? user?.email?.split('@')[0]}
              </p>
              <p style={{ fontSize: 11, color: '#52525B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </p>
            </div>
          )}

          {/* Notifications */}
          {!collapsed && unreadCount > 0 && (
            <Link href="/notifications"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', textDecoration: 'none' }}>
              <Bell size={13} style={{ color: '#3B82F6' }} />
              <span style={{ fontSize: 12, color: '#3B82F6', fontWeight: 600 }}>
                {unreadCount} notifikasi
              </span>
            </Link>
          )}

          <form action="/auth/signout" method="post">
            <button type="submit"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? 0 : 8, padding: collapsed ? '8px 0' : '8px', borderRadius: 8, border: 'none', background: 'transparent', color: '#3A3A3E', cursor: 'pointer', fontSize: 12, fontWeight: 500, transition: 'color 0.2s, background 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as any).style.color = '#EF4444'; (e.currentTarget as any).style.background = '#1A0F0F'; }}
              onMouseLeave={e => { (e.currentTarget as any).style.color = '#3A3A3E'; (e.currentTarget as any).style.background = 'transparent'; }}>
              <LogOut size={14} />
              {!collapsed && <span>Keluar</span>}
            </button>
          </form>

          {!collapsed && role !== 'staff' && (
            <div style={{ display: 'flex', gap: 12, padding: '4px 8px 0' }}>
              <Link href="/terms"   style={{ fontSize: 10, color: '#2A2A2E', textDecoration: 'none' }}>Syarat</Link>
              <Link href="/privacy" style={{ fontSize: 10, color: '#2A2A2E', textDecoration: 'none' }}>Privasi</Link>
            </div>
          )}
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', minWidth: 0 }}>
        <div style={{ position: 'fixed', top: 0, bottom: 0, right: 0, left: sw, backgroundImage: 'linear-gradient(rgba(37,99,235,0.008) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.008) 1px, transparent 1px)', backgroundSize: '52px 52px', pointerEvents: 'none', zIndex: 0, transition: 'left 0.3s' }} />
        <div style={{ position: 'relative', zIndex: 1, padding: '32px', maxWidth: 1400, margin: '0 auto', minHeight: '100%' }}>
          {children}
        </div>
      </main>

      <Toaster position="bottom-right" theme="dark"
        toastOptions={{ style: { background: '#111114', border: '1px solid #1C1C1F', color: '#E4E4E7', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', borderRadius: '10px' } }} />
    </div>
  );
}
