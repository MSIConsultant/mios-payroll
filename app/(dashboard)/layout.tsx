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
  // Only collapse if user explicitly chose it — never collapse on first visit
  if (saved === 'true') setCollapsed(true);
  if (saved === null) setCollapsed(false); // first visit = always expanded
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
    <div style={{ minHeight: '100vh', background: '#0C0C0E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[['M','#E02020'],['I','#1B4FA8'],['O','#2DB44A'],['S','#1C1C1F']].map(([l, c], i) => (
          <div key={l} style={{
            width: 28, height: 28, background: c, borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 11, fontWeight: 900,
            animation: `pulse 1.5s ease-in-out ${i * 0.12}s infinite`,
          }}>{l}</div>
        ))}
      </div>
    </div>
  );

  const sw = collapsed ? 56 : 220;

  return (
    /* CRITICAL: inline styles guarantee layout regardless of Tailwind hydration */
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: '#0C0C0E',
    }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: sw,
        minWidth: sw,
        maxWidth: sw,
        height: '100vh',
        background: '#09090B',
        borderRight: '1px solid #1C1C1F',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative',
        transition: 'width 0.3s ease, min-width 0.3s ease, max-width 0.3s ease',
        zIndex: 20,
      }}>
        {/* RGB top line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, #E02020 0%, #1B4FA8 50%, #2DB44A 100%)',
        }} />

        {/* Logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '16px 8px' : '16px',
          borderBottom: '1px solid #1C1C1F',
          transition: 'padding 0.3s',
        }}>
          <MiosLogo size="sm" showWordmark collapsed={collapsed} />
        </div>

        {/* Live pill */}
        {!collapsed && (
          <div style={{
            margin: '12px 12px 4px',
            padding: '6px 12px',
            borderRadius: 999,
            background: '#0F1F0F',
            border: '1px solid #1A2E1A',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ position: 'relative', display: 'flex', width: 6, height: 6 }}>
              <span className="animate-ping" style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: '#22C55E', opacity: 0.75,
              }} />
              <span style={{
                position: 'relative', width: 6, height: 6,
                borderRadius: '50%', background: '#22C55E',
              }} />
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(34,197,94,0.7)' }}>
              Sistem Aktif
            </span>
          </div>
        )}

        {/* Nav */}
        <NavLinks collapsed={collapsed} onToggle={toggleSidebar} />

        {/* Footer */}
        <div style={{
          borderTop: '1px solid #1C1C1F',
          padding: collapsed ? '8px 4px' : '8px 12px',
        }}>
          {!collapsed && (
            <div style={{ padding: '4px 8px 8px' }}>
              <p style={{ fontSize: 10, fontWeight: 500, color: '#3A3A3E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                Operator
              </p>
              <p style={{ fontSize: 12, color: '#71717A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </p>
            </div>
          )}
          <form action="/auth/signout" method="post">
            <button type="submit"
              title={collapsed ? 'Keluar' : undefined}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: collapsed ? 0 : 8,
                padding: collapsed ? '8px 0' : '8px',
                borderRadius: 8, border: 'none', background: 'transparent',
                color: '#3A3A3E', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                transition: 'color 0.2s, background 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.color = '#EF4444';
                (e.currentTarget as HTMLButtonElement).style.background = '#1A0F0F';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.color = '#3A3A3E';
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}>
              <LogOut size={14} />
              {!collapsed && <span>Keluar</span>}
            </button>
          </form>
          {!collapsed && (
            <div style={{ display: 'flex', gap: 12, padding: '4px 8px 0' }}>
              <Link href="/terms" style={{ fontSize: 10, color: '#2A2A2E', textDecoration: 'none' }}>Syarat</Link>
              <Link href="/privacy" style={{ fontSize: 10, color: '#2A2A2E', textDecoration: 'none' }}>Privasi</Link>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        minWidth: 0,
      }}>
        {/* Ambient grid */}
        <div style={{
          position: 'fixed',
          top: 0, bottom: 0, right: 0,
          left: sw,
          backgroundImage:
            'linear-gradient(rgba(37,99,235,0.008) 1px, transparent 1px), ' +
            'linear-gradient(90deg, rgba(37,99,235,0.008) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
          pointerEvents: 'none',
          zIndex: 0,
          transition: 'left 0.3s',
        }} />

        <div style={{
          position: 'relative',
          zIndex: 1,
          padding: '32px',
          maxWidth: 1400,
          margin: '0 auto',
          minHeight: '100%',
        }}>
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
        }}
      />
    </div>
  );
}
