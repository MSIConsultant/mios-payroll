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

function pct(n: number) {
  return (n * 100).toFixed(1) + '%';
}

function StatCard({
  label, value, sub, color,
}: {
  label: string; value: string; sub?: string;
  color: 'green' | 'red' | 'blue' | 'amber';
}) {
  const styles: Record<typeof color, string> = {
    green:  'bg-[var(--green-soft)]  border-[var(--green-border)]  text-[var(--green)]',
    red:    'bg-[var(--red-soft)]    border-[var(--red-border)]    text-[var(--red)]',
    blue:   'bg-[var(--brand-soft)]  border-blue-200               text-[var(--brand)]',
    amber:  'bg-[var(--amber-soft)]  border-[var(--amber-border)]  text-[var(--amber)]',
  };
  return (
    <div className={`rounded-xl border p-3 ${styles[color]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest opacity-60 leading-none">{label}</p>
      <p className="text-[15px] font-bold mt-1.5 font-mono leading-none">{value}</p>
      {sub && <p className="text-[10px] mt-1 opacity-60">{sub}</p>}
    </div>
  );
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
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl p-8 text-center shadow-[var(--shadow-sm)]">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center mx-auto mb-3">
          <TrendingUp size={20} className="text-[var(--text-muted)]" />
        </div>
        <p className="text-[14px] font-semibold text-[var(--text-secondary)] mb-1">Proyeksi Tahunan</p>
        <p className="text-[13px] text-[var(--text-muted)]">{emptyMessage ?? 'Masukkan gaji pokok untuk simulasi 12 bulan'}</p>
      </div>
    );
  }

  const maxThp = Math.max(...projection.rows.map(r => r.thp));
  const regularRow = projection.rows.find(r => !r.hasThr && !r.hasBonus && r.bulan !== 12) ?? projection.rows[0];
  const effectiveRate = projection.total.bruto > 0 ? projection.total.pph / projection.total.bruto : 0;
  const hasCTC = projection.rows.some(r => r.ctc > 0);

  return (
    <div className="space-y-3">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="THP / bulan"
          value={rpShort(regularRow.thp)}
          sub={rpFull(regularRow.thp)}
          color="green"
        />
        <StatCard
          label="PPh 21 / tahun"
          value={rpShort(projection.total.pph)}
          sub={rpFull(projection.total.pph)}
          color="red"
        />
        {hasCTC && (
          <StatCard
            label="CTC / bulan"
            value={rpShort(regularRow.ctc)}
            sub="biaya total perusahaan"
            color="blue"
          />
        )}
        <StatCard
          label="TER Efektif"
          value={pct(regularRow.ter)}
          sub={`rate PPh bulan normal`}
          color="amber"
        />
        {!hasCTC && (
          <StatCard
            label="Efektif Rate"
            value={pct(effectiveRate)}
            sub="PPh / Bruto setahun"
            color="amber"
          />
        )}
      </div>

      {/* Projection table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl overflow-hidden shadow-[var(--shadow-sm)]">
        <header className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[var(--brand-soft)] flex items-center justify-center">
            <TrendingUp size={14} className="text-[var(--brand)]" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)] leading-none">Proyeksi 12 Bulan</h2>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{new Date().getFullYear()} · real-time</p>
          </div>
        </header>

        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Bln</th>
              <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Bruto</th>
              <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">PPh 21</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">THP</th>
            </tr>
          </thead>
          <tbody>
            {projection.rows.map((row) => {
              let rowBg = '';
              if (row.hasThr)        rowBg = 'bg-amber-50/60';
              else if (row.hasBonus) rowBg = 'bg-blue-50/60';
              else if (row.bulan === 12) rowBg = 'bg-violet-50/60';

              return (
                <tr key={row.bulan} className={`border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)] transition-colors ${rowBg}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-[var(--text-secondary)]">{BULAN_SHORT[row.bulan - 1]}</span>
                      {row.hasThr && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">THR</span>
                      )}
                      {row.hasBonus && (
                        <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">BON</span>
                      )}
                      {row.bulan === 12 && !row.hasThr && !row.hasBonus && (
                        <span className="text-[9px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-full">P17</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[var(--text-secondary)]">{rpShort(row.bruto)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {row.isRefund ? (
                      <span className="text-amber-600 font-semibold text-[10px]">↩ refund</span>
                    ) : (
                      <div>
                        <span className={`font-mono ${row.pph > 0 ? 'text-[var(--red)]' : 'text-[var(--text-muted)]'}`}>
                          {rpShort(row.pph)}
                        </span>
                        {row.ter > 0 && (
                          <span className="block text-[9px] text-[var(--text-faint)] text-right mt-0.5">
                            {pct(row.ter)}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-right">
                      <span className="font-mono font-semibold text-[var(--green)]">{rpShort(row.thp)}</span>
                      {maxThp > 0 && (
                        <div className="mt-1 h-1 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${(row.thp / maxThp) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--bg-subtle)] border-t-2 border-[var(--border-default)]">
              <td className="px-4 py-3 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Total</td>
              <td className="px-3 py-3 text-right font-mono font-bold text-[var(--text-primary)]">{rpShort(projection.total.bruto)}</td>
              <td className="px-3 py-3 text-right font-mono font-bold text-[var(--red)]">{rpShort(projection.total.pph)}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-[var(--green)]">{rpShort(projection.total.thp)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Assumption footer */}
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex flex-col gap-1">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-0.5">Asumsi</p>
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
            <span className="font-semibold text-amber-600">THR</span>
            <span>{BULAN_FULL[thrBulan - 1]} · {thrPct}% gaji</span>
            {gajiPokok > 0 && (
              <span className="ml-auto font-semibold text-[var(--text-secondary)]">{rpFull(Math.round(gajiPokok * thrPct / 100))}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
            <span className="font-semibold text-blue-600">Bonus</span>
            <span>{BULAN_FULL[bonusBulan - 1]} · {bonusPct}% gaji</span>
            {gajiPokok > 0 && (
              <span className="ml-auto font-semibold text-[var(--text-secondary)]">{rpFull(Math.round(gajiPokok * bonusPct / 100))}</span>
            )}
          </div>
          {hasCTC && (
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)] mt-0.5">
              <span className="font-semibold text-[var(--brand)]">CTC/tahun</span>
              <span className="ml-auto font-semibold text-[var(--text-secondary)]">{rpFull(projection.total.ctc)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
