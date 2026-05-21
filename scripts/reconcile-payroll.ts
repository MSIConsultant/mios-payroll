#!/usr/bin/env -S npx tsx
/**
 * Reconcile MIOS engine output against the accountant's Excel workbook.
 *
 * Usage:
 *   npx tsx scripts/reconcile-payroll.ts <workbook.xlsx> --sheet "02" --bulan 2 --tahun 2026 [--csv out.csv]
 *
 * Reads the tetap sheet, builds KaryawanTetap inputs from columns, runs
 * MIOS's calculateMonthlySalary, and dumps a per-employee diff against the
 * Excel values. Discovery script — no app changes, no DB writes.
 *
 * Column mapping is for the format observed in:
 *   samples/Grossup PPh 21 02-2026.xlsx (sheet "02")
 * which is the accountant's standard monthly tetap layout.
 *
 * Layout assumptions:
 *   row 1 = column-group numbering (skipped)
 *   row 2 = column-index numbering (skipped)
 *   row 3 = top-level headers (NAMA, NPWP, BPJS, ALLOWANCE, etc.) (skipped)
 *   row 4 = sub-headers under merged groups (skipped)
 *   row 5+ = data
 */

import * as XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv, exit } from 'node:process';

import { calculateMonthlySalary, type KaryawanTetap } from '../lib/engine/payroll';

// ── CLI args ──────────────────────────────────────────────────────────────
function parseArgs() {
  const args = argv.slice(2);
  let file: string | undefined;
  let sheet = '02';
  let bpjsSheet: string | null = null;
  let bulan = 0;
  let tahun = 0;
  let csvOut: string | null = null;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--sheet' && args[i + 1]) sheet = args[++i];
    else if (a === '--bpjs-sheet' && args[i + 1]) bpjsSheet = args[++i];
    else if (a === '--bulan' && args[i + 1]) bulan = Number(args[++i]);
    else if (a === '--tahun' && args[i + 1]) tahun = Number(args[++i]);
    else if (a === '--csv' && args[i + 1]) csvOut = args[++i];
    else if (a === '--verbose') verbose = true;
    else if (!a.startsWith('--')) file = a;
  }

  if (!file || !bulan || !tahun) {
    console.error('Usage: npx tsx scripts/reconcile-payroll.ts <workbook.xlsx> --sheet NAME --bulan N --tahun YYYY [--bpjs-sheet NAME] [--csv out.csv] [--verbose]');
    console.error('  --bpjs-sheet NAME  also read BPJS sheet for declared salary basis per employee');
    exit(2);
  }

  return { file, sheet, bpjsSheet, bulan, tahun, csvOut, verbose };
}

// ── BPJS sheet mapping (NIK → declared bpjs_basis) ────────────────────────
// Layout observed in samples/Grossup PPh 21 02-2026.xlsx "BPJS" sheet:
//   col E (idx 4) = NIK
//   col J (idx 9) = declared BPJS salary basis
//   header rows 1-4, data row 5+
function buildBpjsBasisMap(workbook: XLSX.WorkBook, sheetName: string): Map<string, number> {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`BPJS sheet "${sheetName}" not found`);
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });
  const map = new Map<string, number>();
  for (let i = 4; i < rows.length; i++) {
    const row = rows[i];
    const nik = s(row[4]);
    const basis = n(row[9]);
    if (nik && basis > 0) map.set(nik, basis);
  }
  return map;
}

// ── Column mapping (0-indexed from sheet) ─────────────────────────────────
//   tied to the accountant's observed layout in samples/02-2026.xlsx
const COL = {
  NO: 1,            // B
  NIK: 2,           // C
  NAMA: 3,          // D
  BAGIAN: 4,        // E   → divisi
  NPWP: 7,          // H   ("000" = no NPWP)
  THP_EXCEL: 8,     // I
  BRUTO_EXCEL: 9,   // J
  PPH_EXCEL: 10,    // K
  STATUS: 11,       // L   → status_ptkp ("TK0", "K2", etc.)
  TARIF_GRUP: 12,   // M   ("TER A" / "TER B" / "TER C") — for cross-check
  TARIF_RATE: 13,   // N   (numeric rate, e.g. 0.0175)
  GAJI: 14,         // O   → gaji_pokok
  BPJS_JKK: 15,     // P   (employer JKK, IN_BRUTO)
  BPJS_JKM: 16,     // Q   (employer JKM, IN_BRUTO)
  BPJS_JHT_E: 17,   // R   (employer JHT, OFFSLIP — shown 0 in main "02" tetap layout)
  BPJS_JP_E: 18,    // S   (employer JP, OFFSLIP)
  BPJS_KES_E: 19,   // T   (employer KES, IN_BRUTO)
  ALLOW_PPH21: 20,  // U   (tunj_pph — if > 0, pph_ditanggung=true)
  ALLOW_BENEFIT: 21,    // V
  ALLOW_KENDARAAN: 22,  // W
  ALLOW_PULSA: 23,      // X
  ALLOW_OPERASIONAL: 24, // Y
  TOTAL_BULAN: 25,  // Z   = bruto (per the sheet)
  TOTAL_TAHUN: 26,  // AA  → akum_bruto (annual projection in Excel)
  THR: 27,          // AB
  BONUS: 28,        // AC
  POTONGAN_KASBON: 47,    // AV
  POTONGAN_ALPHA: 48,     // AW
  POTONGAN_KESEHATAN: 49, // AX
  JK: 52,           // BA  ("L"/"P"/"-")
} as const;

const DATA_START_ROW = 4; // 0-indexed = Excel row 5

// ── Helpers ───────────────────────────────────────────────────────────────
const n = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^\d.-]/g, '');
    return cleaned === '' ? 0 : Number(cleaned);
  }
  return 0;
};

const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

const hasNpwp = (raw: unknown): boolean => {
  const t = s(raw);
  if (t === '' || t === '0' || t === '000' || t === '0000000000000000') return false;
  return /\d/.test(t) && t.replace(/[^\d]/g, '').length >= 8;
};

const diffPct = (a: number, b: number): number => {
  const denom = Math.max(Math.abs(a), Math.abs(b), 1);
  return ((a - b) / denom) * 100;
};

const fmt = (v: number): string => {
  if (v === 0) return '0';
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

const flagDiff = (excel: number, engine: number, tolerance = 1): string => {
  const d = Math.abs(excel - engine);
  if (d <= tolerance) return '  ';
  if (d / Math.max(Math.abs(excel), 1) > 0.05) return '⚠⚠';
  return '· ';
};

// ── Row → KaryawanTetap ───────────────────────────────────────────────────
function buildInput(row: unknown[], bulan: number, tahun: number, bpjsBasisMap: Map<string, number>): KaryawanTetap | null {
  const nik = s(row[COL.NIK]);
  const nama = s(row[COL.NAMA]);
  if (!nik || !nama) return null;

  const gajiPokok = n(row[COL.GAJI]);
  if (gajiPokok <= 0) return null; // skip rows that aren't payroll entries

  const statusPtkp = s(row[COL.STATUS]) || 'TK0';
  const ptkpKeys = ['TK0', 'TK1', 'TK2', 'TK3', 'K0', 'K1', 'K2', 'K3'];
  if (!ptkpKeys.includes(statusPtkp)) {
    console.warn(`  WARN: unknown PTKP "${statusPtkp}" for ${nama} (NIK ${nik}) — defaulting TK0`);
  }

  // Infer ikut_* flags: employer JKK/JKM in P/Q mean BPJS-Ketenagakerjaan participant.
  // R/S are JHT/JP employer (offslip — often 0 in tetap layout; trust JKK presence).
  const jkk = n(row[COL.BPJS_JKK]);
  const jkm = n(row[COL.BPJS_JKM]);
  const kesE = n(row[COL.BPJS_KES_E]);
  const ikutBpjsTk = jkk > 0 || jkm > 0;
  const ikutKes = kesE > 0;

  // JKK rate — back out from employer-JKK / gaji (caveat: accountant may use a
  // declared BPJS salary != gaji_pokok; in that case rate will be slightly off).
  // Fall back to 0.0024 (low-risk default).
  const jkkRate = ikutBpjsTk && gajiPokok > 0 ? jkk / gajiPokok : 0.0024;

  // Grossup detection: if ALLOWANCE PPH 21 > 0 the employee is grossed up.
  const allowPph = n(row[COL.ALLOW_PPH21]);
  const pphDitanggung = allowPph > 0;

  const declaredBpjsBasis = bpjsBasisMap.get(nik);

  return {
    nama,
    nik,
    npwp: s(row[COL.NPWP]),
    divisi: s(row[COL.BAGIAN]),
    jenis_kelamin: s(row[COL.JK]),
    bulan,
    tahun,
    status_ptkp: ptkpKeys.includes(statusPtkp) ? statusPtkp : 'TK0',
    punya_npwp: hasNpwp(row[COL.NPWP]),

    gaji_pokok: gajiPokok,
    bpjs_basis: declaredBpjsBasis ?? null,
    benefit: n(row[COL.ALLOW_BENEFIT]),
    kendaraan: n(row[COL.ALLOW_KENDARAAN]),
    pulsa: n(row[COL.ALLOW_PULSA]),
    operasional: n(row[COL.ALLOW_OPERASIONAL]),
    tunj_lain: 0,

    thr: n(row[COL.THR]),
    bonus: n(row[COL.BONUS]),

    ikut_jht: ikutBpjsTk,
    ikut_jp: ikutBpjsTk,
    ikut_jkp: false,
    jkk_rate: jkkRate,
    ikut_kes: ikutKes,

    // The Excel doesn't directly indicate which BPJS pieces are tanggung
    // (employer-grossed-up). We make a defensible guess: if pph_ditanggung is on,
    // assume all BPJS-karyawan pieces are also tunjangan. Conservative; will
    // produce a known diff for partial-tanggung cases.
    tanggung_jht_k: pphDitanggung,
    tanggung_jp_k:  pphDitanggung,
    tanggung_kes_k: pphDitanggung,

    pph_ditanggung: pphDitanggung,

    kasbon:      n(row[COL.POTONGAN_KASBON]),
    alpha_telat: n(row[COL.POTONGAN_ALPHA]),
    pot_lain:    n(row[COL.POTONGAN_KESEHATAN]),

    pph_jan_nov: 0,
    akum_bruto:  0,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────
function main() {
  const { file, sheet: sheetName, bpjsSheet, bulan, tahun, csvOut, verbose } = parseArgs();
  const absPath = resolve(file);
  const wb = XLSX.readFile(absPath, { cellDates: true });
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    console.error(`Sheet "${sheetName}" not found in workbook. Available: ${wb.SheetNames.join(', ')}`);
    exit(1);
  }

  const bpjsBasisMap = bpjsSheet ? buildBpjsBasisMap(wb, bpjsSheet) : new Map<string, number>();

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });

  console.log(`\nReconciling ${absPath}`);
  console.log(`Sheet: "${sheetName}"   Period: ${bulan}/${tahun}   Data rows: ${raw.length - DATA_START_ROW}`);
  if (bpjsSheet) {
    console.log(`BPJS sheet: "${bpjsSheet}"   Declared-basis entries: ${bpjsBasisMap.size}`);
  } else {
    console.log(`BPJS sheet: (none — using gaji_pokok as basis)`);
  }
  console.log();

  type Diff = {
    nik: string;
    nama: string;
    grup: string;
    excel: { bruto: number; pph: number; thp: number; jkk: number; jkm: number; kes_e: number };
    engine: { bruto: number; pph: number; thp: number; jkk: number; jkm: number; kes_e: number };
    pphDitanggung: boolean;
  };
  const diffs: Diff[] = [];

  for (let i = DATA_START_ROW; i < raw.length; i++) {
    const row = raw[i];
    const input = buildInput(row, bulan, tahun, bpjsBasisMap);
    if (!input) continue;

    let engineResult;
    try {
      engineResult = calculateMonthlySalary(input);
    } catch (err) {
      console.error(`  ERR row ${i + 1} ${input.nama}: ${(err as Error).message}`);
      continue;
    }

    const excelBruto = n(row[COL.TOTAL_BULAN]); // sheet's "TOTAL BULAN" = bruto
    const excelPph   = n(row[COL.PPH_EXCEL]);
    const excelThp   = n(row[COL.THP_EXCEL]);
    const excelJkk   = n(row[COL.BPJS_JKK]);
    const excelJkm   = n(row[COL.BPJS_JKM]);
    const excelKesE  = n(row[COL.BPJS_KES_E]);

    diffs.push({
      nik: input.nik,
      nama: input.nama,
      grup: engineResult.grup,
      excel:  { bruto: excelBruto, pph: excelPph, thp: excelThp, jkk: excelJkk, jkm: excelJkm, kes_e: excelKesE },
      engine: { bruto: engineResult.bruto, pph: engineResult.pph, thp: engineResult.thp,
                jkk: engineResult.bpjs.jkk, jkm: engineResult.bpjs.jkm, kes_e: engineResult.bpjs.kes_e },
      pphDitanggung: input.pph_ditanggung,
    });

    if (verbose) {
      console.log(`  ${input.nama.padEnd(30)} ${engineResult.grup} bruto_excel=${fmt(excelBruto).padStart(15)} bruto_engine=${fmt(engineResult.bruto).padStart(15)}`);
    }
  }

  // ── Summary table ──────────────────────────────────────────────────────
  console.log('\n┌─ Summary (engine vs Excel) ─────────────────────────────────────────────────────');
  console.log(`│  Rows reconciled: ${diffs.length}`);

  const buckets = {
    bruto:  { lt1: 0, lt5: 0, gt5: 0 },
    pph:    { lt1: 0, lt5: 0, gt5: 0 },
    thp:    { lt1: 0, lt5: 0, gt5: 0 },
  };
  for (const d of diffs) {
    for (const k of ['bruto', 'pph', 'thp'] as const) {
      const p = Math.abs(diffPct(d.engine[k], d.excel[k]));
      if (p < 1) buckets[k].lt1++;
      else if (p < 5) buckets[k].lt5++;
      else buckets[k].gt5++;
    }
  }
  console.log(`│  Bruto:   <1%: ${buckets.bruto.lt1}   1-5%: ${buckets.bruto.lt5}   >5%: ${buckets.bruto.gt5}`);
  console.log(`│  PPh 21:  <1%: ${buckets.pph.lt1}     1-5%: ${buckets.pph.lt5}     >5%: ${buckets.pph.gt5}`);
  console.log(`│  THP:     <1%: ${buckets.thp.lt1}     1-5%: ${buckets.thp.lt5}     >5%: ${buckets.thp.gt5}`);
  console.log('└──────\n');

  // ── Worst 15 by absolute PPh diff ──────────────────────────────────────
  const ranked = [...diffs].sort((a, b) =>
    Math.abs(b.engine.pph - b.excel.pph) - Math.abs(a.engine.pph - a.excel.pph)
  );
  console.log('Top 15 worst PPh mismatches:\n');
  console.log('  NAMA                          GRUP  EXCEL.PPH       ENGINE.PPH      DIFF              DIFF%   GROSSUP');
  console.log('  ' + '─'.repeat(110));
  for (const d of ranked.slice(0, 15)) {
    const diff = d.engine.pph - d.excel.pph;
    const pct  = diffPct(d.engine.pph, d.excel.pph);
    const flag = flagDiff(d.excel.pph, d.engine.pph, 100);
    console.log(`  ${d.nama.slice(0, 30).padEnd(30)}  ${d.grup}     ${fmt(d.excel.pph).padStart(14)}  ${fmt(d.engine.pph).padStart(14)}  ${flag}${fmt(diff).padStart(14)}  ${pct.toFixed(2).padStart(8)}%  ${d.pphDitanggung ? 'yes' : 'no'}`);
  }
  console.log();

  // ── CSV output ─────────────────────────────────────────────────────────
  if (csvOut) {
    const csvPath = resolve(csvOut);
    const header = [
      'nik', 'nama', 'grup', 'grossup',
      'excel_bruto', 'engine_bruto', 'bruto_diff', 'bruto_diff_pct',
      'excel_pph', 'engine_pph', 'pph_diff', 'pph_diff_pct',
      'excel_thp', 'engine_thp', 'thp_diff', 'thp_diff_pct',
      'excel_jkk', 'engine_jkk', 'excel_jkm', 'engine_jkm', 'excel_kes_e', 'engine_kes_e',
    ];
    const lines = [header.join(',')];
    for (const d of diffs) {
      lines.push([
        d.nik, JSON.stringify(d.nama), d.grup, d.pphDitanggung ? 1 : 0,
        d.excel.bruto, d.engine.bruto, d.engine.bruto - d.excel.bruto, diffPct(d.engine.bruto, d.excel.bruto).toFixed(2),
        d.excel.pph, d.engine.pph, d.engine.pph - d.excel.pph, diffPct(d.engine.pph, d.excel.pph).toFixed(2),
        d.excel.thp, d.engine.thp, d.engine.thp - d.excel.thp, diffPct(d.engine.thp, d.excel.thp).toFixed(2),
        d.excel.jkk, d.engine.jkk, d.excel.jkm, d.engine.jkm, d.excel.kes_e, d.engine.kes_e,
      ].join(','));
    }
    writeFileSync(csvPath, lines.join('\n'));
    console.log(`CSV written: ${csvPath}\n`);
  }
}

main();
