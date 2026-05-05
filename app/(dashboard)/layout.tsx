'use client';
import { useEffect, useState } from 'react';
import NavLinks from '@/components/layout/NavLinks';
import MiosLogo from '@/components/ui/MiosLogo';
import { Toaster } from 'sonner';
import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser]           = useState<any>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady]         = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') setCollapsed(true);

    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) window.location.href = '/login';
      else { setUser(user); setReady(true); }
    });
  }, []);

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  }

  if (!ready) return (
    <div className="min-h-screen bg-[#0C0C0E] flex items-center justify-center">
      <div className="flex gap-1.5 items-center">
        {[
          { l: 'M', c: '#E02020' },
          { l: 'I', c: '#1B4FA8' },
          { l: 'O', c: '#2DB44A' },
          { l: 'S', c: '#1C1C1F' },
        ].map(({ l, c }, i) => (
          <div key={l}
            className="w-7 h-7 rounded flex items-center justify-center text-[11px] font-black text-white animate-pulse"
            style={{ background: c, animationDelay: `${i * 0.12}s` }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );

  const sw = collapsed ? 56 : 220;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* ── Sidebar ── */}
      <aside
        style={{ width: sw, background: 'var(--bg-sidebar)' }}
        className="flex flex-col flex-shrink-0 border-r border-[#1C1C1F] relative transition-[width] duration-300 ease-in-out z-20">

        {/* RGB top line */}
        <div className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, #E02020 0%, #1B4FA8 50%, #2DB44A 100%)' }} />

        {/* Logo */}
        <div className={`flex items-center border-b border-[#1C1C1F] transition-all duration-300 ${
          collapsed ? 'justify-center px-2 py-4' : 'px-4 py-4'
        }`}>
          <MiosLogo size="sm" showWordmark collapsed={collapsed} />
        </div>

        {/* Live pill — only expanded */}
        {!collapsed && (
          <div className="mx-3 mt-3 mb-1 px-3 py-1.5 rounded-full bg-[#0F1F0F] border border-[#1A2E1A] flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#22C55E]" />
            </span>
            <span className="text-[11px] font-medium text-[#22C55E]/70">Sistem Aktif</span>
          </div>
        )}

        {/* Nav */}
        <NavLinks collapsed={collapsed} onToggle={toggleSidebar} />

        {/* Footer */}
        <div className={`border-t border-[#1C1C1F] p-2 ${collapsed ? '' : 'px-3'}`}>
          {!collapsed && (
            <div className="px-2 pb-2">
              <p className="text-[10px] font-medium text-[#3A3A3E] uppercase tracking-widest mb-0.5">Operator</p>
              <p className="text-[12px] text-[#71717A] truncate">{user?.email}</p>
            </div>
          )}

          <form action="/auth/signout" method="post">
            <button type="submit"
              title={collapsed ? 'Keluar' : undefined}
              className={`w-full flex items-center rounded-lg py-2 text-[#3A3A3E] hover:text-red-400 hover:bg-[#1A0F0F] transition-all duration-200 cursor-pointer ${
                collapsed ? 'justify-center px-0' : 'gap-2 px-2'
              }`}>
              <LogOut size={14} />
              {!collapsed && <span className="text-xs font-medium">Keluar</span>}
            </button>
          </form>

          {!collapsed && (
            <div className="flex gap-3 px-2 pt-1">
              <Link href="/terms"
                className="text-[10px] text-[#2A2A2E] hover:text-[#52525B] transition-colors">
                Syarat
              </Link>
              <Link href="/privacy"
                className="text-[10px] text-[#2A2A2E] hover:text-[#52525B] transition-colors">
                Privasi
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto relative min-w-0">
        {/* Subtle grid */}
        <div className="fixed inset-0 pointer-events-none z-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(37,99,235,0.008) 1px, transparent 1px), ' +
              'linear-gradient(90deg, rgba(37,99,235,0.008) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
            left: sw,
            transition: 'left 0.3s',
          }} />

        <div className="relative z-10 p-8 max-w-[1400px] mx-auto min-h-full">
          {children}
        </div>
      </main>

      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: '#111114',
            border: '1px solid #1C1C1F',
            color: '#E4E4E7',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '13px',
            borderRadius: '10px',
          },
          classNames: {
            success: '!border-green-900/50',
            error:   '!border-red-900/50',
          },
        }}
      />
    </div>
  );
}
