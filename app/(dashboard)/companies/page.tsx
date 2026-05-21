'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Company } from '@/lib/types';
import {
  Plus,
  Search,
  Lock,
  CheckCircle2,
  Clock,
  ChevronRight,
  Building2,
  Users,
} from 'lucide-react';

const BULAN_SHORT = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

type RunStatus = 'locked' | 'calculated' | 'draft' | 'none';

interface CompanyWithMeta extends Company {
  _empCount?: number;
  _runStatus?: RunStatus;
  _runBulan?: number;
  _runTahun?: number;
}

const STATUS_CONFIG: Record<
  RunStatus,
  { label: string; icon: typeof Lock; ring: string; text: string; bg: string }
> = {
  locked: {
    label: 'Terkunci',
    icon: Lock,
    ring: 'ring-emerald-200',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
  },
  calculated: {
    label: 'Dihitung',
    icon: CheckCircle2,
    ring: 'ring-sky-200',
    text: 'text-sky-700',
    bg: 'bg-sky-50',
  },
  draft: {
    label: 'Draft',
    icon: Clock,
    ring: 'ring-amber-200',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
  },
  none: {
    label: 'Belum Run',
    icon: Clock,
    ring: 'ring-slate-200',
    text: 'text-slate-500',
    bg: 'bg-slate-50',
  },
};

function StatusBadge({ status }: { status: RunStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset ${cfg.bg} ${cfg.text} ${cfg.ring}`}
    >
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function CompanyAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  // simple stable hue from name
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return (
    <div
      className="shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-sm"
      style={{ background: `hsl(${hue} 55% 45%)` }}
      aria-hidden="true"
    >
      {initials || <Building2 size={18} />}
    </div>
  );
}

export default function CompaniesPage() {
  const now = new Date();
  const bulanIni = now.getMonth() + 1;
  const tahunIni = now.getFullYear();

  const { workspace, loading: wsLoading } = useWorkspace();

  const [companies, setCompanies] = useState<CompanyWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<RunStatus | 'all'>('all');

  useEffect(() => {
    async function fetchData() {
      if (!workspace) {
        setLoading(false);
        return;
      }

      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, workspace_id')
        .eq('id', user.id)
        .single();

      const workspaceId = profile?.workspace_id;
      const isStaff = profile?.role === 'staff';

      let companiesData: Company[] = [];

      if (isStaff) {
        const { data: access } = await supabase
          .from('company_staff_access')
          .select('company_id')
          .eq('staff_user_id', user.id);

        const allowedIds = (access ?? []).map((a) => a.company_id) ?? [];

        if (allowedIds.length > 0) {
          const { data } = await supabase
            .from('companies')
            .select('*')
            .eq('workspace_id', workspaceId)
            .in('id', allowedIds)
            .eq('aktif', true)
            .order('name');

          companiesData = (data ?? []) as Company[];
        }
      } else {
        const { data } = await supabase
          .from('companies')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('aktif', true)
          .order('name');

        companiesData = (data ?? []) as Company[];
      }

      const companyIds = companiesData.map((c) => c.id);

      const [{ data: runs }, { data: emps }] = await Promise.all([
        companyIds.length > 0
          ? supabase
              .from('payroll_runs')
              .select('company_id, status, bulan, tahun')
              .in('company_id', companyIds)
              .eq('tahun', tahunIni)
              .eq('bulan', bulanIni)
          : Promise.resolve({ data: [] }),

        companyIds.length > 0
          ? supabase
              .from('employees')
              .select('company_id')
              .in('company_id', companyIds)
              .eq('aktif', true)
          : Promise.resolve({ data: [] }),
      ]);

      const runMap: Record<string, RunStatus> = {};
      for (const r of runs ?? []) runMap[r.company_id] = r.status as RunStatus;

      const empMap: Record<string, number> = {};
      for (const e of emps ?? []) empMap[e.company_id] = (empMap[e.company_id] ?? 0) + 1;

      setCompanies(
        companiesData.map((co) => ({
          ...co,
          _empCount: empMap[co.id] ?? 0,
          _runStatus: runMap[co.id] ?? 'none',
          _runBulan: bulanIni,
          _runTahun: tahunIni,
        })),
      );

      setLoading(false);
    }

    if (!wsLoading) fetchData();
  }, [workspace, wsLoading, bulanIni, tahunIni]);

  const filtered = companies.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.kota?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c._runStatus === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    locked: companies.filter((c) => c._runStatus === 'locked').length,
    calculated: companies.filter((c) => c._runStatus === 'calculated').length,
    none: companies.filter((c) => c._runStatus === 'none').length,
  };

  const totalEmployees = companies.reduce((sum, c) => sum + (c._empCount ?? 0), 0);

  return (
    <div className="space-y-7 animate-fade-in-up">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Perusahaan
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {companies.length} klien aktif · {totalEmployees} karyawan · periode{' '}
            <span className="font-semibold text-[var(--text-secondary)]">
              {BULAN_SHORT[bulanIni]} {tahunIni}
            </span>
          </p>
        </div>

        <Link
          href="/companies/new"
          className="inline-flex items-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
        >
          <Plus size={16} />
          Tambah Perusahaan
        </Link>
      </header>

      {/* Status summary */}
      {companies.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox
            label="Total"
            value={companies.length}
            active={filterStatus === 'all'}
            onClick={() => setFilterStatus('all')}
            accent="slate"
          />
          <StatBox
            label="Terkunci"
            value={counts.locked}
            active={filterStatus === 'locked'}
            onClick={() => setFilterStatus(filterStatus === 'locked' ? 'all' : 'locked')}
            accent="emerald"
          />
          <StatBox
            label="Dihitung"
            value={counts.calculated}
            active={filterStatus === 'calculated'}
            onClick={() => setFilterStatus(filterStatus === 'calculated' ? 'all' : 'calculated')}
            accent="sky"
          />
          <StatBox
            label="Belum Run"
            value={counts.none}
            active={filterStatus === 'none'}
            onClick={() => setFilterStatus(filterStatus === 'none' ? 'all' : 'none')}
            accent="amber"
          />
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
        />
        <input
          type="text"
          placeholder="Cari nama perusahaan atau kota…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all"
        />
      </div>

      {/* Company list */}
      {loading || wsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[76px] bg-white border border-[var(--border-default)] rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-[var(--border-default)] rounded-xl py-16 text-center">
          <Building2 size={32} className="mx-auto text-[var(--text-faint)]" />
          <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">
            {companies.length === 0 ? 'Belum ada perusahaan' : 'Tidak ada hasil yang cocok'}
          </p>
          {companies.length === 0 && (
            <Link
              href="/companies/new"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:underline"
            >
              <Plus size={14} />
              Tambah perusahaan pertama
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((co, i) => {
            const status = co._runStatus ?? 'none';
            return (
              <li
                key={co.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${Math.min(i, 8) * 0.03}s`, opacity: 0 }}
              >
                <Link
                  href={`/companies/${co.id}`}
                  className="group flex items-center gap-4 bg-white border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:shadow-md rounded-xl px-4 py-3.5 transition-all"
                >
                  <CompanyAvatar name={co.name} />

                  {/* Name + meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-[15px] sm:text-base font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors truncate">
                        {co.name}
                      </h2>
                      <span className="sm:hidden">
                        <StatusBadge status={status} />
                      </span>
                    </div>
                    <p className="text-[13px] text-[var(--text-muted)] mt-0.5 truncate">
                      {co.kota ?? '—'}
                      {co.industri ? ` · ${co.industri}` : ''}
                    </p>
                  </div>

                  {/* Employee count */}
                  <div className="hidden sm:flex flex-col items-end shrink-0 pr-2">
                    <span className="inline-flex items-center gap-1 text-[15px] font-semibold text-[var(--text-primary)] font-mono">
                      <Users size={13} className="text-[var(--text-muted)]" />
                      {co._empCount ?? 0}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] mt-0.5">karyawan</span>
                  </div>

                  {/* Status */}
                  <div className="hidden sm:flex flex-col items-end shrink-0">
                    <StatusBadge status={status} />
                    <span className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
                      {BULAN_SHORT[bulanIni]} {tahunIni}
                    </span>
                  </div>

                  <ChevronRight
                    size={18}
                    className="text-[var(--text-faint)] group-hover:text-[var(--brand)] group-hover:translate-x-0.5 transition-all shrink-0"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  active,
  onClick,
  accent,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  accent: 'slate' | 'emerald' | 'sky' | 'amber';
}) {
  const accentMap = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-700',
    sky: 'text-sky-700',
    amber: 'text-amber-700',
  } as const;

  return (
    <button
      onClick={onClick}
      className={`text-left bg-white rounded-xl border px-4 py-3 transition-all cursor-pointer ${
        active
          ? 'border-[var(--brand)] ring-2 ring-[var(--brand-ring)] shadow-sm'
          : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:shadow-sm'
      }`}
    >
      <p className={`text-2xl font-bold font-mono ${accentMap[accent]}`}>{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mt-1">
        {label}
      </p>
    </button>
  );
}
