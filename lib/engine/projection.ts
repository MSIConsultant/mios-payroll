import { calculateMonthlySalary } from './payroll';
import type { KaryawanTetap } from './payroll';

export type ProjParams = {
  gajiPokok: number;
  benefit: number;
  kendaraan: number;
  pulsa: number;
  operasional: number;
  tunjLain: number;
  statusPtkp: string;
  punyaNpwp: boolean;
  jkkRate: number;
  ikutJht: boolean;
  ikutJp: boolean;
  ikutJkp: boolean;
  tanggungJhtK: boolean;
  tanggungJpK: boolean;
  ikutKes: boolean;
  tanggungKesK: boolean;
  pphDitanggung: boolean;
  bpjsBasis?: number;
  kesEmployerInBruto?: boolean;
  thrBulan: number;
  thrPct: number;
  bonusBulan: number;
  bonusPct: number;
};

export const DEFAULT_PROJ_PARAMS: ProjParams = {
  gajiPokok: 0,
  benefit: 0, kendaraan: 0, pulsa: 0, operasional: 0, tunjLain: 0,
  statusPtkp: 'TK0',
  punyaNpwp: true,
  jkkRate: 0.0024,
  ikutJht: true, ikutJp: true, ikutJkp: true,
  tanggungJhtK: true, tanggungJpK: true,
  ikutKes: true, tanggungKesK: true,
  pphDitanggung: true,
  bpjsBasis: 0,
  thrBulan: 3, thrPct: 100,
  bonusBulan: 8, bonusPct: 50,
};

/**
 * Per-month override for the monthly ledger model (`runMonthlyProjection`).
 * Any annual default field can be overridden for a single month (e.g. a
 * mid-year raise changes `gajiPokok`; marriage changes `statusPtkp`). THR,
 * bonus and deductions are nominal rupiah for that specific month. `aktif`
 * false means the employee did not work that month (mid-year start/exit).
 */
export type MonthOverride = Partial<ProjParams> & {
  thr?: number;
  bonus?: number;
  kasbon?: number;
  pot_lain?: number;
  aktif?: boolean;
};

export type ProjRow = {
  bulan: number;
  aktif: boolean;
  /** This is the Pasal 17 reconciliation month (December, or last active month). */
  isReconciliation: boolean;
  hasThr: boolean;
  hasBonus: boolean;
  isRefund: boolean;
  ter: number;
  // Totals
  bruto: number;
  pph: number;
  thp: number;
  ctc: number;
  bpjs_employer: number;
  bpjs_karyawan: number;
  // Income breakdown (for per-month detail view)
  gaji_pokok: number;
  allowance_total: number;
  thr_nominal: number;
  bonus_nominal: number;
  tunj_bpjs_employer: number;
  tunj_karyawan_bpjs: number;
  tunj_pph: number;
  // Deduction breakdown
  pot_bpjs_jht: number;
  pot_bpjs_jp: number;
  pot_bpjs_kes: number;
  pot_pph: number;
  kasbon: number;
  pot_lain: number;
  alpha_telat: number;
  bpjs_employer_offslip: number;
  // Pasal 17 reconciliation (only populated on the reconciliation month)
  p17_bruto_setahun?: number;
  p17_biaya_jabatan_setahun?: number;
  p17_netto_setahun?: number;
  p17_pkp_setahun?: number;
  p17_pph_setahun?: number;
  p17_pph_jan_nov?: number;
  p17_pph_desember?: number;
  p17_is_estimate?: boolean;
};

export type ProjResult = {
  rows: ProjRow[];
  total: { bruto: number; pph: number; thp: number; ctc: number };
};

type EngineResult = {
  bruto: number; pph: number; thp: number;
  ter: number | null;
  gaji_pokok: number;
  allowance_total: number;
  thr_nominal: number;
  bonus_nominal: number;
  tunj_pph: number;
  pot_pph: number;
  bpjs: {
    employer_total: number; employer_offslip: number; employer_in_bruto: number;
    karyawan_potong: number; karyawan_tunj: number;
    pot_jht: number; pot_jp: number; pot_kes: number;
  };
  proyeksi: {
    pph_setahun: number;
    bruto_setahun: number;
    biaya_jabatan_setahun: number;
    netto_setahun: number;
    pkp_setahun: number;
    pph_jan_nov_proyeksi: number;
    pph_desember_proyeksi: number;
    is_estimate?: boolean;
  };
};

type RowOpts = {
  thr: number;
  bonus: number;
  kasbon?: number;
  pot_lain?: number;
  alpha_telat?: number;
  akum_bruto: number;
  pph_jan_nov: number;
  isLastMonth?: boolean;
  months_in_year?: number;
};

/**
 * Compute one month through the real `calculateMonthlySalary` engine and map
 * its output to a `ProjRow`. Shared by both `runProjection` (single-input
 * yearly forecast) and `runMonthlyProjection` (per-month editable ledger), so
 * both surfaces produce identical math for identical inputs.
 */
function computeRow(p: ProjParams, bulan: number, tahun: number, o: RowOpts): ProjRow {
  const kasbon = o.kasbon ?? 0;
  const pot_lain = o.pot_lain ?? 0;
  const alpha_telat = o.alpha_telat ?? 0;
  const isReconciliation = o.isLastMonth === true || bulan === 12;

  const k: KaryawanTetap = {
    nama: '', nik: '', npwp: '', divisi: '', jenis_kelamin: 'L',
    bulan, tahun,
    status_ptkp: p.statusPtkp, punya_npwp: p.punyaNpwp,
    gaji_pokok: p.gajiPokok, benefit: p.benefit, kendaraan: p.kendaraan,
    pulsa: p.pulsa, operasional: p.operasional, tunj_lain: p.tunjLain,
    bpjs_basis: (p.bpjsBasis ?? 0) > 0 ? p.bpjsBasis : undefined,
    kes_employer_in_bruto: p.kesEmployerInBruto,
    thr: o.thr, bonus: o.bonus,
    ikut_jht: p.ikutJht, ikut_jp: p.ikutJp, ikut_jkp: p.ikutJkp,
    jkk_rate: p.jkkRate,
    tanggung_jht_k: p.tanggungJhtK, tanggung_jp_k: p.tanggungJpK,
    ikut_kes: p.ikutKes, tanggung_kes_k: p.tanggungKesK,
    pph_ditanggung: p.pphDitanggung,
    kasbon, alpha_telat, pot_lain,
    pph_jan_nov: o.pph_jan_nov, akum_bruto: o.akum_bruto,
    ...(o.isLastMonth ? { isLastMonth: true, months_in_year: o.months_in_year } : {}),
  };

  const res = calculateMonthlySalary(k) as EngineResult;
  const isRefund = isReconciliation && (res.proyeksi.pph_setahun - o.pph_jan_nov) < 0;

  return {
    bulan, aktif: true, isReconciliation,
    hasThr: o.thr > 0, hasBonus: o.bonus > 0,
    isRefund, ter: res.ter ?? 0,
    bruto: res.bruto, pph: res.pph, thp: res.thp,
    ctc: res.bruto + (res.bpjs?.employer_offslip ?? 0),
    bpjs_employer: res.bpjs?.employer_total ?? 0,
    bpjs_karyawan: res.bpjs?.karyawan_potong ?? 0,
    gaji_pokok: res.gaji_pokok ?? p.gajiPokok,
    allowance_total: res.allowance_total ?? 0,
    thr_nominal: res.thr_nominal ?? o.thr,
    bonus_nominal: res.bonus_nominal ?? o.bonus,
    tunj_bpjs_employer: res.bpjs?.employer_in_bruto ?? 0,
    tunj_karyawan_bpjs: res.bpjs?.karyawan_tunj ?? 0,
    tunj_pph: res.tunj_pph ?? 0,
    pot_bpjs_jht: res.bpjs?.pot_jht ?? 0,
    pot_bpjs_jp: res.bpjs?.pot_jp ?? 0,
    pot_bpjs_kes: res.bpjs?.pot_kes ?? 0,
    pot_pph: res.pot_pph ?? 0,
    kasbon, pot_lain, alpha_telat,
    bpjs_employer_offslip: res.bpjs?.employer_offslip ?? 0,
    ...(isReconciliation ? {
      p17_bruto_setahun: res.proyeksi.bruto_setahun,
      p17_biaya_jabatan_setahun: res.proyeksi.biaya_jabatan_setahun,
      p17_netto_setahun: res.proyeksi.netto_setahun,
      p17_pkp_setahun: res.proyeksi.pkp_setahun,
      p17_pph_setahun: res.proyeksi.pph_setahun,
      p17_pph_jan_nov: res.proyeksi.pph_jan_nov_proyeksi,
      p17_pph_desember: res.proyeksi.pph_desember_proyeksi,
      p17_is_estimate: res.proyeksi.is_estimate,
    } : {}),
  };
}

function emptyRow(bulan: number): ProjRow {
  return {
    bulan, aktif: false, isReconciliation: false,
    hasThr: false, hasBonus: false, isRefund: false, ter: 0,
    bruto: 0, pph: 0, thp: 0, ctc: 0, bpjs_employer: 0, bpjs_karyawan: 0,
    gaji_pokok: 0, allowance_total: 0, thr_nominal: 0, bonus_nominal: 0,
    tunj_bpjs_employer: 0, tunj_karyawan_bpjs: 0, tunj_pph: 0,
    pot_bpjs_jht: 0, pot_bpjs_jp: 0, pot_bpjs_kes: 0, pot_pph: 0,
    kasbon: 0, pot_lain: 0, alpha_telat: 0, bpjs_employer_offslip: 0,
  };
}

function sumTotals(rows: ProjRow[]): ProjResult['total'] {
  return rows.reduce(
    (acc, r) => ({ bruto: acc.bruto + r.bruto, pph: acc.pph + r.pph, thp: acc.thp + r.thp, ctc: acc.ctc + r.ctc }),
    { bruto: 0, pph: 0, thp: 0, ctc: 0 },
  );
}

/**
 * Single-input yearly forecast: the same parameters applied to every month,
 * with THR/bonus dropped into one chosen month as a % of gaji. Used by the
 * employee-detail and new-employee "what would a year cost" previews.
 */
export function runProjection(p: ProjParams): ProjResult | null {
  if (p.gajiPokok === 0) return null;
  const tahun = new Date().getFullYear();
  const rows: ProjRow[] = [];
  let akum_bruto = 0;
  let pph_jan_nov = 0;

  for (let bulan = 1; bulan <= 12; bulan++) {
    const thr   = bulan === p.thrBulan   ? Math.round(p.gajiPokok * p.thrPct / 100)   : 0;
    const bonus = bulan === p.bonusBulan ? Math.round(p.gajiPokok * p.bonusPct / 100) : 0;
    const row = computeRow(p, bulan, tahun, {
      thr, bonus, akum_bruto, pph_jan_nov,
      isLastMonth: bulan === 12, months_in_year: bulan === 12 ? 12 : undefined,
    });
    rows.push(row);
    if (bulan < 12) { akum_bruto += row.bruto; pph_jan_nov += row.pph; }
  }

  return { rows, total: sumTotals(rows) };
}

/**
 * Real 12-month ledger: each month resolves `{ ...annual, ...override }` and is
 * computed individually from its own actual inputs. `akum_bruto` / `pph_jan_nov`
 * accumulate from real prior active months, so the December (or last active
 * month) Pasal 17 reconciliation runs on real data — never the estimate
 * fallback. No month is extrapolated from another.
 */
export function runMonthlyProjection(
  annual: ProjParams,
  overrides: Record<number, MonthOverride> = {},
): ProjResult | null {
  const tahun = new Date().getFullYear();

  const active: number[] = [];
  for (let b = 1; b <= 12; b++) {
    if (overrides[b]?.aktif !== false) active.push(b);
  }
  if (active.length === 0) return null;

  const lastActive = active[active.length - 1];
  const monthsInYear = active.length;

  const rows: ProjRow[] = [];
  let akum_bruto = 0;
  let pph_jan_nov = 0;

  for (let bulan = 1; bulan <= 12; bulan++) {
    if (overrides[bulan]?.aktif === false) {
      rows.push(emptyRow(bulan));
      continue;
    }
    const ov = overrides[bulan] ?? {};
    // Extra event keys (thr/bonus/kasbon/pot_lain/aktif) on the spread are
    // ignored by computeRow, which reads THR/bonus/deductions from opts.
    const p: ProjParams = { ...annual, ...ov };
    const isLast = bulan === lastActive;

    const row = computeRow(p, bulan, tahun, {
      thr: ov.thr ?? 0, bonus: ov.bonus ?? 0, kasbon: ov.kasbon ?? 0, pot_lain: ov.pot_lain ?? 0,
      akum_bruto, pph_jan_nov,
      isLastMonth: isLast, months_in_year: isLast ? monthsInYear : undefined,
    });
    rows.push(row);
    if (!isLast) { akum_bruto += row.bruto; pph_jan_nov += row.pph; }
  }

  const total = sumTotals(rows);
  if (total.bruto === 0) return null;
  return { rows, total };
}
