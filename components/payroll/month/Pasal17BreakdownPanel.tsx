'use client';
// Pasal 17 last-month equalization breakdown — extracted verbatim from the
// month page (PR 1 decomposition). Display-only: every number comes from the
// engine result (`res`), nothing is recomputed here.

import { memo } from 'react';
import { formatRupiah } from '@/lib/format';
import { type CalcTooltipData } from '@/components/payroll/CalcTooltip';
import { JP_MAX_BASIS, BIAYA_JAB_RATE, BIAYA_JAB_MAX } from '@/lib/engine/constants';
import { BULAN_NAMES } from '@/lib/payroll/calc-client';
import { P17Row, P17Divider } from './LedgerPrimitives';

// Wrapped in memo so parent re-renders (sidebar collapse, quick-edit on a
// different employee, calc-progress ticks) don't re-fire the bracket-table
// loops and tooltip-object construction for every expanded panel. Default
// shallow comparison on `res` is exactly what we want — the page rebuilds
// the results array but each unchanged employee's res reference is preserved
// across renders.
export const Pasal17BreakdownPanel = memo(function Pasal17BreakdownPanel({ res }: { res: any }) {
  const M = (res.months_in_year ?? 12) as number;
  const isGrossup = !!(res.pph_ditanggung && (res.tunj_pph_setahun ?? 0) > 0);
  const isEstimate = !!(res.proyeksi?.is_estimate);
  const bsBase = (res.bs_base ?? res.bs ?? 0) as number;
  const akumBruto = bsBase - (res.base ?? 0);
  const bulanIdx = (res.bulan as number) - 1;
  const periodName = BULAN_NAMES[bulanIdx] ?? `Bulan ${res.bulan}`;
  const prevName = M >= 2 ? (BULAN_NAMES[M - 2] ?? 'Nov') : '—';
  const rp = (n: number) => formatRupiah(n);
  const minus = (n: number) => `− ${rp(n)}`;
  const mult = (n: number, m: number) => rp(n * m);
  const kesEInBruto = (res.bpjs?.kes_e ?? 0) > 0 &&
    (res.bpjs?.employer_in_bruto ?? 0) > (res.bpjs?.jkk ?? 0) + (res.bpjs?.jkm ?? 0);

  const finalPkp = (res.pkp ?? 0) as number;
  const BRACKETS = [
    { w: 60_000_000, r: 0.05 }, { w: 190_000_000, r: 0.15 },
    { w: 250_000_000, r: 0.25 }, { w: 4_500_000_000, r: 0.30 }, { w: Infinity, r: 0.35 },
  ];
  type BLine = { loM: number; hiM: number; portion: number; rate: number; tax: number; isTop: boolean };
  const bLines: BLine[] = [];
  let rem = finalPkp, cumLo = 0;
  for (const { w, r } of BRACKETS) {
    if (rem <= 0) break;
    const portion = Math.min(rem, w === Infinity ? rem : w);
    bLines.push({ loM: Math.round(cumLo / 1_000_000), hiM: Math.round((cumLo + portion) / 1_000_000), portion, rate: r, tax: portion * r, isTop: w === Infinity });
    rem -= portion;
    cumLo += w === Infinity ? portion : w;
  }

  const pkpBase = (res.pkp_no_grossup ?? finalPkp) as number;
  let marginalRate = 0.05;
  let cumW = 0;
  for (const { w, r } of BRACKETS) {
    const hi = cumW + (w === Infinity ? Infinity : w);
    if (pkpBase < hi) { marginalRate = r; break; }
    if (w !== Infinity) cumW += w;
  }
  const marginalPct = `${(marginalRate * 100).toFixed(0)}%`;
  const totalPengurang = (res.bj ?? 0) + (res.jht_k_tahunan ?? 0) + (res.jp_k_tahunan ?? 0);
  const bpjsBasis = (res.bpjs?._basis ?? res.gaji_pokok ?? 0) as number;
  const jpBasis = Math.min(bpjsBasis, JP_MAX_BASIS);

  /* ── tooltips ── */
  const bjTooltip: CalcTooltipData = {
    title: 'Biaya Jabatan',
    description: 'PMK 168/2023 Pasal 10 (efektif 1 Jan 2024 — gantikan PMK 252/2008)',
    steps: [
      { label: 'Bruto Setahun', value: rp(res.bs ?? bsBase) },
      { label: '5% × Bruto', value: rp((res.bs ?? bsBase) * BIAYA_JAB_RATE), op: '×' },
      { label: `Cap Rp 500rb × ${M} bln`, value: rp(BIAYA_JAB_MAX * M) },
      { label: 'Biaya Jabatan (ambil min)', value: rp(res.bj ?? 0), highlight: true },
    ],
    footer: 'BPJS Kes karyawan 1% bukan pengurang',
  };

  const jhtTooltip: CalcTooltipData | undefined = (res.jht_k_tahunan ?? 0) > 0 ? {
    title: 'Iuran JHT Karyawan',
    description: 'PMK 168/2023 Pasal 10 — deductible',
    steps: [
      { label: 'Basis BPJS', value: rp(bpjsBasis) },
      { label: '× 2% (rate JHT karyawan)', value: rp(res.bpjs?.jht_k ?? 0), op: '×' },
      { label: `× ${M} bulan`, value: rp(res.jht_k_tahunan ?? 0), op: '×', highlight: true },
    ],
  } : undefined;

  const jpTooltip: CalcTooltipData | undefined = (res.jp_k_tahunan ?? 0) > 0 ? {
    title: 'Iuran JP Karyawan',
    description: 'PMK 168/2023 Pasal 10 — deductible',
    steps: [
      { label: `Basis JP (cap ${rp(JP_MAX_BASIS)})`, value: rp(jpBasis) },
      { label: '× 1% (rate JP karyawan)', value: rp(res.bpjs?.jp_k ?? 0), op: '×' },
      { label: `× ${M} bulan`, value: rp(res.jp_k_tahunan ?? 0), op: '×', highlight: true },
    ],
  } : undefined;

  const ptkpTooltip: CalcTooltipData = {
    title: `PTKP — ${res.status_ptkp ?? ''}`,
    description: 'PMK 101/PMK.010/2016',
    steps: [
      { label: 'TK/0 = Rp 54.000.000', value: '' },
      { label: 'TK/1, K/0 = Rp 58.500.000', value: '' },
      { label: 'TK/2, K/1 = Rp 63.000.000', value: '' },
      { label: 'TK/3, K/2 = Rp 67.500.000', value: '' },
      { label: 'K/3 = Rp 72.000.000', value: '' },
      { label: `Status ${res.status_ptkp ?? ''} →`, value: rp(res.ptkp ?? 0), highlight: true },
    ],
  };

  const pkpTooltip: CalcTooltipData = {
    title: 'PKP — Penghasilan Kena Pajak',
    description: 'Dibulatkan ke bawah ribuan',
    steps: [
      { label: 'Netto Setahun', value: rp(res.netto ?? 0) },
      { label: `− PTKP (${res.status_ptkp ?? ''})`, value: minus(res.ptkp ?? 0), op: '-' },
      { label: 'Selisih', value: rp(Math.max(0, (res.netto ?? 0) - (res.ptkp ?? 0))) },
      { label: 'PKP = floor ke bawah ribuan', value: rp(finalPkp), highlight: true },
    ],
    footer: 'floor(max(0, Netto − PTKP) / 1.000) × 1.000',
  };

  return (
    <div className="mt-5 pt-5 border-t border-violet-100">
      <div className="flex items-center gap-2 mb-3.5">
        <div className="w-1.5 h-5 rounded-full bg-violet-500 shrink-0" />
        <span className="text-[12px] font-bold uppercase tracking-widest text-violet-700">
          Rekonsiliasi PPh 21 Pasal 17 — {periodName}
        </span>
        {M < 12 && <span className="text-[11px] text-violet-400 font-medium">({M} bulan)</span>}
      </div>

      <div className="grid gap-2">
        {/* Step 1 — Bruto Setahun */}
        <div className="rounded-lg border border-violet-100 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 border-b border-violet-100">
            <span className="w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0 leading-none">1</span>
            <span className="text-[11px] font-semibold text-violet-700 uppercase tracking-wider">Bruto Setahun</span>
          </div>
          <div className="px-3 py-2.5">
            {isEstimate ? (
              <p className="text-[10px] text-violet-400 italic mb-1.5">Estimasi: akumulasi tidak ada — komponen bulan ini × {M}</p>
            ) : (
              <P17Row label={`Akumulasi Jan–${prevName} (dari DB)`} value={rp(akumBruto)} muted />
            )}
            <div className={`${!isEstimate ? 'mt-1' : ''} pl-2 border-l-2 border-violet-100`}>
              {!isEstimate && <p className="text-[10px] text-[var(--text-faint)] mb-0.5">Bruto {periodName} (rincian):</p>}
              <P17Row label={isEstimate ? `Gaji Pokok (${M} bln)` : 'Gaji Pokok'} value={isEstimate ? mult(res.gaji_pokok ?? 0, M) : rp(res.gaji_pokok ?? 0)} muted />
              {(res.benefit ?? 0) > 0 && <P17Row label={isEstimate ? `Benefit (${M} bln)` : 'Benefit'} value={isEstimate ? mult(res.benefit ?? 0, M) : rp(res.benefit ?? 0)} muted />}
              {(res.kendaraan ?? 0) > 0 && <P17Row label={isEstimate ? `Tunjangan Kendaraan (${M} bln)` : 'Tunj. Kendaraan'} value={isEstimate ? mult(res.kendaraan ?? 0, M) : rp(res.kendaraan ?? 0)} muted />}
              {(res.pulsa ?? 0) > 0 && <P17Row label={isEstimate ? `Tunjangan Pulsa (${M} bln)` : 'Tunj. Pulsa'} value={isEstimate ? mult(res.pulsa ?? 0, M) : rp(res.pulsa ?? 0)} muted />}
              {(res.operasional ?? 0) > 0 && <P17Row label={isEstimate ? `Tunjangan Operasional (${M} bln)` : 'Tunj. Operasional'} value={isEstimate ? mult(res.operasional ?? 0, M) : rp(res.operasional ?? 0)} muted />}
              {(res.tunj_lain ?? 0) > 0 && <P17Row label={isEstimate ? `Tunjangan Lain (${M} bln)` : 'Tunj. Lain'} value={isEstimate ? mult(res.tunj_lain ?? 0, M) : rp(res.tunj_lain ?? 0)} muted />}
              {(res.bpjs?.jkk ?? 0) > 0 && <P17Row label={isEstimate ? `JKK Employer (${M} bln)` : 'JKK Employer'} value={isEstimate ? mult(res.bpjs.jkk, M) : rp(res.bpjs.jkk)} muted />}
              {(res.bpjs?.jkm ?? 0) > 0 && <P17Row label={isEstimate ? `JKM Employer (${M} bln)` : 'JKM Employer'} value={isEstimate ? mult(res.bpjs.jkm, M) : rp(res.bpjs.jkm)} muted />}
              {kesEInBruto && <P17Row label={isEstimate ? `Kes Employer 4% (${M} bln)` : 'Kes Employer 4%'} value={isEstimate ? mult(res.bpjs.kes_e, M) : rp(res.bpjs.kes_e)} muted />}
              {(res.bpjs?.tunj_jht ?? 0) > 0 && <P17Row label={isEstimate ? `Tunj. JHT Karyawan (${M} bln)` : 'Tunj. JHT Karyawan'} value={isEstimate ? mult(res.bpjs.tunj_jht, M) : rp(res.bpjs.tunj_jht)} muted />}
              {(res.bpjs?.tunj_jp ?? 0) > 0 && <P17Row label={isEstimate ? `Tunj. JP Karyawan (${M} bln)` : 'Tunj. JP Karyawan'} value={isEstimate ? mult(res.bpjs.tunj_jp, M) : rp(res.bpjs.tunj_jp)} muted />}
              {(res.bpjs?.tunj_kes ?? 0) > 0 && <P17Row label={isEstimate ? `Tunj. Kes Karyawan (${M} bln)` : 'Tunj. Kes Karyawan'} value={isEstimate ? mult(res.bpjs.tunj_kes, M) : rp(res.bpjs.tunj_kes)} muted />}
              {(res.thr_nominal ?? 0) > 0 && <P17Row label="THR" value={rp(res.thr_nominal ?? 0)} muted />}
              {(res.bonus_nominal ?? 0) > 0 && <P17Row label="Bonus" value={rp(res.bonus_nominal ?? 0)} muted />}
            </div>
            {isGrossup && <P17Row label={`+ Tunjangan PPh ${periodName} (TP)`} value={`+ ${rp(res.tunj_pph ?? 0)}`} accent />}
            <P17Divider />
            <P17Row label="Bruto Setahun" value={rp(res.bs ?? bsBase)} bold />
          </div>
        </div>

        {/* Step 2 — Pengurang */}
        <div className="rounded-lg border border-violet-100 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 border-b border-violet-100">
            <span className="w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0 leading-none">2</span>
            <span className="text-[11px] font-semibold text-violet-700 uppercase tracking-wider">Pengurang</span>
          </div>
          <div className="px-3 py-2.5">
            <P17Row
              label={`Biaya Jabatan (5%, cap ${rp(BIAYA_JAB_MAX * M)})`}
              value={minus(res.bj ?? 0)}
              tooltip={bjTooltip}
            />
            {(res.jht_k_tahunan ?? 0) > 0 && (
              <P17Row
                label={`Iuran JHT Karyawan 2% × ${M} bln`}
                value={minus(res.jht_k_tahunan)}
                tooltip={jhtTooltip}
              />
            )}
            {(res.jp_k_tahunan ?? 0) > 0 && (
              <P17Row
                label={`Iuran JP Karyawan 1% × ${M} bln`}
                value={minus(res.jp_k_tahunan)}
                tooltip={jpTooltip}
              />
            )}
            <p className="text-[10px] text-[var(--text-faint)] italic mt-1.5 leading-relaxed">
              BPJS Kes karyawan (1%) bukan pengurang — hanya JHT &amp; JP per PMK 168/2023 Pasal 10
            </p>
            <P17Divider />
            <P17Row label="Total Pengurang" value={minus(totalPengurang)} bold />
          </div>
        </div>

        {/* Step 3 — Netto → PKP */}
        <div className="rounded-lg border border-violet-100 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 border-b border-violet-100">
            <span className="w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0 leading-none">3</span>
            <span className="text-[11px] font-semibold text-violet-700 uppercase tracking-wider">Netto → PKP</span>
          </div>
          <div className="px-3 py-2.5">
            <P17Row label="Bruto Setahun" value={rp(res.bs ?? bsBase)} muted />
            <P17Row label="− Total Pengurang" value={minus(totalPengurang)} muted />
            <P17Divider />
            <P17Row label="Netto Setahun" value={rp(res.netto ?? 0)} bold />
            <div className="mt-2">
              <P17Row
                label={`− PTKP (${res.status_ptkp ?? ''})`}
                value={minus(res.ptkp ?? 0)}
                tooltip={ptkpTooltip}
              />
            </div>
            <P17Divider />
            <P17Row
              label="PKP (floor ke ribuan)"
              value={rp(finalPkp)}
              bold
              tooltip={pkpTooltip}
            />
          </div>
        </div>

        {/* Step 4 — PPh Pasal 17 (tarif progresif) */}
        <div className="rounded-lg border border-violet-100 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 border-b border-violet-100">
            <span className="w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0 leading-none">4</span>
            <span className="text-[11px] font-semibold text-violet-700 uppercase tracking-wider">
              Tarif Progresif Pasal 17{isGrossup ? ' + Grossup' : ''}
            </span>
          </div>
          <div className="px-3 py-2.5">
            {/* PKP reference at top */}
            <div className="flex items-baseline justify-between mb-2 pb-2 border-b border-violet-100">
              <span className="text-[11px] font-semibold text-violet-700">PKP yang dikenakan tarif</span>
              <span className="font-mono text-[13px] font-bold text-violet-800">{rp(finalPkp)}</span>
            </div>

            {/* Bracket header */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 mb-1 px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Lapisan</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)] text-right">PKP di lapis ini</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)] text-right">Pajak</span>
            </div>

            {/* Bracket rows */}
            {bLines.map((b, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-baseline py-1 px-1 rounded hover:bg-violet-50 transition-colors">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[11px] font-mono font-bold text-violet-600 w-6 shrink-0">{(b.rate * 100).toFixed(0)}%</span>
                  <span className="text-[12px] text-[var(--text-secondary)]">
                    {b.isTop ? `> ${b.loM} jt` : `${b.loM} – ${b.hiM} jt`}
                  </span>
                </div>
                <span className="font-mono text-[12px] text-[var(--text-muted)] text-right">{rp(b.portion)}</span>
                <span className="font-mono text-[12px] font-semibold text-[var(--text-primary)] text-right">{rp(b.tax)}</span>
              </div>
            ))}

            {/* Grossup explanation */}
            {isGrossup && (
              <div className="mt-2.5 rounded-md bg-violet-50 border border-violet-200 px-3 py-2">
                <p className="text-[11px] font-semibold text-violet-700 mb-1.5">Grossup — Tunjangan PPh (TP)</p>
                <div className="flex items-center gap-1.5 font-mono text-[12px] text-violet-900 flex-wrap">
                  <span>TP</span><span className="text-violet-400">=</span>
                  <span>{rp(res.pph_no_grossup ?? 0)}</span><span className="text-violet-400">÷</span>
                  <span>(1 − {marginalPct})</span><span className="text-violet-400">≈</span>
                  <span className="font-bold">{rp(res.tunj_pph_setahun ?? 0)}</span>
                </div>
                <p className="text-[10px] text-violet-500 mt-1 leading-relaxed">
                  PKP masuk lapis {marginalPct} → tarif marginal {marginalPct} → konvergen dalam iterasi
                </p>
              </div>
            )}

            <P17Divider />
            <div className="flex justify-between items-baseline">
              <span className="text-[12px] font-bold text-[var(--text-primary)]">PPh Setahun (Pasal 17)</span>
              <span className="font-mono text-[14px] font-bold text-violet-700">{rp(res.pph_tahunan ?? 0)}</span>
            </div>
            {bLines.length > 1 && (
              <p className="text-[10px] text-[var(--text-faint)] mt-0.5 text-right">
                = {bLines.map(b => rp(b.tax)).join(' + ')}
              </p>
            )}
          </div>
        </div>

        {/* Rekonsiliasi */}
        <div className="rounded-lg bg-violet-50 border border-violet-200 px-4 py-3">
          <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider mb-2.5">Rekonsiliasi</p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-center">
              <p className="text-[10px] text-violet-500 mb-0.5">PPh Setahun</p>
              <p className="font-mono font-bold text-[13px] text-violet-900">{rp(res.pph_tahunan ?? 0)}</p>
            </div>
            <span className="text-violet-400 font-bold text-lg select-none">−</span>
            <div className="text-center">
              <p className="text-[10px] text-violet-500 mb-0.5">{M > 1 ? `PPh Jan–${prevName}` : 'PPh Lalu'}</p>
              <p className="font-mono font-bold text-[13px] text-violet-900">{rp(res.pph_jan_nov ?? 0)}</p>
            </div>
            <span className="text-violet-400 font-bold text-lg select-none">=</span>
            {(() => {
              // Over-withheld: show the honest negative, grossup included.
              // Older saved results lack `lebih_potong` — fall back to refund pair.
              const lebihPotong = (res.lebih_potong ?? (res.is_refund ? res.refund_amount : 0)) || 0;
              const over = lebihPotong > 0;
              return (
                <div className={`text-center rounded-lg px-3 py-1.5 ${over ? 'bg-amber-100 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                  <p className={`text-[10px] mb-0.5 font-medium ${over ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {over ? (res.pph_ditanggung ? '← Lebih setor (grossup)' : '← Refund karyawan') : `PPh ${periodName}`}
                  </p>
                  <p className={`font-mono font-bold text-[14px] ${over ? 'text-amber-800' : 'text-emerald-800'}`}>
                    {over ? `− ${rp(lebihPotong)}` : rp(res.pph ?? 0)}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
});
