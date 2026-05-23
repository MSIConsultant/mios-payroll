'use client';
import { useEffect, useState } from 'react';
import NavLinks from '@/components/layout/NavLinks';
import MiosLogo from '@/components/ui/MiosLogo';
import { LogOut, Bell, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/lib/types/roles';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';

const ROLE_LABEL: Record<string, string> = {
  dev: 'Developer',
  accountant: 'Akuntan',
  staff: 'Staff',
};

const ROLE_CLASSES: Record<string, string> = {
  dev: 'bg-red-900/40 text-red-300 ring-red-700/40',
  accountant: 'bg-blue-900/40 text-blue-300 ring-blue-700/40',
  staff: 'bg-emerald-900/40 text-emerald-300 ring-emerald-700/40',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<any>(null);
  const [profile, setProfile]         = useState<UserProfile | null>(null);
  const [collapsed, setCollapsed]     = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [ready, setReady]             = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobile, setIsMobile]       = useState(false);

  useEffect(() => {
    function checkMobile() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setCollapsed(true);
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

  if (!ready) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
        <div className="flex gap-1.5">
          {[['M','#E02020'],['I','#1B4FA8'],['O','#2DB44A'],['S','#0F172A']].map(([l, c], i) => (
            <div
              key={l}
              className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-extrabold animate-pulse"
              style={{ background: c, animationDelay: `${i * 0.12}s` }}
            >
              {l}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const sidebarWidth = isMobile ? 0 : (collapsed ? 64 : 240);
  const role = profile?.role ?? 'staff';
  const displayName = profile?.full_name ?? user?.email?.split('@')[0] ?? 'User';
  const initials = displayName.charAt(0).toUpperCase();

  const sidebarContent = (
    <>
      {/* Logo */}
      <div
        className={`flex items-center border-b border-[var(--sidebar-border)] ${
          collapsed && !isMobile ? 'justify-center px-2 py-4' : 'justify-between px-4 py-4'
        }`}
      >
        <MiosLogo size="sm" showWordmark collapsed={collapsed && !isMobile} />
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] p-1 rounded-md cursor-pointer"
            aria-label="Tutup menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Role badge */}
      {(!collapsed || isMobile) && (
        <div className="px-3 pt-3 pb-1">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${ROLE_CLASSES[role] ?? ROLE_CLASSES.staff}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {ROLE_LABEL[role] ?? 'User'}
          </span>
        </div>
      )}

      {/* Nav */}
      <NavLinks collapsed={collapsed && !isMobile} onToggle={toggleSidebar} userRole={role} />

      {/* Footer */}
      <div className="border-t border-[var(--sidebar-border)] px-2 py-3">
        {(!collapsed || isMobile) && (
          <div className="flex items-center gap-2.5 px-2 pb-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[var(--sidebar-text-active)] truncate">
                {displayName}
              </p>
              <p className="text-[11px] text-[var(--sidebar-text)] truncate">
                {user?.email}
              </p>
            </div>
          </div>
        )}

        {(!collapsed || isMobile) && unreadCount > 0 && (
          <Link
            href="/notifications"
            className="flex items-center gap-2 px-2.5 py-2 rounded-md mb-1 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 transition-colors"
          >
            <Bell size={14} />
            <span className="text-[12px] font-semibold">{unreadCount} notifikasi</span>
          </Link>
        )}

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className={`w-full flex items-center rounded-md transition-colors cursor-pointer text-[var(--sidebar-text)] hover:bg-red-900/30 hover:text-red-300 ${
              collapsed && !isMobile ? 'justify-center py-2' : 'justify-start gap-2 px-2.5 py-2'
            }`}
            title="Keluar"
          >
            <LogOut size={15} />
            {(!collapsed || isMobile) && <span className="text-[13px] font-medium">Keluar</span>}
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-app)]">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside
          className="h-screen bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] flex flex-col flex-shrink-0 relative z-20 transition-[width,min-width,max-width] duration-200"
          style={{
            width: sidebarWidth,
            minWidth: sidebarWidth,
            maxWidth: sidebarWidth,
          }}
        >
          {sidebarContent}
        </aside>
      )}

      {/* Mobile: top bar + drawer */}
      {isMobile && (
        <>
          <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-[var(--border-default)] z-30 flex items-center px-4 gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1.5 rounded-md cursor-pointer"
              aria-label="Buka menu"
            >
              <Menu size={20} />
            </button>
            <MiosLogo size="sm" showWordmark={false} />
            <div className="flex-1" />
            {unreadCount > 0 && (
              <Link href="/notifications" className="relative text-[var(--text-secondary)] hover:text-[var(--brand)] p-1.5">
                <Bell size={18} />
                <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </Link>
            )}
          </div>

          {mobileOpen && (
            <div className="fixed inset-0 z-40">
              <div
                className="absolute inset-0 bg-[var(--bg-overlay)]"
                onClick={() => setMobileOpen(false)}
              />
              <aside className="absolute top-0 left-0 bottom-0 w-72 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] flex flex-col z-50 animate-slide-left shadow-xl">
                {sidebarContent}
              </aside>
            </div>
          )}
        </>
      )}

      {/* Main */}
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden relative min-w-0"
        style={{ marginTop: isMobile ? 56 : 0 }}
      >
        <div className="relative z-10 px-4 py-6 md:px-8 md:py-10 max-w-[1400px] mx-auto min-h-full">
          <ConfirmProvider>{children}</ConfirmProvider>
        </div>
      </main>

    </div>
  );
}
