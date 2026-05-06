'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Calculator, Save, Lock, Printer, Download, AlertTriangle } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { calculateMonthlySalary, calculateFreelance } from '@/lib/engine/payroll';
import { savePayrollRun, lockPayrollRun } from '@/lib/actions/payroll';
import { printSlipGaji } from '@/lib/export/slip-gaji';
import { exportSPTMasa } from '@/lib/export/spt-masa';
import { toast } from 'sonner';
import { createShareLink } from '@/lib/actions/share';
import { Share2 } from 'lucide-react';


const BULAN_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const sep = '─'.repeat(38);

function CliRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between text-[11px] py-0.5">
      <span className="text-zinc-600 font-mono">{label.padEnd(22,' ')}</span>
      <span className={`font-mono font-bold ${color ?? 'text-zinc-300'}`}>{value}</span>
    </div>
  );
}
function CliSep() {
  return <div className="text-[11px] text-zinc-800 font-mono py-0.5">{sep}</div>;
}

export default function PayrollRunPage() {
  const { companyId, tahun, bulan } = useParams();
  const [employees, setEmployees]   = useState<any[]>([]);
  const [events, setEvents]         = useState<any[]>([]);
  const [existingRun, setExistingRun] = useState<any>(null);
  const [results, setResults]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [isCalculated, setIsCalculated] = useState(false);
  const [company, setCompany]       = useState<any>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [sharing, setSharing]   = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [calcProgress, setCalcProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const [{ data: co }, { data: empData }, { data: eventData }, { data: runData }] = await Promise.all([
        supabase.from('companies').select('name, npwp_perusahaan').eq('id', companyId).single(),
        supabase.from('employees').select('*').eq('company_id', companyId).eq('aktif', true),
        supabase.from('employee_events').select('*').eq('company_id', companyId).eq('tahun', tahun).eq('bulan', bulan),
        supabase.from('payroll_runs').select('*, payroll_results(*)').eq('company_id', companyId)
          .eq('tahun', tahun).eq('bulan', bulan).maybeSingle(),
      ]);

      // Fetch Jan-Nov accumulation for December
      let accumMap: Record<string, { akum_bruto: number; pph_jan_nov: number }> = {};
      if (Number(bulan) === 12 && empData) {
        const { data: prevRuns } = await supabase
          .from('payroll_runs').select('id, bulan')
          .eq('company_id', companyId).eq('tahun', tahun).neq('bulan', 12);
        if (prevRuns && prevRuns.length > 0) {
          const { data: prevResults } = await supabase
            .from('payroll_results').select('employee_id, bruto, pph')
            .in('run_id', prevRuns.map(r => r.id));
          for (const r of prevResults ?? []) {
            if (!accumMap[r.employee_id]) accumMap[r.employee_id] = { akum_bruto: 0, pph_jan_nov: 0 };
            accumMap[r.employee_id].akum_bruto  += r.bruto ?? 0;
            accumMap[r.employee_id].pph_jan_nov += r.pph   ?? 0;
          }
        }
      }

      if (co) setCompany(co);
      if (empData) setEmployees(empData.map(emp => ({
        ...emp,
        _akum_bruto:  accumMap[emp.id]?.akum_bruto  ?? 0,
        _pph_jan_nov: accumMap[emp.id]?.pph_jan_nov ?? 0,
      })));
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
      }
      setLoading(false);
    }
    fetchData();
  }, [companyId, tahun, bulan]);

  function handleCalculate() {
    setCalcProgress({ current: 0, total: employees.length });
    const newResults: any[] = [];
    let i = 0;

    function processNext() {
      if (i >= employees.length) {
        setResults(newResults);
        setIsCalculated(true);
        setCalcProgress({ current: 0, total: 0 });
        return;
      }
      const emp = employees[i];
      const empEvents     = events.filter(e => e.employee_id === emp.id);
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
          tunj_lain: emp.tunj_lain + benefit_extra,
          thr, bonus,
          pph_jan_nov: (emp as any)._pph_jan_nov ?? 0,
          akum_bruto:  (emp as any)._akum_bruto  ?? 0,
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
          kasbon,
          pot_lain:     pot_lain + (emp.pot_lain || 0),
        });
      }
      newResults.push({ ...calcResult, employee_id: emp.id, employee_name: emp.nama });
      i++;
      setCalcProgress({ current: i, total: employees.length });
      setTimeout(processNext, 0);
    }
    processNext();
  }
  
  async function handleShare() {
    if (!existingRun?.id) return;
    setSharing(true);
    const res = await createShareLink(existingRun.id, companyId as string, Number(tahun), Number(bulan));
    if (res.error) toast.error(res.error);
    else {
      setShareUrl(res.url!);
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
    setSaving(false);
  }

  async function handleLock() {
    if (!existingRun?.id) return;
    if (!confirm('Kunci payroll? Data tidak bisa diubah lagi.')) return;
    setSaving(true);
    const res = await lockPayrollRun(existingRun.id, companyId as string, Number(tahun), Number(bulan));
    if (res.error) { toast.error(res.error); setSaving(false); return; }
    setExistingRun((p: any) => ({ ...p, status: 'locked' }));
    setSaving(false);
  }

  if (loading) return <div className="h-64 bg-[#111113] border border-[#1A1A1C] rounded-lg animate-pulse" />;

  const isLocked     = existingRun?.status === 'locked';
  const isDesember   = Number(bulan) === 12;
  const totalBruto   = results.reduce((a, r) => a + (r.bruto || r.total_upah || 0), 0);
  const totalPph     = results.reduce((a, r) => a + (r.pph || r.total_pph || 0), 0);
  const totalThp     = results.reduce((a, r) => a + (r.thp || 0), 0);
  const totalCtc     = results.reduce((a, r) => a + (r.bruto || r.total_upah || 0) + (r.bpjs?.employer_offslip || 0), 0);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/companies/${companyId}/payroll`}
            className="w-9 h-9 bg-[#111113] border border-[#1A1A1C] rounded-lg flex items-center justify-center text-zinc-600 hover:text-zinc-200 transition-colors">
            <ArrowLeft size={15} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-zinc-100">{BULAN_NAMES[Number(bulan)-1]} {tahun}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px] text-zinc-600">{company?.name ?? '—'}</p>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${
                existingRun?.status === 'locked'     ? 'bg-green-900/25 text-green-400' :
                existingRun?.status === 'calculated' ? 'bg-sky-900/25 text-sky-400' :
                'bg-zinc-800 text-zinc-600'
              }`}>{existingRun?.status ?? 'draft'}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {isCalculated && (
            <button
              onClick={() => exportSPTMasa(results, company, employees, Number(bulan), Number(tahun))}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#111113] border border-[#1A1A1C] text-zinc-400 hover:text-[#2563EB] hover:border-[#2563EB]/30 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors">
              <Download size={13} />
              Export SPT
            </button>
          )}
          {!isLocked && (
            calcProgress.total > 0 ? (
              <div className="flex items-center gap-3 px-4 py-2 bg-[#111113] border border-[#1A1A1C] rounded-lg">
                <div className="w-24 h-1 bg-[#1A1A1C] rounded-full overflow-hidden">
                  <div className="h-full bg-[#2563EB] rounded-full transition-all duration-150"
                    style={{ width: `${(calcProgress.current / calcProgress.total) * 100}%` }} />
                </div>
                <span className="text-[11px] text-zinc-500 font-mono">{calcProgress.current}/{calcProgress.total}</span>
              </div>
            ) : (
              <button onClick={handleCalculate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#111113] border border-[#1A1A1C] text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors">
                <Calculator size={13} />
                {isCalculated ? 'Hitung Ulang' : 'Hitung'}
              </button>
            )
          )}
          {isCalculated && !isLocked && (
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-[#0A0A0B] rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors">
              <Save size={13} />
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          )}
          {existingRun?.status === 'calculated' && (
            <button onClick={handleLock} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#111113] border border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-lg text-xs font-bold uppercase tracking-widest disabled:opacity-50 transition-colors">
              <Lock size={13} />
              Kunci
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {isCalculated && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Bruto',  value: formatRupiah(totalBruto), color: 'text-zinc-100' },
            { label: 'Total PPh 21', value: formatRupiah(totalPph),   color: 'text-amber-400' },
            { label: 'Total THP',    value: formatRupiah(totalThp),   color: 'text-green-400' },
            { label: 'Total CTC',    value: formatRupiah(totalCtc),   color: 'text-sky-400' },
          ].map(s => (
            <div key={s.label} className="bg-[#111113] border border-[#1A1A1C] rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">{s.label}</p>
              <p className={`text-sm font-bold font-mono ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* December Equalization Warning */}
      {isDesember && isCalculated && (
        <div className="bg-[#1A1200] border border-amber-800/40 rounded-lg px-5 py-4 flex items-start gap-3 animate-fade-in">
          <AlertTriangle size={15} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-amber-300 uppercase tracking-widest mb-1">Equalisasi Desember</p>
            <p className="text-[11px] text-amber-500 font-mono leading-relaxed">
              Equalisasi Desember akan menghasilkan PPh{' '}
              <span className="text-amber-300 font-bold">{formatRupiah(totalPph)}</span>
              {' '}untuk {results.length} karyawan menggunakan metode Pasal 17 tahunan.
            </p>
          </div>
        </div>
      )}
      
      {existingRun?.status === 'locked' && (
        <button onClick={handleShare} disabled={sharing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#111113] border border-[#1A1A1C] text-zinc-400 hover:text-[#2563EB] hover:border-[#2563EB]/30 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50">
          <Share2 size={13} />
          {shareCopied ? 'Tersalin!' : sharing ? '...' : 'Bagikan'}
        </button>
      )}

      {/* CLI Results */}
      {!isCalculated ? (
        <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg p-16 text-center">
          <Calculator size={32} className="mx-auto text-zinc-700 mb-4" />
          <p className="text-sm text-zinc-500 mb-1">Belum dihitung</p>
          <p className="text-xs text-zinc-700 mb-6">{employees.length} karyawan aktif siap diproses</p>
          <button onClick={handleCalculate}
            className="px-8 py-3 bg-[#2563EB] text-[#0A0A0B] rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-[#1D4ED8] transition-colors">
            Mulai Kalkulasi
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((res, i) => {
            const isTetap = !res.mode || res.mode === undefined;
            const bpjsK   = res.bpjs?.karyawan_potong ?? res.tot_bpjs ?? 0;
            const bpjsEmp = res.bpjs?.employer_total ?? 0;
            const ctc     = (res.bruto || res.total_upah || 0) + (res.bpjs?.employer_offslip ?? 0);

            return (
              <div key={i} className="bg-[#080809] border border-[#1A1A1C] rounded-lg overflow-hidden font-mono animate-fade-in-up"
                style={{ animationDelay: `${i * 0.04}s`, opacity: 0 }}>
                {/* Employee header */}
                <div className="px-5 py-3 bg-[#0F0F11] border-b border-[#1A1A1C] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[#2563EB] text-sm">$</span>
                    <span className="text-sm font-bold text-zinc-200 uppercase tracking-wide">{res.employee_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-zinc-600">{res.mode ? res.mode.toUpperCase() : 'TETAP'}</span>
                      <span className="text-zinc-800">·</span>
                      <span className="text-zinc-600">{res.status_ptkp ?? '—'}</span>
                      <span className="text-zinc-800">·</span>
                      <span className={res.punya_npwp !== false ? 'text-green-500' : 'text-red-500'}>
                        {res.punya_npwp !== false ? 'NPWP ✓' : 'NO NPWP +20%'}
                      </span>
                      {res.pph_ditanggung && <>
                        <span className="text-zinc-800">·</span>
                        <span className="text-amber-400">GROSSUP</span>
                      </>}
                    </div>
                    {/* Print slip button */}
                    <button
                      onClick={() => printSlipGaji(res, company, Number(bulan), Number(tahun))}
                      title="Cetak Slip Gaji"
                      className="p-1.5 text-zinc-700 hover:text-[#2563EB] transition-colors border border-transparent hover:border-[#2563EB]/30 rounded">
                      <Printer size={12} />
                    </button>
                  </div>
                </div>

                <div className="px-5 py-4 space-y-0">
                  {isTetap ? (
                    <>
                      <CliRow label="gaji_pokok"      value={formatRupiah(res.gaji_pokok ?? 0)} />
                      {(res.allowance_total ?? 0) > 0 && <CliRow label="tunjangan_total" value={formatRupiah(res.allowance_total)} />}
                      <CliSep />
                      <CliRow label="bruto"           value={formatRupiah(res.bruto ?? 0)}      color="text-zinc-100" />
                      <CliRow label="ter_rate"        value={res.ter != null ? `${(res.ter * 100).toFixed(2)}%` : 'Pasal 17 ✓'} />
                      <CliRow label="pph21"           value={formatRupiah(res.pph ?? 0)}        color="text-amber-400" />
                      {res.pph_ditanggung && <CliRow label="tunj_pph (co.)" value={formatRupiah(res.tunj_pph ?? 0)} color="text-amber-300" />}
                      {bpjsK > 0 && <>
                        <CliSep />
                        <CliRow label="bpjs_karyawan" value={formatRupiah(bpjsK)}              color="text-zinc-500" />
                        {bpjsEmp > 0 && <CliRow label="bpjs_employer" value={formatRupiah(bpjsEmp)} color="text-zinc-700" />}
                      </>}
                      {(res.thr_nominal > 0 || res.bonus_nominal > 0) && <>
                        <CliSep />
                        {res.thr_nominal > 0 && (
                          <div className="text-[11px] py-0.5">
                            <span className="text-zinc-600">{'thr'.padEnd(22,' ')}</span>
                            <span className="text-amber-400">nominal {formatRupiah(res.thr_nominal)}</span>
                            <span className="text-zinc-700"> · pph {formatRupiah(res.thr_pph ?? 0)}</span>
                            <span className="text-green-400"> · net {formatRupiah(res.thr_thp ?? 0)}</span>
                          </div>
                        )}
                        {res.bonus_nominal > 0 && (
                          <div className="text-[11px] py-0.5">
                            <span className="text-zinc-600">{'bonus'.padEnd(22,' ')}</span>
                            <span className="text-amber-400">nominal {formatRupiah(res.bonus_nominal)}</span>
                            <span className="text-zinc-700"> · pph {formatRupiah(res.bonus_pph ?? 0)}</span>
                            <span className="text-green-400"> · net {formatRupiah(res.bonus_thp ?? 0)}</span>
                          </div>
                        )}
                      </>}
                    </>
                  ) : (
                    <>
                      <CliRow label="total_upah" value={formatRupiah(res.total_upah ?? 0)} color="text-zinc-100" />
                      <CliRow label="pph21"      value={formatRupiah(res.total_pph ?? 0)} color="text-amber-400" />
                      {bpjsK > 0 && <CliRow label="bpjs_karyawan" value={formatRupiah(bpjsK)} color="text-zinc-500" />}
                    </>
                  )}
                  <CliSep />
                  <CliRow label="THP" value={formatRupiah(res.thp ?? 0)} color="text-green-400" />
                  <CliRow label="CTC" value={formatRupiah(ctc)}          color="text-sky-400" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
