'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Layers, Settings,
  ChevronLeft, ChevronRight
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/batch',     label: 'Batch Run',  icon: Layers },
  { href: '/companies', label: 'Perusahaan', icon: Building2 },
  { href: '/settings',  label: 'Pengaturan', icon: Settings },
];

export default function NavLinks({
  collapsed, onToggle
}: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-2 pt-2 flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href ||
          (href !== '/dashboard' && pathname.startsWith(href));
        return (
          <Link key={href} href={href}
            title={collapsed ? label : undefined}
            className={`relative flex items-center gap-3 rounded-lg transition-all duration-200 group cursor-pointer ${
              collapsed ? 'px-0 py-3 justify-center' : 'px-3 py-2.5'
            } ${
              active
                ? 'bg-[#1A2744] text-[#3B82F6]'
                : 'text-[#71717A] hover:bg-[#16161A] hover:text-[#A1A1AA]'
            }`}>
            {/* Active left bar */}
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#3B82F6] rounded-r-full" />
            )}
            <Icon
              size={16}
              className={active ? 'text-[#3B82F6] shrink-0' : 'shrink-0 transition-colors'}
            />
            {!collapsed && (
              <span className="text-sm font-600 font-semibold whitespace-nowrap">
                {label}
              </span>
            )}
            {/* Tooltip on collapsed */}
            {collapsed && (
              <span className="absolute left-full ml-4 px-3 py-1.5 bg-[#1C1C1F] border border-[#2A2A2E] rounded-lg text-xs font-semibold text-[#E4E4E7] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                {label}
              </span>
            )}
          </Link>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Toggle — subtle, at bottom of nav */}
      <button
        onClick={onToggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={`flex items-center justify-center w-full rounded-lg py-2 text-[#3A3A3E] hover:text-[#71717A] hover:bg-[#16161A] transition-all duration-200 cursor-pointer ${
          collapsed ? 'px-0' : 'px-3 gap-2'
        }`}>
        {collapsed
          ? <ChevronRight size={14} />
          : <>
              <ChevronLeft size={14} />
              <span className="text-xs font-medium">Collapse</span>
            </>
        }
      </button>
    </nav>
  );
}
