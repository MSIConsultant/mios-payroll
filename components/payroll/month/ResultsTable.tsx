'use client';
// Sortable Tabel view of monthly results — extracted verbatim (PR 1).

import { Pencil, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { lebihPotongOf } from '@/lib/payroll/calc-client';

export type SortKey = 'nama' | 'bruto' | 'pph' | 'thp';

export function ResultsTable({
  sortedResults, employees, isLocked, sortKey, sortDir,
  onToggleSort, onShowDetail, onQuickEdit,
  totalBruto, totalPph, totalThp, totalBpjsK,
}: {
  sortedResults: any[];
  employees: any[];
  isLocked: boolean;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onToggleSort: (key: SortKey) => void;
  onShowDetail: (employeeId: string) => void;
  onQuickEdit: (emp: any) => void;
  totalBruto: number;
  totalPph: number;
  totalThp: number;
  totalBpjsK: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] w-10">#</th>
            {([['nama', 'Nama', 'left'], ['bruto', 'Bruto', 'right'], ['pph', 'PPh 21', 'right'], ['thp', 'THP', 'right']] as const).map(([key, label, align]) => (
              <th key={key} className={`px-4 py-2.5 ${align === 'right' ? 'text-right' : 'text-left'} text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]`}>
                <button
                  onClick={() => onToggleSort(key)}
                  className={`inline-flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors cursor-pointer uppercase tracking-wider ${sortKey === key ? 'text-[var(--brand)]' : ''}`}
                >
                  {label}
                  {sortKey === key
                    ? (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)
                    : <ArrowUpDown size={11} className="opacity-40" />}
                </button>
              </th>
            ))}
            <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">BPJS Kry.</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
            <th className="px-4 py-2.5 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {sortedResults.map((res, i) => {
            const bpjsK = res.bpjs?.karyawan_potong ?? res.tot_bpjs ?? 0;
            const isTetap = !res.mode;
            const sourceEmp = employees.find((e) => e.id === res.employee_id);
            return (
              <tr key={res.employee_id ?? i} className="hover:bg-[var(--bg-subtle)] transition-colors">
                <td className="px-4 py-2.5 text-[var(--text-faint)] font-mono">{i + 1}</td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => onShowDetail(res.employee_id)}
                    className="font-semibold text-[var(--text-primary)] hover:text-[var(--brand)] transition-colors cursor-pointer text-left"
                    title="Lihat rincian"
                  >
                    {res.employee_name}
                  </button>
                  {lebihPotongOf(res) > 0 && (
                    <span className="ml-2 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-red-50 text-red-600">
                      {res.pph_ditanggung ? 'Lebih Setor' : 'Refund'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{formatRupiah(res.bruto ?? res.total_upah ?? 0)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-amber-700">{formatRupiah(res.pph ?? res.total_pph ?? 0)}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-700">{formatRupiah(res.thp ?? 0)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-[var(--text-muted)]">{bpjsK > 0 ? formatRupiah(Math.round(bpjsK)) : '—'}</td>
                <td className="px-4 py-2.5 text-[12px] text-[var(--text-muted)]">
                  {isTetap ? (res.status_ptkp ?? '—') : res.mode === 'harian' ? 'Harian' : 'Bulanan'}
                  {res.pph_ditanggung && <span className="ml-1.5 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-violet-50 text-violet-600">Grossup</span>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {isTetap && sourceEmp && !isLocked && (
                    <button
                      onClick={() => onQuickEdit(sourceEmp)}
                      className="p-1.5 rounded-md text-[var(--text-faint)] hover:text-[var(--brand)] hover:bg-[var(--brand-soft)] transition-colors cursor-pointer"
                      aria-label={`Edit ${res.employee_name}`}
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-[var(--border-default)] bg-[var(--bg-subtle)] font-semibold">
            <td className="px-4 py-2.5" />
            <td className="px-4 py-2.5 text-[12px] text-[var(--text-secondary)]">TOTAL</td>
            <td className="px-4 py-2.5 text-right font-mono">{formatRupiah(totalBruto)}</td>
            <td className="px-4 py-2.5 text-right font-mono text-amber-700">{formatRupiah(totalPph)}</td>
            <td className="px-4 py-2.5 text-right font-mono text-emerald-700">{formatRupiah(totalThp)}</td>
            <td className="px-4 py-2.5 text-right font-mono text-[var(--text-muted)]">{formatRupiah(Math.round(totalBpjsK))}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
