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

import type { WorkBook, WorkSheet } from 'xlsx';
import { calculateMonthlySalary, calculateFreelance } from '@/lib/engine/payroll';

// XLSX is ~68 KB gzipped and only needed when the user actually drops a file.
// Lazy-loading it keeps /import/new and /import/bulk initial bundles lean.
// The module promise is memoized so repeated parses share one fetch.
let xlsxModulePromise: Promise<typeof import('xlsx')> | null = null;
const getXlsx = () => (xlsxModulePromise ??= import('xlsx'));

/** Read an Excel file into a workbook, lazy-loading the xlsx runtime. */
export async function readWorkbook(input: File | ArrayBuffer): Promise<WorkBook> {
  const buffer = input instanceof File ? await input.arrayBuffer() : input;
  const XLSX = await getXlsx();
  return XLSX.read(new Uint8Array(buffer), { type: 'array' });
}

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
  jenis_karyawan: 'tetap' | 'tidak_tetap_harian' | 'tidak_tetap_bulanan';
  upah_harian: number;
  upah_bulanan: number;
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

export async function parseTetap(ws: WorkSheet): Promise<ParsedEmp[]> {
  const XLSX = await getXlsx();
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  const out: ParsedEmp[] = [];
  for (let r = 4; r <= range.e.r; r++) {
    const g = (c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v ?? null;
    const nama = String(g(3) ?? '').trim();
    if (!nama || nama.length < 2) continue;
    // Accept alphanumeric — TKA employees use passport numbers (e.g. "TZ1069131").
    // Uppercase + strip whitespace/symbols only, NEVER strip letters.
    const nik = String(g(2) ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const punya_npwp = String(g(0) ?? '').toUpperCase() === 'NPWP';
    const ptkp = String(g(11) ?? '').trim().toUpperCase();
    const gaji = Number(g(14)) || 0;
    const jkk_amt = Number(g(15)) || 0;
    const jkk_rate = gaji > 0 ? closestJKK(jkk_amt / gaji) : 0.0024;
    const errs: string[] = [];
    // Min 5 chars to allow short passport numbers; warn-but-not-block on non-16-digit.
    if (nik.length < 5) errs.push('NIK / paspor tidak valid');
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
      upah_bulanan: 0,
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

export async function parseHarian(ws: WorkSheet): Promise<ParsedEmp[]> {
  const XLSX = await getXlsx();
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  const out: ParsedEmp[] = [];
  for (let r = 1; r <= range.e.r; r++) {
    const g = (c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v ?? null;
    if (!g(2) || isNaN(Number(g(2)))) continue;
    const nama = String(g(5) ?? '').trim();
    if (!nama || nama.length < 2) continue;
    // Same alphanumeric-safe parsing as parseTetap.
    const nik = String(g(4) ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const ptkp = String(g(6) ?? '').trim().toUpperCase();
    const errs: string[] = [];
    if (nik.length < 5) errs.push('NIK / paspor tidak valid');
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
      upah_bulanan: 0,
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

/**
 * Parse a "TIDAK FINAL" / "TT BULANAN" sheet (karyawan tidak tetap bulanan).
 * Column layout mirrors the accountant's template: row 1 is a header row,
 * data starts row 2. Columns (0-based):
 *   0  No  1  NIK  2  Nama  3  Divisi  4  NPWP  5  Status PTKP
 *   6  Upah Bulanan  7  Tunjangan  8  Bruto  9  PPh  10 THP
 * BPJS flags are not present on the bulanan sheet — the engine uses
 * ikut_jht/jp/kes from the employees row if the employee already exists.
 * For new employees created from this sheet, BPJS is left false (accountant
 * configures separately).
 */
export async function parseTidakFinal(ws: WorkSheet): Promise<ParsedEmp[]> {
  const XLSX = await getXlsx();
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  const out: ParsedEmp[] = [];
  for (let r = 1; r <= range.e.r; r++) {
    const g = (c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v ?? null;
    const nama = String(g(2) ?? '').trim();
    if (!nama || nama.length < 2) continue;
    const nik = String(g(1) ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const ptkp = String(g(5) ?? '').trim().toUpperCase();
    const upahBulanan = Number(g(6)) || 0;
    const tunj = Number(g(7)) || 0;
    const bruto = Number(g(8)) || 0;
    const errs: string[] = [];
    if (nik.length < 5) errs.push('NIK / paspor tidak valid');
    if (!PTKP_VALID.includes(ptkp)) errs.push(`PTKP tidak dikenal: ${ptkp}`);
    if (upahBulanan <= 0 && bruto <= 0) errs.push('Upah tidak terbaca');
    // punya_npwp: require ≥10 digits after stripping formatting — rules out
    // placeholders ('-', '0', blank) while accepting any NPWP/TIN number.
    // Indonesian NPWP is 15 digits; TKA TIN may differ but still ≥10.
    const npwpRaw = String(g(4) ?? '').trim();
    out.push({
      nik, nama,
      divisi: String(g(3) ?? '').trim(),
      npwp:   npwpRaw,
      punya_npwp: npwpRaw.replace(/\D/g, '').length >= 10,
      status_ptkp: PTKP_VALID.includes(ptkp) ? ptkp : 'TK0',
      jenis_kelamin: 'L',
      gaji_pokok: 0,
      benefit: tunj, kendaraan: 0, pulsa: 0, operasional: 0,
      jkk_rate: 0.0024,
      ikut_jht: false, ikut_jp: false, ikut_kes: false,
      jenis_karyawan: 'tidak_tetap_bulanan',
      upah_harian: 0,
      upah_bulanan: upahBulanan,
      tunj_pph: 0,
      excel_bruto: bruto || upahBulanan + tunj,
      excel_pph: Number(g(9)) || 0,
      excel_thp: Number(g(10)) || 0,
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
  options?: { akum_bruto?: number; pph_jan_nov?: number; bpjs_basis?: number | null },
): ReconcileResult {
  try {
    let result: any = {};
    const akum_bruto  = options?.akum_bruto  ?? 0;
    const pph_jan_nov = options?.pph_jan_nov ?? 0;
    const base = {
      ...emp,
      bulan, tahun,
      tunj_lain: 0, kasbon: 0, alpha_telat: 0, pot_lain: 0,
      thr: 0, bonus: 0, pph_jan_nov, akum_bruto,
      bpjs_basis: options?.bpjs_basis ?? null,
      // JKP is mandatory for all wage-employees per Perpres 82/2020.
      // Employer-only contribution, so no THP impact but matters for CTC.
      ikut_jkp: emp.ikut_jht,
      tanggung_jht_k: emp.ikut_jht,
      tanggung_jp_k: emp.ikut_jp,
      tanggung_kes_k: emp.ikut_kes,
      pph_ditanggung: emp.tunj_pph > 0,
    } as any;

    if (emp.jenis_karyawan === 'tetap') {
      result = calculateMonthlySalary(base);
    } else if (emp.jenis_karyawan === 'tidak_tetap_bulanan') {
      result = calculateFreelance({
        ...emp,
        mode: 'bulanan' as const,
        upah_bulanan: emp.upah_bulanan,
        tunjangan: emp.benefit ?? 0,
        ikut_bpjs_tk: emp.ikut_jht,
        ikut_kes: emp.ikut_kes,
        kasbon: 0, pot_lain: 0, thr: 0, bonus: 0,
      } as any);
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
 * Extract month + rows from an Excel workbook, grouped by payroll run type.
 * Sheet detection:
 *   "01".."12"          → tetap (karyawan tetap monthly)
 *   contains "HARIAN"   → harian (karyawan tidak tetap harian)
 *   contains "TIDAK"    → tidak_final (karyawan tidak tetap bulanan)
 *     (also matches "TIDAK FINAL", "TT BULANAN", "TT FINAL", etc.)
 * Month is inferred from the numeric sheet name, e.g. "02" → February.
 */
export async function parseWorkbook(wb: WorkBook): Promise<{
  month:         number | null;
  tetap:         ParsedEmp[];
  harian:        ParsedEmp[];
  tidak_final:   ParsedEmp[];
  /** Flat union of all rows — kept for backwards compat with /import/new. */
  rows:          ParsedEmp[];
}> {
  let detectedMonth: number | null = null;
  const tetap:       ParsedEmp[] = [];
  const harian:      ParsedEmp[] = [];
  const tidak_final: ParsedEmp[] = [];

  for (const name of wb.SheetNames) {
    const upper = name.trim().toUpperCase();
    const num   = parseInt(name.trim(), 10);
    if (!isNaN(num) && num >= 1 && num <= 12) {
      detectedMonth = num;
      tetap.push(...(await parseTetap(wb.Sheets[name])));
    } else if (upper.includes('HARIAN')) {
      harian.push(...(await parseHarian(wb.Sheets[name])));
    } else if (upper.includes('TIDAK FINAL') || upper.includes('TIDAK TETAP') || upper.startsWith('TT ')) {
      tidak_final.push(...(await parseTidakFinal(wb.Sheets[name])));
    }
  }

  return {
    month: detectedMonth,
    tetap, harian, tidak_final,
    rows: [...tetap, ...harian, ...tidak_final],
  };
}
