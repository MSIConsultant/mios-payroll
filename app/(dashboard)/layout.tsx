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
  dev: 'bg-red-50 text-red-700 ring-red-200',
  accountant: 'bg-blue-50 text-blue-700 ring-blue-200',
  staff: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
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

  const sidebarContent = (
    <>
      {/* Logo */}
      <div
        className={`flex items-center border-b border-[var(--border-subtle)] ${
          collapsed && !isMobile ? 'justify-center px-2 py-4' : 'justify-between px-4 py-4'
        }`}
      >
        <MiosLogo size="sm" showWordmark collapsed={collapsed && !isMobile} />
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md cursor-pointer"
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
      <div className="border-t border-[var(--border-subtle)] px-2 py-3">
        {(!collapsed || isMobile) && (
          <div className="px-2 pb-2">
            <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
              {displayName}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] truncate">
              {user?.email}
            </p>
          </div>
        )}

        {(!collapsed || isMobile) && unreadCount > 0 && (
          <Link
            href="/notifications"
            className="flex items-center gap-2 px-2.5 py-2 rounded-md mb-1 bg-[var(--brand-soft)] text-[var(--brand)] hover:bg-blue-100 transition-colors"
          >
            <Bell size={14} />
            <span className="text-[12px] font-semibold">{unreadCount} notifikasi</span>
          </Link>
        )}

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className={`w-full flex items-center rounded-md transition-colors cursor-pointer text-[var(--text-muted)] hover:bg-red-50 hover:text-red-600 ${
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
          className="h-screen bg-[var(--bg-sidebar)] border-r border-[var(--border-default)] flex flex-col flex-shrink-0 relative z-20 transition-[width,min-width,max-width] duration-200"
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
              <aside className="absolute top-0 left-0 bottom-0 w-72 bg-[var(--bg-sidebar)] border-r border-[var(--border-default)] flex flex-col z-50 animate-slide-left shadow-xl">
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
