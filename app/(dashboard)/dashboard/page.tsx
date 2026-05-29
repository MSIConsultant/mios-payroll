import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Lock, CheckCircle2, Clock, Plus, Building2, Users, Play,
  ArrowRight, TrendingUp,
} from 'lucide-react';
import {
  cachedAuth,
  cachedWorkspaceForUser,
  getDashboardSnapshot,
} from '@/lib/cache';
import DashboardRealtime from './DashboardRealtime';

const BULAN_ID    = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

const STATUS_CHIP: Record<string, string> = {
  locked:     'bg-emerald-50 text-emerald-700 ring-emerald-200',
  calculated: 'bg-sky-50 text-sky-700 ring-sky-200',
  draft:      'bg-amber-50 text-amber-700 ring-amber-200',
};

const STATUS_BORDER: Record<string, string> = {
  locked:     'border-l-emerald-500',
  calculated: 'border-l-sky-500',
  draft:      'border-l-amber-400',
  pending:    'border-l-slate-200',
};

export default async function DashboardPage() {
  const { supabase, user } = await cachedAuth();
  if (!user) redirect('/login');

  const now      = new Date();
  const bulanIni = now.getMonth() + 1;
  const tahunIni = now.getFullYear();

  const ws          = await cachedWorkspaceForUser(user.id);
  const workspaceId = ws?.workspace_id;
  const wsName      = ws?.name ?? '—';

  // No workspace yet (mid-onboarding) — render the empty-state branch with
  // stub data. Staff filtering, company list, payroll status, recent-run
  // totals all collapse into one RPC call below.
  let companies: { id: string; name: string; kota: string | null }[] = [];
  let companyIds: string[] = [];
  let empCount = 0;
  let thisMonthRuns: { id: string; company_id: string; status: string }[] = [];
  let recentRuns: Array<{
    id: string; company_id: string; tahun: number; bulan: number; status: string;
    calculated_at: string | null; total_bruto: number; total_pph: number;
    total_thp: number; employee_count: number;
  }> = [];

  if (workspaceId) {
    const result = await getDashboardSnapshot(supabase, workspaceId, tahunIni, bulanIni);
    if (!result.ok) {
      throw new Error(`Dashboard snapshot failed: ${result.error}`);
    }
    companies     = result.snapshot.companies;
    companyIds    = result.snapshot.company_ids;
    empCount      = result.snapshot.employee_count;
    thisMonthRuns = result.snapshot.this_month_runs;
    recentRuns    = result.snapshot.recent_runs;
  }

  const runMap     = Object.fromEntries(thisMonthRuns.map((r) => [r.company_id, r.status]));
  const locked     = thisMonthRuns.filter((r) => r.status === 'locked').length;
  const calculated = thisMonthRuns.filter((r) => r.status === 'calculated').length;
  const pending    = companies.length - locked - calculated;
  const lockedPct  = companies.length > 0 ? (locked / companies.length) * 100 : 0;
  const calcPct    = companies.length > 0 ? (calculated / companies.length) * 100 : 0;

  // Rebuild the legacy totalsMap shape from the RPC payload so the rendering
  // JSX below stays unchanged (one less moving part per diff).
  const totalsMap: Record<string, { thp: number; bruto: number; pph: number; count: number }> = {};
  for (const r of recentRuns) {
    totalsMap[r.id] = {
      thp:   r.total_thp,
      bruto: r.total_bruto,
      pph:   r.total_pph,
      count: r.employee_count,
    };
  }
  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c]));
  const isEmpty    = companies.length === 0;

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* ── Header ── */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[var(--border-default)]">
        <div className="space-y-2">
          {/* Workspace pill */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-subtle)] text-[11px] font-semibold text-[var(--text-muted)] border border-[var(--border-default)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] inline-block" />
            {wsName}
          </span>
          {/* Period title */}
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
              {BULAN_ID[bulanIni]}
            </h1>
            <span className="text-xl font-semibold text-[var(--text-muted)] font-mono">
              {tahunIni}
            </span>
          </div>
        </div>

        {/* Header action — only when workspace has companies */}
        {!isEmpty && (
          <Link
            href="/companies/new"
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white transition-colors shadow-[var(--shadow-sm)]"
          >
            <Plus size={15} />
            Tambah Perusahaan
          </Link>
        )}
      </header>

      {isEmpty ? (
        <>
          {/* ── Welcome card (empty state) ── */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
            <div
              className="h-1 w-full"
              style={{ background: 'linear-gradient(90deg, #E02020 0%, #1B4FA8 50%, #2DB44A 100%)' }}
            />
            <div className="px-8 py-12 sm:px-16 sm:py-16 text-center">
              <div className="w-20 h-20 rounded-2xl mx-auto mb-7 flex items-center justify-center bg-[var(--metric-blue-soft)]">
                <Play size={30} className="ml-1 text-[var(--metric-blue-text)]" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                Selamat datang di MIOS Payroll
              </h2>
              <p className="text-[15px] text-[var(--text-secondary)] mt-3 max-w-md mx-auto leading-relaxed">
                Mulai dengan menambahkan perusahaan klien pertama. Setelah itu, tambahkan karyawan
                dan jalankan payroll pertama Anda.
              </p>
              <Link
                href="/companies/new"
                className="mt-7 inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white transition-colors shadow-[var(--shadow-sm)]"
              >
                <Plus size={16} />
                Tambah Perusahaan Pertama
              </Link>
            </div>
          </div>

          {/* ── Step guide ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              {
                step: '01',
                icon: Building2,
                title: 'Tambah Perusahaan',
                desc: 'Daftarkan perusahaan klien lengkap dengan NPWP dan informasi dasar.',
                href: '/companies/new',
                soft: 'bg-[var(--metric-blue-soft)]',
                text: 'text-[var(--metric-blue-text)]',
              },
              {
                step: '02',
                icon: Users,
                title: 'Input Karyawan',
                desc: 'Tambahkan karyawan dengan data gaji, BPJS, dan skema PPh 21.',
                href: '/companies',
                soft: 'bg-[var(--metric-green-soft)]',
                text: 'text-[var(--metric-green-text)]',
              },
              {
                step: '03',
                icon: Play,
                title: 'Jalankan Payroll',
                desc: 'Hitung, simpan, dan kunci payroll. Cetak slip gaji dan export SPT.',
                href: '/companies',
                soft: 'bg-[var(--metric-amber-soft)]',
                text: 'text-[var(--metric-amber-text)]',
              },
            ] as const).map((s) => (
              <Link
                key={s.step}
                href={s.href}
                className="group relative bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all duration-200 overflow-hidden"
              >
                {/* Step badge */}
                <span className="absolute top-5 right-5 text-[11px] font-bold font-mono text-[var(--text-faint)] tabular-nums">
                  {s.step}
                </span>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${s.soft} ${s.text}`}>
                  <s.icon size={20} />
                </div>
                <p className="font-semibold text-[15px] text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors">
                  {s.title}
                </p>
                <p className="text-[13px] text-[var(--text-muted)] mt-1.5 leading-relaxed">
                  {s.desc}
                </p>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* ── KPI cards (4-up) ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard
              label="Perusahaan"
              value={String(companies?.length ?? 0)}
              sub="klien aktif"
              accent="blue"
              icon={Building2}
              stagger={1}
            />
            <KpiCard
              label="Karyawan"
              value={String(empCount ?? 0)}
              sub="seluruh perusahaan"
              accent="emerald"
              icon={Users}
              stagger={2}
            />
            <KpiCard
              label="Terkunci"
              value={String(locked)}
              sub={`dari ${companies?.length ?? 0} perusahaan`}
              accent="green"
              icon={Lock}
              stagger={3}
            />
            <KpiCard
              label="Progress"
              value={`${locked}/${companies?.length ?? 0}`}
              sub={`${lockedPct.toFixed(0)}% selesai`}
              accent="amber"
              icon={TrendingUp}
              stagger={4}
            />
          </div>

          {/* ── Payroll progress bar ── */}
          <div className="bg-white rounded-2xl px-6 py-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  Progres Payroll {BULAN_SHORT[bulanIni]} {tahunIni}
                </p>
                <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                  <span className="font-semibold font-mono text-[var(--text-primary)]">{locked}</span>
                  {' '}terkunci &middot;{' '}
                  <span className="font-semibold font-mono text-[var(--text-primary)]">{calculated}</span>
                  {' '}dihitung &middot;{' '}
                  <span className="font-semibold font-mono text-[var(--text-primary)]">{pending}</span>
                  {' '}pending
                </p>
              </div>
              <span className="text-2xl font-bold font-mono text-[var(--text-primary)] tabular-nums">
                {lockedPct.toFixed(0)}%
              </span>
            </div>
            {/* Segmented progress bar */}
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${lockedPct}%` }}
              />
              <div
                className="h-full bg-sky-400 transition-all duration-700"
                style={{ width: `${calcPct}%` }}
              />
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-2.5">
              <LegendDot color="bg-emerald-500" label="Terkunci" />
              <LegendDot color="bg-sky-400" label="Dihitung" />
              <LegendDot color="bg-slate-200" label="Pending" />
            </div>
          </div>

          {/* ── Status board ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[13px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                Status Payroll {BULAN_SHORT[bulanIni]} {tahunIni}
              </h2>
              <Link
                href="/batch"
                className="text-[13px] font-semibold text-[var(--brand)] hover:underline inline-flex items-center gap-1"
              >
                Batch Board <ArrowRight size={13} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(companies ?? []).map((co, i) => {
                const status    = (runMap[co.id] as string) ?? 'pending';
                const chipClass = STATUS_CHIP[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200';
                const leftBorder = STATUS_BORDER[status] ?? 'border-l-slate-200';
                return (
                  <Link
                    key={co.id}
                    href={`/companies/${co.id}/payroll/${tahunIni}/${bulanIni}`}
                    className={`group flex items-center justify-between bg-white border border-[var(--border-default)] border-l-4 ${leftBorder} hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-card-hover)] rounded-xl px-4 py-3.5 transition-all duration-200 animate-fade-in-up`}
                    style={{ animationDelay: `${Math.min(i, 8) * 0.04}s`, opacity: 0 }}
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors truncate">
                        {co.name}
                      </p>
                      <p className="text-[12px] text-[var(--text-muted)] mt-0.5 truncate">
                        {co.kota ?? '—'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 ml-3 inline-flex text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full ring-1 ring-inset ${chipClass}`}
                    >
                      {status}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* ── Recent runs ── */}
          <section>
            <h2 className="text-[13px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4">
              Log Payroll Terbaru
            </h2>

            <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
              {(recentRuns ?? []).length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm text-[var(--text-muted)]">
                    Belum ada run.{' '}
                    <Link href="/companies" className="text-[var(--brand)] hover:underline font-semibold">
                      Mulai dari sini →
                    </Link>
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {(recentRuns ?? []).map((run) => {
                    const t   = totalsMap[run.id];
                    const co  = companyMap[run.company_id];
                    const chip = STATUS_CHIP[run.status] ?? 'bg-slate-100 text-slate-600 ring-slate-200';
                    return (
                      <li key={run.id}>
                        <Link
                          href={`/companies/${run.company_id}/payroll/${run.tahun}/${run.bulan}`}
                          className="block px-6 py-4 hover:bg-[var(--bg-subtle)] transition-colors group"
                        >
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <p className="text-[14px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors truncate">
                                {co?.name ?? '—'}
                              </p>
                              <p className="text-[12px] text-[var(--text-muted)] mt-0.5 font-mono">
                                {BULAN_SHORT[run.bulan]} {run.tahun}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full ring-1 ring-inset ${chip}`}
                            >
                              {run.status}
                            </span>
                          </div>

                          {t ? (
                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <Metric label="Karyawan" value={String(t.count)} />
                              <Metric label="Bruto" value={fmt(t.bruto)} />
                              <Metric label="PPh" value={fmt(t.pph)} tone="amber" />
                              <Metric label="THP" value={fmt(t.thp)} tone="emerald" strong />
                            </div>
                          ) : (
                            <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                              Belum ada hasil
                            </p>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {companyIds.length > 0 && workspaceId && (
            <DashboardRealtime companyIds={companyIds} workspaceId={workspaceId} />
          )}
        </>
      )}
    </div>
  );
}

/* ────────────────────────────────────────
   KpiCard
──────────────────────────────────────── */
const ACCENT_MAP = {
  blue:    { text: 'text-[var(--metric-blue-text)]',   bg: 'bg-[var(--metric-blue-soft)]',   bar: 'bg-[var(--metric-blue-text)]'   },
  emerald: { text: 'text-[var(--metric-green-text)]',  bg: 'bg-[var(--metric-green-soft)]',  bar: 'bg-[var(--metric-green-text)]'  },
  green:   { text: 'text-[var(--metric-green-text)]',  bg: 'bg-[var(--metric-green-soft)]',  bar: 'bg-[var(--metric-green-text)]'  },
  amber:   { text: 'text-[var(--metric-amber-text)]',  bg: 'bg-[var(--metric-amber-soft)]',  bar: 'bg-[var(--metric-amber-text)]'  },
} as const;

type KpiAccent = keyof typeof ACCENT_MAP;

function KpiCard({
  label, value, sub, accent, icon: Icon, stagger,
}: {
  label: string;
  value: string;
  sub: string;
  accent: KpiAccent;
  icon: typeof Building2;
  stagger?: 1 | 2 | 3 | 4 | 5;
}) {
  const a = ACCENT_MAP[accent];
  const staggerClass = stagger ? `stagger-${stagger}` : '';
  return (
    <div
      className={`relative bg-white rounded-2xl p-6 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all duration-200 overflow-hidden animate-fade-in-up ${staggerClass}`}
    >
      {/* Icon + label row */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </p>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.bg} ${a.text}`}>
          <Icon size={17} />
        </div>
      </div>
      {/* Metric number */}
      <p className={`mt-4 text-4xl font-bold font-mono leading-none tabular-nums ${a.text}`}>
        {value}
      </p>
      {/* Sub label */}
      <p className="text-[13px] text-[var(--text-muted)] mt-2 leading-snug">{sub}</p>
      {/* Colored bottom accent bar */}
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${a.bar} opacity-60`} />
    </div>
  );
}

/* ────────────────────────────────────────
   Metric (run row cell)
──────────────────────────────────────── */
function Metric({
  label, value, tone, strong,
}: {
  label: string;
  value: string;
  tone?: 'amber' | 'emerald';
  strong?: boolean;
}) {
  const toneClass =
    tone === 'amber'   ? 'text-[var(--metric-amber-text)]' :
    tone === 'emerald' ? 'text-[var(--metric-green-text)]' :
    'text-[var(--text-secondary)]';
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
      <p className={`mt-0.5 text-[13px] font-mono tabular-nums ${strong ? 'font-bold' : 'font-semibold'} ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

/* ────────────────────────────────────────
   LegendDot (progress bar legend)
──────────────────────────────────────── */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
      <span className="text-[11px] text-[var(--text-muted)] font-medium">{label}</span>
    </div>
  );
}
