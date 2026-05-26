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
  thrBulan: 3, thrPct: 100,
  bonusBulan: 8, bonusPct: 50,
};

export type ProjRow = {
  bulan: number;
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
  bpjs_employer_offslip: number;
};

export type ProjResult = {
  rows: ProjRow[];
  total: { bruto: number; pph: number; thp: number; ctc: number };
};

export function runProjection(p: ProjParams): ProjResult | null {
  if (p.gajiPokok === 0) return null;
  const tahun = new Date().getFullYear();
  const rows: ProjRow[] = [];
  let akum_bruto = 0;
  let pph_jan_nov = 0;

  for (let bulan = 1; bulan <= 12; bulan++) {
    const thr   = bulan === p.thrBulan   ? Math.round(p.gajiPokok * p.thrPct / 100)   : 0;
    const bonus = bulan === p.bonusBulan ? Math.round(p.gajiPokok * p.bonusPct / 100) : 0;
    const k: KaryawanTetap = {
      nama: '', nik: '', npwp: '', divisi: '', jenis_kelamin: 'L',
      bulan, tahun,
      status_ptkp: p.statusPtkp, punya_npwp: p.punyaNpwp,
      gaji_pokok: p.gajiPokok, benefit: p.benefit, kendaraan: p.kendaraan,
      pulsa: p.pulsa, operasional: p.operasional, tunj_lain: p.tunjLain,
      thr, bonus,
      ikut_jht: p.ikutJht, ikut_jp: p.ikutJp, ikut_jkp: p.ikutJkp,
      jkk_rate: p.jkkRate,
      tanggung_jht_k: p.tanggungJhtK, tanggung_jp_k: p.tanggungJpK,
      ikut_kes: p.ikutKes, tanggung_kes_k: p.tanggungKesK,
      pph_ditanggung: p.pphDitanggung,
      kasbon: 0, alpha_telat: 0, pot_lain: 0,
      pph_jan_nov, akum_bruto,
    };
    const res = calculateMonthlySalary(k) as {
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
      proyeksi: { pph_setahun: number };
    };
    const isRefund = bulan === 12 && (res.proyeksi.pph_setahun - pph_jan_nov) < 0;
    rows.push({
      bulan, hasThr: thr > 0, hasBonus: bonus > 0,
      isRefund, ter: res.ter ?? 0,
      bruto: res.bruto, pph: res.pph, thp: res.thp,
      ctc: res.bruto + (res.bpjs?.employer_offslip ?? 0),
      bpjs_employer: res.bpjs?.employer_total ?? 0,
      bpjs_karyawan: res.bpjs?.karyawan_potong ?? 0,
      gaji_pokok: res.gaji_pokok ?? p.gajiPokok,
      allowance_total: res.allowance_total ?? 0,
      thr_nominal: res.thr_nominal ?? thr,
      bonus_nominal: res.bonus_nominal ?? bonus,
      tunj_bpjs_employer: res.bpjs?.employer_in_bruto ?? 0,
      tunj_karyawan_bpjs: res.bpjs?.karyawan_tunj ?? 0,
      tunj_pph: res.tunj_pph ?? 0,
      pot_bpjs_jht: res.bpjs?.pot_jht ?? 0,
      pot_bpjs_jp: res.bpjs?.pot_jp ?? 0,
      pot_bpjs_kes: res.bpjs?.pot_kes ?? 0,
      pot_pph: res.pot_pph ?? 0,
      bpjs_employer_offslip: res.bpjs?.employer_offslip ?? 0,
    });
    if (bulan < 12) { akum_bruto += res.bruto; pph_jan_nov += res.pph; }
  }

  const total = rows.reduce(
    (acc, r) => ({ bruto: acc.bruto + r.bruto, pph: acc.pph + r.pph, thp: acc.thp + r.thp, ctc: acc.ctc + r.ctc }),
    { bruto: 0, pph: 0, thp: 0, ctc: 0 },
  );

  return { rows, total };
}
