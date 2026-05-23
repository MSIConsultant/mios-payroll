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

export type ProjRow = {
  bulan: number;
  hasThr: boolean;
  hasBonus: boolean;
  bruto: number;
  pph: number;
  thp: number;
  isRefund: boolean;
  ter: number;
  ctc: number;
  bpjs_employer: number;
  bpjs_karyawan: number;
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
      bpjs_basis: (p.bpjsBasis ?? 0) > 0 ? p.bpjsBasis : undefined,
      kes_employer_in_bruto: p.kesEmployerInBruto,
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
      ter: number;
      bpjs: { employer_total: number; employer_offslip: number; karyawan_potong: number };
      proyeksi: { pph_setahun: number };
    };
    const isRefund = bulan === 12 && (res.proyeksi.pph_setahun - pph_jan_nov) < 0;
    rows.push({
      bulan, hasThr: thr > 0, hasBonus: bonus > 0,
      bruto: res.bruto, pph: res.pph, thp: res.thp, isRefund,
      ter: res.ter ?? 0,
      ctc: res.bruto + (res.bpjs?.employer_offslip ?? 0),
      bpjs_employer: res.bpjs?.employer_total ?? 0,
      bpjs_karyawan: res.bpjs?.karyawan_potong ?? 0,
    });
    if (bulan < 12) { akum_bruto += res.bruto; pph_jan_nov += res.pph; }
  }

  const total = rows.reduce(
    (acc, r) => ({ bruto: acc.bruto + r.bruto, pph: acc.pph + r.pph, thp: acc.thp + r.thp, ctc: acc.ctc + r.ctc }),
    { bruto: 0, pph: 0, thp: 0, ctc: 0 },
  );

  return { rows, total };
}
