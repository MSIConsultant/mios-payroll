'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Calculator, Save, Lock, Printer, Download, AlertTriangle, Share2, ChevronDown, ChevronRight, TrendingUp } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { calculateMonthlySalary, calculateFreelance } from '@/lib/engine/payroll';
import { savePayrollRun, lockPayrollRun } from '@/lib/actions/payroll';
import { printSlipGaji } from '@/lib/export/slip-gaji';
import { exportSPTMasa } from '@/lib/export/spt-masa';
import { toast } from 'sonner';
import { createShareLink } from '@/lib/actions/share';

const BULAN_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const BULAN_SHORT = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const sep = '─'.repeat(40);

function CliRow({ label, value, color, indent }: { label: string; value: string; color?: string; indent?: boolean }) {
  return (
    <div className="flex justify-between text-[11px] py-[2px]">
      <span className="font-mono" style={{ color: 'var(--text-muted)', paddingLeft: indent ? 16 : 0 }}>
        {label.padEnd(24, ' ')}
      </span>
      <span className={`font-mono font-bold ${color ?? ''}`}
        style={!color ? { color: 'var(--text-secondary)' } : {}}>
        {value}
      </span>
    </div>
  );
}

function CliSep() {
  return (
    <div className="text-[11px] font-mono py-[2px]" style={{ color: 'var(--text-ghost)' }}>
      {sep}
    </div>
  );
}

export default function PayrollRunPage() {
  const { companyId, tahun, bulan } = useParams();
  const [employees, setEmployees]         = useState<any[]>([]);
  const [events, setEvents]               = useState<any[]>([]);
  const [existingRun, setExistingRun]     = useState<any>(null);
  const [results, setResults]             = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [isCalculated, setIsCalculated]   = useState(false);
  const [company, setCompany]             = useState<any>(null);
  const [shareUrl, setShareUrl]           = useState('');
  const [sharing, setSharing]             = useState(false);
  const [shareCopied, setShareCopied]     = useState(false);
  const [calcProgress, setCalcProgress]   = useState({ current: 0, total: 0 });
  const [accumMap, setAccumMap]           = useState<Record<string, { akum_bruto: number; pph_jan_nov: number }>>({});
  const [showYTD, setShowYTD]             = useState(false);
  const [expandedRows, setExpandedRows]   = useState<Set<number>>(new Set());

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

      // Always fetch YTD accumulation for all previous months this year
      const newAccumMap: Record<string, { akum_bruto: number; pph_jan_nov: number }> = {};
      if (empData) {
        const { data: prevRuns } = await supabase
          .from('payroll_runs').select('id, bulan')
          .eq('company_id', companyId)
          .eq('tahun', tahun)
          .lt('bulan', Number(bulan));
        if (prevRuns && prevRuns.length > 0) {
          const { data: prevResults } = await supabase
            .from('payroll_results').select('employee_id, bruto, pph')
            .in('run_id', prevRuns.map(r => r.id));
          for (const r of prevResults ?? []) {
            if (!newAccumMap[r.employee_id]) newAccumMap[r.employee_id] = { akum_bruto: 0, pph_jan_nov: 0 };
            newAccumMap[r.employee_id].akum_bruto  += r.bruto ?? 0;
            newAccumMap[r.employee_id].pph_jan_nov += r.pph   ?? 0;
          }
        }
      }

      if (co) setCompany(co);
      setAccumMap(newAccumMap);
      if (empData) setEmployees(empData.map(emp => ({
        ...emp,
        _akum_bruto:  newAccumMap[emp.id]?.akum_bruto  ?? 0,
        _pph_jan_nov: newAccumMap[emp.id]?.pph_jan_nov ?? 0,
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
      const emp           = employees[i];
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

  function toggleRow(i: number) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
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

  const hasYTD = Object.keys(accumMap).length > 0;

  return (
    <div className="max-w-4xl space-y-6">

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
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{company?.name ?? '—'}</p>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${
                existingRun?.status === 'locked'     ? 'bg-green-900/25 text-green-400' :
                existingRun?.status === 'calculated' ? 'bg-sky-900/25 text-sky-400' :
                'bg-zinc-800 text-zinc-600'
              }`}>{existingRun?.status ?? 'draft'}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          {isCalculated && (
            <button onClick={() => exportSPTMasa(results, company, employees, Number(bulan), Number(tahun))}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
              <Download size={13} />
              Export SPT
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
          {!isLocked && (
            calcProgress.total > 0 ? (
              <div className="flex items-center gap-3 px-4 py-2 rounded-lg"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-default)' }}>
                  <div className="h-full bg-[#2563EB] rounded-full transition-all duration-150"
                    style={{ width: `${(calcProgress.current / calcProgress.total) * 100}%` }} />
                </div>
                <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  {calcProgress.current}/{calcProgress.total}
                </span>
              </div>
            ) : (
              <button onClick={handleCalculate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                <Calculator size={13} />
                {isCalculated ? 'Hitung Ulang' : 'Hitung'}
              </button>
            )
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
            { label: 'Total Bruto',  value: formatRupiah(totalBruto), color: 'var(--text-primary)' },
            { label: 'Total PPh 21', value: formatRupiah(totalPph),   color: '#FBB040' },
            { label: 'Total THP',    value: formatRupiah(totalThp),   color: '#4ADE80' },
            { label: 'Total CTC',    value: formatRupiah(totalCtc),   color: '#38BDF8' },
          ].map(s => (
            <div key={s.label} className="rounded-lg p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              <p className="text-sm font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
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
            <p className="text-xs font-bold text-amber-300 uppercase tracking-widest mb-1">
              Equalisasi Desember
            </p>
            <p className="text-[11px] text-amber-500 font-mono leading-relaxed">
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
          <button
            onClick={() => setShowYTD(v => !v)}
            className="w-full px-5 py-3 flex items-center justify-between transition-colors"
            style={{ background: 'var(--bg-card)', borderBottom: showYTD ? '1px solid var(--border-default)' : 'none' }}>
            <div className="flex items-center gap-3">
              <TrendingUp size={13} className="text-[#3B82F6]" />
              <span className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--text-secondary)' }}>
                YTD Ledger — Akumulasi {BULAN_NAMES[0]} s/d {BULAN_NAMES[Number(bulan)-2] || '—'}
              </span>
            </div>
            {showYTD
              ? <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
              : <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
            }
          </button>

          {showYTD && (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Nama', 'Akum. Bruto', 'Akum. PPh', 'Bulan Ini Bruto', 'Est. Bruto Tahunan'].map(h => (
                      <th key={h} className="px-5 py-2.5 text-left font-bold uppercase tracking-widest"
                        style={{ color: 'var(--text-muted)', fontSize: 9 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((res, i) => {
                    const acc  = accumMap[res.employee_id] ?? { akum_bruto: 0, pph_jan_nov: 0 };
                    const thisBruto = res.bruto ?? res.total_upah ?? 0;
                    const projected = (acc.akum_bruto + thisBruto) / Number(bulan) * 12;
                    return (
                      <tr key={i}
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        className="transition-colors">
                        <td className="px-5 py-2.5 font-bold" style={{ color: 'var(--text-secondary)' }}>
                          {res.employee_name}
                        </td>
                        <td className="px-5 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                          {formatRupiah(acc.akum_bruto)}
                        </td>
                        <td className="px-5 py-2.5 text-amber-400">
                          {formatRupiah(acc.pph_jan_nov)}
                        </td>
                        <td className="px-5 py-2.5" style={{ color: 'var(--text-primary)' }}>
                          {formatRupiah(thisBruto)}
                        </td>
                        <td className="px-5 py-2.5 text-sky-400">
                          {formatRupiah(projected)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CLI Results */}
      {!isCalculated ? (
        <div className="rounded-lg p-16 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <Calculator size={32} className="mx-auto mb-4" style={{ color: 'var(--text-ghost)' }} />
          <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Belum dihitung</p>
          <p className="text-xs mb-6" style={{ color: 'var(--text-ghost)' }}>
            {employees.length} karyawan aktif siap diproses
          </p>
          <button onClick={handleCalculate}
            className="px-8 py-3 rounded-lg font-bold text-xs uppercase tracking-widest text-white transition-colors"
            style={{ background: '#2563EB' }}>
            Mulai Kalkulasi
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((res, i) => {
            const isTetap   = !res.mode || res.mode === undefined;
            const bpjsK     = res.bpjs?.karyawan_potong ?? res.tot_bpjs ?? 0;
            const bpjsEmp   = res.bpjs?.employer_total ?? 0;
            const ctc       = (res.bruto || res.total_upah || 0) + (res.bpjs?.employer_offslip ?? 0);
            const isExpanded = expandedRows.has(i);

            // Bruto components
            const bpjsJKK     = res.bpjs?.jkk ?? 0;
            const bpjsJKM     = res.bpjs?.jkm ?? 0;
            const bpjsKesE    = res.bpjs?.kes_e ?? 0;
            const bpjsTunjJHT = res.bpjs?.tunj_jht ?? 0;
            const bpjsTunjJP  = res.bpjs?.tunj_jp  ?? 0;
            const bpjsTunjKes = res.bpjs?.tunj_kes ?? 0;
            const bpjsInBruto = bpjsJKK + bpjsJKM + bpjsKesE;
            const bpjsTunj    = bpjsTunjJHT + bpjsTunjJP + bpjsTunjKes;

            return (
              <div key={i}
                className="rounded-lg overflow-hidden font-mono animate-fade-in-up"
                style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-default)',
                  animationDelay: `${i * 0.04}s`, opacity: 0 }}>

                {/* Employee header */}
                <div className="px-5 py-3 flex items-center justify-between"
                  style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-default)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-[#3B82F6] text-sm">$</span>
                    <span className="text-sm font-bold uppercase tracking-wide"
                      style={{ color: 'var(--text-primary)' }}>
                      {res.employee_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-[10px]">
                      <span style={{ color: 'var(--text-muted)' }}>{res.mode ? res.mode.toUpperCase() : 'TETAP'}</span>
                      <span style={{ color: 'var(--text-ghost)' }}>·</span>
                      <span style={{ color: 'var(--text-muted)' }}>{res.status_ptkp ?? '—'}</span>
                      <span style={{ color: 'var(--text-ghost)' }}>·</span>
                      <span className={res.punya_npwp !== false ? 'text-green-500' : 'text-red-500'}>
                        {res.punya_npwp !== false ? 'NPWP ✓' : 'NO NPWP +20%'}
                      </span>
                      {res.pph_ditanggung && (
                        <>
                          <span style={{ color: 'var(--text-ghost)' }}>·</span>
                          <span className="text-amber-400">GROSSUP</span>
                        </>
                      )}
                    </div>
                    <button onClick={() => printSlipGaji(res, company, Number(bulan), Number(tahun))}
                      title="Cetak Slip Gaji"
                      className="p-1.5 rounded transition-colors"
                      style={{ color: 'var(--text-ghost)', border: '1px solid transparent' }}>
                      <Printer size={12} />
                    </button>
                  </div>
                </div>

                <div className="px-5 py-4">
                  {isTetap ? (
                    <>
                      {/* Gaji components */}
                      <CliRow label="gaji_pokok" value={formatRupiah(res.gaji_pokok ?? 0)} />

                      {/* Individual allowances */}
                      {(res.benefit ?? 0) > 0 &&
                        <CliRow label="benefit" value={formatRupiah(res.benefit)} indent />}
                      {(res.kendaraan ?? 0) > 0 &&
                        <CliRow label="kendaraan" value={formatRupiah(res.kendaraan)} indent />}
                      {(res.pulsa ?? 0) > 0 &&
                        <CliRow label="pulsa" value={formatRupiah(res.pulsa)} indent />}
                      {(res.operasional ?? 0) > 0 &&
                        <CliRow label="operasional" value={formatRupiah(res.operasional)} indent />}
                      {(res.tunj_lain ?? 0) > 0 &&
                        <CliRow label="tunj_lain" value={formatRupiah(res.tunj_lain)} indent />}

                      {/* BPJS breakdown — toggle */}
                      {(bpjsInBruto + bpjsTunj) > 0 && (
                        <>
                          <button
                            onClick={() => toggleRow(i)}
                            className="flex items-center gap-2 mt-1 mb-0.5 text-[10px] transition-colors"
                            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            {isExpanded
                              ? <ChevronDown size={10} />
                              : <ChevronRight size={10} />
                            }
                            <span className="uppercase tracking-widest">
                              bpjs in bruto (+{formatRupiah(bpjsInBruto + bpjsTunj)})
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="pl-4 mb-1 space-y-0">
                              {bpjsJKK > 0 &&
                                <CliRow label="  jkk (employer)" value={formatRupiah(bpjsJKK)} indent />}
                              {bpjsJKM > 0 &&
                                <CliRow label="  jkm (employer)" value={formatRupiah(bpjsJKM)} indent />}
                              {bpjsKesE > 0 &&
                                <CliRow label="  kes 4% (employer)" value={formatRupiah(bpjsKesE)} indent />}
                              {bpjsTunjJHT > 0 &&
                                <CliRow label="  jht_k (tunj co.)" value={formatRupiah(bpjsTunjJHT)} indent />}
                              {bpjsTunjJP > 0 &&
                                <CliRow label="  jp_k (tunj co.)" value={formatRupiah(bpjsTunjJP)} indent />}
                              {bpjsTunjKes > 0 &&
                                <CliRow label="  kes_k (tunj co.)" value={formatRupiah(bpjsTunjKes)} indent />}
                            </div>
                          )}
                        </>
                      )}

                      {res.pph_ditanggung && (res.tunj_pph ?? 0) > 0 &&
                        <CliRow label="tunj_pph (grossup)" value={formatRupiah(res.tunj_pph ?? 0)} color="text-amber-400" indent />}

                      <CliSep />
                      <CliRow label="BRUTO" value={formatRupiah(res.bruto ?? 0)} color="text-[--text-primary]" />
                      <CliRow label="ter_rate"
                        value={res.ter != null ? `${(res.ter * 100).toFixed(2)}%` : 'Pasal 17 ✓'} />
                      <CliRow label="pph21" value={formatRupiah(res.pph ?? 0)} color="text-amber-400" />

                      {bpjsK > 0 && (
                        <>
                          <CliSep />
                          <CliRow label="bpjs_karyawan (pot.)" value={formatRupiah(bpjsK)} color="text-red-400" />
                          {bpjsEmp > 0 &&
                            <CliRow label="bpjs_employer (total)" value={formatRupiah(bpjsEmp)}
                              style={{ color: 'var(--text-ghost)' }} />}
                        </>
                      )}

                      {(res.thr_nominal > 0 || res.bonus_nominal > 0) && (
                        <>
                          <CliSep />
                          {res.thr_nominal > 0 && (
                            <div className="flex justify-between text-[11px] py-[2px]">
                              <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                                {'thr'.padEnd(24, ' ')}
                              </span>
                              <span className="font-mono text-xs">
                                <span className="text-amber-400">
                                  nominal {formatRupiah(res.thr_nominal)}
                                </span>
                                <span style={{ color: 'var(--text-ghost)' }}>
                                  {' '}· pph {formatRupiah(res.thr_pph ?? 0)}
                                </span>
                                <span className="text-green-400">
                                  {' '}· net {formatRupiah(res.thr_thp ?? 0)}
                                </span>
                              </span>
                            </div>
                          )}
                          {res.bonus_nominal > 0 && (
                            <div className="flex justify-between text-[11px] py-[2px]">
                              <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                                {'bonus'.padEnd(24, ' ')}
                              </span>
                              <span className="font-mono text-xs">
                                <span className="text-amber-400">
                                  nominal {formatRupiah(res.bonus_nominal)}
                                </span>
                                <span style={{ color: 'var(--text-ghost)' }}>
                                  {' '}· pph {formatRupiah(res.bonus_pph ?? 0)}
                                </span>
                                <span className="text-green-400">
                                  {' '}· net {formatRupiah(res.bonus_thp ?? 0)}
                                </span>
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <CliRow label="total_upah" value={formatRupiah(res.total_upah ?? 0)} />
                      <CliRow label="pph21"      value={formatRupiah(res.total_pph ?? 0)} color="text-amber-400" />
                      {bpjsK > 0 &&
                        <CliRow label="bpjs_karyawan" value={formatRupiah(bpjsK)} color="text-red-400" />}
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