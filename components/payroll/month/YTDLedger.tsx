'use client';
// Collapsible YTD accumulation ledger — extracted verbatim from the month
// page (PR 1). Owns its own open/closed state.

import { useState } from 'react';
import { TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { BULAN_NAMES } from '@/lib/payroll/calc-client';

export function YTDLedger({ results, accumMap, bulan }: {
  results: any[];
  accumMap: Record<string, { akum_bruto: number; pph_jan_nov: number }>;
  bulan: number;
}) {
  const [showYTD, setShowYTD] = useState(false);
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
      <button onClick={() => setShowYTD((v) => !v)} className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer">
        <div className="flex items-center gap-2.5">
          <TrendingUp size={15} className="text-[var(--brand)]" />
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">YTD Ledger — s/d {BULAN_NAMES[bulan - 2] || BULAN_NAMES[0]}</span>
        </div>
        {showYTD ? <ChevronDown size={16} className="text-[var(--text-muted)]" /> : <ChevronRight size={16} className="text-[var(--text-muted)]" />}
      </button>
      {showYTD && (
        <div className="overflow-x-auto border-t border-[var(--border-subtle)]">
          <table>
            <thead><tr>{['Nama', 'Akum. Bruto', 'Akum. PPh', 'Bulan Ini'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {results.map((res, i) => {
                const acc = accumMap[res.employee_id] ?? { akum_bruto: 0, pph_jan_nov: 0 };
                const thisBruto = res.bruto ?? res.total_upah ?? 0;
                return (
                  <tr key={i}>
                    <td className="font-semibold text-[var(--text-primary)]">{res.employee_name}</td>
                    <td className="font-mono">{formatRupiah(acc.akum_bruto)}</td>
                    <td className="font-mono text-amber-700">{formatRupiah(acc.pph_jan_nov)}</td>
                    <td className="font-mono">{formatRupiah(thisBruto)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
