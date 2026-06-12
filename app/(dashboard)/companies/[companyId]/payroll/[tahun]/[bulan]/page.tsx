'use client';
// Payroll month page — orchestrator. All presentation lives in
// components/payroll/month/*; pure calc helpers in lib/payroll/calc-client.ts.
// (PR 1 decomposition — behavior unchanged.)

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Table2, LayoutList } from 'lucide-react';
import { toast } from 'sonner';
import { formatRupiah } from '@/lib/format';
import { savePayrollRun, lockPayrollRun, deletePayrollRun } from '@/lib/actions/payroll';
import { updateEmployee } from '@/lib/actions/employees';
import { printAllSlipGaji } from '@/lib/export/slip-gaji';
import { exportSPTMasa } from '@/lib/export/spt-masa';
import { exportBPJSTK, exportBPJSKes } from '@/lib/export/bpjs';
import { createShareLink } from '@/lib/actions/share';
import type { EmployeeYTDRow } from '@/lib/cache';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  BULAN_NAMES, lebihPotongOf, filterEmployeesForPeriod,
  indexEventsByEmp, computeEmployeeResult,
} from '@/lib/payroll/calc-client';
import { MonthHeader } from '@/components/payroll/month/MonthHeader';
import { DecemberBanners } from '@/components/payroll/month/DecemberBanners';
import { YTDLedger } from '@/components/payroll/month/YTDLedger';
import { ResultsTable, type SortKey } from '@/components/payroll/month/ResultsTable';
import { EmployeeDetailCard } from '@/components/payroll/month/EmployeeDetailCard';
import { QuickEditModal } from '@/components/payroll/month/QuickEditModal';
import { UpahBulananModal } from '@/components/payroll/month/UpahBulananModal';

export default function PayrollRunPage() {
  const { companyId, tahun, bulan } = useParams();
  const confirm = useConfirm();
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
  const [savedMonths, setSavedMonths]     = useState<number[]>([]);
  const [quickEditEmp, setQuickEditEmp]   = useState<any>(null);
  const [upahEditEmp, setUpahEditEmp]     = useState<any>(null);
  const [expandedEmps, setExpandedEmps]   = useState<Set<string>>(new Set());
  // Tabel = sortable overview (the accountant's Excel reflex); Detail = the
  // per-employee accordion cards. Choice persists across visits.
  const [view, setView]                   = useState<'tabel' | 'detail'>('detail');
  const [sortKey, setSortKey]             = useState<SortKey>('nama');
  const [sortDir, setSortDir]             = useState<'asc' | 'desc'>('asc');
  const autoCalcRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem('payroll_view');
    if (saved === 'tabel' || saved === 'detail') setView(saved);
  }, []);

  function switchView(v: 'tabel' | 'detail') {
    setView(v);
    localStorage.setItem('payroll_view', v);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Numeric columns are usually reviewed largest-first.
      setSortDir(key === 'nama' ? 'asc' : 'desc');
    }
  }

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const [{ data: co }, { data: empDataRaw }, { data: eventData }, { data: runRows }, { data: priorRuns }] = await Promise.all([
        supabase.from('companies').select('name, npwp_perusahaan').eq('id', companyId).single(),
        supabase.from('employees').select('*').eq('company_id', companyId).eq('aktif', true),
        supabase.from('employee_events').select('*').eq('company_id', companyId).eq('tahun', tahun).eq('bulan', bulan),
        // Archival imports can create multiple runs per month (one per jenis:
        // tetap/harian/tidak_final) — .maybeSingle() would error on those.
        // Prefer the tetap run; fall back to whichever exists.
        supabase.from('payroll_runs').select('*, payroll_results(*)').eq('company_id', companyId).eq('tahun', tahun).eq('bulan', bulan),
        // Which prior months of this year have a saved run — December's
        // equalization silently sums only what exists, so the UI must be able
        // to say which months are missing from the accumulation.
        supabase.from('payroll_runs').select('bulan').eq('company_id', companyId).eq('tahun', tahun).lt('bulan', Number(bulan)),
      ]);
      setSavedMonths([...new Set((priorRuns ?? []).map((r) => Number(r.bulan)))]);
      const runData = (runRows ?? []).find((r: any) => r.jenis === 'tetap') ?? (runRows ?? [])[0] ?? null;

      const empData = filterEmployeesForPeriod(empDataRaw ?? [], Number(tahun), Number(bulan));

      // Server-side GROUP BY via get_employee_ytd RPC — one indexed query
      // replaces the prior two-fetch waterfall (prior-month runs + their
      // results) plus the JS sum loop.
      const newAccumMap: Record<string, { akum_bruto: number; pph_jan_nov: number }> = {};
      if (empData && empData.length > 0) {
        const { data: ytdRows, error: ytdErr } = await supabase.rpc('get_employee_ytd', {
          p_company_id: companyId,
          p_tahun: Number(tahun),
          p_exclude_bulan: Number(bulan),
        });
        if (ytdErr) console.error('[ytd] get_employee_ytd failed', ytdErr);
        for (const r of (ytdRows ?? []) as EmployeeYTDRow[]) {
          newAccumMap[r.employee_id] = { akum_bruto: r.akum_bruto, pph_jan_nov: r.pph_jan_nov };
        }
      }

      if (co) setCompany(co);
      setAccumMap(newAccumMap);
      const enrichedEmps = (empData ?? []).map((emp) => ({ ...emp, _akum_bruto: newAccumMap[emp.id]?.akum_bruto ?? 0, _pph_jan_nov: newAccumMap[emp.id]?.pph_jan_nov ?? 0 }));
      setEmployees(enrichedEmps);
      if (eventData) setEvents(eventData);

      if (runData) {
        setExistingRun(runData);
        if (runData.payroll_results?.length > 0) {
          const mapped = runData.payroll_results.map((r: any) => ({ ...r.result_json, employee_id: r.employee_id, employee_name: empData?.find((e) => e.id === r.employee_id)?.nama }));
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
    if (isAutoCalcing && employees.length > 0 && !isCalculated) { handleCalculate(); setIsAutoCalcing(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoCalcing, employees]);

  function runCalculation(emps: any[], evts: any[]) {
    return new Promise<any[]>((resolve) => {
      setCalcProgress({ current: 0, total: emps.length });
      const byEmp = indexEventsByEmp(evts);
      const newResults: any[] = [];
      let i = 0;
      function processNext() {
        if (i >= emps.length) { setCalcProgress({ current: 0, total: 0 }); resolve(newResults); return; }
        const emp = emps[i];
        const byTipe = byEmp.get(emp.id) ?? new Map<string, any[]>();
        newResults.push(computeEmployeeResult(emp, byTipe, Number(tahun), Number(bulan)));
        i++;
        setCalcProgress((p) => ({ ...p, current: i }));
        setTimeout(processNext, 0);
      }
      processNext();
    });
  }

  function handleCalculate() {
    if (existingRun?.status === 'locked') { toast.error('Run sudah dikunci — tidak dapat dihitung ulang.'); return; }
    runCalculation(employees, events).then((newResults) => { setResults(newResults); setIsCalculated(true); });
  }

  async function handleQuickEdit(empId: string, companyId: string, formData: FormData) {
    const res = await updateEmployee(empId, companyId as string, formData);
    if (res.error) { toast.error(res.error); return; }
    const supabase = createClient();
    const { data: updatedEmp } = await supabase.from('employees').select('*').eq('id', empId).single();
    if (!updatedEmp) { toast.error('Gagal refresh data karyawan'); return; }
    const enriched = { ...updatedEmp, _akum_bruto: accumMap[empId]?.akum_bruto ?? 0, _pph_jan_nov: accumMap[empId]?.pph_jan_nov ?? 0 };
    setEmployees(employees.map((e) => (e.id === empId ? enriched : e)));
    const singleResult = await runCalculation([enriched], events.filter((e) => e.employee_id === empId));
    setResults((prev) => prev.map((r) => r.employee_id === empId ? { ...singleResult[0], employee_id: empId, employee_name: updatedEmp.nama } : r));
    toast.success(`${updatedEmp.nama} — dihitung ulang`);
  }

  async function handleShare() {
    if (!existingRun?.id) return;
    setSharing(true);
    const res = await createShareLink(existingRun.id, companyId as string, Number(tahun), Number(bulan));
    if (res.error) toast.error(res.error);
    else { await navigator.clipboard.writeText(res.url!); setShareCopied(true); toast.success('Link disalin ke clipboard'); setTimeout(() => setShareCopied(false), 3000); }
    setSharing(false);
  }

  async function handleSave() {
    setSaving(true);
    const res = await savePayrollRun(companyId as string, Number(tahun), Number(bulan), results);
    if (res.error) { toast.error(res.error); setSaving(false); return; }
    setExistingRun((p: any) => ({ ...p, id: res.runId, status: 'calculated' }));
    toast.success('Payroll disimpan');
    setSaving(false);
  }

  async function handleLock() {
    if (!existingRun?.id) return;
    if (!(await confirm({ title: `Kunci payroll ${BULAN_NAMES[Number(bulan) - 1]} ${tahun}?`, message: 'Setelah dikunci, data tidak bisa diubah atau dihapus lagi.', severity: 'danger', confirmLabel: 'Kunci' }))) return;
    setSaving(true);
    const res = await lockPayrollRun(existingRun.id, companyId as string, Number(tahun), Number(bulan));
    if (res.error) { toast.error(res.error); setSaving(false); return; }
    setExistingRun((p: any) => ({ ...p, status: 'locked' }));
    toast.success('Payroll dikunci');
    setSaving(false);
  }

  async function handleDelete() {
    if (!existingRun?.id || existingRun.status === 'locked') return;
    if (!(await confirm({ title: `Hapus run ${BULAN_NAMES[Number(bulan) - 1]} ${tahun}?`, message: 'Hasil tersimpan bulan ini dihapus dari database. Karyawan dan variasi tidak terpengaruh.', severity: 'danger', confirmLabel: 'Hapus' }))) return;
    setSaving(true);
    const res = await deletePayrollRun(existingRun.id, companyId as string, Number(tahun), Number(bulan));
    if (res.error) { toast.error(res.error); setSaving(false); return; }
    setExistingRun(null);
    toast.success('Run dihapus — hasil di layar tetap bisa disimpan ulang');
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="h-20 bg-white border border-[var(--border-default)] rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-white border border-[var(--border-default)] rounded-xl animate-pulse" />)}
        </div>
        {[1, 2].map((i) => <div key={i} className="h-48 bg-white border border-[var(--border-default)] rounded-xl animate-pulse" />)}
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
  const totalLebihPotong = results.reduce((a, r) => a + lebihPotongOf(r), 0);
  const missingMonths = isDesember
    ? Array.from({ length: 11 }, (_, i) => i + 1).filter((m) => !savedMonths.includes(m))
    : [];
  const totalBpjsK = results.reduce((a, r) => a + (r.bpjs?.karyawan_potong ?? r.tot_bpjs ?? 0), 0);
  const sortedResults = [...results].sort((a, b) => {
    const val = (r: any) =>
      sortKey === 'nama'  ? (r.employee_name ?? '') :
      sortKey === 'bruto' ? (r.bruto ?? r.total_upah ?? 0) :
      sortKey === 'pph'   ? (r.pph ?? r.total_pph ?? 0) :
                            (r.thp ?? 0);
    const av = val(a), bv = val(b);
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sortDir === 'asc' ? cmp : -cmp;
  });
  const isCalcing  = calcProgress.total > 0;
  const maxThp     = results.length > 0 ? Math.max(...results.map((r) => r.thp ?? 0), 1) : 1;
  const runStatus  = existingRun?.status ?? (isCalcing ? 'calculating' : 'draft');

  return (
    <div className="space-y-6 animate-fade-in-up">
      {quickEditEmp && !isLocked && (
        <QuickEditModal employee={quickEditEmp} onClose={() => setQuickEditEmp(null)} onSaveAndRecalc={handleQuickEdit} />
      )}

      {upahEditEmp && !isLocked && (
        <UpahBulananModal
          employee={upahEditEmp}
          tahun={Number(tahun)}
          bulan={Number(bulan)}
          currentOverride={
            events.find(
              (e) =>
                e.employee_id === upahEditEmp.id &&
                e.tipe === 'upah_bulanan_override' &&
                e.tahun === Number(tahun) &&
                e.bulan === Number(bulan),
            )?.nilai ?? null
          }
          onClose={() => setUpahEditEmp(null)}
          onSaved={async () => {
            // Refetch events for this period, then recompute the affected employee.
            const supabase = createClient();
            const { data: refreshed } = await supabase
              .from('employee_events').select('*')
              .eq('company_id', companyId).eq('tahun', tahun).eq('bulan', bulan);
            const nextEvents = refreshed ?? events;
            setEvents(nextEvents);
            const emp = employees.find((e) => e.id === upahEditEmp.id);
            if (emp) {
              const singleResult = await runCalculation([emp], nextEvents.filter((e) => e.employee_id === emp.id));
              setResults((prev) => prev.map((r) => r.employee_id === emp.id ? { ...singleResult[0], employee_id: emp.id, employee_name: emp.nama } : r));
            }
          }}
        />
      )}

      <MonthHeader
        bulan={Number(bulan)}
        tahun={Number(tahun)}
        companyId={companyId as string}
        companyName={company?.name ?? null}
        runStatus={runStatus}
        resultCount={results.length}
        isCalculated={isCalculated}
        isLocked={isLocked}
        canLock={existingRun?.status === 'calculated'}
        canShare={existingRun?.status === 'locked'}
        canDelete={!!existingRun?.id && existingRun?.status !== 'locked'}
        saving={saving}
        sharing={sharing}
        shareCopied={shareCopied}
        isCalcing={isCalcing}
        calcProgress={calcProgress}
        onCalculate={handleCalculate}
        onSave={handleSave}
        onLock={handleLock}
        onShare={handleShare}
        onDelete={handleDelete}
        onPrintAll={() => printAllSlipGaji(results, company, Number(bulan), Number(tahun))}
        onExportSPT={() => exportSPTMasa(results, company, employees, Number(bulan), Number(tahun))}
        onExportBPJSTK={() => exportBPJSTK(results, employees, company, Number(bulan), Number(tahun))}
        onExportBPJSKes={() => exportBPJSKes(results, employees, company, Number(bulan), Number(tahun))}
      />

      {/* Auto-calc indicator */}
      {isCalcing && !isCalculated && (
        <div className="bg-white border border-[var(--border-default)] rounded-xl p-10 text-center animate-fade-in">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--brand)] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">Menghitung {calcProgress.current} / {calcProgress.total} karyawan…</p>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">Otomatis dihitung saat halaman dibuka</p>
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

      <DecemberBanners
        isDesember={isDesember}
        isCalculated={isCalculated}
        missingMonths={missingMonths}
        tahun={String(tahun)}
        totalPph={totalPph}
        totalLebihPotong={totalLebihPotong}
        resultCount={results.length}
      />

      {/* YTD Ledger */}
      {isCalculated && hasYTD && (
        <YTDLedger results={results} accumMap={accumMap} bulan={Number(bulan)} />
      )}

      {/* Per-employee results — sortable table or accordion detail cards */}
      {isCalculated && (
        <div className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[13px] font-semibold text-[var(--text-secondary)]">{results.length} Karyawan</span>
            <div className="flex items-center gap-3">
              {view === 'detail' && (
                <button
                  onClick={() => setExpandedEmps(expandedEmps.size === results.length ? new Set() : new Set(results.map((r) => r.employee_id)))}
                  className="text-[12px] font-medium text-[var(--brand)] hover:opacity-70 transition-opacity cursor-pointer"
                >
                  {expandedEmps.size === results.length ? 'Collapse Semua' : 'Expand Semua'}
                </button>
              )}
              <div className="flex gap-0.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-lg p-0.5">
                {([['tabel', Table2, 'Tabel'], ['detail', LayoutList, 'Detail']] as const).map(([id, Icon, label]) => (
                  <button
                    key={id}
                    onClick={() => switchView(id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-semibold transition-colors cursor-pointer ${
                      view === id
                        ? 'bg-white text-[var(--brand)] shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {view === 'tabel' && (
            <ResultsTable
              sortedResults={sortedResults}
              employees={employees}
              isLocked={isLocked}
              sortKey={sortKey}
              sortDir={sortDir}
              onToggleSort={toggleSort}
              onShowDetail={(employeeId) => { switchView('detail'); setExpandedEmps(new Set([employeeId])); }}
              onQuickEdit={setQuickEditEmp}
              totalBruto={totalBruto}
              totalPph={totalPph}
              totalThp={totalThp}
              totalBpjsK={totalBpjsK}
            />
          )}

          {view === 'detail' && sortedResults.map((res, i) => {
            const sourceEmp = employees.find((e) => e.id === res.employee_id);
            const hasUpahOverride = !!sourceEmp && events.some(
              (e) =>
                e.employee_id === sourceEmp.id &&
                e.tipe === 'upah_bulanan_override' &&
                e.tahun === Number(tahun) &&
                e.bulan === Number(bulan),
            );
            return (
              <EmployeeDetailCard
                key={res.employee_id ?? i}
                res={res}
                index={i}
                isExpanded={expandedEmps.has(res.employee_id)}
                onToggleExpand={() => setExpandedEmps((prev) => { const next = new Set(prev); if (next.has(res.employee_id)) next.delete(res.employee_id); else next.add(res.employee_id); return next; })}
                sourceEmp={sourceEmp}
                hasUpahOverride={hasUpahOverride}
                isLocked={isLocked}
                isDesember={isDesember}
                maxThp={maxThp}
                company={company}
                companyId={companyId as string}
                tahun={Number(tahun)}
                bulan={Number(bulan)}
                onQuickEdit={setQuickEditEmp}
                onUpahEdit={setUpahEditEmp}
              />
            );
          })}

          {/* Total footer (tabel view shows totals in its own tfoot) */}
          {view === 'detail' && (
            <div className="px-5 py-3.5 border-t border-[var(--border-default)] bg-[var(--bg-subtle)] flex items-center justify-between flex-wrap gap-3">
              <span className="text-[12px] font-semibold text-[var(--text-secondary)]">{results.length} karyawan</span>
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider">Total Bruto</p>
                  <p className="text-[12px] font-mono font-semibold text-[var(--text-secondary)]">{formatRupiah(totalBruto)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider">Total PPh</p>
                  <p className="text-[12px] font-mono font-semibold text-amber-700">{formatRupiah(totalPph)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider">Total THP</p>
                  <p className="text-[13px] font-mono font-bold text-emerald-700">{formatRupiah(totalThp)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: 'amber' | 'emerald' | 'sky' }) {
  const toneMap = { amber: { text: 'text-amber-700', bg: 'bg-amber-50' }, emerald: { text: 'text-emerald-700', bg: 'bg-emerald-50' }, sky: { text: 'text-sky-700', bg: 'bg-sky-50' } } as const;
  const t = tone ? toneMap[tone] : { text: 'text-[var(--text-primary)]', bg: 'bg-[var(--bg-subtle)]' };
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
        <span className={`w-2 h-2 rounded-full ${t.bg}`} />
      </div>
      <p className={`mt-2 text-[17px] font-bold font-mono ${t.text}`}>{value}</p>
    </div>
  );
}
