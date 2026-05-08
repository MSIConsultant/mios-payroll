'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft, Calculator, Save, Lock, Printer, Download,
  AlertTriangle, Share2, ChevronDown, ChevronRight,
  TrendingUp, Pencil, X, RefreshCw
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

const BULAN_NAMES = ['Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'];
const BULAN_SHORT = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function CliLabel({ text }: { text: string }) {
  return (
    <div className="pt-3 pb-1">
      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded font-mono"
        style={{ color: 'var(--text-muted)', background: 'var(--border-default)' }}>
        {text}
      </span>
    </div>
  );
}

function CliRow({ label, value, color, indent, dim }: {
  label: string; value: string; color?: string; indent?: boolean; dim?: boolean;
}) {
  return (
    <div className="flex justify-between py-[3px]" style={{ opacity: dim ? 0.55 : 1 }}>
      <span className="font-mono text-[13px]"
        style={{ color: 'var(--text-muted)', paddingLeft: indent ? 20 : 0 }}>
        {label}
      </span>
      <span className={`font-mono text-[13px] font-bold ${color ?? ''}`}
        style={!color ? { color: 'var(--text-secondary)' } : {}}>
        {value}
      </span>
    </div>
  );
}

function CliSep() {
  return <div className="my-2 border-t" style={{ borderColor: 'var(--border-subtle)' }} />;
}

function CliTotal({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="font-mono text-[15px] font-black" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <span className={`font-mono text-[15px] font-black ${color}`}>{value}</span>
    </div>
  );
}

// Quick edit modal for a single employee
function QuickEditModal({
  employee, onClose, onSaveAndRecalc
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
    // Carry over all existing employee fields not in this form
    const fields = ['nama','nik','npwp','punya_npwp','status_ptkp','jenis_kelamin',
      'tanggal_masuk','divisi','jabatan','jenis_karyawan','jkk_rate',
      'ikut_jht','ikut_jp','ikut_jkp','ikut_kes',
      'tanggung_jht_k','tanggung_jp_k','tanggung_kes_k','pph_ditanggung'];
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-deep)' }}>
          <div>
            <p className="font-bold text-[15px]" style={{ color: 'var(--text-primary)' }}>
              Edit Kompensasi
            </p>
            <p className="text-[12px] mt-0.5 font-mono uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}>
              {employee.nama}
            </p>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <NominalInput label="Gaji Pokok"         name="gaji_pokok"  defaultValue={employee.gaji_pokok}   />
            <NominalInput label="Benefit / Tunj. Tetap" name="benefit"  defaultValue={employee.benefit}       />
            <NominalInput label="Tunjangan Kendaraan" name="kendaraan"  defaultValue={employee.kendaraan}     />
            <NominalInput label="Tunjangan Pulsa"     name="pulsa"      defaultValue={employee.pulsa}         />
            <NominalInput label="Tunjangan Operasional" name="operasional" defaultValue={employee.operasional} />
            <NominalInput label="Tunjangan Lain"      name="tunj_lain"  defaultValue={employee.tunj_lain}     />
          </div>

          <p className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
            Perubahan akan disimpan ke database dan payroll bulan ini dihitung ulang otomatis.
          </p>

          <div className="flex gap-3 pt-2" style={{ borderTop: '1px solid var(--border-default)' }}>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              Batal
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-bold text-white transition-colors disabled:opacity-50"
              style={{ background: '#2563EB' }}>
              <RefreshCw size={14} className={saving ? 'animate-spin' : ''} />
              {saving ? 'Menyimpan...' : 'Simpan & Hitung Ulang'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PayrollRunPage() {
  const { companyId, tahun, bulan } = useParams();
  const [employees, setEmployees]       = useState<any[]>([]);
  const [events, setEvents]             = useState<any[]>([]);
  const [existingRun, setExistingRun]   = useState<any>(null);
  const [results, setResults]           = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [isCalculated, setIsCalculated] = useState(false);
  const [isAutoCalcing, setIsAutoCalcing] = useState(false);
  const [company, setCompany]           = useState<any>(null);
  const [sharing, setSharing]           = useState(false);
  const [shareCopied, setShareCopied]   = useState(false);
  const [calcProgress, setCalcProgress] = useState({ current: 0, total: 0 });
  const [accumMap, setAccumMap]         = useState<Record<string, { akum_bruto: number; pph_jan_nov: number }>>({});
  const [showYTD, setShowYTD]           = useState(false);
  const [quickEditEmp, setQuickEditEmp] = useState<any>(null);
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
            .in('run_id', prevRuns.map(r => r.id));
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
      const enrichedEmps = (empData ?? []).map(emp => ({
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
            employee_id:   r.employee_id,
            employee_name: empData?.find(e => e.id === r.employee_id)?.nama,
          }));
          setResults(mapped);
          setIsCalculated(true);
        }
      } else if ((empData ?? []).length > 0 && !autoCalcRef.current) {
        // Auto-calculate when no existing run
        autoCalcRef.current = true;
        setIsAutoCalcing(true);
      }
      setLoading(false);
    }
    fetchData();
  }, [companyId, tahun, bulan]);

  // Trigger auto-calculate after employees are loaded
  useEffect(() => {
    if (isAutoCalcing && employees.length > 0 && !isCalculated) {
      handleCalculate();
      setIsAutoCalcing(false);
    }
  }, [isAutoCalcing, employees]);

  function runCalculation(emps: any[], evts: any[]) {
    return new Promise<any[]>((resolve) => {
      setCalcProgress({ current: 0, total: emps.length });
      const newResults: any[] = [];
      let i = 0;
      function processNext() {
        if (i >= emps.length) {
          setCalcProgress({ current: 0, total: 0 });
          resolve(newResults); return;
        }
        const emp           = emps[i];
        const empEvents     = evts.filter(e => e.employee_id === emp.id);
        const kasbon        = empEvents.filter(e => e.tipe === 'kasbon').reduce((a: number, b: any) => a + b.nilai, 0);
        const alpha_telat   = empEvents.filter(e => e.tipe === 'alpha_telat').reduce((a: number, b: any) => a + b.nilai, 0);
        const pot_lain      = empEvents.filter(e => e.tipe === 'pot_lain').reduce((a: number, b: any) => a + b.nilai, 0);
        const thr           = empEvents.filter(e => e.tipe === 'thr').reduce((a: number, b: any) => a + b.nilai, 0);
        const bonus         = empEvents.filter(e => e.tipe === 'bonus').reduce((a: number, b: any) => a + b.nilai, 0);
        const benefit_extra = empEvents.filter(e => e.tipe === 'benefit_extra').reduce((a: number, b: any) => a + b.nilai, 0);
        let calcResult: any = {};
        if (emp.jenis_karyawan === 'tetap') {
          calcResult = calculateMonthlySalary({
            ...emp, bulan: Number(bulan), tahun: Number(tahun),
            kasbon, alpha_telat,
            pot_lain:  pot_lain + (emp.pot_lain || 0),
            tunj_lain: (emp.tunj_lain ?? 0) + benefit_extra,
            thr, bonus,
            pph_jan_nov: emp._pph_jan_nov ?? 0,
            akum_bruto:  emp._akum_bruto  ?? 0,
          });
        } else {
          calcResult = calculateFreelance({
            ...emp,
            mode:         emp.jenis_karyawan === 'tidak_tetap_harian' ? 'harian' : 'bulanan',
            upah_harian:  emp.upah_harian,
            hari_kerja:   emp.hari_kerja_default || 22,
            upah_bulanan: emp.upah_bulanan_tt,
            tunjangan:    (emp.tunjangan_tt || 0) + benefit_extra,
            thr, bonus,
            ikut_bpjs_tk: emp.ikut_jht || emp.ikut_jp,
            ikut_kes:     emp.ikut_kes,
            kasbon, pot_lain: pot_lain + (emp.pot_lain || 0),
          });
        }
        newResults.push({ ...calcResult, employee_id: emp.id, employee_name: emp.nama });
        i++;
        setCalcProgress(p => ({ ...p, current: i }));
        setTimeout(processNext, 0);
      }
      processNext();
    });
  }

  function handleCalculate() {
    runCalculation(employees, events).then(newResults => {
      setResults(newResults);
      setIsCalculated(true);
    });
  }

  // Quick-edit: save employee then recalculate just that employee
  async function handleQuickEdit(empId: string, companyId: string, formData: FormData) {
    const res = await updateEmployee(empId, companyId as string, formData);
    if (res.error) { toast.error(res.error); return; }

    // Refresh just that employee from DB
    const supabase = createClient();
    const { data: updatedEmp } = await supabase
      .from('employees').select('*').eq('id', empId).single();
    if (!updatedEmp) { toast.error('Gagal refresh data karyawan'); return; }

    const enriched = {
      ...updatedEmp,
      _akum_bruto:  accumMap[empId]?.akum_bruto  ?? 0,
      _pph_jan_nov: accumMap[empId]?.pph_jan_nov ?? 0,
    };

    // Update employees list
    const updatedEmps = employees.map(e => e.id === empId ? enriched : e);
    setEmployees(updatedEmps);

    // Recalculate just this one employee
    const singleResult = await runCalculation([enriched], events.filter(e => e.employee_id === empId));
    setResults(prev => prev.map(r =>
      r.employee_id === empId ? { ...singleResult[0], employee_id: empId, employee_name: updatedEmp.nama } : r
    ));

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
    if (res.error) { toast.error(res.error); setSaving(false); return; }
    setExistingRun((p: any) => ({ ...p, id: res.runId, status: 'calculated' }));
    toast.success('Payroll disimpan');
    setSaving(false);
  }

  async function handleLock() {
    if (!existingRun?.id) return;
    if (!confirm('Kunci payroll? Data tidak bisa diubah lagi.')) return;
    setSaving(true);
    const res = await lockPayrollRun(existingRun.id, companyId as string, Number(tahun), Number(bulan));
    if (res.error) { toast.error(res.error); setSaving(false); return; }
    setExistingRun((p: any) => ({ ...p, status: 'locked' }));
    toast.success('Payroll dikunci');
    setSaving(false);
  }

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => (
        <div key={i} className="h-16 rounded-lg animate-pulse"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }} />
      ))}
    </div>
  );

  const isLocked   = existingRun?.status === 'locked';
  const isDesember = Number(bulan) === 12;
  const totalBruto = results.reduce((a, r) => a + (r.bruto || r.total_upah || 0), 0);
  const totalPph   = results.reduce((a, r) => a + (r.pph   || r.total_pph  || 0), 0);
  const totalThp   = results.reduce((a, r) => a + (r.thp   || 0), 0);
  const totalCtc   = results.reduce((a, r) => a + (r.bruto || r.total_upah || 0) + (r.bpjs?.employer_offslip || 0), 0);
  const hasYTD     = Object.keys(accumMap).length > 0;
  const isCalcing  = calcProgress.total > 0;

  return (
    <div className="max-w-4xl space-y-6">

      {/* Quick edit modal */}
      {quickEditEmp && !isLocked && (
        <QuickEditModal
          employee={quickEditEmp}
          onClose={() => setQuickEditEmp(null)}
          onSaveAndRecalc={handleQuickEdit}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/companies/${companyId}/payroll`}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
            <ArrowLeft size={15} />
          </Link>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {BULAN_NAMES[Number(bulan)-1]} {tahun}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {company?.name ?? '—'}
              </p>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${
                existingRun?.status === 'locked'     ? 'bg-green-900/25 text-green-400' :
                existingRun?.status === 'calculated' ? 'bg-sky-900/25 text-sky-400' :
                'bg-zinc-800 text-zinc-600'
              }`}>{existingRun?.status ?? (isCalcing ? 'menghitung...' : 'draft')}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          {isCalculated && (
            <button onClick={() => exportSPTMasa(results, company, employees, Number(bulan), Number(tahun))}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
              <Download size={13} />Export SPT
            </button>
          )}
          {existingRun?.status === 'locked' && (
            <button onClick={handleShare} disabled={sharing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
              <Share2 size={13} />
              {shareCopied ? 'Tersalin!' : sharing ? '...' : 'Bagikan'}
            </button>
          )}
          {/* Progress bar replaces button during calculation */}
          {isCalcing ? (
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-default)' }}>
                <div className="h-full rounded-full transition-all duration-150"
                  style={{
                    width: `${(calcProgress.current / calcProgress.total) * 100}%`,
                    background: '#2563EB',
                  }} />
              </div>
              <span className="text-[12px] font-mono" style={{ color: 'var(--text-muted)' }}>
                {calcProgress.current}/{calcProgress.total}
              </span>
            </div>
          ) : !isLocked && (
            <button onClick={handleCalculate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
              <RefreshCw size={13} />
              {isCalculated ? 'Hitung Ulang' : 'Hitung'}
            </button>
          )}
          {isCalculated && !isLocked && (
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white uppercase tracking-widest hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors"
              style={{ background: '#2563EB' }}>
              <Save size={13} />
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          )}
          {existingRun?.status === 'calculated' && (
            <button onClick={handleLock} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest disabled:opacity-50 transition-colors"
              style={{ background: 'var(--bg-card)', border: '1px solid #3A3A3E', color: 'var(--text-secondary)' }}>
              <Lock size={13} />Kunci
            </button>
          )}
        </div>
      </div>

      {/* Auto-calc loading state */}
      {isCalcing && !isCalculated && (
        <div className="rounded-lg p-10 text-center animate-fade-in"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <div className="w-8 h-8 rounded-full border-2 border-[#2563EB] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            Menghitung {calcProgress.current} / {calcProgress.total} karyawan...
          </p>
          <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
            Otomatis dihitung saat halaman dibuka
          </p>
        </div>
      )}

      {/* Summary cards */}
      {isCalculated && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Bruto',  value: formatRupiah(totalBruto), color: 'var(--text-primary)' },
            { label: 'Total PPh 21', value: formatRupiah(totalPph),   color: '#FBB040' },
            { label: 'Total THP',    value: formatRupiah(totalThp),   color: '#4ADE80' },
            { label: 'Total CTC',    value: formatRupiah(totalCtc),   color: '#38BDF8' },
          ].map(s => (
            <div key={s.label} className="rounded-lg p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              <p className="text-base font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* December Warning */}
      {isDesember && isCalculated && (
        <div className="rounded-lg px-5 py-4 flex items-start gap-3 animate-fade-in"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <AlertTriangle size={15} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-amber-300 uppercase tracking-widest mb-1">Equalisasi Desember</p>
            <p className="text-[13px] text-amber-500 font-mono leading-relaxed">
              Equalisasi Desember akan menghasilkan PPh{' '}
              <span className="text-amber-300 font-bold">{formatRupiah(totalPph)}</span>
              {' '}untuk {results.length} karyawan menggunakan metode Pasal 17 tahunan.
            </p>
          </div>
        </div>
      )}

      {/* YTD Ledger */}
      {isCalculated && hasYTD && (
        <div className="rounded-lg overflow-hidden font-mono"
          style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-default)' }}>
          <button onClick={() => setShowYTD(v => !v)}
            className="w-full px-5 py-3 flex items-center justify-between transition-colors"
            style={{ background: 'var(--bg-card)', borderBottom: showYTD ? '1px solid var(--border-default)' : 'none' }}>
            <div className="flex items-center gap-3">
              <TrendingUp size={13} className="text-[#3B82F6]" />
              <span className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--text-secondary)' }}>
                YTD Ledger — s/d {BULAN_NAMES[Number(bulan)-2] || BULAN_NAMES[0]}
              </span>
            </div>
            {showYTD
              ? <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
              : <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />}
          </button>
          {showYTD && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Nama','Akum. Bruto','Akum. PPh','Bulan Ini','Est. Tahunan'].map(h => (
                      <th key={h} className="px-5 py-2.5 text-left font-bold uppercase tracking-widest"
                        style={{ color: 'var(--text-muted)', fontSize: 10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((res, i) => {
                    const acc       = accumMap[res.employee_id] ?? { akum_bruto: 0, pph_jan_nov: 0 };
                    const thisBruto = res.bruto ?? res.total_upah ?? 0;
                    const projected = (acc.akum_bruto + thisBruto) / Number(bulan) * 12;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td className="px-5 py-2.5 font-bold text-[13px]"
                          style={{ color: 'var(--text-secondary)' }}>{res.employee_name}</td>
                        <td className="px-5 py-2.5 text-[13px]"
                          style={{ color: 'var(--text-secondary)' }}>{formatRupiah(acc.akum_bruto)}</td>
                        <td className="px-5 py-2.5 text-[13px] text-amber-400">{formatRupiah(acc.pph_jan_nov)}</td>
                        <td className="px-5 py-2.5 text-[13px]"
                          style={{ color: 'var(--text-primary)' }}>{formatRupiah(thisBruto)}</td>
                        <td className="px-5 py-2.5 text-[13px] text-sky-400">{formatRupiah(projected)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {isCalculated && (
        <div className="space-y-4">
          {results.map((res, i) => {
            const isTetap     = !res.mode || res.mode === undefined;
            const bpjsK       = res.bpjs?.karyawan_potong ?? res.tot_bpjs ?? 0;
            const bpjsEmp     = res.bpjs?.employer_total ?? 0;
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

            // Find the source employee for quick edit
            const sourceEmp = employees.find(e => e.id === res.employee_id);

            return (
              <div key={i}
                className="rounded-xl overflow-hidden font-mono animate-fade-in-up"
                style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-default)',
                  animationDelay: `${i * 0.04}s`, opacity: 0 }}>

                {/* Employee header */}
                <div className="px-5 py-3.5 flex items-center justify-between"
                  style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-default)' }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[#3B82F6] text-base shrink-0">$</span>
                    {/* ← Employee name is now a LINK */}
                    <Link
                      href={`/companies/${companyId}/employees/${res.employee_id}?from=payroll&tahun=${tahun}&bulan=${bulan}`}
                      className="text-base font-black uppercase tracking-wide truncate transition-colors hover:text-[#3B82F6]"
                      style={{ color: 'var(--text-primary)' }}>
                      {res.employee_name}
                    </Link>
                    {/* Quick edit — only when not locked */}
                    {!isLocked && sourceEmp && (
                      <button
                        onClick={() => setQuickEditEmp(sourceEmp)}
                        title="Edit kompensasi & hitung ulang"
                        className="shrink-0 p-1.5 rounded-lg transition-all opacity-40 hover:opacity-100"
                        style={{ color: 'var(--text-muted)', border: '1px solid transparent' }}>
                        <Pencil size={12} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest"
                        style={{ background: 'var(--border-default)', color: 'var(--text-muted)' }}>
                        {res.mode ? res.mode.toUpperCase() : 'TETAP'}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>{res.status_ptkp ?? '—'}</span>
                      <span className={res.punya_npwp !== false ? 'text-green-500' : 'text-red-400'}>
                        {res.punya_npwp !== false ? 'NPWP ✓' : 'NO NPWP'}
                      </span>
                      {res.pph_ditanggung && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest"
                          style={{ background: 'rgba(251,176,64,0.1)', color: '#FBB040' }}>
                          GROSSUP
                        </span>
                      )}
                    </div>
                    <button onClick={() => printSlipGaji(res, company, Number(bulan), Number(tahun))}
                      title="Cetak Slip Gaji"
                      className="p-1.5 rounded transition-colors hover:bg-[#1A2744]"
                      style={{ color: 'var(--text-ghost)' }}>
                      <Printer size={14} />
                    </button>
                  </div>
                </div>

                <div className="px-6 py-5">
                  {isTetap ? (
                    <>
                      <CliLabel text="Pendapatan" />
                      <CliRow label="Gaji Pokok" value={formatRupiah(res.gaji_pokok ?? 0)} />
                      {(res.benefit     ?? 0) > 0 && <CliRow label="  Benefit / Tunj. Tetap"    value={formatRupiah(res.benefit)}     indent />}
                      {(res.kendaraan   ?? 0) > 0 && <CliRow label="  Tunjangan Kendaraan"       value={formatRupiah(res.kendaraan)}   indent />}
                      {(res.pulsa       ?? 0) > 0 && <CliRow label="  Tunjangan Pulsa"           value={formatRupiah(res.pulsa)}       indent />}
                      {(res.operasional ?? 0) > 0 && <CliRow label="  Tunjangan Operasional"     value={formatRupiah(res.operasional)} indent />}
                      {(res.tunj_lain   ?? 0) > 0 && <CliRow label="  Tunjangan Lain"            value={formatRupiah(res.tunj_lain)}  indent />}

                      {(bpjsInBruto + bpjsTunj) > 0 && (
                        <>
                          <CliLabel text="BPJS Masuk Bruto" />
                          {bpjsJKK     > 0 && <CliRow label="  JKK Employer"                value={formatRupiah(bpjsJKK)}     indent />}
                          {bpjsJKM     > 0 && <CliRow label="  JKM Employer"                value={formatRupiah(bpjsJKM)}     indent />}
                          {bpjsKesE    > 0 && <CliRow label="  Kesehatan 4% (Employer)"     value={formatRupiah(bpjsKesE)}    indent />}
                          {bpjsTunjJHT > 0 && <CliRow label="  JHT Karyawan (Co. Tunggung)" value={formatRupiah(bpjsTunjJHT)} indent />}
                          {bpjsTunjJP  > 0 && <CliRow label="  JP Karyawan (Co. Tunggung)"  value={formatRupiah(bpjsTunjJP)}  indent />}
                          {bpjsTunjKes > 0 && <CliRow label="  Kes Karyawan (Co. Tunggung)" value={formatRupiah(bpjsTunjKes)} indent />}
                        </>
                      )}

                      {res.pph_ditanggung && (res.tunj_pph ?? 0) > 0 && (
                        <>
                          <CliLabel text="PPh Grossup" />
                          <CliRow label="  Tunjangan PPh 21 (Co. Tanggung)"
                            value={formatRupiah(res.tunj_pph ?? 0)} color="text-amber-400" indent />
                        </>
                      )}

                      <CliSep />
                      <CliTotal label="BRUTO" value={formatRupiah(res.bruto ?? 0)} color="text-white" />
                      <CliRow label="  TER Rate"
                        value={res.ter != null ? `${(res.ter * 100).toFixed(2)}%` : 'Pasal 17 ✓'}
                        indent dim />
                      <CliRow label="  PPh 21 = TER × Bruto"
                        value={formatRupiah(res.pph ?? 0)} color="text-amber-400" indent />

                      {(res.thr_nominal > 0 || res.bonus_nominal > 0) && (
                        <>
                          <CliLabel text="THR / Bonus — Selisih Pasal 17" />
                          {res.thr_nominal > 0 && (
                            <>
                              <CliRow label="  THR Nominal"   value={formatRupiah(res.thr_nominal)}  indent />
                              <CliRow label="  PPh THR"       value={formatRupiah(res.thr_pph ?? 0)} color="text-amber-400" indent />
                              <CliRow label="  THR Net"       value={formatRupiah(res.thr_thp ?? 0)} color="text-green-400" indent />
                            </>
                          )}
                          {res.bonus_nominal > 0 && (
                            <>
                              <CliRow label="  Bonus Nominal"  value={formatRupiah(res.bonus_nominal)}  indent />
                              <CliRow label="  PPh Bonus"      value={formatRupiah(res.bonus_pph ?? 0)} color="text-amber-400" indent />
                              <CliRow label="  Bonus Net"      value={formatRupiah(res.bonus_thp ?? 0)} color="text-green-400" indent />
                            </>
                          )}
                        </>
                      )}

                      {(!res.pph_ditanggung || bpjsPotJHT > 0 || bpjsPotJP > 0 || bpjsPotKes > 0
                        || (res.kasbon ?? 0) > 0 || (res.alpha_telat ?? 0) > 0 || (res.pot_lain ?? 0) > 0) && (
                        <>
                          <CliLabel text="Potongan dari Gaji" />
                          {!res.pph_ditanggung && (res.pph ?? 0) > 0 &&
                            <CliRow label="  PPh 21 Dipotong"       value={`− ${formatRupiah(res.pph ?? 0)}`}   color="text-red-400" indent />}
                          {bpjsPotJHT > 0 &&
                            <CliRow label="  JHT Karyawan 2%"       value={`− ${formatRupiah(bpjsPotJHT)}`}     color="text-red-400" indent />}
                          {bpjsPotJP  > 0 &&
                            <CliRow label="  JP Karyawan 1%"        value={`− ${formatRupiah(bpjsPotJP)}`}      color="text-red-400" indent />}
                          {bpjsPotKes > 0 &&
                            <CliRow label="  Kesehatan Karyawan 1%" value={`− ${formatRupiah(bpjsPotKes)}`}     color="text-red-400" indent />}
                          {(res.kasbon ?? 0) > 0 &&
                            <CliRow label="  Kasbon"                value={`− ${formatRupiah(res.kasbon)}`}     color="text-red-400" indent />}
                          {(res.alpha_telat ?? 0) > 0 &&
                            <CliRow label="  Alpha / Telat"         value={`− ${formatRupiah(res.alpha_telat)}`} color="text-red-400" indent />}
                          {(res.pot_lain ?? 0) > 0 &&
                            <CliRow label="  Potongan Lain"         value={`− ${formatRupiah(res.pot_lain)}`}   color="text-red-400" indent />}
                        </>
                      )}

                      <CliSep />
                      <CliTotal label="TAKE HOME PAY" value={formatRupiah(res.thp ?? 0)} color="text-green-400" />
                      <CliRow label="  Gaji + Tunjangan"         value={formatRupiah(grossPend)}           indent dim />
                      {!res.pph_ditanggung && (res.pph ?? 0) > 0 &&
                        <CliRow label="  − PPh 21"               value={`− ${formatRupiah(res.pph ?? 0)}`} indent dim />}
                      {bpjsK > 0 &&
                        <CliRow label="  − BPJS Karyawan Dipotong" value={`− ${formatRupiah(bpjsK)}`}     indent dim />}
                      <CliSep />
                      <CliTotal label="COST TO COMPANY" value={formatRupiah(ctc)} color="text-sky-400" />
                      <CliRow label="  Bruto"                    value={formatRupiah(res.bruto ?? 0)}      indent dim />
                      {bpjsJHTE > 0 &&
                        <CliRow label="  + JHT Employer (offslip)" value={`+ ${formatRupiah(bpjsJHTE)}`}  indent dim />}
                      {bpjsJPE > 0 &&
                        <CliRow label="  + JP Employer (offslip)"  value={`+ ${formatRupiah(bpjsJPE)}`}   indent dim />}
                    </>
                  ) : (
                    <>
                      <CliLabel text="Upah Tidak Tetap" />
                      <CliRow label="Total Upah" value={formatRupiah(res.total_upah ?? 0)} />
                      <CliRow label="PPh 21"     value={formatRupiah(res.total_pph  ?? 0)} color="text-amber-400" />
                      {bpjsK > 0 &&
                        <CliRow label="BPJS Karyawan" value={`− ${formatRupiah(bpjsK)}`} color="text-red-400" />}
                      <CliSep />
                      <CliTotal label="TAKE HOME PAY"    value={formatRupiah(res.thp ?? 0)} color="text-green-400" />
                      <CliTotal label="COST TO COMPANY"  value={formatRupiah(ctc)}           color="text-sky-400" />
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
