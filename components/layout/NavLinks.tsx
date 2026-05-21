'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Layers, Settings,
  ChevronLeft, ChevronRight, Users, ScrollText,
  Terminal, Upload, FlaskConical,
} from 'lucide-react';
import type { UserRole } from '@/lib/types/roles';

function buildNav(role: UserRole) {
  const base = [
    { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
    { href: '/batch',      label: 'Batch Run',  icon: Layers },
    { href: '/companies',  label: 'Perusahaan', icon: Building2 },
    { href: '/simulasi', label: 'Simulasi', icon: FlaskConical },
  ];
  if (role === 'accountant' || role === 'dev') {
    base.push({ href: '/import',   label: 'Import',     icon: Upload     });
    base.push({ href: '/staff',    label: 'Staff',      icon: Users      });
    base.push({ href: '/logs',     label: 'Audit Log',  icon: ScrollText });
    base.push({ href: '/settings', label: 'Pengaturan', icon: Settings   });
  }
  if (role === 'dev') {
    base.push({ href: '/dev/admin', label: 'Dev Panel', icon: Terminal });
  }
  return base;
}

export default function NavLinks({
  collapsed, onToggle, userRole = 'staff',
}: {
  collapsed: boolean;
  onToggle: () => void;
  userRole?: UserRole;
}) {
  const pathname = usePathname();
  const NAV = buildNav(userRole);

  return (
    <nav className="flex-1 px-2 pt-3 flex flex-col gap-0.5 overflow-y-auto">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className={`relative flex items-center gap-3 rounded-lg transition-colors duration-150 group cursor-pointer ${
              collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2'
            } ${
              active
                ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[var(--brand)] rounded-r-full" />
            )}
            <Icon size={17} className="shrink-0" />
            {!collapsed && (
              <span className="text-[13.5px] font-semibold whitespace-nowrap">{label}</span>
            )}
            {collapsed && (
              <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white rounded-md text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                {label}
              </span>
            )}
          </Link>
        );
      })}

      <div className="flex-1" />

      <button
        onClick={onToggle}
        className={`flex items-center justify-center w-full rounded-lg py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer ${
          collapsed ? 'px-0' : 'px-3 gap-2'
        }`}
        aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
      >
        {collapsed ? (
          <ChevronRight size={15} />
        ) : (
          <>
            <ChevronLeft size={15} />
            <span className="text-xs font-medium">Collapse</span>
          </>
        )}
      </button>
    </nav>
  );
}
