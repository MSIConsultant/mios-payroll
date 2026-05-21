'use client';
import { TrendingUp } from 'lucide-react';
import type { ProjResult } from '@/lib/engine/projection';

const BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const BULAN_FULL  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function rpShort(n: number): string {
  if (n === 0) return '-';
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return (m % 1 === 0 ? String(m) : m.toFixed(1)) + 'jt';
  }
  return Math.round(n / 1_000) + 'rb';
}

function rpFull(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export function ProjectionTable({
  projection,
  gajiPokok,
  thrBulan, thrPct,
  bonusBulan, bonusPct,
  emptyMessage,
}: {
  projection: ProjResult | null;
  gajiPokok: number;
  thrBulan: number; thrPct: number;
  bonusBulan: number; bonusPct: number;
  emptyMessage?: string;
}) {
  if (!projection) {
    return (
      <div className="bg-white border border-[var(--border-default)] rounded-xl p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center mx-auto mb-3">
          <TrendingUp size={20} className="text-[var(--text-muted)]" />
        </div>
        <p className="text-[14px] font-semibold text-[var(--text-secondary)] mb-1">Proyeksi Tahunan</p>
        <p className="text-[13px] text-[var(--text-muted)]">{emptyMessage ?? 'Masukkan gaji pokok untuk simulasi 12 bulan'}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
      <header className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center gap-2">
        <TrendingUp size={16} className="text-[var(--brand)]" />
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Proyeksi Tahunan</h2>
          <p className="text-[12px] text-[var(--text-muted)]">Real-time · {new Date().getFullYear()}</p>
        </div>
      </header>

      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
            <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Bln</th>
            <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Bruto</th>
            <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">PPh</th>
            <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">THP</th>
          </tr>
        </thead>
        <tbody>
          {projection.rows.map((row) => {
            let rowBg = '';
            if (row.hasThr)        rowBg = 'bg-amber-50';
            else if (row.hasBonus) rowBg = 'bg-blue-50';
            else if (row.bulan === 12) rowBg = 'bg-purple-50';

            return (
              <tr key={row.bulan} className={`border-b border-[var(--border-subtle)] ${rowBg}`}>
                <td className="px-4 py-2 font-medium text-[var(--text-secondary)]">
                  {BULAN_SHORT[row.bulan - 1]}
                  {row.hasThr && (
                    <span className="ml-1.5 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1 py-0.5 rounded">THR</span>
                  )}
                  {row.hasBonus && (
                    <span className="ml-1.5 text-[10px] font-semibold text-blue-700 bg-blue-100 px-1 py-0.5 rounded">Bon</span>
                  )}
                  {row.bulan === 12 && !row.hasThr && !row.hasBonus && (
                    <span className="ml-1.5 text-[10px] font-semibold text-purple-700 bg-purple-100 px-1 py-0.5 rounded">P17</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right font-mono text-[var(--text-primary)]">{rpShort(row.bruto)}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {row.isRefund
                    ? <span className="text-amber-600 font-semibold text-[11px]">↩ refund</span>
                    : <span className={row.pph > 0 ? 'text-red-500' : 'text-[var(--text-muted)]'}>{rpShort(row.pph)}</span>
                  }
                </td>
                <td className="px-4 py-2 text-right font-mono font-semibold text-emerald-700">{rpShort(row.thp)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-[var(--bg-subtle)] border-t-2 border-[var(--border-default)]">
            <td className="px-4 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Total</td>
            <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">{rpShort(projection.total.bruto)}</td>
            <td className="px-4 py-3 text-right font-mono font-bold text-red-500">{rpShort(projection.total.pph)}</td>
            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{rpShort(projection.total.thp)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)] space-y-1">
        <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Asumsi</p>
        <p className="text-[12px] text-[var(--text-muted)]">
          <span className="font-semibold text-amber-600">THR</span>
          {' '}{BULAN_FULL[thrBulan - 1]} · {thrPct}% gaji
          {gajiPokok > 0 && <> = <span className="text-[var(--text-primary)] font-semibold">{rpFull(Math.round(gajiPokok * thrPct / 100))}</span></>}
        </p>
        <p className="text-[12px] text-[var(--text-muted)]">
          <span className="font-semibold text-blue-600">Bonus</span>
          {' '}{BULAN_FULL[bonusBulan - 1]} · {bonusPct}% gaji
          {gajiPokok > 0 && <> = <span className="text-[var(--text-primary)] font-semibold">{rpFull(Math.round(gajiPokok * bonusPct / 100))}</span></>}
        </p>
      </div>
    </div>
  );
}
