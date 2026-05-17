'use client';
import { useEffect, useState } from 'react';
import NavLinks from '@/components/layout/NavLinks';
import MiosLogo from '@/components/ui/MiosLogo';
import { Toaster } from 'sonner';
import { LogOut, Bell, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/lib/types/roles';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser]           = useState<any>(null);
  const [profile, setProfile]     = useState<UserProfile | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady]         = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobile, setIsMobile]   = useState(false);

  useEffect(() => {
    // Detect mobile
    function checkMobile() {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) setCollapsed(true);
    }
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') setCollapsed(true);

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/login'; return; }
      setUser(user);
      const { data: p } = await supabase
        .from('user_profiles').select('*').eq('id', user.id).single();
      if (p) setProfile(p as UserProfile);
      const { count } = await supabase
        .from('notifications').select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id).eq('read', false);
      setUnreadCount(count ?? 0);
      setReady(true);
    });

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  function toggleSidebar() {
    if (isMobile) {
      setMobileOpen(v => !v);
    } else {
      const next = !collapsed;
      setCollapsed(next);
      localStorage.setItem('sidebar_collapsed', String(next));
    }
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

  const sw   = isMobile ? 0 : (collapsed ? 56 : 220);
  const role = profile?.role ?? 'staff';

  const sidebarContent = (
    <>
      {/* RGB line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #E02020 0%, #1B4FA8 50%, #2DB44A 100%)' }} />

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed && !isMobile ? 'center' : 'flex-start', padding: collapsed && !isMobile ? '16px 8px' : '16px', borderBottom: '1px solid #1C1C1F', gap: 8 }}>
        <MiosLogo size="sm" showWordmark collapsed={collapsed && !isMobile} />
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#71717A', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Role badge */}
      {(!collapsed || isMobile) && (
        <div style={{ margin: '8px 12px 4px', padding: '4px 10px', borderRadius: 6, background: role === 'dev' ? 'rgba(239,68,68,0.1)' : role === 'accountant' ? 'rgba(37,99,235,0.1)' : 'rgba(34,197,94,0.08)', border: `1px solid ${role === 'dev' ? 'rgba(239,68,68,0.2)' : role === 'accountant' ? 'rgba(37,99,235,0.2)' : 'rgba(34,197,94,0.15)'}`, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: role === 'dev' ? '#EF4444' : role === 'accountant' ? '#3B82F6' : '#22C55E', display: 'inline-block' }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: role === 'dev' ? '#EF4444' : role === 'accountant' ? '#3B82F6' : '#22C55E' }}>
            {role === 'dev' ? 'Developer' : role === 'accountant' ? 'Akuntan' : 'Staff'}
          </span>
        </div>
      )}

      <NavLinks collapsed={collapsed && !isMobile} onToggle={toggleSidebar} userRole={role} />

      {/* Footer */}
      <div style={{ borderTop: '1px solid #1C1C1F', padding: collapsed && !isMobile ? '8px 4px' : '8px 12px' }}>
        {(!collapsed || isMobile) && (
          <div style={{ padding: '4px 8px 8px' }}>
            <p style={{ fontSize: 10, fontWeight: 500, color: '#3A3A3E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
              {profile?.full_name ?? user?.email?.split('@')[0]}
            </p>
            <p style={{ fontSize: 11, color: '#52525B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </p>
          </div>
        )}
        {(!collapsed || isMobile) && unreadCount > 0 && (
          <Link href="/notifications" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', textDecoration: 'none' }}>
            <Bell size={13} style={{ color: '#3B82F6' }} />
            <span style={{ fontSize: 12, color: '#3B82F6', fontWeight: 600 }}>{unreadCount} notifikasi</span>
          </Link>
        )}
        <form action="/auth/signout" method="post">
          <button type="submit"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed && !isMobile ? 'center' : 'flex-start', gap: collapsed && !isMobile ? 0 : 8, padding: collapsed && !isMobile ? '8px 0' : '8px', borderRadius: 8, border: 'none', background: 'transparent', color: '#3A3A3E', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
            onMouseEnter={e => { (e.currentTarget as any).style.color = '#EF4444'; (e.currentTarget as any).style.background = '#1A0F0F'; }}
            onMouseLeave={e => { (e.currentTarget as any).style.color = '#3A3A3E'; (e.currentTarget as any).style.background = 'transparent'; }}>
            <LogOut size={14} />
            {(!collapsed || isMobile) && <span>Keluar</span>}
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0A0A0C' }}>

      {/* Desktop sidebar */}
      {!isMobile && (
        <aside style={{ width: sw, minWidth: sw, maxWidth: sw, height: '100vh', background: '#09090B', borderRight: '1px solid #1C1C1F', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative', transition: 'width 0.3s ease, min-width 0.3s ease, max-width 0.3s ease', zIndex: 20 }}>
          {sidebarContent}
        </aside>
      )}

      {/* Mobile: hamburger + drawer */}
      {isMobile && (
        <>
          {/* Top bar */}
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 52, background: '#09090B', borderBottom: '1px solid #1C1C1F', zIndex: 30, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
            <button onClick={() => setMobileOpen(true)}
              style={{ background: 'none', border: 'none', color: '#71717A', cursor: 'pointer', padding: 6 }}>
              <Menu size={20} />
            </button>
            <MiosLogo size="sm" showWordmark={false} />
            <div style={{ flex: 1 }} />
            {unreadCount > 0 && (
              <Link href="/notifications" style={{ position: 'relative', color: '#71717A', textDecoration: 'none' }}>
                <Bell size={18} />
                <span style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: '#EF4444', fontSize: 8, color: '#fff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unreadCount}
                </span>
              </Link>
            )}
          </div>

          {/* Drawer overlay */}
          {mobileOpen && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }}>
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }}
                onClick={() => setMobileOpen(false)} />
              <aside style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 260, background: '#09090B', borderRight: '1px solid #1C1C1F', display: 'flex', flexDirection: 'column', zIndex: 50, animation: 'slideInLeft 0.25s ease' }}>
                {sidebarContent}
              </aside>
            </div>
          )}
        </>
      )}

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', minWidth: 0, marginTop: isMobile ? 52 : 0 }}>
        <div style={{ position: 'fixed', top: isMobile ? 52 : 0, bottom: 0, right: 0, left: sw, backgroundImage: 'linear-gradient(rgba(37,99,235,0.008) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.008) 1px, transparent 1px)', backgroundSize: '52px 52px', pointerEvents: 'none', zIndex: 0, transition: 'left 0.3s' }} />
        <div style={{ position: 'relative', zIndex: 1, padding: isMobile ? '16px' : '32px', maxWidth: 1400, margin: '0 auto', minHeight: '100%' }}>
          {children}
        </div>
      </main>

      <Toaster position="bottom-right" theme="dark"
        toastOptions={{ style: { background: '#111114', border: '1px solid #1C1C1F', color: '#E4E4E7', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', borderRadius: '10px' } }} />
    </div>
  );
}
