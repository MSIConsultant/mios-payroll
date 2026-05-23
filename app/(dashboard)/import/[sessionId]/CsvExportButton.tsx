'use client';
import { Download } from 'lucide-react';

interface RecordRow {
  employee_name: string;
  original_data: unknown;
  recalculated_data: unknown;
  differences: unknown;
  has_diff: boolean;
}

function cell(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export function CsvExportButton({
  records,
  bulan,
  tahun,
}: {
  records: RecordRow[];
  bulan: number;
  tahun: number;
}) {
  function handleExport() {
    const header = [
      'Karyawan',
      'Bruto Excel',
      'Bruto Engine',
      'Selisih Bruto',
      'PPh Excel',
      'PPh Engine',
      'Selisih PPh',
      'THP Excel',
      'Delta %',
      'Status',
    ];
    const rows = records.map((r) => {
      const orig  = r.original_data   as Record<string, number> | null ?? {};
      const recalc = r.recalculated_data as Record<string, number> | null ?? {};
      const diff   = r.differences       as Record<string, number> | null ?? {};
      return [
        r.employee_name,
        orig.bruto   ?? 0,
        recalc.bruto ?? 0,
        diff.bruto   ?? 0,
        orig.pph     ?? 0,
        recalc.pph   ?? 0,
        diff.pph     ?? 0,
        orig.thp     ?? 0,
        ((diff as any).diff_pct ?? 0).toFixed(2),
        r.has_diff ? 'BEDA' : 'MATCH',
      ];
    });

    const csv =
      '﻿' +
      [header, ...rows].map((r) => r.map(cell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `rekonsiliasi-${String(bulan).padStart(2, '0')}-${tahun}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg text-[13px] font-semibold transition-colors cursor-pointer"
    >
      <Download size={14} />
      Ekspor CSV
    </button>
  );
}
