'use client';
import { useState } from 'react';
import { TrendingUp, ChevronDown } from 'lucide-react';
import type { ProjResult, ProjRow } from '@/lib/engine/projection';

const BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const BULAN_FULL  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function rpFull(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function rpShort(n: number): string {
  if (n === 0) return '–';
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return (m % 1 === 0 ? String(m) : m.toFixed(1)) + 'jt';
  }
  return Math.round(n / 1_000) + 'rb';
}

function pct(n: number) {
  return n > 0 ? (n * 100).toFixed(1) + '%' : '–';
}

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string;
  color: 'green' | 'red' | 'blue' | 'amber';
}) {
  const s: Record<string, string> = {
    green: 'bg-[var(--green-soft)]  border-[var(--green-border)]  text-[var(--green)]',
    red:   'bg-[var(--red-soft)]    border-[var(--red-border)]    text-[var(--red)]',
    blue:  'bg-[var(--brand-soft)]  border-blue-200              text-[var(--brand)]',
    amber: 'bg-[var(--amber-soft)]  border-[var(--amber-border)] text-[var(--amber)]',
  };
  return (
    <div className={`rounded-xl border p-3 ${s[color]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest opacity-60 leading-none">{label}</p>
      <p className="text-[16px] font-bold mt-1.5 font-mono leading-none">{value}</p>
      {sub && <p className="text-[10px] mt-1 opacity-60 font-mono">{sub}</p>}
    </div>
  );
}

function BLine({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  if (value === 0 && !bold) return null;
  return (
    <div className={`flex items-baseline justify-between gap-3 py-[3px] ${bold ? 'pt-2.5 mt-1 border-t-2 border-[var(--border-default)]' : 'border-b border-[var(--border-subtle)]'}`}>
      <span className={`text-[12px] ${bold ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
        {label}
      </span>
      <span className={`font-mono text-[12px] shrink-0 ${bold ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
        {value === 0 ? '–' : rpFull(value)}
      </span>
    </div>
  );
}

function P17RecLine({ label, value, sub, bold, accent, minus, indent }: {
  label: string; value: number; sub?: string; bold?: boolean; accent?: boolean; minus?: boolean; indent?: boolean;
}) {
  if (value === 0 && !bold) return null;
  return (
    <div className={`flex items-baseline justify-between gap-2 py-[3px] ${bold ? 'pt-2 mt-1 border-t border-violet-200' : 'border-b border-violet-50'} ${indent ? 'pl-3' : ''}`}>
      <span className={`text-[12px] leading-relaxed ${bold ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
        {minus && <span className="text-[var(--text-muted)] mr-1">−</span>}{label}
        {sub && <span className="ml-1.5 text-[10px] text-[var(--text-muted)] font-normal">{sub}</span>}
      </span>
      <span className={`font-mono text-[12px] shrink-0 ml-2 ${bold ? 'font-bold' : 'font-medium'} ${accent ? 'text-violet-700' : minus ? 'text-[var(--red)]' : 'text-[var(--text-primary)]'}`}>
        {rpFull(value)}
      </span>
    </div>
  );
}

function MonthDetail({ row }: { row: ProjRow }) {
  const totalDeductions = row.pot_bpjs_jht + row.pot_bpjs_jp + row.pot_bpjs_kes + row.pot_pph
    + row.kasbon + row.pot_lain + row.alpha_telat;
  const isGrossup = row.tunj_pph > 0;
  const hasP17 = row.isReconciliation && row.p17_bruto_setahun !== undefined;

  // Derived: iuran BPJS TK deductible (JHT + JP karyawan) = bruto - biaya_jab - netto
  const iuranBpjsTk = hasP17
    ? (row.p17_bruto_setahun! - row.p17_biaya_jabatan_setahun! - row.p17_netto_setahun!)
    : 0;
  const ptkpSetahun = hasP17
    ? Math.max(0, row.p17_netto_setahun! - row.p17_pkp_setahun!)
    : 0;

  return (
    <div className="mx-4 mb-2 rounded-xl border border-[var(--border-default)] bg-white overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-default)]">

        {/* LEFT — Penghasilan → Bruto */}
        <div className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Penghasilan</p>
          <BLine label="Gaji Pokok" value={row.gaji_pokok} />
          <BLine label="Tunjangan (Benefit, Kendaraan, dll.)" value={row.allowance_total} />
          <BLine label="THR" value={row.thr_nominal} />
          <BLine label="Bonus" value={row.bonus_nominal} />
          <BLine label="Tunj. BPJS Perusahaan (JKK + JKM + KES)" value={row.tunj_bpjs_employer} />
          <BLine label="Tunj. BPJS Karyawan (ditanggung)" value={row.tunj_karyawan_bpjs} />
          <BLine label="Tunj. PPh 21 (Grossup)" value={row.tunj_pph} />
          <BLine label="Bruto" value={row.bruto} bold />

          {row.bpjs_employer_offslip > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Biaya Perusahaan (Off-slip)</p>
              <BLine label="BPJS JHT + JP Perusahaan" value={row.bpjs_employer_offslip} />
              <BLine label="CTC — Total Biaya" value={row.ctc} bold />
            </div>
          )}
        </div>

        {/* RIGHT — Potongan → THP */}
        <div className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Potongan</p>
          <BLine label="BPJS JHT Karyawan (2%)" value={row.pot_bpjs_jht} />
          <BLine label="BPJS JP Karyawan (1%)" value={row.pot_bpjs_jp} />
          <BLine label="BPJS KES Karyawan (1%)" value={row.pot_bpjs_kes} />
          {!isGrossup && (
            <BLine
              label={`PPh 21${row.ter > 0 ? ` · TER ${pct(row.ter)}` : ' · Pasal 17'}`}
              value={row.pot_pph}
            />
          )}
          <BLine label="Kasbon" value={row.kasbon} />
          <BLine label="Potongan Lain" value={row.pot_lain} />
          <BLine label="Alpha / Telat" value={row.alpha_telat} />
          {isGrossup && totalDeductions === 0 && (
            <p className="text-[12px] text-[var(--text-muted)] italic py-1.5">Tidak ada potongan — PPh ditanggung perusahaan</p>
          )}
          <BLine label="Total Potongan" value={totalDeductions} bold />

          {row.isRefund && (
            <div className="mt-3 rounded-lg bg-[var(--amber-soft)] border border-[var(--amber-border)] px-3 py-2.5">
              <p className="text-[12px] text-[var(--amber)] font-medium">↩ PPh over-withheld — ada restitusi</p>
            </div>
          )}

          <div className="mt-4 pt-3 border-t-2 border-[var(--green-border)]">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--green)]">THP</span>
              <span className="text-[18px] font-bold font-mono text-[var(--green)]">{rpFull(row.thp)}</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Take-home pay · dibawa pulang</p>
          </div>
        </div>

      </div>

      {/* December only — Pasal 17 annual reconciliation */}
      {hasP17 && (
        <div className="border-t border-violet-100 bg-violet-50/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[9px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-full tracking-widest uppercase">P17</span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-violet-700">Rekonsiliasi Pasal 17 — Setahun</p>
            {row.p17_is_estimate && (
              <span className="ml-auto text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">estimasi</span>
            )}
          </div>
          <div className="max-w-sm">
            {/* Where does Bruto Setahun come from? Show the sum, not just the total. */}
            {row.p17_is_estimate ? (
              <P17RecLine label="Bruto Setahun" value={row.p17_bruto_setahun!}
                sub={`estimasi · bulan ini × ${(row.p17_months_counted ?? 11) + 1} bln`} bold />
            ) : (
              <>
                <P17RecLine label="Akumulasi bln sebelumnya" value={row.p17_akum_bruto ?? 0}
                  sub={`${row.p17_months_counted ?? 11} bln`} indent />
                <P17RecLine label="Bruto bulan ini" value={row.bruto} indent />
                <P17RecLine label="Bruto Setahun" value={row.p17_bruto_setahun!} bold />
              </>
            )}
            <P17RecLine label="Biaya Jabatan" value={row.p17_biaya_jabatan_setahun!} sub="maks 500rb/bln" minus indent />
            {iuranBpjsTk > 0 && (
              <P17RecLine label="Iuran BPJS TK" value={iuranBpjsTk} sub="JHT 2% + JP 1%" minus indent />
            )}
            <P17RecLine label="Netto Setahun" value={row.p17_netto_setahun!} bold />
            <P17RecLine label="PTKP" value={ptkpSetahun} minus indent />
            <P17RecLine label="PKP Setahun" value={row.p17_pkp_setahun!} bold accent />
            <P17RecLine label="PPh Pasal 17 Setahun" value={row.p17_pph_setahun!} sub="progresif 5–35%" bold />
            <P17RecLine label="PPh Jan–Nov" value={row.p17_pph_jan_nov!} sub="sudah dipotong" minus indent />
            <P17RecLine label="PPh Desember" value={row.p17_pph_desember!} bold accent />
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjectionTable({
  projection, gajiPokok, thrBulan, thrPct, bonusBulan, bonusPct, emptyMessage, title, subtitle,
}: {
  projection: ProjResult | null;
  gajiPokok: number;
  /** Single-input callers pass these for the "Asumsi" footer. Omit in the
   *  monthly ledger — the footer is then derived from the per-month rows. */
  thrBulan?: number; thrPct?: number;
  bonusBulan?: number; bonusPct?: number;
  emptyMessage?: string;
  title?: string;
  subtitle?: string;
}) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  if (!projection) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-12 text-center shadow-[var(--shadow-sm)]">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center mx-auto mb-3">
          <TrendingUp size={20} className="text-[var(--text-muted)]" />
        </div>
        <p className="text-[14px] font-semibold text-[var(--text-secondary)] mb-1">Proyeksi Tahunan</p>
        <p className="text-[13px] text-[var(--text-muted)]">{emptyMessage ?? 'Masukkan gaji pokok untuk simulasi 12 bulan'}</p>
      </div>
    );
  }

  const maxThp = Math.max(...projection.rows.map(r => r.thp));
  const regularRow =
    projection.rows.find(r => r.aktif && !r.hasThr && !r.hasBonus && !r.isReconciliation)
    ?? projection.rows.find(r => r.aktif)
    ?? projection.rows[0];
  const effectiveRate = projection.total.bruto > 0 ? projection.total.pph / projection.total.bruto : 0;
  const hasCTC = projection.rows.some(r => r.ctc > 0);

  // Monthly-ledger mode: when the single-input THR/bonus props are omitted,
  // derive the assumptions footer from the actual per-month rows.
  const derivedFooter = thrBulan == null;
  const thrMonths = projection.rows.filter(r => r.hasThr).map(r => BULAN_FULL[r.bulan - 1]);
  const bonusMonths = projection.rows.filter(r => r.hasBonus).map(r => BULAN_FULL[r.bulan - 1]);
  const thrTotal = projection.rows.reduce((s, r) => s + r.thr_nominal, 0);
  const bonusTotal = projection.rows.reduce((s, r) => s + r.bonus_nominal, 0);

  return (
    <div className="space-y-3">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="THP / bulan" value={rpShort(regularRow.thp)} sub={rpFull(regularRow.thp)} color="green" />
        <StatCard label="PPh 21 / tahun" value={rpShort(projection.total.pph)} sub={rpFull(projection.total.pph)} color="red" />
        {hasCTC ? (
          <StatCard label="CTC / bulan" value={rpShort(regularRow.ctc)} sub="biaya total perusahaan" color="blue" />
        ) : (
          <StatCard label="Efektif Rate" value={pct(effectiveRate)} sub="PPh ÷ Bruto setahun" color="amber" />
        )}
        <StatCard label="TER Rate" value={pct(regularRow.ter)} sub="bulan normal" color="amber" />
      </div>

      {/* Timeline */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl overflow-hidden shadow-[var(--shadow-sm)]">

        {/* Panel header */}
        <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[var(--brand-soft)] flex items-center justify-center shrink-0">
            <TrendingUp size={14} className="text-[var(--brand)]" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)] leading-none">{title ?? 'Proyeksi 12 Bulan'}</h2>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{subtitle ?? `${new Date().getFullYear()} · klik baris untuk rincian breakdown`}</p>
          </div>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)]">
          <span className="w-8 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider shrink-0">Bln</span>
          <span className="w-14 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider shrink-0">Tag</span>
          <span className="flex-1 text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">THP — proporsi</span>
          <span className="w-20 text-right text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider shrink-0">THP</span>
          <span className="w-16 text-right text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider shrink-0">PPh 21</span>
          <span className="w-12 text-right text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider shrink-0 hidden sm:block">TER</span>
          <span className="w-4 shrink-0"></span>
        </div>

        {/* Month accordion rows */}
        <div className="divide-y divide-[var(--border-subtle)]">
          {projection.rows.map((row) => {
            const isSelected = selectedMonth === row.bulan;

            // Inactive month (mid-year start/exit) — render muted, not expandable.
            if (!row.aktif) {
              return (
                <div key={row.bulan} className="flex items-center gap-3 px-4 py-2.5 opacity-60">
                  <span className="w-8 text-[13px] font-medium text-[var(--text-faint)] shrink-0">
                    {BULAN_SHORT[row.bulan - 1]}
                  </span>
                  <div className="w-14 flex gap-1 shrink-0">
                    <span className="text-[9px] font-bold text-[var(--text-muted)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded-full">Nonaktif</span>
                  </div>
                  <div className="flex-1 h-3.5" />
                  <span className="w-20 text-right font-mono text-[13px] text-[var(--text-faint)] shrink-0">–</span>
                  <span className="w-16 text-right font-mono text-[12px] text-[var(--text-faint)] shrink-0">–</span>
                  <span className="w-12 text-right text-[11px] text-[var(--text-faint)] hidden sm:block shrink-0">–</span>
                  <span className="w-4 shrink-0" />
                </div>
              );
            }

            const barCls = row.hasThr
              ? 'bg-amber-300'
              : row.hasBonus
                ? 'bg-blue-300'
                : row.isReconciliation
                  ? 'bg-violet-300'
                  : 'bg-emerald-300';
            const hoverCls = !isSelected
              ? row.hasThr     ? 'hover:bg-amber-50/60'
              : row.hasBonus   ? 'hover:bg-blue-50/60'
              : row.isReconciliation ? 'hover:bg-violet-50/60'
              : 'hover:bg-[var(--bg-subtle)]'
              : '';

            return (
              <div key={row.bulan} className={`transition-colors ${isSelected ? 'bg-[var(--brand-soft)]' : ''}`}>
                <button
                  type="button"
                  onClick={() => setSelectedMonth(s => s === row.bulan ? null : row.bulan)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors ${hoverCls}`}
                >
                  {/* Month label */}
                  <span className="w-8 text-[13px] font-medium text-[var(--text-secondary)] shrink-0">
                    {BULAN_SHORT[row.bulan - 1]}
                  </span>

                  {/* Badges */}
                  <div className="w-14 flex gap-1 shrink-0">
                    {row.hasThr && <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">THR</span>}
                    {row.hasBonus && <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">BON</span>}
                    {row.isReconciliation && !row.hasThr && !row.hasBonus && (
                      <span className="text-[9px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-full">P17</span>
                    )}
                  </div>

                  {/* Proportional THP bar */}
                  <div className="flex-1 h-3.5 bg-[var(--bg-subtle)] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barCls} rounded-full transition-all duration-500 ease-out`}
                      style={{ width: `${maxThp > 0 ? (row.thp / maxThp) * 100 : 0}%` }}
                    />
                  </div>

                  {/* THP */}
                  <span className="w-20 text-right font-mono font-semibold text-[13px] text-[var(--green)] shrink-0">
                    {rpShort(row.thp)}
                  </span>

                  {/* PPh */}
                  <div className="w-16 text-right shrink-0">
                    {row.isRefund
                      ? <span className="text-[10px] font-semibold text-amber-600">↩ refund</span>
                      : <span className="font-mono text-[12px] text-[var(--red)]">{rpShort(row.pph)}</span>
                    }
                  </div>

                  {/* TER */}
                  <span className="w-12 text-right text-[11px] text-[var(--text-faint)] hidden sm:block shrink-0">
                    {row.ter > 0 ? pct(row.ter) : '–'}
                  </span>

                  {/* Chevron */}
                  <ChevronDown
                    size={14}
                    className={`w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${isSelected ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Expanded breakdown */}
                {isSelected && <MonthDetail row={row} />}
              </div>
            );
          })}
        </div>

        {/* Total row */}
        <div className="flex items-center gap-3 px-4 py-3 border-t-2 border-[var(--border-default)] bg-[var(--bg-subtle)]">
          <span className="w-8 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider shrink-0">Total</span>
          <span className="w-14 shrink-0"></span>
          <span className="flex-1"></span>
          <span className="w-20 text-right font-mono font-bold text-[var(--green)] shrink-0">{rpShort(projection.total.thp)}</span>
          <span className="w-16 text-right font-mono font-bold text-[var(--red)] shrink-0">{rpShort(projection.total.pph)}</span>
          <span className="w-12 hidden sm:block shrink-0"></span>
          <span className="w-4 shrink-0"></span>
        </div>

        {/* Assumptions footer */}
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2">
            {derivedFooter ? 'Ringkasan' : 'Asumsi'}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[12px] text-[var(--text-muted)]">
            {derivedFooter ? (
              <>
                {thrTotal > 0 && (
                  <span>
                    <span className="font-semibold text-amber-600">THR</span>{' '}
                    {thrMonths.join(', ')}
                    <span className="ml-1.5 font-semibold text-[var(--text-secondary)] font-mono">{rpFull(thrTotal)}</span>
                  </span>
                )}
                {bonusTotal > 0 && (
                  <span>
                    <span className="font-semibold text-blue-600">Bonus</span>{' '}
                    {bonusMonths.join(', ')}
                    <span className="ml-1.5 font-semibold text-[var(--text-secondary)] font-mono">{rpFull(bonusTotal)}</span>
                  </span>
                )}
              </>
            ) : (
              <>
                <span>
                  <span className="font-semibold text-amber-600">THR</span>{' '}
                  {BULAN_FULL[thrBulan! - 1]} · {thrPct}% gaji
                  {gajiPokok > 0 && (
                    <span className="ml-1.5 font-semibold text-[var(--text-secondary)] font-mono">{rpFull(Math.round(gajiPokok * thrPct! / 100))}</span>
                  )}
                </span>
                <span>
                  <span className="font-semibold text-blue-600">Bonus</span>{' '}
                  {BULAN_FULL[bonusBulan! - 1]} · {bonusPct}% gaji
                  {gajiPokok > 0 && bonusPct! > 0 && (
                    <span className="ml-1.5 font-semibold text-[var(--text-secondary)] font-mono">{rpFull(Math.round(gajiPokok * bonusPct! / 100))}</span>
                  )}
                </span>
              </>
            )}
            {hasCTC && (
              <span>
                <span className="font-semibold text-[var(--brand)]">CTC / tahun</span>{' '}
                <span className="font-semibold text-[var(--text-secondary)] font-mono">{rpFull(projection.total.ctc)}</span>
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
