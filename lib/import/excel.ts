/**
 * Shared Excel-import primitives. Used by both the single-workbook wizard
 * (`/import/new`) and the bulk uploader (`/import/bulk`).
 *
 * Parsers target the accountant's standard monthly workbook format:
 *   - Sheet "01" .. "12" holds tetap rows; data starts row 5 (rows 1-4 are
 *     merged headers).
 *   - A "HARIAN" sheet holds harian rows; data starts row 2.
 *
 * Each parser returns ParsedEmp rows with both the Excel-declared totals
 * (excel_bruto / excel_pph / excel_thp) and the inputs needed to re-run the
 * MIOS engine for verification (gaji_pokok, BPJS flags, etc.).
 */

import * as XLSX from 'xlsx';
import { calculateMonthlySalary, calculateFreelance } from '@/lib/engine/payroll';

export interface ParsedEmp {
  nik: string;
  nama: string;
  divisi: string;
  npwp: string;
  punya_npwp: boolean;
  status_ptkp: string;
  jenis_kelamin: string;
  gaji_pokok: number;
  benefit: number;
  kendaraan: number;
  pulsa: number;
  operasional: number;
  jkk_rate: number;
  ikut_jht: boolean;
  ikut_jp: boolean;
  ikut_kes: boolean;
  jenis_karyawan: 'tetap' | 'tidak_tetap_harian';
  upah_harian: number;
  tunj_pph: number;
  excel_bruto: number;
  excel_pph: number;
  excel_thp: number;
  _valid: boolean;
  _errors: string[];
}

export const PTKP_VALID = ['TK0', 'TK1', 'TK2', 'TK3', 'K0', 'K1', 'K2', 'K3'];
export const JKK_RATES = [0.0024, 0.0054, 0.0089, 0.0127, 0.0174];

export function closestJKK(rate: number): number {
  if (rate <= 0) return 0.0024;
  return JKK_RATES.reduce((p, c) => (Math.abs(c - rate) < Math.abs(p - rate) ? c : p));
}

export function parseTetap(ws: any): ParsedEmp[] {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  const out: ParsedEmp[] = [];
  for (let r = 4; r <= range.e.r; r++) {
    const g = (c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v ?? null;
    const nama = String(g(3) ?? '').trim();
    if (!nama || nama.length < 2) continue;
    const nik = String(g(2) ?? '').trim().replace(/\D/g, '');
    const punya_npwp = String(g(0) ?? '').toUpperCase() === 'NPWP';
    const ptkp = String(g(11) ?? '').trim().toUpperCase();
    const gaji = Number(g(14)) || 0;
    const jkk_amt = Number(g(15)) || 0;
    const jkk_rate = gaji > 0 ? closestJKK(jkk_amt / gaji) : 0.0024;
    const errs: string[] = [];
    if (nik.length < 8) errs.push('NIK tidak valid');
    if (!PTKP_VALID.includes(ptkp)) errs.push(`PTKP tidak dikenal: ${ptkp}`);
    if (gaji <= 0) errs.push('Gaji tidak terbaca');
    out.push({
      nik, nama,
      divisi: String(g(4) ?? '').trim(),
      npwp: String(g(7) ?? '').trim(),
      punya_npwp,
      status_ptkp: PTKP_VALID.includes(ptkp) ? ptkp : 'TK0',
      jenis_kelamin: String(g(52) ?? '').trim().toUpperCase() === 'P' ? 'P' : 'L',
      gaji_pokok: gaji,
      benefit: Number(g(21)) || 0,
      kendaraan: Number(g(22)) || 0,
      pulsa: Number(g(23)) || 0,
      operasional: Number(g(24)) || 0,
      jkk_rate,
      ikut_jht: (Number(g(17)) || 0) > 0,
      ikut_jp: (Number(g(18)) || 0) > 0,
      ikut_kes: (Number(g(19)) || 0) > 0,
      jenis_karyawan: 'tetap',
      upah_harian: 0,
      tunj_pph: Number(g(20)) || 0,
      excel_thp: Number(g(8)) || 0,
      excel_bruto: Number(g(9)) || 0,
      excel_pph: Number(g(10)) || 0,
      _valid: errs.length === 0,
      _errors: errs,
    });
  }
  return out;
}

export function parseHarian(ws: any): ParsedEmp[] {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  const out: ParsedEmp[] = [];
  for (let r = 1; r <= range.e.r; r++) {
    const g = (c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v ?? null;
    if (!g(2) || isNaN(Number(g(2)))) continue;
    const nama = String(g(5) ?? '').trim();
    if (!nama || nama.length < 2) continue;
    const nik = String(g(4) ?? '').trim().replace(/\D/g, '');
    const ptkp = String(g(6) ?? '').trim().toUpperCase();
    const errs: string[] = [];
    if (nik.length < 8) errs.push('NIK tidak valid');
    const bruto = Number(g(10)) || 0;
    out.push({
      nik, nama,
      divisi: '', npwp: '', punya_npwp: false,
      status_ptkp: PTKP_VALID.includes(ptkp) ? ptkp : 'TK0',
      jenis_kelamin: 'L', gaji_pokok: 0, benefit: 0, kendaraan: 0,
      pulsa: 0, operasional: 0, jkk_rate: 0.0024,
      ikut_jht: false, ikut_jp: false, ikut_kes: false,
      jenis_karyawan: 'tidak_tetap_harian',
      upah_harian: bruto > 0 ? Math.round(bruto / 22) : 0,
      tunj_pph: 0,
      excel_bruto: bruto,
      excel_pph: Number(g(11)) || 0,
      excel_thp: Number(g(12)) || 0,
      _valid: errs.length === 0,
      _errors: errs,
    });
  }
  return out;
}

export interface ReconcileResult {
  engine_bruto: number;
  engine_pph: number;
  engine_thp: number;
  diff_pct: number;
  has_diff: boolean;
  full_result: Record<string, any>;
}

export function reconcileEmployee(
  emp: ParsedEmp,
  bulan: number,
  tahun: number,
): ReconcileResult {
  try {
    let result: any = {};
    const base = {
      ...emp,
      bulan, tahun,
      tunj_lain: 0, kasbon: 0, alpha_telat: 0, pot_lain: 0,
      thr: 0, bonus: 0, pph_jan_nov: 0, akum_bruto: 0,
      ikut_jkp: false,
      tanggung_jht_k: emp.ikut_jht,
      tanggung_jp_k: emp.ikut_jp,
      tanggung_kes_k: emp.ikut_kes,
      pph_ditanggung: emp.tunj_pph > 0,
    } as any;

    if (emp.jenis_karyawan === 'tetap') {
      result = calculateMonthlySalary(base);
    } else {
      result = calculateFreelance({
        ...emp,
        mode: 'harian' as const,
        upah_harian: emp.upah_harian,
        hari_kerja: 22,
        ikut_bpjs_tk: false,
        ikut_kes: false,
        kasbon: 0, pot_lain: 0, thr: 0, bonus: 0,
      } as any);
    }

    const engine_bruto = result.bruto ?? result.total_upah ?? 0;
    const engine_pph = result.pph ?? result.total_pph ?? 0;
    const engine_thp = result.thp ?? 0;
    const base_val = emp.excel_bruto || 1;
    const diff_pct = (Math.abs(engine_bruto - emp.excel_bruto) / base_val) * 100;

    return {
      engine_bruto, engine_pph, engine_thp,
      diff_pct,
      has_diff: diff_pct > 0.5,
      full_result: result,
    };
  } catch {
    return {
      engine_bruto: 0, engine_pph: 0, engine_thp: 0,
      diff_pct: 100, has_diff: true,
      full_result: {},
    };
  }
}

/**
 * Extract month + tetap rows + harian rows from an Excel workbook.
 * Month is detected from sheet names "01".."12" — falls back to null if none.
 */
export function parseWorkbook(wb: XLSX.WorkBook): { month: number | null; rows: ParsedEmp[] } {
  let detectedMonth: number | null = null;
  const all: ParsedEmp[] = [];
  for (const name of wb.SheetNames) {
    const num = parseInt(name.trim(), 10);
    if (!isNaN(num) && num >= 1 && num <= 12) {
      detectedMonth = num;
      all.push(...parseTetap(wb.Sheets[name]));
    }
    if (name.toUpperCase().includes('HARIAN')) {
      all.push(...parseHarian(wb.Sheets[name]));
    }
  }
  return { month: detectedMonth, rows: all };
}
