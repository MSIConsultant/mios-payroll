import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Lock, CheckCircle2, Clock, Plus, Building2, Users, Play,
  ArrowRight, TrendingUp,
} from 'lucide-react';
import DashboardRealtime from './DashboardRealtime';
import { getCachedCompanies, getCachedEmployeeCount, getCachedPayrollRuns } from '@/lib/cache';

const BULAN_ID    = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

const STATUS_CHIP: Record<string, string> = {
  locked: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  calculated: 'bg-sky-50 text-sky-700 ring-sky-200',
  draft: 'bg-amber-50 text-amber-700 ring-amber-200',
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const now      = new Date();
  const bulanIni = now.getMonth() + 1;
  const tahunIni = now.getFullYear();

  const { data: membership } = await supabase
    .from('workspace_members').select('workspace_id, workspaces(id, name)')
    .eq('user_id', user.id).limit(1).single();

  const workspaceId = membership?.workspace_id;
  const ws          = membership?.workspaces;
  const wsName      = (Array.isArray(ws) ? ws[0]?.name : (ws as any)?.name) ?? '—';

  // Cached server reads via lib/cache.ts wrappers. revalidateTag calls in the
  // mutating actions (companies/employees/payroll) bust these caches.
  const allCompanies = workspaceId ? await getCachedCompanies(workspaceId) : [];
  const companies = allCompanies.filter((c) => c.aktif);
  const companyIds = companies.map((c) => c.id);

  const empCount = workspaceId && companyIds.length > 0
    ? await getCachedEmployeeCount(workspaceId, companyIds)
    : 0;

  const thisMonthRuns = companyIds.length > 0
    ? await getCachedPayrollRuns(companyIds, tahunIni, bulanIni)
    : [];

  const runMap     = Object.fromEntries(thisMonthRuns.map((r) => [r.company_id, r.status]));
  const locked     = thisMonthRuns.filter((r) => r.status === 'locked').length;
  const calculated = thisMonthRuns.filter((r) => r.status === 'calculated').length;
  const pending    = companies.length - locked - calculated;
  const lockedPct  = companies.length > 0 ? (locked / companies.length) * 100 : 0;

  const { data: recentRuns } = companyIds.length > 0
    ? await supabase.from('payroll_runs')
        .select('id, company_id, tahun, bulan, status, calculated_at')
        .in('company_id', companyIds)
        .order('calculated_at', { ascending: false }).limit(8)
    : { data: [] };

  const runIds = (recentRuns ?? []).map((r) => r.id);
  const { data: runTotals } = runIds.length > 0
    ? await supabase.from('payroll_results').select('run_id, thp, bruto, pph').in('run_id', runIds)
    : { data: [] };

  const totalsMap: Record<string, { thp: number; bruto: number; pph: number; count: number }> = {};
  for (const r of runTotals ?? []) {
    if (!totalsMap[r.run_id]) totalsMap[r.run_id] = { thp: 0, bruto: 0, pph: 0, count: 0 };
    totalsMap[r.run_id].thp   += r.thp   ?? 0;
    totalsMap[r.run_id].bruto += r.bruto ?? 0;
    totalsMap[r.run_id].pph   += r.pph   ?? 0;
    totalsMap[r.run_id].count += 1;
  }
  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c]));
  const isEmpty    = companies.length === 0;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Period header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-[var(--border-default)]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {wsName} · Periode Aktif
          </p>
          <div className="flex items-baseline gap-3 mt-1">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
              {BULAN_ID[bulanIni]}
            </h1>
            <span className="text-xl font-semibold text-[var(--text-muted)] font-mono">
              {tahunIni}
            </span>
          </div>
        </div>

        {!isEmpty && (
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1.5">
              <Lock size={14} className="text-emerald-600" />
              <span className="text-sm font-semibold text-[var(--text-secondary)]">
                <span className="font-mono">{locked}</span> terkunci
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-sky-600" />
              <span className="text-sm font-semibold text-[var(--text-secondary)]">
                <span className="font-mono">{calculated}</span> dihitung
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-amber-600" />
              <span className="text-sm font-semibold text-[var(--text-secondary)]">
                <span className="font-mono">{pending}</span> pending
              </span>
            </div>
            <div className="w-32 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${lockedPct}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {isEmpty ? (
        <>
          {/* Welcome card */}
          <div className="bg-white border border-[var(--border-default)] rounded-2xl overflow-hidden shadow-sm">
            <div
              className="h-1 w-full"
              style={{ background: 'linear-gradient(90deg, #E02020, #1B4FA8, #2DB44A)' }}
            />
            <div className="p-10 text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center bg-[var(--brand-soft)] text-[var(--brand)]">
                <Play size={26} className="ml-0.5" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Selamat datang di MIOS Payroll
              </h2>
              <p className="text-[15px] text-[var(--text-secondary)] mt-3 max-w-md mx-auto leading-relaxed">
                Mulai dengan menambahkan perusahaan klien pertama. Setelah itu, tambahkan karyawan
                dan jalankan payroll pertama Anda.
              </p>

              <Link
                href="/companies/new"
                className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white transition-colors shadow-sm"
              >
                <Plus size={16} />
                Tambah Perusahaan Pertama
              </Link>
            </div>
          </div>

          {/* Step guide */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: '01',
                icon: Building2,
                title: 'Tambah Perusahaan',
                desc: 'Daftarkan perusahaan klien lengkap dengan NPWP dan informasi dasar.',
                href: '/companies/new',
                tint: 'bg-blue-50 text-blue-700',
              },
              {
                step: '02',
                icon: Users,
                title: 'Input Karyawan',
                desc: 'Tambahkan karyawan dengan data gaji, BPJS, dan skema PPh 21.',
                href: '/companies',
                tint: 'bg-emerald-50 text-emerald-700',
              },
              {
                step: '03',
                icon: Play,
                title: 'Jalankan Payroll',
                desc: 'Hitung, simpan, dan kunci payroll. Cetak slip gaji dan export SPT.',
                href: '/companies',
                tint: 'bg-amber-50 text-amber-700',
              },
            ].map((s) => (
              <Link
                key={s.step}
                href={s.href}
                className="group bg-white border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:shadow-md rounded-xl p-5 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${s.tint}`}
                  >
                    <s.icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold font-mono text-[var(--text-muted)] uppercase tracking-wider">
                      Step {s.step}
                    </p>
                    <p className="font-semibold text-[15px] text-[var(--text-primary)] mt-0.5 group-hover:text-[var(--brand)] transition-colors">
                      {s.title}
                    </p>
                    <p className="text-[13px] text-[var(--text-muted)] mt-1 leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* KPI stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Perusahaan Aktif"
              value={companies.length}
              sub="klien terdaftar"
              accent="brand"
              icon={Building2}
            />
            <KpiCard
              label="Karyawan Aktif"
              value={empCount}
              sub="seluruh perusahaan"
              accent="emerald"
              icon={Users}
            />
            <KpiCard
              label={`Run ${BULAN_SHORT[bulanIni]} ${tahunIni}`}
              value={thisMonthRuns.length}
              sub={`dari ${companies.length} perusahaan`}
              accent="amber"
              icon={TrendingUp}
            />
          </div>

          {/* Status board */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Status Payroll {BULAN_SHORT[bulanIni]} {tahunIni}
              </h2>
              <Link
                href="/batch"
                className="text-[13px] font-semibold text-[var(--brand)] hover:underline inline-flex items-center gap-1"
              >
                Batch Board <ArrowRight size={13} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {companies.map((co, i) => {
                const status = (runMap[co.id] as string) ?? 'pending';
                const chipClass = STATUS_CHIP[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200';
                return (
                  <Link
                    key={co.id}
                    href={`/companies/${co.id}/payroll/${tahunIni}/${bulanIni}`}
                    className="group flex items-center justify-between bg-white border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:shadow-sm rounded-lg px-4 py-3 transition-all animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(i, 8) * 0.03}s`, opacity: 0 }}
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
                      className={`shrink-0 ml-3 inline-flex text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${chipClass}`}
                    >
                      {status}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Recent runs */}
          <section>
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Log Payroll Terbaru
            </h2>

            <div className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
              {(recentRuns ?? []).length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">
                  Belum ada run.{' '}
                  <Link href="/companies" className="text-[var(--brand)] hover:underline font-semibold">
                    Mulai dari sini →
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {(recentRuns ?? []).map((run) => {
                    const t = totalsMap[run.id];
                    const co = companyMap[run.company_id];
                    const chip = STATUS_CHIP[run.status] ?? 'bg-slate-100 text-slate-600 ring-slate-200';
                    return (
                      <li key={run.id}>
                        <Link
                          href={`/companies/${run.company_id}/payroll/${run.tahun}/${run.bulan}`}
                          className="block px-5 py-4 hover:bg-[var(--bg-subtle)] transition-colors group"
                        >
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <p className="text-[14px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors truncate">
                                {co?.name ?? '—'}
                              </p>
                              <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                                {BULAN_SHORT[run.bulan]} {run.tahun}
                              </p>
                            </div>
                            <span
                              className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${chip}`}
                            >
                              {run.status}
                            </span>
                          </div>

                          {t ? (
                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
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

function KpiCard({
  label, value, sub, accent, icon: Icon,
}: {
  label: string;
  value: number;
  sub: string;
  accent: 'brand' | 'emerald' | 'amber';
  icon: typeof Building2;
}) {
  const accentMap = {
    brand:   { text: 'text-[var(--brand)]',   bg: 'bg-[var(--brand-soft)]' },
    emerald: { text: 'text-emerald-700',      bg: 'bg-emerald-50' },
    amber:   { text: 'text-amber-700',        bg: 'bg-amber-50' },
  } as const;
  const a = accentMap[accent];
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-xl p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.bg} ${a.text}`}>
          <Icon size={15} />
        </div>
      </div>
      <p className={`mt-3 text-3xl font-bold font-mono leading-none ${a.text}`}>{value}</p>
      <p className="text-[13px] text-[var(--text-muted)] mt-2">{sub}</p>
    </div>
  );
}

function Metric({
  label, value, tone, strong,
}: {
  label: string;
  value: string;
  tone?: 'amber' | 'emerald';
  strong?: boolean;
}) {
  const toneClass =
    tone === 'amber'   ? 'text-amber-700' :
    tone === 'emerald' ? 'text-emerald-700' :
    'text-[var(--text-secondary)]';
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
      <p className={`mt-0.5 font-mono ${strong ? 'font-bold' : 'font-semibold'} ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}
