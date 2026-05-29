'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Lock, CheckCircle2, Clock, Plus, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { deletePayrollRun } from '@/lib/actions/payroll';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';

const BULAN_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

export default function PayrollHubPage() {
  const { companyId } = useParams();
  const [company, setCompany]     = useState<any>(null);
  const [runs, setRuns]           = useState<any[]>([]);
  const [totalsMap, setTotalsMap] = useState<Record<string, any>>({});
  const [loading, setLoading]     = useState(true);
  const [year, setYear]           = useState(new Date().getFullYear());
  const [deleting, setDeleting]   = useState<string | null>(null);

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
            .from('payroll_results').select('run_id, thp, bruto, pph').in('run_id', runIds);
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

  const confirm = useConfirm();
  async function handleDelete(run: any, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (run.status === 'locked') { toast.error('Run yang sudah dikunci tidak bisa dihapus.'); return; }
    if (!(await confirm({
      title: `Hapus payroll ${BULAN_NAMES[run.bulan - 1]} ${run.tahun}?`,
      message: 'Semua hasil kalkulasi untuk periode ini akan hilang dan tidak bisa dipulihkan.',
      severity: 'danger',
      confirmLabel: 'Hapus',
    }))) return;
    setDeleting(run.id);
    const res = await deletePayrollRun(run.id, companyId as string, run.tahun, run.bulan);
    if (res.error) { toast.error(res.error); setDeleting(null); }
    else { toast.success('Run dihapus'); setRuns(r => r.filter(x => x.id !== run.id)); setDeleting(null); }
  }

  const now = new Date();
  const allYears = Array.from(new Set([...runs.map(r => r.tahun), now.getFullYear()])).sort((a, b) => b - a);
  const runsForYear = runs.filter(r => r.tahun === year);
  const runByMonth: Record<number, any> = Object.fromEntries(runsForYear.map(r => [r.bulan, r]));
  const yearTotals = runsForYear.reduce((acc, r) => {
    const t = totalsMap[r.id];
    if (!t) return acc;
    return { thp: acc.thp + t.thp, pph: acc.pph + t.pph, count: acc.count + t.count };
  }, { thp: 0, pph: 0, count: 0 });

  const statusCfg = {
    locked:     { cls: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80', text: 'text-emerald-700', icon: Lock },
    calculated: { cls: 'border-sky-200 bg-sky-50 hover:bg-sky-100/80',             text: 'text-sky-700',     icon: CheckCircle2 },
    draft:      { cls: 'border-amber-200 bg-amber-50 hover:bg-amber-100/80',       text: 'text-amber-700',   icon: Clock },
  } as const;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href={`/companies/${companyId}`} className="inline-flex items-center gap-1 hover:text-[var(--brand)] transition-colors">
          <ArrowLeft size={14} />
          {company?.name ?? 'Perusahaan'}
        </Link>
      </div>

      {/* Header + year nav */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Payroll Hub</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {yearTotals.count > 0
              ? `${year} · THP ${formatRupiah(yearTotals.thp)} · PPh ${formatRupiah(yearTotals.pph)}`
              : 'Pilih bulan untuk memulai kalkulasi'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear(y => y - 1)}
            className="p-1.5 rounded-lg border border-[var(--border-default)] hover:border-[var(--brand)] hover:text-[var(--brand)] text-[var(--text-muted)] transition-colors cursor-pointer"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-[18px] font-bold font-mono text-[var(--text-primary)] min-w-[56px] text-center">{year}</span>
          <button
            onClick={() => setYear(y => y + 1)}
            className="p-1.5 rounded-lg border border-[var(--border-default)] hover:border-[var(--brand)] hover:text-[var(--brand)] text-[var(--text-muted)] transition-colors cursor-pointer"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* 12-month calendar grid */}
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="h-[88px] bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {Array.from({ length: 12 }, (_, idx) => {
            const bulan = idx + 1;
            const run = runByMonth[bulan];
            const totals = run ? totalsMap[run.id] : null;
            const isFuture = year > now.getFullYear() || (year === now.getFullYear() && bulan > now.getMonth() + 1);

            if (!run) {
              return (
                <Link
                  key={bulan}
                  href={isFuture ? '#' : `/companies/${companyId}/payroll/${year}/${bulan}`}
                  className={`flex flex-col p-4 border rounded-xl transition-all group ${
                    isFuture
                      ? 'border-[var(--border-subtle)] bg-[var(--bg-card)] opacity-35 pointer-events-none'
                      : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:shadow-sm cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{BULAN_SHORT[idx]}</span>
                    <Plus size={12} className="text-[var(--text-faint)] group-hover:text-[var(--brand)] transition-colors" />
                  </div>
                  <p className="text-[12px] text-[var(--text-faint)] group-hover:text-[var(--brand)] font-medium transition-colors">Mulai hitung</p>
                </Link>
              );
            }

            const cfg = statusCfg[run.status as keyof typeof statusCfg] ?? statusCfg.draft;
            const StatusIcon = cfg.icon;

            return (
              <div key={bulan} className="relative group">
                <Link
                  href={`/companies/${companyId}/payroll/${year}/${bulan}`}
                  className={`flex flex-col p-4 border rounded-xl transition-all shadow-sm ${cfg.cls}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[11px] font-semibold uppercase tracking-wider ${cfg.text}`}>{BULAN_SHORT[idx]}</span>
                    <StatusIcon size={12} className={cfg.text} />
                  </div>
                  {totals ? (
                    <>
                      <p className={`text-[13px] font-bold font-mono leading-snug ${cfg.text}`}>
                        {formatRupiah(totals.thp)}
                      </p>
                      <p className={`text-[10px] mt-0.5 ${cfg.text} opacity-70`}>
                        {totals.count} karyawan
                      </p>
                    </>
                  ) : (
                    <p className={`text-[12px] font-medium ${cfg.text} opacity-80`}>{run.status}</p>
                  )}
                </Link>
                {run.status !== 'locked' && (
                  <button
                    onClick={(e) => handleDelete(run, e)}
                    disabled={deleting === run.id}
                    className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 disabled:opacity-50 cursor-pointer z-10"
                    aria-label={`Hapus ${BULAN_NAMES[idx]} ${year}`}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Other years */}
      {allYears.filter(y => y !== year).length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
            <h2 className="text-[13px] font-semibold text-[var(--text-secondary)]">Tahun Lain</h2>
          </div>
          <div className="flex flex-wrap gap-2 p-4">
            {allYears.filter(y => y !== year).map(y => {
              const runsY = runs.filter(r => r.tahun === y);
              const locked = runsY.filter(r => r.status === 'locked').length;
              return (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className="px-4 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] text-[var(--text-secondary)] text-[13px] font-semibold transition-all cursor-pointer"
                >
                  {y}
                  <span className="ml-2 text-[11px] font-normal opacity-60">{locked}/{runsY.length} locked</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
