'use client';
// Home — the list of company "databases" (workbook PR 4). Absorbs the old
// dashboard + batch + companies-list pages: one screen the accountant opens
// to pick a company and see its current-month status + totals at a glance.

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Lock, CheckCircle2, Clock, Building2, Users, Upload, FileSpreadsheet,
} from 'lucide-react';
import { formatRupiah } from '@/lib/format';

const BULAN_ID = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export type HomeRunStatus = 'locked' | 'calculated' | 'draft' | 'none';

export interface HomeCompany {
  id: string;
  name: string;
  kota: string | null;
  empCount: number;
  status: HomeRunStatus;
  /** Current-month totals — present once the run is calculated/locked. */
  bruto?: number;
  pph?: number;
  thp?: number;
}

const STATUS_CONFIG: Record<HomeRunStatus, { label: string; icon: typeof Lock; ring: string; text: string; bg: string; dot: string }> = {
  locked:     { label: 'Terkunci', icon: Lock,         ring: 'ring-emerald-200', text: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
  calculated: { label: 'Dihitung', icon: CheckCircle2, ring: 'ring-sky-200',     text: 'text-sky-700',     bg: 'bg-sky-50',     dot: 'bg-sky-500' },
  draft:      { label: 'Draft',    icon: Clock,        ring: 'ring-amber-200',   text: 'text-amber-700',   bg: 'bg-amber-50',   dot: 'bg-amber-500' },
  none:       { label: 'Belum Run', icon: Clock,       ring: 'ring-slate-200',   text: 'text-slate-500',   bg: 'bg-slate-50',   dot: 'bg-slate-300' },
};

function CompanyAvatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return (
    <div
      className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white"
      style={{ background: `hsl(${hue} 55% 45%)`, boxShadow: '0 1px 4px rgba(15,23,42,0.18)' }}
      aria-hidden="true"
    >
      {initials || <Building2 size={18} />}
    </div>
  );
}

export default function HomeClient({
  companies, bulanIni, tahunIni, hasWorkspace,
}: {
  companies: HomeCompany[];
  bulanIni: number;
  tahunIni: number;
  hasWorkspace: boolean;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<HomeRunStatus | 'all'>('all');

  const counts = {
    locked:     companies.filter((c) => c.status === 'locked').length,
    calculated: companies.filter((c) => c.status === 'calculated').length,
    none:       companies.filter((c) => c.status === 'none' || c.status === 'draft').length,
  };
  const totalEmployees = companies.reduce((s, c) => s + c.empCount, 0);

  const filtered = companies.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.kota ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filter === 'all' ||
      (filter === 'none' ? (c.status === 'none' || c.status === 'draft') : c.status === filter);
    return matchSearch && matchStatus;
  });

  const cta = (
    <div className="flex gap-2 flex-wrap">
      <Link
        href="/import/bulk?new=1"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-white border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors"
      >
        <FileSpreadsheet size={15} />
        Buat dari Excel
      </Link>
      <Link
        href="/companies/new"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white transition-colors shadow-[var(--shadow-sm)]"
      >
        <Plus size={15} />
        Tambah Perusahaan
      </Link>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-[var(--border-default)]">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Perusahaan
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {companies.length} klien · {totalEmployees} karyawan · periode{' '}
            <span className="font-semibold text-[var(--text-secondary)]">
              {BULAN_ID[bulanIni]} {tahunIni}
            </span>
          </p>
        </div>
        {(hasWorkspace && companies.length > 0) && cta}
      </header>

      {!hasWorkspace ? (
        <EmptyState
          title="Belum ada workspace"
          desc="Akun Anda belum terhubung ke workspace. Hubungi developer untuk menautkan akun."
        />
      ) : companies.length === 0 ? (
        <div className="bg-white rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #E02020 0%, #1B4FA8 50%, #2DB44A 100%)' }} />
          <div className="px-8 py-14 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center bg-[var(--brand-soft)] text-[var(--brand)]">
              <Building2 size={28} />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Mulai dengan perusahaan pertama
            </h2>
            <p className="text-[14px] text-[var(--text-secondary)] mt-2.5 max-w-md mx-auto leading-relaxed">
              Tambahkan perusahaan klien, atau buat langsung dari workbook payroll Excel —
              karyawan dan riwayat bulanan ikut terisi.
            </p>
            <div className="mt-6 flex justify-center gap-2 flex-wrap">
              <Link
                href="/import/bulk?new=1"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg font-semibold bg-white border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Upload size={16} />
                Buat dari Excel
              </Link>
              <Link
                href="/companies/new"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg font-semibold bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white transition-colors shadow-md"
              >
                <Plus size={16} />
                Tambah Perusahaan
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Status filter boxes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Total" value={companies.length} active={filter === 'all'} onClick={() => setFilter('all')} accent="slate" icon={Building2} />
            <StatBox label="Terkunci" value={counts.locked} active={filter === 'locked'} onClick={() => setFilter(filter === 'locked' ? 'all' : 'locked')} accent="emerald" icon={Lock} />
            <StatBox label="Dihitung" value={counts.calculated} active={filter === 'calculated'} onClick={() => setFilter(filter === 'calculated' ? 'all' : 'calculated')} accent="sky" icon={CheckCircle2} />
            <StatBox label="Belum Run" value={counts.none} active={filter === 'none'} onClick={() => setFilter(filter === 'none' ? 'all' : 'none')} accent="amber" icon={Clock} />
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama perusahaan atau kota…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[var(--border-default)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all shadow-[var(--shadow-card)]"
            />
          </div>

          {/* Company cards */}
          {filtered.length === 0 ? (
            <EmptyState title="Tidak ada hasil yang cocok" desc="Coba ubah kata kunci atau filter status." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filtered.map((co, i) => {
                const cfg = STATUS_CONFIG[co.status];
                const StatusIcon = cfg.icon;
                const hasTotals = co.thp != null;
                return (
                  <Link
                    key={co.id}
                    href={`/companies/${co.id}/payroll/${tahunIni}/${bulanIni}`}
                    className="group bg-white border border-[var(--border-subtle)] hover:border-[var(--border-strong)] rounded-xl p-4 transition-all shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(i, 8) * 0.03}s`, opacity: 0 }}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="relative shrink-0">
                        <CompanyAvatar name={co.name} />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${cfg.dot}`} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-[15px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors truncate">
                          {co.name}
                        </h2>
                        <p className="text-[12.5px] text-[var(--text-muted)] mt-0.5 truncate flex items-center gap-1.5">
                          {co.kota ?? '—'}
                          <span className="text-[var(--text-faint)]">·</span>
                          <Users size={11} className="inline" /> {co.empCount}
                        </p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full ring-1 ring-inset ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
                        <StatusIcon size={11} />
                        {cfg.label}
                      </span>
                    </div>

                    {hasTotals && (
                      <div className="mt-3.5 pt-3 border-t border-[var(--border-subtle)] grid grid-cols-3 gap-2">
                        <Mini label="Bruto" value={formatRupiah(co.bruto ?? 0)} />
                        <Mini label="PPh 21" value={formatRupiah(co.pph ?? 0)} tone="amber" />
                        <Mini label="THP" value={formatRupiah(co.thp ?? 0)} tone="emerald" strong />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Mini({ label, value, tone, strong }: { label: string; value: string; tone?: 'amber' | 'emerald'; strong?: boolean }) {
  const toneClass = tone === 'amber' ? 'text-amber-700' : tone === 'emerald' ? 'text-emerald-700' : 'text-[var(--text-secondary)]';
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">{label}</p>
      <p className={`font-mono ${strong ? 'text-[13px] font-bold' : 'text-[12px] font-semibold'} ${toneClass}`}>{value}</p>
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-white border border-dashed border-[var(--border-default)] rounded-2xl py-16 text-center shadow-[var(--shadow-card)]">
      <div className="w-14 h-14 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto">
        <Building2 size={26} className="text-[var(--text-faint)]" />
      </div>
      <p className="mt-4 text-sm font-semibold text-[var(--text-secondary)]">{title}</p>
      <p className="mt-1 text-[13px] text-[var(--text-muted)]">{desc}</p>
    </div>
  );
}

function StatBox({
  label, value, active, onClick, accent, icon: Icon,
}: {
  label: string; value: number; active: boolean; onClick: () => void;
  accent: 'slate' | 'emerald' | 'sky' | 'amber'; icon: typeof Building2;
}) {
  const accentMap = {
    slate:   { num: 'text-[var(--text-primary)]', icon: 'text-slate-400',   bg: 'bg-slate-50' },
    emerald: { num: 'text-emerald-700',           icon: 'text-emerald-500', bg: 'bg-emerald-50' },
    sky:     { num: 'text-sky-700',               icon: 'text-sky-500',     bg: 'bg-sky-50' },
    amber:   { num: 'text-amber-700',             icon: 'text-amber-500',   bg: 'bg-amber-50' },
  } as const;
  const cfg = accentMap[accent];
  return (
    <button
      onClick={onClick}
      className={`relative text-left bg-white rounded-xl border px-4 py-3.5 transition-all cursor-pointer ${
        active
          ? 'border-[var(--brand)] ring-2 ring-[var(--brand-ring)] shadow-[var(--shadow-card-hover)]'
          : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]'
      }`}
    >
      <div className={`absolute top-3 right-3 w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center`}>
        <Icon size={14} className={cfg.icon} />
      </div>
      <p className={`text-3xl font-bold font-mono ${cfg.num}`}>{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mt-1.5">{label}</p>
    </button>
  );
}
