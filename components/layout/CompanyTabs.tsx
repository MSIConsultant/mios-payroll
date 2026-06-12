'use client';
// Workbook tab bar for a company (workbook PR 2). Active tab derives from
// the pathname so nested routes (employees/[empId], payroll/[tahun]/[bulan])
// keep their parent tab highlighted. REKAP joins in workbook PR 3.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Building2, CalendarDays, Users, Database, Table } from 'lucide-react';

export function CompanyTabs({ companyId, companyName, aktif }: {
  companyId: string;
  companyName: string | null;
  aktif: boolean;
}) {
  const pathname = usePathname();
  const now = new Date();
  const base = `/companies/${companyId}`;

  const tabs = [
    { id: 'bulan',    label: 'Bulan',    icon: CalendarDays, href: `${base}/payroll/${now.getFullYear()}/${now.getMonth() + 1}`, match: `${base}/payroll` },
    { id: 'rekap',    label: 'REKAP',    icon: Table,        href: `${base}/rekap`, match: `${base}/rekap` },
    { id: 'karyawan', label: 'Karyawan', icon: Users,        href: `${base}/employees`, match: `${base}/employees` },
    { id: 'data',     label: 'Data',     icon: Database,     href: `${base}/data`, match: `${base}/data` },
  ];

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-xl px-4 sm:px-5 pt-3.5">
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/companies"
          className="inline-flex items-center gap-1 text-[13px] text-[var(--text-muted)] hover:text-[var(--brand)] transition-colors shrink-0"
          title="Semua perusahaan"
        >
          <ArrowLeft size={14} />
        </Link>
        <div className="w-8 h-8 rounded-lg bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center shrink-0">
          <Building2 size={16} />
        </div>
        <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)] truncate min-w-0">
          {companyName ?? 'Perusahaan'}
        </h1>
        {!aktif && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset bg-slate-100 text-slate-600 ring-slate-200">
            Arsip
          </span>
        )}
      </div>

      <nav className="mt-2.5 -mb-px flex gap-1 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon, href, match }) => {
          const active = pathname.startsWith(match);
          return (
            <Link
              key={id}
              href={href}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-[var(--brand)] text-[var(--brand)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon size={14} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
