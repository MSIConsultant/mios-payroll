'use client';
// Per-employee detail card: compact summary row + expandable full ledger with
// calc tooltips and the Pasal 17 panel. Extracted verbatim from the month
// page's detail map (PR 1). Display-only — numbers come from the engine `res`.

import Link from 'next/link';
import {
  ChevronDown, ChevronRight, Pencil, Printer, Wallet, AlertTriangle,
} from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { printSlipGaji } from '@/lib/export/slip-gaji';
import { type CalcTooltipData } from '@/components/payroll/CalcTooltip';
import { BPJS as BPJS_RATES, JP_MAX_BASIS, KES_MAX_BASIS } from '@/lib/engine/constants';
import { lebihPotongOf } from '@/lib/payroll/calc-client';
import { LedgerSectionLabel, LedgerRow, LedgerSep, LedgerTotal } from './LedgerPrimitives';
import { Pasal17BreakdownPanel } from './Pasal17BreakdownPanel';

export function EmployeeDetailCard({
  res, index, isExpanded, onToggleExpand, sourceEmp, hasUpahOverride,
  isLocked, isDesember, maxThp, company, companyId, tahun, bulan,
  onQuickEdit, onUpahEdit,
}: {
  res: any;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  sourceEmp: any | undefined;
  hasUpahOverride: boolean;
  isLocked: boolean;
  isDesember: boolean;
  maxThp: number;
  company: any;
  companyId: string;
  tahun: number;
  bulan: number;
  onQuickEdit: (emp: any) => void;
  onUpahEdit: (emp: any) => void;
}) {
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
  const basis    = res.bpjs?._basis    ?? res.basis ?? res.gaji_pokok ?? 0;
  const jpBasis  = res.bpjs?._jp_basis  ?? Math.min(basis, JP_MAX_BASIS);
  const kesBasis = res.bpjs?._kes_basis ?? Math.min(basis, KES_MAX_BASIS);
  const jkkRate  = sourceEmp?.jkk_rate ?? 0;
  const rpFmt    = (n: number) => formatRupiah(Math.round(n));
  const pct      = (r: number) => `${(r * 100).toFixed(2)}%`;

  const calcBruto: CalcTooltipData | undefined = isTetap ? {
    title: 'BRUTO', description: 'Total penghasilan kena pajak',
    steps: [
      { label: 'Gaji Pokok', value: rpFmt(res.gaji_pokok ?? 0), op: '+' },
      ...((res.allowance_total ?? 0) > 0 ? [{ label: 'Total Tunjangan', value: rpFmt(res.allowance_total ?? 0), op: '+' as const }] : []),
      ...(bpjsInBruto > 0 ? [{ label: 'BPJS Employer (bruto)', value: rpFmt(bpjsInBruto), op: '+' as const }] : []),
      ...(bpjsTunj > 0 ? [{ label: 'Tunj. BPJS Karyawan', value: rpFmt(bpjsTunj), op: '+' as const }] : []),
      ...((res.tunj_pph ?? 0) > 0 ? [{ label: 'Tunj. PPh 21 (Grossup)', value: rpFmt(res.tunj_pph ?? 0), op: '+' as const }] : []),
      { label: 'BRUTO', value: rpFmt(res.bruto ?? 0), highlight: true },
    ],
  } : undefined;

  const calcPph: CalcTooltipData | undefined = (isTetap && res.ter != null) ? {
    title: 'PPh 21 — Metode TER', description: 'TER% × Bruto',
    steps: [
      { label: `PTKP ${res.status_ptkp ?? '—'} → Grup ${res.grup ?? '—'}`, value: '', muted: true },
      { label: 'Bruto', value: rpFmt(res.bruto ?? 0), op: '×' },
      { label: 'TER Rate', value: pct(res.ter), op: '=' },
      { label: 'PPh 21', value: rpFmt(res.pph ?? 0), highlight: true },
    ],
    footer: 'PMK 168/2023',
  } : undefined;

  const calcPphDes: CalcTooltipData | undefined = (isTetap && res.ter == null) ? (() => {
    const M = res.months_in_year ?? 12;
    const isMidYear = res.is_last_month === true && res.bulan !== 12;
    const steps: Array<{ label: string; value: string; op?: '+' | '-' | '×' | '÷' | '='; highlight?: boolean; muted?: boolean }> = [];
    if (res.bulan === 12 && (res.proyeksi?.bruto_setahun ?? 0) > (res.base ?? 0)) {
      const akum = (res.bs ?? 0) - (res.base ?? 0);
      steps.push({ label: 'Bruto Jan–Nov (akumulasi)', value: rpFmt(akum), op: '+', muted: true });
      steps.push({ label: 'Bruto bulan ini', value: rpFmt(res.base ?? 0), op: '+', muted: true });
    }
    steps.push({ label: `Bruto setahun (${M} bulan)`, value: rpFmt(res.bs ?? 0) });
    steps.push({ label: `− Biaya Jabatan (cap ${formatRupiah(500_000 * M)})`, value: rpFmt(res.bj ?? 0), op: '-' });
    if ((res.jht_k_tahunan ?? 0) > 0) steps.push({ label: '− Iuran JHT Karyawan', value: rpFmt(res.jht_k_tahunan ?? 0), op: '-' });
    if ((res.jp_k_tahunan ?? 0) > 0) steps.push({ label: '− Iuran JP Karyawan', value: rpFmt(res.jp_k_tahunan ?? 0), op: '-' });
    steps.push({ label: 'Netto Setahun', value: rpFmt(res.netto ?? 0), muted: true });
    steps.push({ label: `− PTKP ${res.status_ptkp ?? ''}`, value: rpFmt(res.ptkp ?? 0), op: '-' });
    steps.push({ label: 'PKP (pembulatan ribuan)', value: rpFmt(res.pkp ?? 0), muted: true });
    const pkp = res.pkp ?? 0;
    if (pkp > 0) {
      const brackets = [{ width: 60_000_000, rate: 0.05 }, { width: 190_000_000, rate: 0.15 }, { width: 250_000_000, rate: 0.25 }, { width: 4_500_000_000, rate: 0.30 }, { width: Number.POSITIVE_INFINITY, rate: 0.35 }];
      let remaining = pkp, cumLo = 0;
      for (const b of brackets) {
        if (remaining <= 0) break;
        const portion = Math.min(remaining, b.width);
        const loM = Math.round(cumLo / 1_000_000), hiM = Math.round((cumLo + portion) / 1_000_000);
        steps.push({ label: b.width === Number.POSITIVE_INFINITY ? `> Rp ${loM}jt × ${(b.rate * 100).toFixed(0)}%` : `${loM}jt – ${hiM}jt × ${(b.rate * 100).toFixed(0)}%`, value: rpFmt(portion * b.rate), muted: true });
        cumLo += portion; remaining -= portion;
      }
    }
    steps.push({ label: 'PPh Tahunan', value: rpFmt(res.pph_tahunan ?? 0) });
    steps.push({ label: '− PPh sudah dipotong', value: rpFmt(res.pph_jan_nov ?? 0), op: '-' });
    if (lebihPotongOf(res) > 0) steps.push({ label: res.pph_ditanggung ? 'Lebih setor (grossup)' : 'Refund (kelebihan potong)', value: `−${rpFmt(lebihPotongOf(res))}`, highlight: true });
    else steps.push({ label: isMidYear ? 'PPh Bulan Terakhir' : 'PPh Desember', value: rpFmt(res.pph ?? 0), highlight: true });
    return { title: `PPh 21 — ${isMidYear ? `Bulan Terakhir Kerja (${M} bulan)` : 'Desember (12 bulan)'}`, description: 'Equalisasi tarif progresif Pasal 17', steps, footer: 'UU HPP Pasal 17 — pembulatan PKP ke ribuan bawah' };
  })() : undefined;

  const calcJKK: CalcTooltipData = { title: 'JKK — Jaminan Kecelakaan Kerja', description: 'Basis × JKK Rate (industri)', steps: [{ label: 'Basis BPJS', value: rpFmt(basis), op: '×' }, { label: 'JKK Rate', value: pct(jkkRate), op: '=' }, { label: 'JKK', value: rpFmt(bpjsJKK), highlight: true }], footer: 'Beban perusahaan, masuk bruto' };
  const calcJKM: CalcTooltipData = { title: 'JKM — Jaminan Kematian', description: 'Basis × 0.30%', steps: [{ label: 'Basis BPJS', value: rpFmt(basis), op: '×' }, { label: 'JKM Rate', value: pct(BPJS_RATES.jkm), op: '=' }, { label: 'JKM', value: rpFmt(bpjsJKM), highlight: true }], footer: 'Beban perusahaan, masuk bruto' };
  const calcKesE: CalcTooltipData = { title: 'Kesehatan Employer (4%)', description: 'min(basis, 12jt) × 4%', steps: [{ label: 'Basis Kes (capped 12jt)', value: rpFmt(kesBasis), op: '×' }, { label: 'Kes Employer Rate', value: pct(BPJS_RATES.kes_e), op: '=' }, { label: 'Kes Employer', value: rpFmt(bpjsKesE), highlight: true }], footer: 'Beban perusahaan, masuk bruto' };
  const calcTunjJHT: CalcTooltipData = { title: 'JHT Karyawan (Co. Tanggung)', description: 'Basis × 2% — dibayar perusahaan', steps: [{ label: 'Basis BPJS', value: rpFmt(basis), op: '×' }, { label: 'JHT Karyawan Rate', value: pct(BPJS_RATES.jht_k), op: '=' }, { label: 'Tunj. JHT', value: rpFmt(bpjsTunjJHT), highlight: true }], footer: 'Tunjangan ini masuk bruto karyawan' };
  const calcTunjJP: CalcTooltipData = { title: 'JP Karyawan (Co. Tanggung)', description: 'min(basis, 10.5jt) × 1% — dibayar perusahaan', steps: [{ label: 'Basis JP (capped 10.5jt)', value: rpFmt(jpBasis), op: '×' }, { label: 'JP Karyawan Rate', value: pct(BPJS_RATES.jp_k), op: '=' }, { label: 'Tunj. JP', value: rpFmt(bpjsTunjJP), highlight: true }], footer: 'Tunjangan ini masuk bruto karyawan' };
  const calcTunjKes: CalcTooltipData = { title: 'Kes Karyawan (Co. Tanggung)', description: 'min(basis, 12jt) × 1% — dibayar perusahaan', steps: [{ label: 'Basis Kes (capped 12jt)', value: rpFmt(kesBasis), op: '×' }, { label: 'Kes Karyawan Rate', value: pct(BPJS_RATES.kes_k), op: '=' }, { label: 'Tunj. Kes', value: rpFmt(bpjsTunjKes), highlight: true }], footer: 'Tunjangan ini masuk bruto karyawan' };
  const calcPotJHT: CalcTooltipData = { title: 'JHT Karyawan 2% (Dipotong)', description: 'Basis × 2% — dipotong dari gaji', steps: [{ label: 'Basis BPJS', value: rpFmt(basis), op: '×' }, { label: 'JHT Rate', value: pct(BPJS_RATES.jht_k), op: '=' }, { label: 'Potongan JHT', value: rpFmt(bpjsPotJHT), highlight: true }] };
  const calcPotJP: CalcTooltipData = { title: 'JP Karyawan 1% (Dipotong)', description: 'min(basis, 10.5jt) × 1% — dipotong dari gaji', steps: [{ label: 'Basis JP (capped)', value: rpFmt(jpBasis), op: '×' }, { label: 'JP Rate', value: pct(BPJS_RATES.jp_k), op: '=' }, { label: 'Potongan JP', value: rpFmt(bpjsPotJP), highlight: true }] };
  const calcPotKes: CalcTooltipData = { title: 'Kesehatan Karyawan 1% (Dipotong)', description: 'min(basis, 12jt) × 1% — dipotong dari gaji', steps: [{ label: 'Basis Kes (capped)', value: rpFmt(kesBasis), op: '×' }, { label: 'Kes Rate', value: pct(BPJS_RATES.kes_k), op: '=' }, { label: 'Potongan Kes', value: rpFmt(bpjsPotKes), highlight: true }] };

  const calcGrossup: CalcTooltipData | undefined = ((res.tunj_pph ?? 0) > 0) ? (
    res.is_last_month ? {
      title: 'Tunjangan PPh 21 (Grossup Pasal 17)', description: 'Iterasi Pasal 17: PPh setahun(bs + TP) = TP',
      steps: [{ label: 'Bruto setahun (tanpa TP)', value: rpFmt(res.bs_base ?? res.bs ?? 0), muted: true }, { label: 'PPh setahun (konvergen)', value: rpFmt(res.pph_tahunan ?? 0), muted: true }, { label: '− PPh sudah dibayar Jan–Nov', value: rpFmt(res.pph_jan_nov ?? 0), op: '-', muted: true }, { label: 'TP bulan ini', value: rpFmt(res.tunj_pph ?? 0), highlight: true }],
      footer: 'Pasal 17 rekonsiliasi — employer menanggung selisih PPh tahunan',
    } : {
      title: 'Tunjangan PPh 21 (Grossup TER)', description: 'Iterasi: PPh = TER × (Base + PPh) / (1 − TER)',
      steps: [{ label: 'Base (gaji + tunjangan + BPJS)', value: rpFmt((res.base ?? res.bruto ?? 0) - (res.tunj_pph ?? 0)), muted: true }, ...(res.ter != null ? [{ label: 'TER (konvergen)', value: pct(res.ter), muted: true }] : []), { label: 'PPh hasil iterasi', value: rpFmt(res.tunj_pph ?? 0), highlight: true }],
      footer: 'Perusahaan menanggung PPh sebagai tunjangan',
    }
  ) : undefined;

  const calcThp: CalcTooltipData = {
    title: 'TAKE HOME PAY', description: 'Yang diterima karyawan',
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
    title: 'COST TO COMPANY', description: 'Total biaya perusahaan',
    steps: [
      { label: 'Bruto', value: rpFmt(res.bruto ?? res.total_upah ?? 0), op: '+' },
      ...(bpjsJHTE > 0 ? [{ label: 'JHT Employer (offslip)', value: rpFmt(bpjsJHTE), op: '+' as const }] : []),
      ...(bpjsJPE > 0 ? [{ label: 'JP Employer (offslip)', value: rpFmt(bpjsJPE), op: '+' as const }] : []),
      { label: 'CTC', value: rpFmt(ctc), highlight: true },
    ],
    footer: 'Offslip = tidak terlihat di slip gaji',
  };

  const thpVal   = res.thp ?? 0;
  const thpPct   = maxThp > 0 ? (thpVal / maxThp) * 100 : 0;
  const barColor = res.is_refund ? 'bg-red-400' : (res.is_last_month || (isDesember && isTetap)) ? 'bg-violet-400' : 'bg-emerald-400';

  return (
    <div className="border-b border-[var(--border-subtle)] last:border-b-0 animate-fade-in-up" style={{ animationDelay: `${Math.min(index, 8) * 0.04}s`, opacity: 0 }}>

      {/* Compact summary row */}
      <div
        className="px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="shrink-0 text-[var(--text-muted)]">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href={`/companies/${companyId}/employees/${res.employee_id}?from=payroll&tahun=${tahun}&bulan=${bulan}`} onClick={(e) => e.stopPropagation()} className="text-[13px] font-semibold text-[var(--text-primary)] hover:text-[var(--brand)] transition-colors">
              {res.employee_name}
            </Link>
            <span className="shrink-0 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{res.mode ?? 'Tetap'}</span>
            <span className="shrink-0 text-[10px] font-medium text-[var(--text-faint)]">{res.status_ptkp ?? '—'}</span>
            {res.punya_npwp === false && <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-600">NO NPWP</span>}
            {res.pph_ditanggung && <span className="shrink-0 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Gross</span>}
            {res.is_last_month && <span className="shrink-0 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">P17·{res.months_in_year ?? 12}m</span>}
            {lebihPotongOf(res) > 0 && <span className="shrink-0 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-red-50 text-red-600">{res.pph_ditanggung ? 'Lebih Setor' : 'Refund'}</span>}
          </div>
          <div className="mt-1.5 h-1 w-full max-w-[160px] bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${thpPct}%` }} />
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-5 shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider">Bruto</p>
            <p className="text-[12px] font-mono font-semibold text-[var(--text-secondary)]">{formatRupiah(res.bruto ?? res.total_upah ?? 0)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider">PPh 21</p>
            <p className="text-[12px] font-mono font-semibold text-amber-700">{formatRupiah(res.pph ?? res.total_pph ?? 0)}</p>
          </div>
          <div className="w-[100px] text-right">
            <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider">THP</p>
            <p className="text-[13px] font-mono font-bold text-emerald-700">{formatRupiah(thpVal)}</p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {!isLocked && sourceEmp?.jenis_karyawan === 'tidak_tetap_bulanan' && (
            <button
              onClick={() => onUpahEdit(sourceEmp)}
              title={hasUpahOverride ? 'Edit upah bulan ini (sedang di-override)' : 'Set upah berbeda untuk bulan ini'}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                hasUpahOverride
                  ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                  : 'text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              <Wallet size={13} />
            </button>
          )}
          {!isLocked && sourceEmp && (
            <button onClick={() => onQuickEdit(sourceEmp)} title="Edit kompensasi" className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer">
              <Pencil size={13} />
            </button>
          )}
          <button onClick={() => printSlipGaji(res, company, bulan, tahun)} title="Cetak Slip Gaji" className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer">
            <Printer size={14} />
          </button>
        </div>
      </div>

      {/* Expanded ledger detail */}
      {isExpanded && (
        <div className="px-5 sm:px-6 py-5 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
          {(res.proyeksi?.is_estimate === true || res.is_estimate === true) && (
            <div className="mb-4 flex items-start gap-2.5 bg-sky-50 border border-sky-200 rounded-lg px-4 py-2.5">
              <AlertTriangle size={16} className="text-sky-600 mt-0.5 shrink-0" />
              <div className="text-[13px] text-sky-900 leading-relaxed">
                <p className="font-semibold">Estimasi — data PPh Jan–Nov belum tersimpan</p>
                <p className="mt-0.5">
                  Perhitungan Desember membutuhkan akumulasi PPh bulan-bulan sebelumnya.
                  Karena data tersebut belum ada, PPh dihitung berdasarkan perkiraan gaji bulan ini × sisa bulan.
                  Simpan run Jan–Nov terlebih dahulu lalu hitung ulang untuk hasil yang akurat.
                </p>
              </div>
            </div>
          )}
          {lebihPotongOf(res) > 0 && (
            <div className="mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="text-[13px] text-amber-900 leading-relaxed">
                <p className="font-semibold">
                  {res.pph_ditanggung
                    ? 'Kelebihan setor PPh (grossup) — PPh Des negatif'
                    : 'Kelebihan potong PPh — karyawan berhak refund'}
                </p>
                <p className="mt-0.5">
                  PPh tahunan ({formatRupiah(res.pph_tahunan ?? 0)}) lebih kecil dari PPh yang sudah {res.pph_ditanggung ? 'dibayar perusahaan' : 'dipotong'}{' '}
                  ({formatRupiah(res.pph_jan_nov ?? 0)}). PPh Desember:{' '}
                  <span className="font-semibold font-mono">− {formatRupiah(lebihPotongOf(res))}</span>
                  {res.pph_ditanggung
                    ? ' — kelebihan setor perusahaan, dikompensasikan/direstitusi via SPT.'
                    : ' — harus dikembalikan tunai kepada karyawan di luar slip ini.'}
                </p>
              </div>
            </div>
          )}

          {isTetap ? (
            <>
              <LedgerSectionLabel text="Pendapatan" />
              <LedgerRow label="Gaji Pokok" value={formatRupiah(res.gaji_pokok ?? 0)} />
              {(res.benefit ?? 0) > 0 && <LedgerRow label="Benefit / Tunj. Tetap" value={formatRupiah(res.benefit)} indent />}
              {(res.kendaraan ?? 0) > 0 && <LedgerRow label="Tunjangan Kendaraan" value={formatRupiah(res.kendaraan)} indent />}
              {(res.pulsa ?? 0) > 0 && <LedgerRow label="Tunjangan Pulsa" value={formatRupiah(res.pulsa)} indent />}
              {(res.operasional ?? 0) > 0 && <LedgerRow label="Tunjangan Operasional" value={formatRupiah(res.operasional)} indent />}
              {(res.tunj_lain ?? 0) > 0 && <LedgerRow label="Tunjangan Lain" value={formatRupiah(res.tunj_lain)} indent />}

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
                  <LedgerRow label="Tunjangan PPh 21 (Co. Tanggung)" value={formatRupiah(res.tunj_pph ?? 0)} color="text-amber-700" indent calc={calcGrossup} />
                </>
              )}

              <LedgerSep />
              <LedgerTotal label="BRUTO" value={formatRupiah(res.bruto ?? 0)} color="text-[var(--text-primary)]" calc={calcBruto} />
              <LedgerRow label="TER Rate" value={res.ter != null ? `${(res.ter * 100).toFixed(2)}%` : 'Pasal 17 ✓'} indent dim />
              <LedgerRow label={res.ter != null ? "PPh 21 = TER × Bruto" : "PPh 21 (Pasal 17)"} value={formatRupiah(res.pph ?? 0)} color="text-amber-700" indent calc={calcPph ?? calcPphDes} />

              {(res.thr_nominal > 0 || res.bonus_nominal > 0) && (
                <>
                  <LedgerSectionLabel text="THR / Bonus — Selisih Pasal 17" />
                  {res.thr_nominal > 0 && (
                    <>
                      <LedgerRow label="THR Nominal" value={formatRupiah(res.thr_nominal)} indent />
                      <LedgerRow label="PPh THR" value={formatRupiah(res.thr_pph ?? 0)} color="text-amber-700" indent />
                      <LedgerRow label="THR Net" value={formatRupiah(res.thr_thp ?? 0)} color="text-emerald-700" indent />
                    </>
                  )}
                  {res.bonus_nominal > 0 && (
                    <>
                      <LedgerRow label="Bonus Nominal" value={formatRupiah(res.bonus_nominal)} indent />
                      <LedgerRow label="PPh Bonus" value={formatRupiah(res.bonus_pph ?? 0)} color="text-amber-700" indent />
                      <LedgerRow label="Bonus Net" value={formatRupiah(res.bonus_thp ?? 0)} color="text-emerald-700" indent />
                    </>
                  )}
                </>
              )}

              {(!res.pph_ditanggung || bpjsPotJHT > 0 || bpjsPotJP > 0 || bpjsPotKes > 0 || (res.kasbon ?? 0) > 0 || (res.alpha_telat ?? 0) > 0 || (res.pot_lain ?? 0) > 0) && (
                <>
                  <LedgerSectionLabel text="Potongan dari Gaji" />
                  {!res.pph_ditanggung && (res.pph ?? 0) > 0 && <LedgerRow label="PPh 21 Dipotong" value={`− ${formatRupiah(res.pph ?? 0)}`} color="text-red-600" indent />}
                  {bpjsPotJHT > 0 && <LedgerRow label="JHT Karyawan 2%"       value={`− ${formatRupiah(bpjsPotJHT)}`} color="text-red-600" indent calc={calcPotJHT} />}
                  {bpjsPotJP  > 0 && <LedgerRow label="JP Karyawan 1%"        value={`− ${formatRupiah(bpjsPotJP)}`}  color="text-red-600" indent calc={calcPotJP} />}
                  {bpjsPotKes > 0 && <LedgerRow label="Kesehatan Karyawan 1%" value={`− ${formatRupiah(bpjsPotKes)}`} color="text-red-600" indent calc={calcPotKes} />}
                  {(res.kasbon ?? 0) > 0      && <LedgerRow label="Kasbon"        value={`− ${formatRupiah(res.kasbon)}`}      color="text-red-600" indent />}
                  {(res.alpha_telat ?? 0) > 0 && <LedgerRow label="Alpha / Telat" value={`− ${formatRupiah(res.alpha_telat)}`} color="text-red-600" indent />}
                  {(res.pot_lain ?? 0) > 0    && <LedgerRow label="Potongan Lain" value={`− ${formatRupiah(res.pot_lain)}`}    color="text-red-600" indent />}
                </>
              )}

              <LedgerSep />
              <LedgerTotal label="TAKE HOME PAY" value={formatRupiah(res.thp ?? 0)} color="text-emerald-700" calc={calcThp} calcPosition="above" />
              <LedgerRow label="Gaji + Tunjangan" value={formatRupiah(grossPend)} indent dim />
              {!res.pph_ditanggung && (res.pph ?? 0) > 0 && <LedgerRow label="− PPh 21" value={`− ${formatRupiah(res.pph ?? 0)}`} indent dim />}
              {bpjsK > 0 && <LedgerRow label="− BPJS Karyawan Dipotong" value={`− ${formatRupiah(bpjsK)}`} indent dim />}
              <LedgerSep />
              <LedgerTotal label="COST TO COMPANY" value={formatRupiah(ctc)} color="text-sky-700" calc={calcCtc} calcPosition="above" />
              <LedgerRow label="Bruto" value={formatRupiah(res.bruto ?? 0)} indent dim />
              {bpjsJHTE > 0 && <LedgerRow label="+ JHT Employer (offslip)" value={`+ ${formatRupiah(bpjsJHTE)}`} indent dim />}
              {bpjsJPE > 0  && <LedgerRow label="+ JP Employer (offslip)"  value={`+ ${formatRupiah(bpjsJPE)}`}  indent dim />}

              {/* Pasal 17 equalization panel — December / last-month employees */}
              {(res.is_last_month || (isDesember && !res.ter)) && (
                <Pasal17BreakdownPanel res={res} />
              )}
            </>
          ) : (
            <>
              <LedgerSectionLabel text="Upah Tidak Tetap" />
              <LedgerRow label="Total Upah" value={formatRupiah(res.total_upah ?? 0)} />
              <LedgerRow label="PPh 21" value={formatRupiah(res.total_pph ?? 0)} color="text-amber-700" />
              {bpjsK > 0 && <LedgerRow label="BPJS Karyawan" value={`− ${formatRupiah(bpjsK)}`} color="text-red-600" />}
              <LedgerSep />
              <LedgerTotal label="TAKE HOME PAY" value={formatRupiah(res.thp ?? 0)} color="text-emerald-700" calc={calcThp} calcPosition="above" />
              <LedgerTotal label="COST TO COMPANY" value={formatRupiah(ctc)} color="text-sky-700" calc={calcCtc} calcPosition="above" />
            </>
          )}
        </div>
      )}
    </div>
  );
}
