'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  Lock, CheckCircle2, Clock, ChevronRight,
  TrendingUp, TrendingDown, Layers,
} from 'lucide-react';
import { formatRupiah } from '@/lib/format';

const BULAN_FULL  = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

type RunStatus = 'locked' | 'calculated' | 'draft' | 'none';

const STATUS_META: Record<RunStatus, { label: string; chip: string; icon: typeof Lock; leftBar: string }> = {
  locked:     { label: 'Terkunci', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: Lock,         leftBar: 'bg-emerald-500' },
  calculated: { label: 'Dihitung', chip: 'bg-sky-50 text-sky-700 ring-sky-200',             icon: CheckCircle2, leftBar: 'bg-sky-500'     },
  draft:      { label: 'Draft',    chip: 'bg-amber-50 text-amber-700 ring-amber-200',        icon: Clock,        leftBar: 'bg-amber-500'   },
  none:       { label: 'Pending',  chip: 'bg-slate-100 text-slate-600 ring-slate-200',       icon: Clock,        leftBar: 'bg-slate-200'   },
};

export interface CompanyRow {
  id: string; name: string; kota: string | null; empCount: number;
  thisMonth: { status: RunStatus; runId?: string; bruto?: number; pph?: number; thp?: number } | null;
  lastMonth: { status: RunStatus; bruto?: number } | null;
  anomaly: 'up' | 'down' | null;
}

export default function BatchClient({
  rows,
  bulanIni,
  tahunIni,
  prevBulan,
}: {
  rows: CompanyRow[];
  bulanIni: number;
  tahunIni: number;
  prevBulan: number;
}) {
  const [filter, setFilter] = useState<RunStatus | 'all'>('all');

  const filtered = filter === 'all' ? rows : rows.filter((r) => (r.thisMonth?.status ?? 'none') === filter);

  const counts = {
    locked:     rows.filter((r) => r.thisMonth?.status === 'locked').length,
    calculated: rows.filter((r) => r.thisMonth?.status === 'calculated').length,
    draft:      rows.filter((r) => r.thisMonth?.status === 'draft').length,
    none:       rows.filter((r) => !r.thisMonth).length,
  };

  const totalThp  = rows.reduce((a, r) => a + (r.thisMonth?.thp ?? 0), 0);
  const totalPph  = rows.reduce((a, r) => a + (r.thisMonth?.pph ?? 0), 0);
  const anomalies = rows.filter((r) => r.anomaly).length;
  const lockedPct = rows.length > 0 ? (counts.locked / rows.length) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center shadow-[var(--shadow-metric)]">
            <Layers size={22} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              Batch Run
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              {BULAN_FULL[bulanIni]} {tahunIni} · {rows.length} perusahaan aktif
            </p>
          </div>
        </div>
      </header>

      {/* Summary cards */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Total THP */}
          <div className="sm:col-span-2 bg-white border border-[var(--border-subtle)] rounded-2xl p-5 shadow-[var(--shadow-card)]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Total THP Bulan Ini
            </p>
            <p className="mt-2.5 text-3xl font-bold text-emerald-700 font-mono leading-none">
              {totalThp > 0 ? formatRupiah(totalThp) : '—'}
            </p>
            <div className="mt-2.5 flex items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">PPh 21</span>
              <span className="font-mono font-semibold text-[13px] text-amber-700">
                {totalPph > 0 ? formatRupiah(totalPph) : '—'}
              </span>
            </div>
          </div>

          {/* Progress */}
          <div className="bg-white border border-[var(--border-subtle)] rounded-2xl p-5 shadow-[var(--shadow-card)]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Progress
            </p>
            <p className="mt-2.5 text-3xl font-bold text-[var(--text-primary)] font-mono leading-none">
              {counts.locked}
              <span className="text-[var(--text-muted)] text-xl font-semibold">
                /{rows.length}
              </span>
            </p>
            <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${lockedPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
              {lockedPct.toFixed(0)}% terkunci
            </p>
          </div>

          {/* Anomali */}
          <div
            className={`bg-white border rounded-2xl p-5 shadow-[var(--shadow-card)] ${
              anomalies > 0 ? 'border-amber-200' : 'border-[var(--border-subtle)]'
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Anomali
            </p>
            <p
              className={`mt-2.5 text-3xl font-bold font-mono leading-none ${
                anomalies > 0 ? 'text-amber-700' : 'text-[var(--text-faint)]'
              }`}
            >
              {anomalies}
            </p>
            <p className="text-[11px] font-semibold text-[var(--text-muted)] mt-2">
              &gt;15% perubahan bruto
            </p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(
          [
            ['all', 'Semua', rows.length],
            ['none', 'Pending', counts.none],
            ['draft', 'Draft', counts.draft],
            ['calculated', 'Dihitung', counts.calculated],
            ['locked', 'Terkunci', counts.locked],
          ] as const
        ).map(([key, label, count]) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key as RunStatus | 'all')}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-[var(--brand)] text-white shadow-sm'
                  : 'bg-white border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
              }`}
            >
              {label}{' '}
              <span
                className={`ml-1 font-mono ${active ? 'opacity-80' : 'text-[var(--text-muted)]'}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-[var(--border-default)] rounded-2xl py-20 text-center shadow-[var(--shadow-card)]">
          <div className="w-14 h-14 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto">
            <Layers size={26} className="text-[var(--text-faint)]" />
          </div>
          <p className="mt-4 text-sm font-semibold text-[var(--text-secondary)]">Tidak ada hasil</p>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">Coba ubah filter status di atas</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((co, i) => {
            const status = co.thisMonth?.status ?? 'none';
            const meta = STATUS_META[status];
            const Icon = meta.icon;

            return (
              <li
                key={co.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${Math.min(i, 8) * 0.03}s`, opacity: 0 }}
              >
                <div className="bg-white border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:border-[var(--border-strong)] transition-all">
                  <div className="flex items-stretch">
                    {/* Status bar */}
                    <div className={`w-1.5 shrink-0 ${meta.leftBar}`} />

                    <div className="flex-1 px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Name + meta */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <Icon
                          size={16}
                          className={`mt-0.5 shrink-0 ${
                            status === 'locked'     ? 'text-emerald-600' :
                            status === 'calculated' ? 'text-sky-600'     :
                            status === 'draft'      ? 'text-amber-600'   : 'text-slate-400'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
                              {co.name}
                            </p>
                            <span
                              className={`inline-flex text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${meta.chip}`}
                            >
                              {meta.label}
                            </span>
                            {co.anomaly && (
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${
                                  co.anomaly === 'up'
                                    ? 'bg-amber-50 text-amber-700 ring-amber-200'
                                    : 'bg-sky-50 text-sky-700 ring-sky-200'
                                }`}
                              >
                                {co.anomaly === 'up' ? (
                                  <TrendingUp size={11} />
                                ) : (
                                  <TrendingDown size={11} />
                                )}
                                {co.anomaly === 'up' ? '+bruto' : '−bruto'}
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                            {co.kota ?? '—'} · {co.empCount} karyawan
                          </p>
                        </div>
                      </div>

                      {/* Figures */}
                      {co.thisMonth?.thp ? (
                        <div className="grid grid-cols-3 gap-4 sm:gap-6 text-right shrink-0">
                          <Figure label="Bruto" value={formatRupiah(co.thisMonth.bruto ?? 0)} />
                          <Figure label="PPh 21" value={formatRupiah(co.thisMonth.pph ?? 0)} tone="amber" />
                          <Figure label="THP" value={formatRupiah(co.thisMonth.thp ?? 0)} tone="emerald" strong />
                        </div>
                      ) : (
                        <p className="text-[13px] text-[var(--text-muted)] shrink-0">
                          {status === 'none'
                            ? `Belum ada run ${BULAN_SHORT[bulanIni]}`
                            : 'Belum dihitung'}
                        </p>
                      )}

                      {/* Action */}
                      <Link
                        href={`/companies/${co.id}/payroll/${tahunIni}/${bulanIni}`}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                          status === 'none' || status === 'draft'
                            ? 'bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] shadow-sm'
                            : status === 'calculated'
                            ? 'bg-white border border-sky-300 text-sky-700 hover:bg-sky-50'
                            : 'bg-white border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {status === 'none'
                          ? 'Mulai'
                          : status === 'draft'
                          ? 'Lanjut'
                          : status === 'calculated'
                          ? 'Review'
                          : 'Lihat'}
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                  </div>

                  {co.lastMonth?.bruto && co.thisMonth?.bruto ? (
                    <div className="px-5 py-2.5 border-t border-[var(--border-subtle)] bg-slate-50/80 flex items-center gap-3 flex-wrap">
                      <p className="text-[12px] text-[var(--text-muted)]">
                        vs {BULAN_SHORT[prevBulan]}{' '}
                        <span className="font-mono text-[var(--text-secondary)]">
                          {formatRupiah(co.lastMonth.bruto)}
                        </span>
                      </p>
                      {(() => {
                        const pct = ((co.thisMonth.bruto - co.lastMonth.bruto) / co.lastMonth.bruto) * 100;
                        return (
                          <span
                            className={`text-[12px] font-semibold font-mono ${
                              pct > 0 ? 'text-amber-700' : 'text-sky-700'
                            }`}
                          >
                            {pct > 0 ? '+' : ''}
                            {pct.toFixed(1)}%
                          </span>
                        );
                      })()}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Figure({
  label, value, tone, strong,
}: {
  label: string;
  value: string;
  tone?: 'amber' | 'emerald';
  strong?: boolean;
}) {
  const toneClass =
    tone === 'amber'   ? 'text-amber-700'   :
    tone === 'emerald' ? 'text-emerald-700'  :
    'text-[var(--text-primary)]';
  return (
    <div>
      <p
        className={`font-mono ${strong ? 'text-base font-bold' : 'text-[13px] font-semibold'} ${toneClass}`}
      >
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mt-0.5">
        {label}
      </p>
    </div>
  );
}
