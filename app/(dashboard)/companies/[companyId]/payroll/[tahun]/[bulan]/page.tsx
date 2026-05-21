'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft, Save, Lock, Printer, Download,
  AlertTriangle, Share2, ChevronDown, ChevronRight,
  TrendingUp, Pencil, X, RefreshCw, CheckCircle2, Clock,
} from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { calculateMonthlySalary, calculateFreelance } from '@/lib/engine/payroll';
import { savePayrollRun, lockPayrollRun } from '@/lib/actions/payroll';
import { updateEmployee } from '@/lib/actions/employees';
import { printSlipGaji } from '@/lib/export/slip-gaji';
import { exportSPTMasa } from '@/lib/export/spt-masa';
import { toast } from 'sonner';
import { createShareLink } from '@/lib/actions/share';
import { NominalInput } from '@/components/ui/FormattedInput';
import { CalcTooltipPopover, InfoDot, type CalcTooltipData } from '@/components/payroll/CalcTooltip';
import { BPJS as BPJS_RATES, JP_MAX_BASIS, KES_MAX_BASIS } from '@/lib/engine/constants';

const BULAN_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

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

/* ── Ledger row helpers (light-themed, tabular) ── */

function LedgerSectionLabel({ text }: { text: string }) {
  return (
    <div className="mt-4 mb-1">
      <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-muted)]">
        {text}
      </span>
    </div>
  );
}

function LedgerRow({
  label, value, color, indent, dim, calc, calcPosition,
}: {
  label: string;
  value: string;
  color?: string;
  indent?: boolean;
  dim?: boolean;
  calc?: CalcTooltipData;
  calcPosition?: 'below' | 'above';
}) {
  const labelEl = (
    <span
      className="text-[13px] text-[var(--text-secondary)] inline-flex items-baseline gap-1.5"
      style={{ paddingLeft: indent ? 16 : 0 }}
    >
      {label}
      {calc && <InfoDot />}
    </span>
  );
  const valueEl = (
    <span
      className={`font-mono text-[13px] font-semibold ${color ?? 'text-[var(--text-primary)]'}`}
    >
      {value}
    </span>
  );

  if (!calc) {
    return (
      <div className="flex justify-between items-baseline py-[3px]" style={{ opacity: dim ? 0.7 : 1 }}>
        {labelEl}
        {valueEl}
      </div>
    );
  }

  return (
    <div className="relative group" style={{ opacity: dim ? 0.7 : 1 }}>
      <div className="flex justify-between items-baseline py-[3px] cursor-help hover:bg-slate-50 rounded -mx-2 px-2 transition-colors">
        {labelEl}
        {valueEl}
      </div>
      <CalcTooltipPopover data={calc} position={calcPosition} />
    </div>
  );
}

function LedgerSep() {
  return <div className="my-2 border-t border-[var(--border-subtle)]" />;
}

function LedgerTotal({
  label, value, color, calc, calcPosition,
}: {
  label: string;
  value: string;
  color: string;
  calc?: CalcTooltipData;
  calcPosition?: 'below' | 'above';
}) {
  const labelEl = (
    <span className="text-[14px] font-bold text-[var(--text-primary)] inline-flex items-baseline gap-1.5">
      {label}
      {calc && <InfoDot />}
    </span>
  );
  const valueEl = <span className={`font-mono text-[15px] font-bold ${color}`}>{value}</span>;

  if (!calc) {
    return (
      <div className="flex justify-between items-baseline py-1.5">
        {labelEl}
        {valueEl}
      </div>
    );
  }

  return (
    <div className="relative group">
      <div className="flex justify-between items-baseline py-1.5 cursor-help hover:bg-slate-50 rounded -mx-2 px-2 transition-colors">
        {labelEl}
        {valueEl}
      </div>
      <CalcTooltipPopover data={calc} position={calcPosition} />
    </div>
  );
}

/* ── Quick edit modal ── */

function QuickEditModal({
  employee, onClose, onSaveAndRecalc,
}: {
  employee: any;
  onClose: () => void;
  onSaveAndRecalc: (empId: string, companyId: string, formData: FormData) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const fields = [
      'nama', 'nik', 'npwp', 'punya_npwp', 'status_ptkp', 'jenis_kelamin',
      'tanggal_masuk', 'divisi', 'jabatan', 'jenis_karyawan', 'jkk_rate',
      'ikut_jht', 'ikut_jp', 'ikut_jkp', 'ikut_kes',
      'tanggung_jht_k', 'tanggung_jp_k', 'tanggung_kes_k', 'pph_ditanggung',
    ];
    for (const f of fields) {
      if (!fd.has(f)) {
        if (typeof employee[f] === 'boolean' && employee[f]) {
          fd.append(f, 'on');
        } else if (typeof employee[f] === 'string' || typeof employee[f] === 'number') {
          fd.append(f, String(employee[f]));
        }
      }
    }
    await onSaveAndRecalc(employee.id, employee.company_id, fd);
    setSaving(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-[var(--bg-overlay)] z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--border-default)]">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Edit Kompensasi
            </h3>
            <p className="text-[13px] text-[var(--text-muted)] mt-0.5 truncate">{employee.nama}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <NominalInput label="Gaji Pokok" name="gaji_pokok" defaultValue={employee.gaji_pokok} />
            <NominalInput label="Benefit / Tunj. Tetap" name="benefit" defaultValue={employee.benefit} />
            <NominalInput label="Tunjangan Kendaraan" name="kendaraan" defaultValue={employee.kendaraan} />
            <NominalInput label="Tunjangan Pulsa" name="pulsa" defaultValue={employee.pulsa} />
            <NominalInput label="Tunjangan Operasional" name="operasional" defaultValue={employee.operasional} />
            <NominalInput label="Tunjangan Lain" name="tunj_lain" defaultValue={employee.tunj_lain} />
          </div>

          <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
            Perubahan akan disimpan ke database dan payroll bulan ini dihitung ulang otomatis.
          </p>

          <div className="flex gap-3 pt-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={saving ? 'animate-spin' : ''} />
              {saving ? 'Menyimpan…' : 'Simpan & Hitung Ulang'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main page ── */

export default function PayrollRunPage() {
  const { companyId, tahun, bulan } = useParams();
  const [employees, setEmployees]         = useState<any[]>([]);
  const [events, setEvents]               = useState<any[]>([]);
  const [existingRun, setExistingRun]     = useState<any>(null);
  const [results, setResults]             = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [isCalculated, setIsCalculated]   = useState(false);
  const [isAutoCalcing, setIsAutoCalcing] = useState(false);
  const [company, setCompany]             = useState<any>(null);
  const [sharing, setSharing]             = useState(false);
  const [shareCopied, setShareCopied]     = useState(false);
  const [calcProgress, setCalcProgress]   = useState({ current: 0, total: 0 });
  const [accumMap, setAccumMap]           = useState<Record<string, { akum_bruto: number; pph_jan_nov: number }>>({});
  const [showYTD, setShowYTD]             = useState(false);
  const [quickEditEmp, setQuickEditEmp]   = useState<any>(null);
  const autoCalcRef = useRef(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const [{ data: co }, { data: empData }, { data: eventData }, { data: runData }] = await Promise.all([
        supabase.from('companies').select('name, npwp_perusahaan').eq('id', companyId).single(),
        supabase.from('employees').select('*').eq('company_id', companyId).eq('aktif', true),
        supabase.from('employee_events').select('*')
          .eq('company_id', companyId).eq('tahun', tahun).eq('bulan', bulan),
        supabase.from('payroll_runs').select('*, payroll_results(*)')
          .eq('company_id', companyId).eq('tahun', tahun).eq('bulan', bulan).maybeSingle(),
      ]);

      const newAccumMap: Record<string, { akum_bruto: number; pph_jan_nov: number }> = {};
      if (empData) {
        const { data: prevRuns } = await supabase
          .from('payroll_runs').select('id, bulan')
          .eq('company_id', companyId).eq('tahun', tahun).lt('bulan', Number(bulan));
        if (prevRuns?.length) {
          const { data: prevResults } = await supabase
            .from('payroll_results').select('employee_id, bruto, pph')
            .in('run_id', prevRuns.map((r) => r.id));
          for (const r of prevResults ?? []) {
            if (!newAccumMap[r.employee_id])
              newAccumMap[r.employee_id] = { akum_bruto: 0, pph_jan_nov: 0 };
            newAccumMap[r.employee_id].akum_bruto  += r.bruto ?? 0;
            newAccumMap[r.employee_id].pph_jan_nov += r.pph   ?? 0;
          }
        }
      }

      if (co) setCompany(co);
      setAccumMap(newAccumMap);
      const enrichedEmps = (empData ?? []).map((emp) => ({
        ...emp,
        _akum_bruto:  newAccumMap[emp.id]?.akum_bruto  ?? 0,
        _pph_jan_nov: newAccumMap[emp.id]?.pph_jan_nov ?? 0,
      }));
      setEmployees(enrichedEmps);
      if (eventData) setEvents(eventData);

      if (runData) {
        setExistingRun(runData);
        if (runData.payroll_results?.length > 0) {
          const mapped = runData.payroll_results.map((r: any) => ({
            ...r.result_json,
            employee_id: r.employee_id,
            employee_name: empData?.find((e) => e.id === r.employee_id)?.nama,
          }));
          setResults(mapped);
          setIsCalculated(true);
        }
      } else if ((empData ?? []).length > 0 && !autoCalcRef.current) {
        autoCalcRef.current = true;
        setIsAutoCalcing(true);
      }
      setLoading(false);
    }
    fetchData();
  }, [companyId, tahun, bulan]);

  useEffect(() => {
    if (isAutoCalcing && employees.length > 0 && !isCalculated) {
      handleCalculate();
      setIsAutoCalcing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoCalcing, employees]);

  function runCalculation(emps: any[], evts: any[]) {
    return new Promise<any[]>((resolve) => {
      setCalcProgress({ current: 0, total: emps.length });
      const newResults: any[] = [];
      let i = 0;
      function processNext() {
        if (i >= emps.length) {
          setCalcProgress({ current: 0, total: 0 });
          resolve(newResults);
          return;
        }
        const emp = emps[i];
        const empEvents     = evts.filter((e) => e.employee_id === emp.id);
        const kasbon        = empEvents.filter((e) => e.tipe === 'kasbon').reduce((a: number, b: any) => a + b.nilai, 0);
        const alpha_telat   = empEvents.filter((e) => e.tipe === 'alpha_telat').reduce((a: number, b: any) => a + b.nilai, 0);
        const pot_lain      = empEvents.filter((e) => e.tipe === 'pot_lain').reduce((a: number, b: any) => a + b.nilai, 0);
        const thr           = empEvents.filter((e) => e.tipe === 'thr').reduce((a: number, b: any) => a + b.nilai, 0);
        const bonus         = empEvents.filter((e) => e.tipe === 'bonus').reduce((a: number, b: any) => a + b.nilai, 0);
        const benefit_extra = empEvents.filter((e) => e.tipe === 'benefit_extra').reduce((a: number, b: any) => a + b.nilai, 0);
        let calcResult: any = {};
        if (emp.jenis_karyawan === 'tetap') {
          // Mid-year exit detection: if this run's month matches the employee's
          // tanggal_keluar month/year, route through Pasal 17 reconciliation
          // (isLastMonth) and scale annual caps to actual months worked.
          const runYear  = Number(tahun);
          const runMonth = Number(bulan);
          const exitDate  = emp.tanggal_keluar ? new Date(`${emp.tanggal_keluar}T00:00:00`) : null;
          const entryDate = emp.tanggal_masuk  ? new Date(`${emp.tanggal_masuk}T00:00:00`)  : null;
          const isLastMonth =
            !!exitDate &&
            exitDate.getFullYear() === runYear &&
            (exitDate.getMonth() + 1) === runMonth;
          let months_in_year = 12;
          if (isLastMonth) {
            const startMonth = entryDate && entryDate.getFullYear() === runYear
              ? (entryDate.getMonth() + 1)
              : 1;
            months_in_year = Math.max(1, Math.min(12, runMonth - startMonth + 1));
          }

          calcResult = calculateMonthlySalary({
            ...emp, bulan: runMonth, tahun: runYear,
            kasbon, alpha_telat,
            pot_lain: pot_lain + (emp.pot_lain || 0),
            tunj_lain: (emp.tunj_lain ?? 0) + benefit_extra,
            thr, bonus,
            pph_jan_nov: emp._pph_jan_nov ?? 0,
            akum_bruto: emp._akum_bruto ?? 0,
            isLastMonth,
            months_in_year,
          });
        } else {
          calcResult = calculateFreelance({
            ...emp,
            mode: emp.jenis_karyawan === 'tidak_tetap_harian' ? 'harian' : 'bulanan',
            upah_harian: emp.upah_harian,
            hari_kerja: emp.hari_kerja_default || 22,
            upah_bulanan: emp.upah_bulanan_tt,
            tunjangan: (emp.tunjangan_tt || 0) + benefit_extra,
            thr, bonus,
            ikut_bpjs_tk: emp.ikut_jht || emp.ikut_jp,
            ikut_kes: emp.ikut_kes,
            kasbon, pot_lain: pot_lain + (emp.pot_lain || 0),
          });
        }
        newResults.push({ ...calcResult, employee_id: emp.id, employee_name: emp.nama });
        i++;
        setCalcProgress((p) => ({ ...p, current: i }));
        setTimeout(processNext, 0);
      }
      processNext();
    });
  }

  function handleCalculate() {
    runCalculation(employees, events).then((newResults) => {
      setResults(newResults);
      setIsCalculated(true);
    });
  }

  async function handleQuickEdit(empId: string, companyId: string, formData: FormData) {
    const res = await updateEmployee(empId, companyId as string, formData);
    if (res.error) {
      toast.error(res.error);
      return;
    }

    const supabase = createClient();
    const { data: updatedEmp } = await supabase
      .from('employees').select('*').eq('id', empId).single();
    if (!updatedEmp) {
      toast.error('Gagal refresh data karyawan');
      return;
    }

    const enriched = {
      ...updatedEmp,
      _akum_bruto: accumMap[empId]?.akum_bruto ?? 0,
      _pph_jan_nov: accumMap[empId]?.pph_jan_nov ?? 0,
    };

    const updatedEmps = employees.map((e) => (e.id === empId ? enriched : e));
    setEmployees(updatedEmps);

    const singleResult = await runCalculation(
      [enriched],
      events.filter((e) => e.employee_id === empId),
    );
    setResults((prev) =>
      prev.map((r) =>
        r.employee_id === empId
          ? { ...singleResult[0], employee_id: empId, employee_name: updatedEmp.nama }
          : r,
      ),
    );

    toast.success(`${updatedEmp.nama} — dihitung ulang`);
  }

  async function handleShare() {
    if (!existingRun?.id) return;
    setSharing(true);
    const res = await createShareLink(existingRun.id, companyId as string, Number(tahun), Number(bulan));
    if (res.error) toast.error(res.error);
    else {
      await navigator.clipboard.writeText(res.url!);
      setShareCopied(true);
      toast.success('Link disalin ke clipboard');
      setTimeout(() => setShareCopied(false), 3000);
    }
    setSharing(false);
  }

  async function handleSave() {
    setSaving(true);
    const res = await savePayrollRun(companyId as string, Number(tahun), Number(bulan), results);
    if (res.error) {
      toast.error(res.error);
      setSaving(false);
      return;
    }
    setExistingRun((p: any) => ({ ...p, id: res.runId, status: 'calculated' }));
    toast.success('Payroll disimpan');
    setSaving(false);
  }

  async function handleLock() {
    if (!existingRun?.id) return;
    if (!confirm('Kunci payroll? Data tidak bisa diubah lagi.')) return;
    setSaving(true);
    const res = await lockPayrollRun(existingRun.id, companyId as string, Number(tahun), Number(bulan));
    if (res.error) {
      toast.error(res.error);
      setSaving(false);
      return;
    }
    setExistingRun((p: any) => ({ ...p, status: 'locked' }));
    toast.success('Payroll dikunci');
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="h-20 bg-white border border-[var(--border-default)] rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-[var(--border-default)] rounded-xl animate-pulse" />
          ))}
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="h-48 bg-white border border-[var(--border-default)] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const isLocked   = existingRun?.status === 'locked';
  const isDesember = Number(bulan) === 12;
  const totalBruto = results.reduce((a, r) => a + (r.bruto || r.total_upah || 0), 0);
  const totalPph   = results.reduce((a, r) => a + (r.pph || r.total_pph || 0), 0);
  const totalThp   = results.reduce((a, r) => a + (r.thp || 0), 0);
  const totalCtc   = results.reduce((a, r) => a + (r.bruto || r.total_upah || 0) + (r.bpjs?.employer_offslip || 0), 0);
  const hasYTD     = Object.keys(accumMap).length > 0;
  const isCalcing  = calcProgress.total > 0;
  const runStatus  = existingRun?.status ?? (isCalcing ? 'calculating' : 'draft');
  const StatusIconCmp = STATUS_ICON[runStatus] ?? Clock;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {quickEditEmp && !isLocked && (
        <QuickEditModal
          employee={quickEditEmp}
          onClose={() => setQuickEditEmp(null)}
          onSaveAndRecalc={handleQuickEdit}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link
          href={`/companies/${companyId}/payroll`}
          className="inline-flex items-center gap-1 hover:text-[var(--brand)] transition-colors"
        >
          <ArrowLeft size={14} />
          {company?.name ?? 'Perusahaan'} · Payroll
        </Link>
      </div>

      {/* Header */}
      <header className="bg-white border border-[var(--border-default)] rounded-xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                {BULAN_NAMES[Number(bulan) - 1]} {tahun}
              </h1>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${
                  STATUS_CHIP[runStatus] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
                }`}
              >
                <StatusIconCmp size={11} />
                {runStatus === 'calculating' ? 'Menghitung…' : runStatus}
              </span>
            </div>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {company?.name ?? '—'} · {results.length} karyawan
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {isCalculated && (
              <button
                onClick={() => exportSPTMasa(results, company, employees, Number(bulan), Number(tahun))}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <Download size={14} />
                Export SPT
              </button>
            )}
            {existingRun?.status === 'locked' && (
              <button
                onClick={handleShare}
                disabled={sharing}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Share2 size={14} />
                {shareCopied ? 'Tersalin!' : sharing ? '…' : 'Bagikan'}
              </button>
            )}

            {isCalcing ? (
              <div className="flex items-center gap-3 px-3 py-2 bg-white border border-[var(--border-default)] rounded-lg">
                <div className="w-32 h-1.5 rounded-full overflow-hidden bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[var(--brand)] transition-all duration-150"
                    style={{
                      width: `${(calcProgress.current / calcProgress.total) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  {calcProgress.current}/{calcProgress.total}
                </span>
              </div>
            ) : (
              !isLocked && (
                <button
                  onClick={handleCalculate}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <RefreshCw size={14} />
                  {isCalculated ? 'Hitung Ulang' : 'Hitung'}
                </button>
              )
            )}

            {isCalculated && !isLocked && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              >
                <Save size={14} />
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            )}
            {existingRun?.status === 'calculated' && (
              <button
                onClick={handleLock}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-50 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Lock size={14} />
                Kunci
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Auto-calc indicator */}
      {isCalcing && !isCalculated && (
        <div className="bg-white border border-[var(--border-default)] rounded-xl p-10 text-center animate-fade-in">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--brand)] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">
            Menghitung {calcProgress.current} / {calcProgress.total} karyawan…
          </p>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">
            Otomatis dihitung saat halaman dibuka
          </p>
        </div>
      )}

      {/* Summary cards */}
      {isCalculated && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label="Total Bruto" value={formatRupiah(totalBruto)} />
          <SummaryCard label="Total PPh 21" value={formatRupiah(totalPph)} tone="amber" />
          <SummaryCard label="Total THP" value={formatRupiah(totalThp)} tone="emerald" />
          <SummaryCard label="Total CTC" value={formatRupiah(totalCtc)} tone="sky" />
        </div>
      )}

      {/* December warning */}
      {isDesember && isCalculated && (
        <div className="rounded-xl p-5 flex items-start gap-3 bg-amber-50 border border-amber-200 animate-fade-in">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Equalisasi Desember</p>
            <p className="text-[13px] text-amber-700 mt-1 leading-relaxed">
              Equalisasi Desember akan menghasilkan PPh{' '}
              <span className="font-semibold font-mono">{formatRupiah(totalPph)}</span> untuk{' '}
              {results.length} karyawan menggunakan metode Pasal 17 tahunan.
            </p>
          </div>
        </div>
      )}

      {/* YTD Ledger */}
      {isCalculated && hasYTD && (
        <div className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowYTD((v) => !v)}
            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <TrendingUp size={15} className="text-[var(--brand)]" />
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                YTD Ledger — s/d {BULAN_NAMES[Number(bulan) - 2] || BULAN_NAMES[0]}
              </span>
            </div>
            {showYTD ? (
              <ChevronDown size={16} className="text-[var(--text-muted)]" />
            ) : (
              <ChevronRight size={16} className="text-[var(--text-muted)]" />
            )}
          </button>
          {showYTD && (
            <div className="overflow-x-auto border-t border-[var(--border-subtle)]">
              <table>
                <thead>
                  <tr>
                    {['Nama', 'Akum. Bruto', 'Akum. PPh', 'Bulan Ini', 'Est. Tahunan'].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((res, i) => {
                    const acc       = accumMap[res.employee_id] ?? { akum_bruto: 0, pph_jan_nov: 0 };
                    const thisBruto = res.bruto ?? res.total_upah ?? 0;
                    const projected = ((acc.akum_bruto + thisBruto) / Number(bulan)) * 12;
                    return (
                      <tr key={i}>
                        <td className="font-semibold text-[var(--text-primary)]">
                          {res.employee_name}
                        </td>
                        <td className="font-mono">{formatRupiah(acc.akum_bruto)}</td>
                        <td className="font-mono text-amber-700">{formatRupiah(acc.pph_jan_nov)}</td>
                        <td className="font-mono">{formatRupiah(thisBruto)}</td>
                        <td className="font-mono text-sky-700">{formatRupiah(projected)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Per-employee results */}
      {isCalculated && (
        <div className="space-y-4">
          {results.map((res, i) => {
            const isTetap     = !res.mode || res.mode === undefined;
            const bpjsK       = res.bpjs?.karyawan_potong ?? res.tot_bpjs ?? 0;
            const ctc         = (res.bruto || res.total_upah || 0) + (res.bpjs?.employer_offslip ?? 0);
            const bpjsJKK     = res.bpjs?.jkk ?? 0;
            const bpjsJKM     = res.bpjs?.jkm ?? 0;
            const bpjsKesE    = res.bpjs?.kes_e ?? 0;
            const bpjsTunjJHT = res.bpjs?.tunj_jht ?? 0;
            const bpjsTunjJP  = res.bpjs?.tunj_jp  ?? 0;
            const bpjsTunjKes = res.bpjs?.tunj_kes ?? 0;
            const bpjsJHTE    = res.bpjs?.jht_e ?? 0;
            const bpjsJPE     = res.bpjs?.jp_e  ?? 0;
            const bpjsInBruto = bpjsJKK + bpjsJKM + bpjsKesE;
            const bpjsTunj    = bpjsTunjJHT + bpjsTunjJP + bpjsTunjKes;
            const bpjsPotJHT  = res.bpjs?.pot_jht ?? 0;
            const bpjsPotJP   = res.bpjs?.pot_jp  ?? 0;
            const bpjsPotKes  = res.bpjs?.pot_kes ?? 0;
            const grossPend   = (res.gaji_pokok ?? 0) + (res.allowance_total ?? 0);

            const sourceEmp = employees.find((e) => e.id === res.employee_id);

            // ── Calculation breakdown tooltips ───────────────────────────────
            const basis    = res.bpjs?._basis    ?? res.basis ?? res.gaji_pokok ?? 0;
            const jpBasis  = res.bpjs?._jp_basis  ?? Math.min(basis, JP_MAX_BASIS);
            const kesBasis = res.bpjs?._kes_basis ?? Math.min(basis, KES_MAX_BASIS);
            const jkkRate  = sourceEmp?.jkk_rate ?? 0;
            const rpFmt    = (n: number) => formatRupiah(Math.round(n));
            const pct      = (r: number) => `${(r * 100).toFixed(2)}%`;

            const calcBruto: CalcTooltipData | undefined = isTetap ? {
              title: 'BRUTO',
              description: 'Total penghasilan kena pajak',
              steps: [
                { label: 'Gaji Pokok',            value: rpFmt(res.gaji_pokok ?? 0),    op: '+' },
                ...((res.allowance_total ?? 0) > 0 ? [{ label: 'Total Tunjangan',   value: rpFmt(res.allowance_total ?? 0), op: '+' as const }] : []),
                ...(bpjsInBruto > 0 ? [{ label: 'BPJS Employer (bruto)', value: rpFmt(bpjsInBruto), op: '+' as const }] : []),
                ...(bpjsTunj > 0 ? [{ label: 'Tunj. BPJS Karyawan',   value: rpFmt(bpjsTunj),    op: '+' as const }] : []),
                ...((res.tunj_pph ?? 0) > 0 ? [{ label: 'Tunj. PPh 21 (Grossup)', value: rpFmt(res.tunj_pph ?? 0), op: '+' as const }] : []),
                { label: 'BRUTO', value: rpFmt(res.bruto ?? 0), highlight: true },
              ],
            } : undefined;

            const calcPph: CalcTooltipData | undefined = (isTetap && res.ter != null) ? {
              title: 'PPh 21 — Metode TER',
              description: 'TER% × Bruto',
              steps: [
                { label: `PTKP ${res.status_ptkp ?? '—'} → Grup ${res.grup ?? '—'}`, value: '', muted: true },
                { label: 'Bruto',    value: rpFmt(res.bruto ?? 0),  op: '×' },
                { label: 'TER Rate', value: pct(res.ter),           op: '=' },
                ...((res.punya_npwp === false) ? [{ label: 'Non-NPWP (×1.2)', value: '', muted: true }] : []),
                { label: 'PPh 21',   value: rpFmt(res.pph ?? 0),    highlight: true },
              ],
              footer: 'PMK 168/2023',
            } : undefined;

            const calcPphDes: CalcTooltipData | undefined = (isTetap && res.ter == null) ? {
              title: 'PPh 21 — Desember (Pasal 17)',
              description: 'Equalisasi tarif progresif tahunan',
              steps: [
                { label: 'Bruto Setahun', value: rpFmt(res.bs ?? 0),  op: '+' },
                { label: '− Biaya Jabatan', value: rpFmt(res.bj ?? 0), op: '-' },
                { label: `− Iuran JP/JHT Karyawan`, value: rpFmt(res.jp_k_tahunan ?? 0), op: '-' },
                { label: 'Netto Setahun',  value: rpFmt(res.netto ?? 0), muted: true },
                { label: `− PTKP ${res.status_ptkp ?? ''}`, value: rpFmt(res.ptkp ?? 0), op: '-' },
                { label: 'PKP (× tarif berlapis)', value: rpFmt(res.pkp ?? 0), muted: true },
                { label: 'PPh Tahunan', value: rpFmt(res.pph_tahunan ?? 0) },
                { label: '− PPh Jan–Nov', value: rpFmt(res.pph_jan_nov ?? 0), op: '-' },
                { label: 'PPh Desember', value: rpFmt(res.pph ?? 0), highlight: true },
              ],
              footer: 'UU HPP Pasal 17 — pembulatan PKP ke ribuan',
            } : undefined;

            const calcJKK: CalcTooltipData = {
              title: 'JKK — Jaminan Kecelakaan Kerja',
              description: 'Basis × JKK Rate (industri)',
              steps: [
                { label: 'Basis BPJS', value: rpFmt(basis), op: '×' },
                { label: 'JKK Rate',   value: pct(jkkRate), op: '=' },
                { label: 'JKK',        value: rpFmt(bpjsJKK), highlight: true },
              ],
              footer: 'Beban perusahaan, masuk bruto',
            };
            const calcJKM: CalcTooltipData = {
              title: 'JKM — Jaminan Kematian',
              description: 'Basis × 0.30%',
              steps: [
                { label: 'Basis BPJS', value: rpFmt(basis), op: '×' },
                { label: 'JKM Rate',   value: pct(BPJS_RATES.jkm), op: '=' },
                { label: 'JKM',        value: rpFmt(bpjsJKM), highlight: true },
              ],
              footer: 'Beban perusahaan, masuk bruto',
            };
            const calcKesE: CalcTooltipData = {
              title: 'Kesehatan Employer (4%)',
              description: 'min(basis, 12jt) × 4%',
              steps: [
                { label: 'Basis Kes (capped 12jt)', value: rpFmt(kesBasis), op: '×' },
                { label: 'Kes Employer Rate', value: pct(BPJS_RATES.kes_e), op: '=' },
                { label: 'Kes Employer', value: rpFmt(bpjsKesE), highlight: true },
              ],
              footer: 'Beban perusahaan, masuk bruto',
            };
            const calcTunjJHT: CalcTooltipData = {
              title: 'JHT Karyawan (Co. Tanggung)',
              description: 'Basis × 2% — dibayar perusahaan',
              steps: [
                { label: 'Basis BPJS', value: rpFmt(basis), op: '×' },
                { label: 'JHT Karyawan Rate', value: pct(BPJS_RATES.jht_k), op: '=' },
                { label: 'Tunj. JHT', value: rpFmt(bpjsTunjJHT), highlight: true },
              ],
              footer: 'Tunjangan ini masuk bruto karyawan',
            };
            const calcTunjJP: CalcTooltipData = {
              title: 'JP Karyawan (Co. Tanggung)',
              description: 'min(basis, 10.5jt) × 1% — dibayar perusahaan',
              steps: [
                { label: 'Basis JP (capped 10.5jt)', value: rpFmt(jpBasis), op: '×' },
                { label: 'JP Karyawan Rate', value: pct(BPJS_RATES.jp_k), op: '=' },
                { label: 'Tunj. JP', value: rpFmt(bpjsTunjJP), highlight: true },
              ],
              footer: 'Tunjangan ini masuk bruto karyawan',
            };
            const calcTunjKes: CalcTooltipData = {
              title: 'Kes Karyawan (Co. Tanggung)',
              description: 'min(basis, 12jt) × 1% — dibayar perusahaan',
              steps: [
                { label: 'Basis Kes (capped 12jt)', value: rpFmt(kesBasis), op: '×' },
                { label: 'Kes Karyawan Rate', value: pct(BPJS_RATES.kes_k), op: '=' },
                { label: 'Tunj. Kes', value: rpFmt(bpjsTunjKes), highlight: true },
              ],
              footer: 'Tunjangan ini masuk bruto karyawan',
            };
            const calcPotJHT: CalcTooltipData = {
              title: 'JHT Karyawan 2% (Dipotong)',
              description: 'Basis × 2% — dipotong dari gaji',
              steps: [
                { label: 'Basis BPJS', value: rpFmt(basis), op: '×' },
                { label: 'JHT Rate',   value: pct(BPJS_RATES.jht_k), op: '=' },
                { label: 'Potongan JHT', value: rpFmt(bpjsPotJHT), highlight: true },
              ],
            };
            const calcPotJP: CalcTooltipData = {
              title: 'JP Karyawan 1% (Dipotong)',
              description: 'min(basis, 10.5jt) × 1% — dipotong dari gaji',
              steps: [
                { label: 'Basis JP (capped)', value: rpFmt(jpBasis), op: '×' },
                { label: 'JP Rate',           value: pct(BPJS_RATES.jp_k), op: '=' },
                { label: 'Potongan JP',       value: rpFmt(bpjsPotJP), highlight: true },
              ],
            };
            const calcPotKes: CalcTooltipData = {
              title: 'Kesehatan Karyawan 1% (Dipotong)',
              description: 'min(basis, 12jt) × 1% — dipotong dari gaji',
              steps: [
                { label: 'Basis Kes (capped)', value: rpFmt(kesBasis), op: '×' },
                { label: 'Kes Rate',           value: pct(BPJS_RATES.kes_k), op: '=' },
                { label: 'Potongan Kes',       value: rpFmt(bpjsPotKes), highlight: true },
              ],
            };
            const calcGrossup: CalcTooltipData | undefined = ((res.tunj_pph ?? 0) > 0) ? {
              title: 'Tunjangan PPh 21 (Grossup)',
              description: 'Iterasi: PPh = TER × (Base + PPh) / (1 − TER)',
              steps: [
                { label: 'Base (gaji + tunjangan + BPJS)', value: rpFmt((res.base ?? res.bruto ?? 0) - (res.tunj_pph ?? 0)), muted: true },
                ...(res.ter != null ? [{ label: 'TER (konvergen)', value: pct(res.ter), muted: true }] : []),
                { label: 'PPh hasil iterasi', value: rpFmt(res.tunj_pph ?? 0), highlight: true },
              ],
              footer: 'Perusahaan menanggung PPh sebagai tunjangan',
            } : undefined;

            const calcThp: CalcTooltipData = {
              title: 'TAKE HOME PAY',
              description: 'Yang diterima karyawan',
              steps: [
                { label: 'Gaji + Tunjangan', value: rpFmt(grossPend), op: '+' },
                ...(!res.pph_ditanggung && (res.pph ?? 0) > 0 ? [{ label: '− PPh 21', value: rpFmt(res.pph ?? 0), op: '-' as const }] : []),
                ...(bpjsK > 0 ? [{ label: '− BPJS Karyawan dipotong', value: rpFmt(bpjsK), op: '-' as const }] : []),
                ...((res.kasbon ?? 0) > 0 ? [{ label: '− Kasbon', value: rpFmt(res.kasbon ?? 0), op: '-' as const }] : []),
                ...((res.alpha_telat ?? 0) > 0 ? [{ label: '− Alpha/Telat', value: rpFmt(res.alpha_telat ?? 0), op: '-' as const }] : []),
                ...((res.pot_lain ?? 0) > 0 ? [{ label: '− Potongan Lain', value: rpFmt(res.pot_lain ?? 0), op: '-' as const }] : []),
                { label: 'THP', value: rpFmt(res.thp ?? 0), highlight: true },
              ],
            };

            const calcCtc: CalcTooltipData = {
              title: 'COST TO COMPANY',
              description: 'Total biaya perusahaan',
              steps: [
                { label: 'Bruto', value: rpFmt(res.bruto ?? res.total_upah ?? 0), op: '+' },
                ...(bpjsJHTE > 0 ? [{ label: 'JHT Employer (offslip)', value: rpFmt(bpjsJHTE), op: '+' as const }] : []),
                ...(bpjsJPE > 0 ? [{ label: 'JP Employer (offslip)', value: rpFmt(bpjsJPE), op: '+' as const }] : []),
                { label: 'CTC', value: rpFmt(ctc), highlight: true },
              ],
              footer: 'Offslip = tidak terlihat di slip gaji',
            };

            return (
              <div
                key={i}
                className="bg-white border border-[var(--border-default)] rounded-xl animate-fade-in-up"
                style={{ animationDelay: `${Math.min(i, 8) * 0.04}s`, opacity: 0 }}
              >
                {/* Employee header */}
                <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] rounded-t-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <Link
                      href={`/companies/${companyId}/employees/${res.employee_id}?from=payroll&tahun=${tahun}&bulan=${bulan}`}
                      className="text-base font-semibold text-[var(--text-primary)] hover:text-[var(--brand)] transition-colors truncate"
                    >
                      {res.employee_name}
                    </Link>
                    {!isLocked && sourceEmp && (
                      <button
                        onClick={() => setQuickEditEmp(sourceEmp)}
                        title="Edit kompensasi & hitung ulang"
                        className="shrink-0 p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-white transition-colors cursor-pointer"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3 flex-wrap">
                    <span className="inline-flex text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset bg-slate-100 text-slate-700 ring-slate-200">
                      {res.mode ? res.mode : 'Tetap'}
                    </span>
                    <span className="text-[12px] text-[var(--text-muted)] font-medium">
                      {res.status_ptkp ?? '—'}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                        res.punya_npwp !== false
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {res.punya_npwp !== false ? 'NPWP ✓' : 'NO NPWP'}
                    </span>
                    {res.pph_ditanggung && (
                      <span className="inline-flex text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset bg-amber-50 text-amber-700 ring-amber-200">
                        Grossup
                      </span>
                    )}
                    {res.is_last_month && (
                      <span
                        title={`Bulan terakhir kerja — perhitungan Pasal 17 (${res.months_in_year ?? 12} bulan)`}
                        className="inline-flex text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset bg-purple-50 text-purple-700 ring-purple-200"
                      >
                        Bulan Terakhir · {res.months_in_year ?? 12}m
                      </span>
                    )}
                    <button
                      onClick={() => printSlipGaji(res, company, Number(bulan), Number(tahun))}
                      title="Cetak Slip Gaji"
                      className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-white transition-colors cursor-pointer"
                    >
                      <Printer size={14} />
                    </button>
                  </div>
                </div>

                {/* Ledger body */}
                <div className="px-5 sm:px-6 py-5">
                  {res.is_refund && (
                    <div className="mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                      <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-[13px] text-amber-900 leading-relaxed">
                        <p className="font-semibold">Kelebihan potong PPh — karyawan berhak refund</p>
                        <p className="mt-0.5">
                          PPh tahunan ({formatRupiah(res.pph_tahunan ?? 0)}) lebih kecil dari PPh yang sudah dipotong
                          {' '}({formatRupiah(res.pph_jan_nov ?? 0)}). Selisih:
                          {' '}<span className="font-semibold font-mono">{formatRupiah(res.refund_amount ?? 0)}</span>
                          {' '}harus dikembalikan tunai kepada karyawan di luar slip ini.
                        </p>
                      </div>
                    </div>
                  )}
                  {isTetap ? (
                    <>
                      <LedgerSectionLabel text="Pendapatan" />
                      <LedgerRow label="Gaji Pokok" value={formatRupiah(res.gaji_pokok ?? 0)} />
                      {(res.benefit ?? 0) > 0 && <LedgerRow label="Benefit / Tunj. Tetap"   value={formatRupiah(res.benefit)}     indent />}
                      {(res.kendaraan ?? 0) > 0 && <LedgerRow label="Tunjangan Kendaraan"   value={formatRupiah(res.kendaraan)}   indent />}
                      {(res.pulsa ?? 0) > 0 && <LedgerRow label="Tunjangan Pulsa"           value={formatRupiah(res.pulsa)}       indent />}
                      {(res.operasional ?? 0) > 0 && <LedgerRow label="Tunjangan Operasional" value={formatRupiah(res.operasional)} indent />}
                      {(res.tunj_lain ?? 0) > 0 && <LedgerRow label="Tunjangan Lain"        value={formatRupiah(res.tunj_lain)}   indent />}

                      {bpjsInBruto + bpjsTunj > 0 && (
                        <>
                          <LedgerSectionLabel text="BPJS Masuk Bruto" />
                          {bpjsJKK > 0     && <LedgerRow label="JKK Employer"                value={formatRupiah(bpjsJKK)}     indent calc={calcJKK} />}
                          {bpjsJKM > 0     && <LedgerRow label="JKM Employer"                value={formatRupiah(bpjsJKM)}     indent calc={calcJKM} />}
                          {bpjsKesE > 0    && <LedgerRow label="Kesehatan 4% (Employer)"     value={formatRupiah(bpjsKesE)}    indent calc={calcKesE} />}
                          {bpjsTunjJHT > 0 && <LedgerRow label="JHT Karyawan (Co. Tanggung)" value={formatRupiah(bpjsTunjJHT)} indent calc={calcTunjJHT} />}
                          {bpjsTunjJP > 0  && <LedgerRow label="JP Karyawan (Co. Tanggung)"  value={formatRupiah(bpjsTunjJP)}  indent calc={calcTunjJP} />}
                          {bpjsTunjKes > 0 && <LedgerRow label="Kes Karyawan (Co. Tanggung)" value={formatRupiah(bpjsTunjKes)} indent calc={calcTunjKes} />}
                        </>
                      )}

                      {res.pph_ditanggung && (res.tunj_pph ?? 0) > 0 && (
                        <>
                          <LedgerSectionLabel text="PPh Grossup" />
                          <LedgerRow
                            label="Tunjangan PPh 21 (Co. Tanggung)"
                            value={formatRupiah(res.tunj_pph ?? 0)}
                            color="text-amber-700"
                            indent
                            calc={calcGrossup}
                          />
                        </>
                      )}

                      <LedgerSep />
                      <LedgerTotal label="BRUTO" value={formatRupiah(res.bruto ?? 0)} color="text-[var(--text-primary)]" calc={calcBruto} />
                      <LedgerRow
                        label="TER Rate"
                        value={res.ter != null ? `${(res.ter * 100).toFixed(2)}%` : 'Pasal 17 ✓'}
                        indent
                        dim
                      />
                      <LedgerRow
                        label={res.ter != null ? "PPh 21 = TER × Bruto" : "PPh 21 (Pasal 17)"}
                        value={formatRupiah(res.pph ?? 0)}
                        color="text-amber-700"
                        indent
                        calc={calcPph ?? calcPphDes}
                      />

                      {(res.thr_nominal > 0 || res.bonus_nominal > 0) && (
                        <>
                          <LedgerSectionLabel text="THR / Bonus — Selisih Pasal 17" />
                          {res.thr_nominal > 0 && (
                            <>
                              <LedgerRow label="THR Nominal" value={formatRupiah(res.thr_nominal)}   indent />
                              <LedgerRow label="PPh THR"     value={formatRupiah(res.thr_pph ?? 0)}  color="text-amber-700" indent />
                              <LedgerRow label="THR Net"     value={formatRupiah(res.thr_thp ?? 0)}  color="text-emerald-700" indent />
                            </>
                          )}
                          {res.bonus_nominal > 0 && (
                            <>
                              <LedgerRow label="Bonus Nominal" value={formatRupiah(res.bonus_nominal)} indent />
                              <LedgerRow label="PPh Bonus"     value={formatRupiah(res.bonus_pph ?? 0)} color="text-amber-700" indent />
                              <LedgerRow label="Bonus Net"     value={formatRupiah(res.bonus_thp ?? 0)} color="text-emerald-700" indent />
                            </>
                          )}
                        </>
                      )}

                      {(!res.pph_ditanggung ||
                        bpjsPotJHT > 0 ||
                        bpjsPotJP > 0 ||
                        bpjsPotKes > 0 ||
                        (res.kasbon ?? 0) > 0 ||
                        (res.alpha_telat ?? 0) > 0 ||
                        (res.pot_lain ?? 0) > 0) && (
                        <>
                          <LedgerSectionLabel text="Potongan dari Gaji" />
                          {!res.pph_ditanggung && (res.pph ?? 0) > 0 && (
                            <LedgerRow label="PPh 21 Dipotong" value={`− ${formatRupiah(res.pph ?? 0)}`} color="text-red-600" indent />
                          )}
                          {bpjsPotJHT > 0 && <LedgerRow label="JHT Karyawan 2%"       value={`− ${formatRupiah(bpjsPotJHT)}`}     color="text-red-600" indent calc={calcPotJHT} />}
                          {bpjsPotJP  > 0 && <LedgerRow label="JP Karyawan 1%"        value={`− ${formatRupiah(bpjsPotJP)}`}      color="text-red-600" indent calc={calcPotJP} />}
                          {bpjsPotKes > 0 && <LedgerRow label="Kesehatan Karyawan 1%" value={`− ${formatRupiah(bpjsPotKes)}`}     color="text-red-600" indent calc={calcPotKes} />}
                          {(res.kasbon ?? 0) > 0      && <LedgerRow label="Kasbon"         value={`− ${formatRupiah(res.kasbon)}`}      color="text-red-600" indent />}
                          {(res.alpha_telat ?? 0) > 0 && <LedgerRow label="Alpha / Telat"  value={`− ${formatRupiah(res.alpha_telat)}`} color="text-red-600" indent />}
                          {(res.pot_lain ?? 0) > 0    && <LedgerRow label="Potongan Lain"  value={`− ${formatRupiah(res.pot_lain)}`}    color="text-red-600" indent />}
                        </>
                      )}

                      <LedgerSep />
                      <LedgerTotal label="TAKE HOME PAY" value={formatRupiah(res.thp ?? 0)} color="text-emerald-700" calc={calcThp} calcPosition="above" />
                      <LedgerRow label="Gaji + Tunjangan" value={formatRupiah(grossPend)} indent dim />
                      {!res.pph_ditanggung && (res.pph ?? 0) > 0 && (
                        <LedgerRow label="− PPh 21" value={`− ${formatRupiah(res.pph ?? 0)}`} indent dim />
                      )}
                      {bpjsK > 0 && (
                        <LedgerRow label="− BPJS Karyawan Dipotong" value={`− ${formatRupiah(bpjsK)}`} indent dim />
                      )}
                      <LedgerSep />
                      <LedgerTotal label="COST TO COMPANY" value={formatRupiah(ctc)} color="text-sky-700" calc={calcCtc} calcPosition="above" />
                      <LedgerRow label="Bruto" value={formatRupiah(res.bruto ?? 0)} indent dim />
                      {bpjsJHTE > 0 && (
                        <LedgerRow label="+ JHT Employer (offslip)" value={`+ ${formatRupiah(bpjsJHTE)}`} indent dim />
                      )}
                      {bpjsJPE > 0 && (
                        <LedgerRow label="+ JP Employer (offslip)" value={`+ ${formatRupiah(bpjsJPE)}`} indent dim />
                      )}
                    </>
                  ) : (
                    <>
                      <LedgerSectionLabel text="Upah Tidak Tetap" />
                      <LedgerRow label="Total Upah" value={formatRupiah(res.total_upah ?? 0)} />
                      <LedgerRow label="PPh 21" value={formatRupiah(res.total_pph ?? 0)} color="text-amber-700" />
                      {bpjsK > 0 && (
                        <LedgerRow label="BPJS Karyawan" value={`− ${formatRupiah(bpjsK)}`} color="text-red-600" />
                      )}
                      <LedgerSep />
                      <LedgerTotal label="TAKE HOME PAY" value={formatRupiah(res.thp ?? 0)} color="text-emerald-700" calc={calcThp} calcPosition="above" />
                      <LedgerTotal label="COST TO COMPANY" value={formatRupiah(ctc)} color="text-sky-700" calc={calcCtc} calcPosition="above" />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label, value, tone,
}: {
  label: string;
  value: string;
  tone?: 'amber' | 'emerald' | 'sky';
}) {
  const toneMap = {
    amber:   { text: 'text-amber-700',   bg: 'bg-amber-50' },
    emerald: { text: 'text-emerald-700', bg: 'bg-emerald-50' },
    sky:     { text: 'text-sky-700',     bg: 'bg-sky-50' },
  } as const;
  const t = tone ? toneMap[tone] : { text: 'text-[var(--text-primary)]', bg: 'bg-[var(--bg-subtle)]' };
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </p>
        <span className={`w-2 h-2 rounded-full ${t.bg}`} />
      </div>
      <p className={`mt-2 text-[17px] font-bold font-mono ${t.text}`}>{value}</p>
    </div>
  );
}
