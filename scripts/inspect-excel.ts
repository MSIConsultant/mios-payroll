#!/usr/bin/env -S npx tsx
/**
 * Inspect an Excel file: list sheets, columns, types, and sample rows.
 *
 * Usage:
 *   npx tsx scripts/inspect-excel.ts <path-to-file.xlsx> [--rows N]
 *
 * Example:
 *   npx tsx scripts/inspect-excel.ts samples/payroll-2024.xlsx
 *   npx tsx scripts/inspect-excel.ts samples/payroll-2024.xlsx --rows 5
 *
 * Prints sheet names, header row per sheet, inferred type per column,
 * and N sample data rows (default 3). Designed to help map an accountant's
 * Excel format to a future importer.
 */

import * as XLSX from 'xlsx';
import { argv, exit } from 'node:process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

function parseArgs() {
  const args = argv.slice(2);
  let filePath: string | undefined;
  let sampleRows = 3;
  let rawRows: number | null = null;
  let onlySheet: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--rows' && args[i + 1]) {
      sampleRows = Number(args[++i]);
      if (!Number.isFinite(sampleRows) || sampleRows < 0) {
        console.error(`Invalid --rows value`);
        exit(2);
      }
    } else if (a === '--raw' && args[i + 1]) {
      rawRows = Number(args[++i]);
      if (!Number.isFinite(rawRows) || rawRows < 0) {
        console.error(`Invalid --raw value`);
        exit(2);
      }
    } else if (a === '--sheet' && args[i + 1]) {
      onlySheet = args[++i];
    } else if (!a.startsWith('--')) {
      filePath = a;
    }
  }

  if (!filePath) {
    console.error('Usage: npx tsx scripts/inspect-excel.ts <path-to-file.xlsx> [--rows N] [--raw N] [--sheet NAME]');
    console.error('  --rows N    sample N data rows (default 3)');
    console.error('  --raw N     dump the first N raw rows as cell arrays (useful for merged headers)');
    console.error('  --sheet S   only inspect sheet with name S');
    exit(2);
  }

  return { filePath, sampleRows, rawRows, onlySheet };
}

function inferType(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'empty';
  if (value instanceof Date) return 'date';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date-string';
    if (/^[\d.,]+$/.test(value)) return 'numeric-string';
    return 'string';
  }
  return typeof value;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '∅';
  if (value === '') return '""';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.length > 40 ? s.slice(0, 37) + '...' : s;
}

function main() {
  const { filePath, sampleRows, rawRows, onlySheet } = parseArgs();
  const absolutePath = resolve(filePath);

  if (!existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    exit(1);
  }

  const stat = statSync(absolutePath);
  console.log(`\n┌─ ${absolutePath}`);
  console.log(`│  size: ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`│  modified: ${stat.mtime.toISOString().slice(0, 16).replace('T', ' ')}`);
  console.log('└──────');

  const workbook = XLSX.readFile(absolutePath, { cellDates: true });

  console.log(`\nSheets (${workbook.SheetNames.length}): ${workbook.SheetNames.join(', ')}\n`);

  const sheetNames = onlySheet ? [onlySheet] : workbook.SheetNames;

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      console.log(`(no such sheet: "${sheetName}")\n`);
      continue;
    }

    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
    const totalRows = range.e.r - range.s.r;
    const totalCols = range.e.c - range.s.c + 1;

    console.log(`━━━ Sheet: "${sheetName}"`);
    console.log(`    range: ${sheet['!ref']}   rows: ${totalRows}   cols: ${totalCols}\n`);

    // Raw mode: dump first N rows as cell arrays — best for merged headers
    if (rawRows !== null) {
      const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: null,
        raw: true,
        blankrows: false,
      });
      const n = Math.min(rawRows, rawData.length);
      console.log(`    RAW (first ${n} non-blank rows of ${rawData.length}):\n`);
      for (let i = 0; i < n; i++) {
        const row = rawData[i] as unknown[];
        const cells = row.map((c, idx) => {
          const col = XLSX.utils.encode_col(range.s.c + idx);
          return `${col}=${formatCell(c)}`;
        });
        console.log(`    [${String(i + 1).padStart(3)}] ${cells.join('  ')}`);
      }
      console.log();
      continue;
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
      raw: true,
    });

    if (rows.length === 0) {
      console.log('    (empty)\n');
      continue;
    }

    const headers = Object.keys(rows[0]);
    const typeMap: Record<string, Set<string>> = {};

    for (const h of headers) typeMap[h] = new Set();
    for (const row of rows.slice(0, Math.min(50, rows.length))) {
      for (const h of headers) typeMap[h].add(inferType(row[h]));
    }

    console.log('    COLUMNS:');
    headers.forEach((h, i) => {
      const types = [...typeMap[h]].filter(t => t !== 'empty');
      const typeStr = types.length === 0 ? 'all-empty' : types.join(' | ');
      const col = XLSX.utils.encode_col(range.s.c + i);
      console.log(`      ${col.padEnd(3)} [${String(i).padStart(3)}]  ${h.padEnd(28)}  (${typeStr})`);
    });

    if (sampleRows > 0 && rows.length > 0) {
      console.log(`\n    SAMPLE ROWS (first ${Math.min(sampleRows, rows.length)} of ${rows.length}):`);
      for (let i = 0; i < Math.min(sampleRows, rows.length); i++) {
        console.log(`\n    row ${i + 1}:`);
        for (const h of headers) {
          console.log(`      ${h.padEnd(28)} = ${formatCell(rows[i][h])}`);
        }
      }
    }

    console.log();
  }

  console.log('Done.\n');
}

main();
