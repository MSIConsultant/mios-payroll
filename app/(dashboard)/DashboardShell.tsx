'use client';
import { useEffect, useState } from 'react';
import NavLinks from '@/components/layout/NavLinks';
import MiosLogo from '@/components/ui/MiosLogo';
import { LogOut, Menu, X } from 'lucide-react';
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

export interface DashboardShellProps {
  userEmail: string;
  fullName: string | null;
  role: 'dev' | 'accountant' | 'staff';
  children: React.ReactNode;
}

export default function DashboardShell({
  userEmail,
  fullName,
  role,
  children,
}: DashboardShellProps) {
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile]     = useState(false);

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

  const sidebarWidth = isMobile ? 0 : (collapsed ? 64 : 240);
  const displayName  = fullName ?? userEmail.split('@')[0] ?? 'User';
  const initials     = displayName.charAt(0).toUpperCase();

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
                {userEmail}
              </p>
            </div>
          </div>
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
