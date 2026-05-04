'use client';
import { useEffect, useState } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import NavLinks from '@/components/layout/NavLinks';
import MiosLogo from '@/components/ui/MiosLogo';
import { Toaster } from 'sonner';
import { LogOut } from 'lucide-react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser]           = useState<any>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady]         = useState(false);

  useEffect(() => {
    // Restore collapsed state
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') setCollapsed(true);

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
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
    <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center">
      <div className="flex gap-1">
        {['M','I','O','S'].map((l, i) => (
          <div key={l} className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-black animate-pulse"
            style={{
              background: ['#E02020','#1B4FA8','#2DB44A','#1A1A1C'][i],
              color: '#fff',
              animationDelay: `${i * 0.15}s`,
            }}>{l}</div>
        ))}
      </div>
    </div>
  );

  const sidebarW = collapsed ? 56 : 208;

  return (
    <div className="flex h-screen bg-[#0D0D0F] overflow-hidden text-zinc-100">
      {/* Sidebar */}
      <aside
        className="bg-[#080809] border-r border-[#1A1A1C] flex flex-col flex-shrink-0 relative transition-all duration-300"
        style={{ width: sidebarW }}>
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, #E02020, #1B4FA8, #2DB44A)' }} />

        {/* Logo */}
        <div className={`border-b border-[#1A1A1C] flex items-center transition-all duration-300 ${
          collapsed ? 'px-3 py-5 justify-center' : 'px-5 py-5 justify-start'
        }`}>
          <MiosLogo size="md" showWordmark collapsed={collapsed} />
        </div>

        {/* Live indicator — only when expanded */}
        {!collapsed && (
          <div className="px-4 py-2 border-b border-[#1A1A1C] flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
            </span>
            <p className="text-[9px] text-zinc-700 uppercase tracking-widest font-mono">sistem aktif</p>
          </div>
        )}

        <NavLinks collapsed={collapsed} onToggle={toggleSidebar} />

        {/* User + signout */}
        <div className={`p-2 border-t border-[#1A1A1C] mt-auto ${collapsed ? '' : 'px-3'}`}>
          {!collapsed && (
            <div className="px-2 py-2 mb-1">
              <p className="text-[9px] text-zinc-700 uppercase tracking-widest font-mono mb-0.5">operator</p>
              <p className="text-[11px] text-zinc-500 truncate font-mono">{user?.email}</p>
            </div>
          )}
          <form action="/auth/signout" method="post">
            <button type="submit"
              title={collapsed ? 'Keluar' : undefined}
              className={`w-full flex items-center rounded-lg py-2 text-[11px] text-zinc-700 hover:text-red-400 hover:bg-[#111113] transition-all font-mono uppercase tracking-widest ${
                collapsed ? 'justify-center px-0' : 'gap-2 px-3'
              }`}>
              <LogOut size={12} />
              {!collapsed && 'Keluar'}
            </button>
          </form>
          {!collapsed && (
            <div className="flex gap-3 px-2 pt-2">
              <Link href="/terms"   className="text-[9px] text-zinc-800 hover:text-zinc-600 font-mono uppercase tracking-widest">Syarat</Link>
              <Link href="/privacy" className="text-[9px] text-zinc-800 hover:text-zinc-600 font-mono uppercase tracking-widest">Privasi</Link>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto relative min-w-0">
        {/* Ambient grid */}
        <div className="fixed inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(37,99,235,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.012) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            left: sidebarW,
            transition: 'left 0.3s',
          }} />

        <div className="relative z-10 p-8 min-h-full">
          {children}
        </div>
      </main>

      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: '#111113',
            border: '1px solid #1A1A1C',
            color: '#e4e4e7',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '13px',
          },
        }}
      />
    </div>
  );
}
