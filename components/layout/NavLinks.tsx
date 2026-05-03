'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Layers, Settings, ChevronLeft, ChevronRight } from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/batch',     label: 'Batch Run',    icon: Layers },
  { href: '/companies', label: 'Perusahaan',   icon: Building2 },
  { href: '/settings',  label: 'Pengaturan',   icon: Settings },
];

interface NavLinksProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function NavLinks({ collapsed, onToggle }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-2 pt-3 space-y-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
        return (
          <Link key={href} href={href}
            title={collapsed ? label : undefined}
            className={`flex items-center gap-3 rounded-lg transition-all duration-200 group relative ${
              collapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2.5'
            } ${
              active
                ? 'bg-[#1A1A1C] border-l-2 border-[#2563EB] text-[#2563EB]'
                : 'text-zinc-600 border-l-2 border-transparent hover:bg-[#111113] hover:text-zinc-300'
            }`}>
            <Icon size={15} className={active ? 'text-[#2563EB] shrink-0' : 'text-zinc-700 shrink-0 group-hover:text-zinc-400'} />
            {!collapsed && (
              <span className="font-bold text-[11px] uppercase tracking-widest whitespace-nowrap">{label}</span>
            )}
            {/* Tooltip when collapsed */}
            {collapsed && (
              <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#1A1A1C] border border-[#2D2D30] rounded-lg text-[11px] font-bold uppercase tracking-widest text-zinc-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {label}
              </div>
            )}
          </Link>
        );
      })}

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center rounded-lg px-3 py-2.5 text-zinc-800 hover:text-zinc-500 hover:bg-[#111113] transition-all duration-200 mt-4 ${
          collapsed ? 'justify-center' : 'gap-3'
        }`}>
        {collapsed
          ? <ChevronRight size={13} />
          : <>
              <ChevronLeft size={13} />
              <span className="text-[10px] uppercase tracking-widest font-bold">Sembunyikan</span>
            </>
        }
      </button>
    </nav>
  );
}
