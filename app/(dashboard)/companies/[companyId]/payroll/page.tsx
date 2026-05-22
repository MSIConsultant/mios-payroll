'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft, ChevronRight, Plus, Trash2, Calendar, Lock, CheckCircle2, Clock,
} from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { deletePayrollRun } from '@/lib/actions/payroll';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';

const BULAN_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const STATUS_CHIP: Record<string, string> = {
  locked: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  calculated: 'bg-sky-50 text-sky-700 ring-sky-200',
  draft: 'bg-amber-50 text-amber-700 ring-amber-200',
};

const STATUS_ICON: Record<string, typeof Lock> = {
  locked: Lock,
  calculated: CheckCircle2,
  draft: Clock,
};

export default function PayrollOverviewPage() {
  const { companyId } = useParams();
  const confirm = useConfirm();
  const [runs, setRuns]           = useState<any[]>([]);
  const [company, setCompany]     = useState<any>(null);
  const [totalsMap, setTotalsMap] = useState<Record<string, any>>({});
  const [loading, setLoading]     = useState(true);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [selTahun, setSelTahun]   = useState(new Date().getFullYear());
  const [selBulan, setSelBulan]   = useState(new Date().getMonth() + 1);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const [{ data: co }, { data: runsData }] = await Promise.all([
        supabase.from('companies').select('name').eq('id', companyId).single(),
        supabase.from('payroll_runs').select('*').eq('company_id', companyId)
          .order('tahun', { ascending: false }).order('bulan', { ascending: false }),
      ]);
      if (co) setCompany(co);
      if (runsData) {
        setRuns(runsData);
        const runIds = runsData.map((r) => r.id);
        if (runIds.length > 0) {
          const { data: totals } = await supabase
            .from('payroll_results')
            .select('run_id, thp, bruto, pph')
            .in('run_id', runIds);
          const map: Record<string, any> = {};
          for (const t of totals ?? []) {
            if (!map[t.run_id]) map[t.run_id] = { thp: 0, bruto: 0, pph: 0, count: 0 };
            map[t.run_id].thp   += t.thp   ?? 0;
            map[t.run_id].bruto += t.bruto ?? 0;
            map[t.run_id].pph   += t.pph   ?? 0;
            map[t.run_id].count += 1;
          }
          setTotalsMap(map);
        }
      }
      setLoading(false);
    }
    fetchData();
  }, [companyId]);

  async function handleDeleteRun(run: any) {
    if (run.status === 'locked') {
      toast.error('Run yang sudah dikunci tidak bisa dihapus.');
      return;
    }
    if (!(await confirm({
      title: `Hapus payroll ${BULAN_NAMES[run.bulan - 1]} ${run.tahun}?`,
      message: 'Semua hasil kalkulasi untuk periode ini akan hilang. Tindakan ini tidak bisa dibatalkan.',
      severity: 'danger',
      confirmLabel: 'Hapus',
    }))) return;
    setDeleting(run.id);
    const res = await deletePayrollRun(run.id, companyId as string, run.tahun, run.bulan);
    if (res.error) {
      toast.error(res.error);
      setDeleting(null);
    } else {
      toast.success('Run dihapus');
      setRuns((r) => r.filter((x) => x.id !== run.id));
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link
          href={`/companies/${companyId}`}
          className="inline-flex items-center gap-1 hover:text-[var(--brand)] transition-colors"
        >
          <ArrowLeft size={14} />
          {company?.name ?? 'Perusahaan'}
        </Link>
      </div>

      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Payroll Hub
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Buat run baru atau lanjutkan dari riwayat.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* New Run */}
        <div className="bg-white border border-[var(--border-default)] rounded-xl p-5 lg:sticky lg:top-4 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center">
              <Plus size={16} />
            </div>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Payroll Baru</h2>
          </div>

          <div className="space-y-3 mb-4">
            <div>
              <label
                htmlFor="run-year"
                className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Tahun
              </label>
              <select
                id="run-year"
                value={selTahun}
                onChange={(e) => setSelTahun(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-[var(--border-default)] rounded-lg text-sm font-mono outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              >
                {[2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="run-month"
                className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Bulan
              </label>
              <select
                id="run-month"
                value={selBulan}
                onChange={(e) => setSelBulan(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-[var(--border-default)] rounded-lg text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              >
                {BULAN_NAMES.map((n, i) => (
                  <option key={i} value={i + 1}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Link
            href={`/companies/${companyId}/payroll/${selTahun}/${selBulan}`}
            className="group flex items-center justify-center gap-2 w-full py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white rounded-lg font-semibold text-sm transition-colors shadow-sm"
          >
            <Calendar size={15} />
            Mulai Hitung
            <ChevronRight
              size={15}
              className="group-hover:translate-x-0.5 transition-transform"
            />
          </Link>
        </div>

        {/* History */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                Riwayat Payroll{' '}
                <span className="text-[var(--text-muted)] font-normal">({runs.length})</span>
              </h2>
            </div>

            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 bg-[var(--bg-subtle)] rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : runs.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Calendar size={28} className="mx-auto text-[var(--text-faint)]" />
                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                  Belum ada riwayat payroll.
                </p>
                <p className="text-[12px] text-[var(--text-muted)] mt-1">
                  Pilih periode di samping untuk memulai.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {runs.map((run, i) => {
                  const t = totalsMap[run.id];
                  const isLocked = run.status === 'locked';
                  const StatusIcon = STATUS_ICON[run.status] ?? Clock;
                  const chip = STATUS_CHIP[run.status] ?? 'bg-slate-100 text-slate-600 ring-slate-200';
                  return (
                    <li
                      key={run.id}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${Math.min(i, 6) * 0.04}s`, opacity: 0 }}
                    >
                      <div className="flex items-center gap-3 px-5 py-4 hover:bg-[var(--bg-subtle)] transition-colors group">
                        <Link
                          href={`/companies/${companyId}/payroll/${run.tahun}/${run.bulan}`}
                          className="flex-1 min-w-0"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <StatusIcon
                              size={14}
                              className={
                                isLocked
                                  ? 'text-emerald-600'
                                  : run.status === 'calculated'
                                  ? 'text-sky-600'
                                  : 'text-amber-600'
                              }
                            />
                            <p className="text-[15px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors">
                              {BULAN_NAMES[run.bulan - 1]} {run.tahun}
                            </p>
                            <span
                              className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${chip}`}
                            >
                              {run.status}
                            </span>
                          </div>
                          {t ? (
                            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
                              <Field label="Karyawan" value={String(t.count)} />
                              <Field label="Bruto" value={formatRupiah(t.bruto)} />
                              <Field
                                label="PPh 21"
                                value={formatRupiah(t.pph)}
                                tone="amber"
                              />
                              <Field
                                label="THP"
                                value={formatRupiah(t.thp)}
                                tone="emerald"
                                strong
                              />
                            </div>
                          ) : (
                            <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                              Belum ada hasil
                            </p>
                          )}
                        </Link>

                        {!isLocked && (
                          <button
                            onClick={() => handleDeleteRun(run)}
                            disabled={deleting === run.id}
                            className="shrink-0 p-2 text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                            aria-label={`Hapus run ${BULAN_NAMES[run.bulan - 1]} ${run.tahun}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                        <ChevronRight
                          size={16}
                          className="shrink-0 text-[var(--text-faint)] group-hover:text-[var(--brand)] group-hover:translate-x-0.5 transition-all"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
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
