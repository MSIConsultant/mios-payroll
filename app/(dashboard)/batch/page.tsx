'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  Lock, CheckCircle2, Clock, ChevronRight,
  TrendingUp, TrendingDown, Layers,
} from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import type { PayrollRunTotal } from '@/lib/cache';

const BULAN_FULL  = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

type RunStatus = 'locked' | 'calculated' | 'draft' | 'none';

const STATUS_META: Record<RunStatus, { label: string; chip: string; icon: typeof Lock; leftBar: string }> = {
  locked:     { label: 'Terkunci', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: Lock,         leftBar: 'bg-emerald-500' },
  calculated: { label: 'Dihitung', chip: 'bg-sky-50 text-sky-700 ring-sky-200',             icon: CheckCircle2, leftBar: 'bg-sky-500'     },
  draft:      { label: 'Draft',    chip: 'bg-amber-50 text-amber-700 ring-amber-200',        icon: Clock,        leftBar: 'bg-amber-500'   },
  none:       { label: 'Pending',  chip: 'bg-slate-100 text-slate-600 ring-slate-200',       icon: Clock,        leftBar: 'bg-slate-200'   },
};

interface CompanyRow {
  id: string; name: string; kota: string | null; empCount: number;
  thisMonth: { status: RunStatus; runId?: string; bruto?: number; pph?: number; thp?: number } | null;
  lastMonth: { status: RunStatus; bruto?: number } | null;
  anomaly: 'up' | 'down' | null;
}

export default function BatchPage() {
  const now = new Date();
  const bulanIni  = now.getMonth() + 1;
  const tahunIni  = now.getFullYear();
  const prevBulan = bulanIni === 1 ? 12 : bulanIni - 1;
  const prevTahun = bulanIni === 1 ? tahunIni - 1 : tahunIni;

  const { workspace, loading: wsLoading } = useWorkspace();
  const [rows, setRows]       = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<RunStatus | 'all'>('all');

  useEffect(() => {
    async function fetchData() {
      if (!workspace) { setLoading(false); return; }
      const supabase = createClient();

      // Same staff filter as /companies and /dashboard — staff only see
      // companies they've been granted access to via company_staff_access.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: profile } = await supabase
        .from('user_profiles').select('role').eq('id', user.id).maybeSingle();
      const isStaff = profile?.role === 'staff';

      let allowedIds: string[] | null = null;
      if (isStaff) {
        const { data: access } = await supabase
          .from('company_staff_access').select('company_id')
          .eq('staff_user_id', user.id);
        allowedIds = (access ?? []).map(a => a.company_id as string);
        if (allowedIds.length === 0) { setRows([]); setLoading(false); return; }
      }

      const coBase = supabase
        .from('companies').select('id, name, kota')
        .eq('workspace_id', workspace.id).eq('aktif', true).order('name');
      const coQuery = isStaff ? coBase.in('id', allowedIds!) : coBase;
      const { data: companies } = await coQuery;

      if (!companies?.length) { setLoading(false); return; }
      const companyIds = companies.map((c) => c.id);

      const [{ data: thisRuns }, { data: prevRuns }, { data: emps }] = await Promise.all([
        supabase.from('payroll_runs').select('id, company_id, status')
          .in('company_id', companyIds).eq('tahun', tahunIni).eq('bulan', bulanIni),
        supabase.from('payroll_runs').select('id, company_id, status')
          .in('company_id', companyIds).eq('tahun', prevTahun).eq('bulan', prevBulan),
        supabase.from('employees').select('company_id')
          .in('company_id', companyIds).eq('aktif', true),
      ]);

      const thisRunIds = (thisRuns ?? []).map((r) => r.id);
      const prevRunIds = (prevRuns ?? []).map((r) => r.id);

      // Server-side GROUP BY via get_payroll_run_totals RPC (one row per run).
      // Replaces the previous fetch-all-then-sum loops over payroll_results.
      const [{ data: thisTotals }, { data: prevTotals }] = await Promise.all([
        thisRunIds.length > 0
          ? supabase.rpc('get_payroll_run_totals', { p_run_ids: thisRunIds })
          : { data: [] },
        prevRunIds.length > 0
          ? supabase.rpc('get_payroll_run_totals', { p_run_ids: prevRunIds })
          : { data: [] },
      ]);

      const thisMap: Record<string, { bruto: number; pph: number; thp: number }> = {};
      for (const r of (thisTotals ?? []) as PayrollRunTotal[]) {
        thisMap[r.run_id] = { bruto: r.total_bruto, pph: r.total_pph, thp: r.total_thp };
      }
      const prevMap: Record<string, { bruto: number }> = {};
      for (const r of (prevTotals ?? []) as PayrollRunTotal[]) {
        prevMap[r.run_id] = { bruto: r.total_bruto };
      }

      const thisRunByCompany = Object.fromEntries((thisRuns ?? []).map((r) => [r.company_id, r]));
      const prevRunByCompany = Object.fromEntries((prevRuns ?? []).map((r) => [r.company_id, r]));
      const empCountByCompany: Record<string, number> = {};
      for (const e of emps ?? []) {
        empCountByCompany[e.company_id] = (empCountByCompany[e.company_id] ?? 0) + 1;
      }

      const result: CompanyRow[] = companies.map((co) => {
        const thisRun = thisRunByCompany[co.id];
        const prevRun = prevRunByCompany[co.id];
        const thisTot = thisRun ? thisMap[thisRun.id] : null;
        const prevTot = prevRun ? prevMap[prevRun.id] : null;

        let anomaly: 'up' | 'down' | null = null;
        if (thisTot?.bruto && prevTot?.bruto) {
          const diff = (thisTot.bruto - prevTot.bruto) / prevTot.bruto;
          if (diff > 0.15) anomaly = 'up';
          if (diff < -0.15) anomaly = 'down';
        }

        return {
          id: co.id, name: co.name, kota: co.kota,
          empCount: empCountByCompany[co.id] ?? 0,
          thisMonth: thisRun
            ? { status: thisRun.status as RunStatus, runId: thisRun.id, bruto: thisTot?.bruto, pph: thisTot?.pph, thp: thisTot?.thp }
            : null,
          lastMonth: prevRun
            ? { status: prevRun.status as RunStatus, bruto: prevTot?.bruto }
            : null,
          anomaly,
        };
      });

      setRows(result);
      setLoading(false);
    }
    if (!wsLoading) fetchData();
  }, [workspace, wsLoading, bulanIni, tahunIni, prevBulan, prevTahun]);

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
      {loading || wsLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 bg-white border border-[var(--border-subtle)] rounded-xl animate-pulse shadow-[var(--shadow-card)]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
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
