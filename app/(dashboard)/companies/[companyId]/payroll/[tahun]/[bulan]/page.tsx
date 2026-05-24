'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft, Save, Lock, Printer, Download,
  AlertTriangle, Share2, ChevronDown, ChevronRight,
  TrendingUp, Pencil, X, RefreshCw, CheckCircle2, Clock,
} from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { calculateMonthlySalary, calculateFreelance } from '@/lib/engine/payroll';
import { savePayrollRun, lockPayrollRun } from '@/lib/actions/payroll';
import { updateEmployee } from '@/lib/actions/employees';
import { printSlipGaji, printAllSlipGaji } from '@/lib/export/slip-gaji';
import { exportSPTMasa } from '@/lib/export/spt-masa';
import { exportBPJSTK, exportBPJSKes } from '@/lib/export/bpjs';
import { toast } from 'sonner';
import { createShareLink } from '@/lib/actions/share';
import { NominalInput } from '@/components/ui/FormattedInput';
import { CalcTooltipPopover, InfoDot, type CalcTooltipData } from '@/components/payroll/CalcTooltip';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { BPJS as BPJS_RATES, JP_MAX_BASIS, KES_MAX_BASIS } from '@/lib/engine/constants';

const BULAN_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const STATUS_CHIP: Record<string, string> = {
  locked: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  calculated: 'bg-sky-50 text-sky-700 ring-sky-200',
  draft: 'bg-amber-50 text-amber-700 ring-amber-200',
};

const STATUS_ICON: Record<string, typeof Lock> = {
  locked: Lock,
  calculated: CheckCircle2,
  draft: Clock,
};

/* ── Ledger row helpers (light-themed, tabular) ── */

function LedgerSectionLabel({ text }: { text: string }) {
  return (
    <div className="mt-4 mb-1">
      <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-muted)]">
        {text}
      </span>
    </div>
  );
}

function LedgerRow({
  label, value, color, indent, dim, calc, calcPosition,
}: {
  label: string;
  value: string;
  color?: string;
  indent?: boolean;
  dim?: boolean;
  calc?: CalcTooltipData;
  calcPosition?: 'below' | 'above';
}) {
  const labelEl = (
    <span
      className="text-[13px] text-[var(--text-secondary)] inline-flex items-baseline gap-1.5"
      style={{ paddingLeft: indent ? 16 : 0 }}
    >
      {label}
      {calc && <InfoDot />}
    </span>
  );
  const valueEl = (
    <span
      className={`font-mono text-[13px] font-semibold ${color ?? 'text-[var(--text-primary)]'}`}
    >
      {value}
    </span>
  );

  if (!calc) {
    return (
      <div className="flex justify-between items-baseline py-[3px]" style={{ opacity: dim ? 0.7 : 1 }}>
        {labelEl}
        {valueEl}
      </div>
    );
  }

  return (
    <div className="relative group" style={{ opacity: dim ? 0.7 : 1 }}>
      <div className="flex justify-between items-baseline py-[3px] cursor-help hover:bg-slate-50 rounded -mx-2 px-2 transition-colors">
        {labelEl}
        {valueEl}
      </div>
      <CalcTooltipPopover data={calc} position={calcPosition} />
    </div>
  );
}

function LedgerSep() {
  return <div className="my-2 border-t border-[var(--border-subtle)]" />;
}

function LedgerTotal({
  label, value, color, calc, calcPosition,
}: {
  label: string;
  value: string;
  color: string;
  calc?: CalcTooltipData;
  calcPosition?: 'below' | 'above';
}) {
  const labelEl = (
    <span className="text-[14px] font-bold text-[var(--text-primary)] inline-flex items-baseline gap-1.5">
      {label}
      {calc && <InfoDot />}
    </span>
  );
  const valueEl = <span className={`font-mono text-[15px] font-bold ${color}`}>{value}</span>;

  if (!calc) {
    return (
      <div className="flex justify-between items-baseline py-1.5">
        {labelEl}
        {valueEl}
      </div>
    );
  }

  return (
    <div className="relative group">
      <div className="flex justify-between items-baseline py-1.5 cursor-help hover:bg-slate-50 rounded -mx-2 px-2 transition-colors">
        {labelEl}
        {valueEl}
      </div>
      <CalcTooltipPopover data={calc} position={calcPosition} />
    </div>
  );
}

/* ── Pasal 17 equalization breakdown panel (December / last-month employees) ── */

function P17Row({ label, value, muted, bold, accent }: {
  label: string; value: string; muted?: boolean; bold?: boolean; accent?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline py-[2px]">
      <span className={`text-[12px] leading-relaxed ${muted ? 'text-[var(--text-faint)]' : 'text-[var(--text-secondary)]'}`}>
        {label}
      </span>
      <span className={`font-mono text-[12px] shrink-0 ml-2 ${bold ? 'font-bold' : 'font-medium'} ${
        accent ? 'text-violet-700' : 'text-[var(--text-primary)]'
      }`}>
        {value}
      </span>
    </div>
  );
}

function P17Divider() {
  return <div className="my-1.5 border-t border-violet-100" />;
}

function Pasal17BreakdownPanel({ res }: { res: any }) {
  const M = (res.months_in_year ?? 12) as number;
  const isGrossup = !!(res.pph_ditanggung && (res.tunj_pph_setahun ?? 0) > 0);
  const isEstimate = !!(res.proyeksi?.is_estimate);
  const bsBase = (res.bs_base ?? res.bs ?? 0) as number;
  const akumBruto = bsBase - (res.base ?? 0);
  const bulanIdx = (res.bulan as number) - 1;
  const periodName = BULAN_NAMES[bulanIdx] ?? `Bulan ${res.bulan}`;
  const prevName = M >= 2 ? (BULAN_NAMES[M - 2] ?? 'Nov') : '—';
  const rp = (n: number) => formatRupiah(n);
  const minus = (n: number) => `− ${rp(n)}`;
  const mult = (n: number, m: number) => rp(n * m);
  // Kes employer is only in bruto when employer_in_bruto exceeds jkk+jkm
  const kesEInBruto = (res.bpjs?.kes_e ?? 0) > 0 &&
    (res.bpjs?.employer_in_bruto ?? 0) > (res.bpjs?.jkk ?? 0) + (res.bpjs?.jkm ?? 0);

  // Pasal 17 brackets applied to the FINAL PKP
  const finalPkp = (res.pkp ?? 0) as number;
  const BRACKETS = [
    { w: 60_000_000,    r: 0.05 },
    { w: 190_000_000,   r: 0.15 },
    { w: 250_000_000,   r: 0.25 },
    { w: 4_500_000_000, r: 0.30 },
    { w: Infinity,      r: 0.35 },
  ];
  type BLine = { loM: number; hiM: number; portion: number; rate: number; tax: number; isTop: boolean };
  const bLines: BLine[] = [];
  let rem = finalPkp, cumLo = 0;
  for (const { w, r } of BRACKETS) {
    if (rem <= 0) break;
    const portion = Math.min(rem, w === Infinity ? rem : w);
    bLines.push({
      loM: Math.round(cumLo / 1_000_000),
      hiM: Math.round((cumLo + portion) / 1_000_000),
      portion, rate: r, tax: portion * r, isTop: w === Infinity,
    });
    rem -= portion;
    cumLo += w === Infinity ? portion : w;
  }

  // Marginal rate = bracket containing pkp_no_grossup (for closed-form formula display)
  const pkpBase = (res.pkp_no_grossup ?? finalPkp) as number;
  let marginalRate = 0.05;
  let cumW = 0;
  for (const { w, r } of BRACKETS) {
    const hi = cumW + (w === Infinity ? Infinity : w);
    if (pkpBase < hi) { marginalRate = r; break; }
    if (w !== Infinity) cumW += w;
  }
  const marginalPct = `${(marginalRate * 100).toFixed(0)}%`;
  const totalPengurang = (res.bj ?? 0) + (res.jht_k_tahunan ?? 0) + (res.jp_k_tahunan ?? 0);

  return (
    <div className="mt-5 pt-5 border-t border-violet-100">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3.5">
        <div className="w-1.5 h-5 rounded-full bg-violet-500 shrink-0" />
        <span className="text-[12px] font-bold uppercase tracking-widest text-violet-700">
          Rekonsiliasi PPh 21 Pasal 17 — {periodName}
        </span>
        {M < 12 && (
          <span className="text-[11px] text-violet-400 font-medium">({M} bulan)</span>
        )}
      </div>

      <div className="grid gap-2">
        {/* Step 1 — Bruto Setahun */}
        <div className="rounded-lg border border-violet-100 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 border-b border-violet-100">
            <span className="w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0 leading-none">1</span>
            <span className="text-[11px] font-semibold text-violet-700 uppercase tracking-wider">Bruto Setahun</span>
          </div>
          <div className="px-3 py-2.5">
            {isEstimate ? (
              <p className="text-[10px] text-violet-400 italic mb-1.5">
                Estimasi: akumulasi tidak ada — komponen bulan ini × {M}
              </p>
            ) : (
              <P17Row label={`Akumulasi Jan–${prevName} (dari DB)`} value={rp(akumBruto)} muted />
            )}

            {/* Component breakdown — shown for both cases */}
            <div className={`${!isEstimate ? 'mt-1' : ''} pl-2 border-l-2 border-violet-100`}>
              {!isEstimate && (
                <p className="text-[10px] text-[var(--text-faint)] mb-0.5">
                  Bruto {periodName} (rincian):
                </p>
              )}
              {/* Regular income */}
              <P17Row
                label={isEstimate ? `Gaji Pokok (${M} bln)` : 'Gaji Pokok'}
                value={isEstimate ? mult(res.gaji_pokok ?? 0, M) : rp(res.gaji_pokok ?? 0)}
                muted
              />
              {(res.benefit ?? 0) > 0 && (
                <P17Row
                  label={isEstimate ? `Benefit (${M} bln)` : 'Benefit'}
                  value={isEstimate ? mult(res.benefit ?? 0, M) : rp(res.benefit ?? 0)}
                  muted
                />
              )}
              {(res.kendaraan ?? 0) > 0 && (
                <P17Row
                  label={isEstimate ? `Tunjangan Kendaraan (${M} bln)` : 'Tunj. Kendaraan'}
                  value={isEstimate ? mult(res.kendaraan ?? 0, M) : rp(res.kendaraan ?? 0)}
                  muted
                />
              )}
              {(res.pulsa ?? 0) > 0 && (
                <P17Row
                  label={isEstimate ? `Tunjangan Pulsa (${M} bln)` : 'Tunj. Pulsa'}
                  value={isEstimate ? mult(res.pulsa ?? 0, M) : rp(res.pulsa ?? 0)}
                  muted
                />
              )}
              {(res.operasional ?? 0) > 0 && (
                <P17Row
                  label={isEstimate ? `Tunjangan Operasional (${M} bln)` : 'Tunj. Operasional'}
                  value={isEstimate ? mult(res.operasional ?? 0, M) : rp(res.operasional ?? 0)}
                  muted
                />
              )}
              {(res.tunj_lain ?? 0) > 0 && (
                <P17Row
                  label={isEstimate ? `Tunjangan Lain (${M} bln)` : 'Tunj. Lain'}
                  value={isEstimate ? mult(res.tunj_lain ?? 0, M) : rp(res.tunj_lain ?? 0)}
                  muted
                />
              )}
              {/* BPJS employer in bruto */}
              {(res.bpjs?.jkk ?? 0) > 0 && (
                <P17Row
                  label={isEstimate ? `JKK Employer (${M} bln)` : 'JKK Employer'}
                  value={isEstimate ? mult(res.bpjs.jkk, M) : rp(res.bpjs.jkk)}
                  muted
                />
              )}
              {(res.bpjs?.jkm ?? 0) > 0 && (
                <P17Row
                  label={isEstimate ? `JKM Employer (${M} bln)` : 'JKM Employer'}
                  value={isEstimate ? mult(res.bpjs.jkm, M) : rp(res.bpjs.jkm)}
                  muted
                />
              )}
              {kesEInBruto && (
                <P17Row
                  label={isEstimate ? `Kes Employer 4% (${M} bln)` : 'Kes Employer 4%'}
                  value={isEstimate ? mult(res.bpjs.kes_e, M) : rp(res.bpjs.kes_e)}
                  muted
                />
              )}
              {/* BPJS karyawan tunj (if company tanggung) */}
              {(res.bpjs?.tunj_jht ?? 0) > 0 && (
                <P17Row
                  label={isEstimate ? `Tunj. JHT Karyawan (${M} bln)` : 'Tunj. JHT Karyawan'}
                  value={isEstimate ? mult(res.bpjs.tunj_jht, M) : rp(res.bpjs.tunj_jht)}
                  muted
                />
              )}
              {(res.bpjs?.tunj_jp ?? 0) > 0 && (
                <P17Row
                  label={isEstimate ? `Tunj. JP Karyawan (${M} bln)` : 'Tunj. JP Karyawan'}
                  value={isEstimate ? mult(res.bpjs.tunj_jp, M) : rp(res.bpjs.tunj_jp)}
                  muted
                />
              )}
              {(res.bpjs?.tunj_kes ?? 0) > 0 && (
                <P17Row
                  label={isEstimate ? `Tunj. Kes Karyawan (${M} bln)` : 'Tunj. Kes Karyawan'}
                  value={isEstimate ? mult(res.bpjs.tunj_kes, M) : rp(res.bpjs.tunj_kes)}
                  muted
                />
              )}
              {/* THR / Bonus — one-time, not multiplied */}
              {(res.thr_nominal ?? 0) > 0 && (
                <P17Row label="THR" value={rp(res.thr_nominal ?? 0)} muted />
              )}
              {(res.bonus_nominal ?? 0) > 0 && (
                <P17Row label="Bonus" value={rp(res.bonus_nominal ?? 0)} muted />
              )}
            </div>

            {isGrossup && (
              <P17Row label={`+ Tunjangan PPh ${periodName} (TP)`} value={`+ ${rp(res.tunj_pph ?? 0)}`} accent />
            )}
            <P17Divider />
            <P17Row label="Bruto Setahun" value={rp(res.bs ?? bsBase)} bold />
          </div>
        </div>

        {/* Step 2 — Pengurang */}
        <div className="rounded-lg border border-violet-100 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 border-b border-violet-100">
            <span className="w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0 leading-none">2</span>
            <span className="text-[11px] font-semibold text-violet-700 uppercase tracking-wider">Pengurang</span>
          </div>
          <div className="px-3 py-2.5">
            <P17Row
              label={`Biaya Jabatan (5%, cap Rp ${formatRupiah(500_000 * M)})`}
              value={minus(res.bj ?? 0)}
            />
            {(res.jht_k_tahunan ?? 0) > 0 && (
              <P17Row label={`Iuran JHT Karyawan 2% × ${M} bln`} value={minus(res.jht_k_tahunan)} />
            )}
            {(res.jp_k_tahunan ?? 0) > 0 && (
              <P17Row label={`Iuran JP Karyawan 1% × ${M} bln`} value={minus(res.jp_k_tahunan)} />
            )}
            <p className="text-[10px] text-[var(--text-faint)] italic mt-1 leading-relaxed">
              BPJS Kes Karyawan (1%) bukan pengurang — hanya JHT &amp; JP per UU HPP
            </p>
            <P17Divider />
            <P17Row label="Total Pengurang" value={minus(totalPengurang)} bold />
          </div>
        </div>

        {/* Step 3 — Netto → PKP */}
        <div className="rounded-lg border border-violet-100 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 border-b border-violet-100">
            <span className="w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0 leading-none">3</span>
            <span className="text-[11px] font-semibold text-violet-700 uppercase tracking-wider">Netto → PKP</span>
          </div>
          <div className="px-3 py-2.5">
            <P17Row label="Netto Setahun" value={rp(res.netto ?? 0)} />
            <P17Row label={`− PTKP (${res.status_ptkp ?? ''})`} value={minus(res.ptkp ?? 0)} />
            <P17Divider />
            <P17Row label="PKP (floor ke ribuan)" value={rp(res.pkp ?? 0)} bold />
          </div>
        </div>

        {/* Step 4 — PPh Pasal 17 */}
        <div className="rounded-lg border border-violet-100 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 border-b border-violet-100">
            <span className="w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0 leading-none">4</span>
            <span className="text-[11px] font-semibold text-violet-700 uppercase tracking-wider">
              PPh Pasal 17{isGrossup ? ' + Grossup' : ''}
            </span>
          </div>
          <div className="px-3 py-2.5">
            {bLines.map((b, i) => (
              <P17Row
                key={i}
                label={b.isTop
                  ? `Sisa > ${b.loM}jt × ${(b.rate * 100).toFixed(0)}%`
                  : `${b.loM}jt – ${b.hiM}jt × ${(b.rate * 100).toFixed(0)}%`}
                value={rp(b.tax)}
                muted
              />
            ))}
            {isGrossup && (
              <div className="mt-2 rounded-md bg-violet-50 border border-violet-200 px-3 py-2">
                <p className="text-[11px] font-semibold text-violet-700 mb-1.5">
                  Grossup — closed-form Pasal 17
                </p>
                <div className="flex items-center gap-1.5 font-mono text-[12px] text-violet-900 flex-wrap">
                  <span>TP</span>
                  <span className="text-violet-400">=</span>
                  <span>{rp(res.pph_no_grossup ?? 0)}</span>
                  <span className="text-violet-400">÷</span>
                  <span>(1 − {marginalPct})</span>
                  <span className="text-violet-400">≈</span>
                  <span className="font-bold">{rp(res.tunj_pph_setahun ?? 0)}</span>
                </div>
                <p className="text-[10px] text-violet-500 mt-1 leading-relaxed">
                  PKP masuk lapis {marginalPct} → tarif marginal {marginalPct} → iterasi konvergen
                </p>
              </div>
            )}
            <P17Divider />
            <P17Row label="PPh Setahun (Pasal 17)" value={rp(res.pph_tahunan ?? 0)} bold />
          </div>
        </div>

        {/* Rekonsiliasi summary box */}
        <div className="rounded-lg bg-violet-50 border border-violet-200 px-4 py-3">
          <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider mb-2.5">
            Rekonsiliasi
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-center">
              <p className="text-[10px] text-violet-500 mb-0.5">PPh Setahun</p>
              <p className="font-mono font-bold text-[13px] text-violet-900">{rp(res.pph_tahunan ?? 0)}</p>
            </div>
            <span className="text-violet-400 font-bold text-lg select-none">−</span>
            <div className="text-center">
              <p className="text-[10px] text-violet-500 mb-0.5">
                {M > 1 ? `PPh Jan–${prevName}` : 'PPh Lalu'}
              </p>
              <p className="font-mono font-bold text-[13px] text-violet-900">{rp(res.pph_jan_nov ?? 0)}</p>
            </div>
            <span className="text-violet-400 font-bold text-lg select-none">=</span>
            <div className={`text-center rounded-lg px-3 py-1.5 ${
              res.is_refund
                ? 'bg-amber-100 border border-amber-200'
                : 'bg-emerald-50 border border-emerald-200'
            }`}>
              <p className={`text-[10px] mb-0.5 font-medium ${res.is_refund ? 'text-amber-600' : 'text-emerald-600'}`}>
                {res.is_refund ? '← Refund karyawan' : `PPh ${periodName}`}
              </p>
              <p className={`font-mono font-bold text-[14px] ${res.is_refund ? 'text-amber-800' : 'text-emerald-800'}`}>
                {res.is_refund ? `− ${rp(res.refund_amount ?? 0)}` : rp(res.pph ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Quick edit modal ── */

function QuickEditModal({
  employee, onClose, onSaveAndRecalc,
}: {
  employee: any;
  onClose: () => void;
  onSaveAndRecalc: (empId: string, companyId: string, formData: FormData) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const fields = [
      'nama', 'nik', 'npwp', 'punya_npwp', 'status_ptkp', 'jenis_kelamin',
      'tanggal_masuk', 'divisi', 'jabatan', 'jenis_karyawan', 'jkk_rate',
      'ikut_jht', 'ikut_jp', 'ikut_jkp', 'ikut_kes',
      'tanggung_jht_k', 'tanggung_jp_k', 'tanggung_kes_k', 'pph_ditanggung',
    ];
    for (const f of fields) {
      if (!fd.has(f)) {
        if (typeof employee[f] === 'boolean' && employee[f]) {
          fd.append(f, 'on');
        } else if (typeof employee[f] === 'string' || typeof employee[f] === 'number') {
          fd.append(f, String(employee[f]));
        }
      }
    }
    await onSaveAndRecalc(employee.id, employee.company_id, fd);
    setSaving(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-[var(--bg-overlay)] z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--border-default)]">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Edit Kompensasi
            </h3>
            <p className="text-[13px] text-[var(--text-muted)] mt-0.5 truncate">{employee.nama}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <NominalInput label="Gaji Pokok" name="gaji_pokok" defaultValue={employee.gaji_pokok} />
            <NominalInput label="Benefit / Tunj. Tetap" name="benefit" defaultValue={employee.benefit} />
            <NominalInput label="Tunjangan Kendaraan" name="kendaraan" defaultValue={employee.kendaraan} />
            <NominalInput label="Tunjangan Pulsa" name="pulsa" defaultValue={employee.pulsa} />
            <NominalInput label="Tunjangan Operasional" name="operasional" defaultValue={employee.operasional} />
            <NominalInput label="Tunjangan Lain" name="tunj_lain" defaultValue={employee.tunj_lain} />
          </div>

          <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
            Perubahan akan disimpan ke database dan payroll bulan ini dihitung ulang otomatis.
          </p>

          <div className="flex gap-3 pt-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={saving ? 'animate-spin' : ''} />
              {saving ? 'Menyimpan…' : 'Simpan & Hitung Ulang'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main page ── */

export default function PayrollRunPage() {
  const { companyId, tahun, bulan } = useParams();
  const confirm = useConfirm();
  const [employees, setEmployees]         = useState<any[]>([]);
  const [events, setEvents]               = useState<any[]>([]);
  const [existingRun, setExistingRun]     = useState<any>(null);
  const [results, setResults]             = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [isCalculated, setIsCalculated]   = useState(false);
  const [isAutoCalcing, setIsAutoCalcing] = useState(false);
  const [company, setCompany]             = useState<any>(null);
  const [sharing, setSharing]             = useState(false);
  const [shareCopied, setShareCopied]     = useState(false);
  const [calcProgress, setCalcProgress]   = useState({ current: 0, total: 0 });
  const [accumMap, setAccumMap]           = useState<Record<string, { akum_bruto: number; pph_jan_nov: number }>>({});
  const [showYTD, setShowYTD]             = useState(false);
  const [quickEditEmp, setQuickEditEmp]   = useState<any>(null);
  const autoCalcRef = useRef(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const [{ data: co }, { data: empData }, { data: eventData }, { data: runData }] = await Promise.all([
        supabase.from('companies').select('name, npwp_perusahaan').eq('id', companyId).single(),
        supabase.from('employees').select('*').eq('company_id', companyId).eq('aktif', true),
        supabase.from('employee_events').select('*')
          .eq('company_id', companyId).eq('tahun', tahun).eq('bulan', bulan),
        supabase.from('payroll_runs').select('*, payroll_results(*)')
          .eq('company_id', companyId).eq('tahun', tahun).eq('bulan', bulan).maybeSingle(),
      ]);

      const newAccumMap: Record<string, { akum_bruto: number; pph_jan_nov: number }> = {};
      if (empData) {
        const { data: prevRuns } = await supabase
          .from('payroll_runs').select('id, bulan')
          .eq('company_id', companyId).eq('tahun', tahun).lt('bulan', Number(bulan));
        if (prevRuns?.length) {
          const { data: prevResults } = await supabase
            .from('payroll_results').select('employee_id, bruto, pph')
            .in('run_id', prevRuns.map((r) => r.id));
          for (const r of prevResults ?? []) {
            if (!newAccumMap[r.employee_id])
              newAccumMap[r.employee_id] = { akum_bruto: 0, pph_jan_nov: 0 };
            newAccumMap[r.employee_id].akum_bruto  += r.bruto ?? 0;
            newAccumMap[r.employee_id].pph_jan_nov += r.pph   ?? 0;
          }
        }
      }

      if (co) setCompany(co);
      setAccumMap(newAccumMap);
      const enrichedEmps = (empData ?? []).map((emp) => ({
        ...emp,
        _akum_bruto:  newAccumMap[emp.id]?.akum_bruto  ?? 0,
        _pph_jan_nov: newAccumMap[emp.id]?.pph_jan_nov ?? 0,
      }));
      setEmployees(enrichedEmps);
      if (eventData) setEvents(eventData);

      if (runData) {
        setExistingRun(runData);
        if (runData.payroll_results?.length > 0) {
          const mapped = runData.payroll_results.map((r: any) => ({
            ...r.result_json,
            employee_id: r.employee_id,
            employee_name: empData?.find((e) => e.id === r.employee_id)?.nama,
          }));
          setResults(mapped);
          setIsCalculated(true);
        }
      } else if ((empData ?? []).length > 0 && !autoCalcRef.current) {
        autoCalcRef.current = true;
        setIsAutoCalcing(true);
      }
      setLoading(false);
    }
    fetchData();
  }, [companyId, tahun, bulan]);

  useEffect(() => {
    if (isAutoCalcing && employees.length > 0 && !isCalculated) {
      handleCalculate();
      setIsAutoCalcing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoCalcing, employees]);

  function runCalculation(emps: any[], evts: any[]) {
    return new Promise<any[]>((resolve) => {
      setCalcProgress({ current: 0, total: emps.length });
      const newResults: any[] = [];
      let i = 0;
      function processNext() {
        if (i >= emps.length) {
          setCalcProgress({ current: 0, total: 0 });
          resolve(newResults);
          return;
        }
        const emp = emps[i];
        const empEvents     = evts.filter((e) => e.employee_id === emp.id);
        const kasbon        = empEvents.filter((e) => e.tipe === 'kasbon').reduce((a: number, b: any) => a + b.nilai, 0);
        const alpha_telat   = empEvents.filter((e) => e.tipe === 'alpha_telat').reduce((a: number, b: any) => a + b.nilai, 0);
        const pot_lain      = empEvents.filter((e) => e.tipe === 'pot_lain').reduce((a: number, b: any) => a + b.nilai, 0);
        const thr           = empEvents.filter((e) => e.tipe === 'thr').reduce((a: number, b: any) => a + b.nilai, 0);
        const bonus         = empEvents.filter((e) => e.tipe === 'bonus').reduce((a: number, b: any) => a + b.nilai, 0);
        const benefit_extra = empEvents.filter((e) => e.tipe === 'benefit_extra').reduce((a: number, b: any) => a + b.nilai, 0);
        let calcResult: any = {};
        if (emp.jenis_karyawan === 'tetap') {
          // Mid-year exit detection: if this run's month matches the employee's
          // tanggal_keluar month/year, route through Pasal 17 reconciliation
          // (isLastMonth) and scale annual caps to actual months worked.
          const runYear  = Number(tahun);
          const runMonth = Number(bulan);
          const exitDate  = emp.tanggal_keluar ? new Date(`${emp.tanggal_keluar}T00:00:00`) : null;
          const entryDate = emp.tanggal_masuk  ? new Date(`${emp.tanggal_masuk}T00:00:00`)  : null;
          const isLastMonth =
            !!exitDate &&
            exitDate.getFullYear() === runYear &&
            (exitDate.getMonth() + 1) === runMonth;
          let months_in_year = 12;
          if (isLastMonth) {
            const startMonth = entryDate && entryDate.getFullYear() === runYear
              ? (entryDate.getMonth() + 1)
              : 1;
            months_in_year = Math.max(1, Math.min(12, runMonth - startMonth + 1));
          }

          calcResult = calculateMonthlySalary({
            ...emp, bulan: runMonth, tahun: runYear,
            kasbon, alpha_telat,
            pot_lain: pot_lain + (emp.pot_lain || 0),
            tunj_lain: (emp.tunj_lain ?? 0) + benefit_extra,
            thr, bonus,
            pph_jan_nov: emp._pph_jan_nov ?? 0,
            akum_bruto: emp._akum_bruto ?? 0,
            isLastMonth,
            months_in_year,
          });
        } else {
          calcResult = calculateFreelance({
            ...emp,
            mode: emp.jenis_karyawan === 'tidak_tetap_harian' ? 'harian' : 'bulanan',
            upah_harian: emp.upah_harian,
            hari_kerja: emp.hari_kerja_default || 22,
            upah_bulanan: emp.upah_bulanan_tt,
            tunjangan: (emp.tunjangan_tt || 0) + benefit_extra,
            thr, bonus,
            ikut_bpjs_tk: emp.ikut_jht || emp.ikut_jp,
            ikut_kes: emp.ikut_kes,
            kasbon, pot_lain: pot_lain + (emp.pot_lain || 0),
          });
        }
        newResults.push({ ...calcResult, employee_id: emp.id, employee_name: emp.nama });
        i++;
        setCalcProgress((p) => ({ ...p, current: i }));
        setTimeout(processNext, 0);
      }
      processNext();
    });
  }

  function handleCalculate() {
    // Skip recompute for locked runs — saved values are authoritative and the
    // "Hitung Ulang" button is hidden when locked, but guard here too in case
    // some path triggers calculate (auto-calc effect, accidental click).
    if (existingRun?.status === 'locked') {
      toast.error('Run sudah dikunci — tidak dapat dihitung ulang.');
      return;
    }
    runCalculation(employees, events).then((newResults) => {
      setResults(newResults);
      setIsCalculated(true);
    });
  }

  async function handleQuickEdit(empId: string, companyId: string, formData: FormData) {
    const res = await updateEmployee(empId, companyId as string, formData);
    if (res.error) {
      toast.error(res.error);
      return;
    }

    const supabase = createClient();
    const { data: updatedEmp } = await supabase
      .from('employees').select('*').eq('id', empId).single();
    if (!updatedEmp) {
      toast.error('Gagal refresh data karyawan');
      return;
    }

    const enriched = {
      ...updatedEmp,
      _akum_bruto: accumMap[empId]?.akum_bruto ?? 0,
      _pph_jan_nov: accumMap[empId]?.pph_jan_nov ?? 0,
    };

    const updatedEmps = employees.map((e) => (e.id === empId ? enriched : e));
    setEmployees(updatedEmps);

    const singleResult = await runCalculation(
      [enriched],
      events.filter((e) => e.employee_id === empId),
    );
    setResults((prev) =>
      prev.map((r) =>
        r.employee_id === empId
          ? { ...singleResult[0], employee_id: empId, employee_name: updatedEmp.nama }
          : r,
      ),
    );

    toast.success(`${updatedEmp.nama} — dihitung ulang`);
  }

  async function handleShare() {
    if (!existingRun?.id) return;
    setSharing(true);
    const res = await createShareLink(existingRun.id, companyId as string, Number(tahun), Number(bulan));
    if (res.error) toast.error(res.error);
    else {
      await navigator.clipboard.writeText(res.url!);
      setShareCopied(true);
      toast.success('Link disalin ke clipboard');
      setTimeout(() => setShareCopied(false), 3000);
    }
    setSharing(false);
  }

  async function handleSave() {
    setSaving(true);
    const res = await savePayrollRun(companyId as string, Number(tahun), Number(bulan), results);
    if (res.error) {
      toast.error(res.error);
      setSaving(false);
      return;
    }
    setExistingRun((p: any) => ({ ...p, id: res.runId, status: 'calculated' }));
    toast.success('Payroll disimpan');
    setSaving(false);
  }

  async function handleLock() {
    if (!existingRun?.id) return;
    if (!(await confirm({
      title: `Kunci payroll ${BULAN_NAMES[Number(bulan) - 1]} ${tahun}?`,
      message: 'Setelah dikunci, data tidak bisa diubah atau dihapus lagi.',
      severity: 'danger',
      confirmLabel: 'Kunci',
    }))) return;
    setSaving(true);
    const res = await lockPayrollRun(existingRun.id, companyId as string, Number(tahun), Number(bulan));
    if (res.error) {
      toast.error(res.error);
      setSaving(false);
      return;
    }
    setExistingRun((p: any) => ({ ...p, status: 'locked' }));
    toast.success('Payroll dikunci');
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="h-20 bg-white border border-[var(--border-default)] rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-[var(--border-default)] rounded-xl animate-pulse" />
          ))}
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="h-48 bg-white border border-[var(--border-default)] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const isLocked   = existingRun?.status === 'locked';
  const isDesember = Number(bulan) === 12;
  const totalBruto = results.reduce((a, r) => a + (r.bruto || r.total_upah || 0), 0);
  const totalPph   = results.reduce((a, r) => a + (r.pph || r.total_pph || 0), 0);
  const totalThp   = results.reduce((a, r) => a + (r.thp || 0), 0);
  const totalCtc   = results.reduce((a, r) => a + (r.bruto || r.total_upah || 0) + (r.bpjs?.employer_offslip || 0), 0);
  const hasYTD     = Object.keys(accumMap).length > 0;
  const isCalcing  = calcProgress.total > 0;
  const runStatus  = existingRun?.status ?? (isCalcing ? 'calculating' : 'draft');
  const StatusIconCmp = STATUS_ICON[runStatus] ?? Clock;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {quickEditEmp && !isLocked && (
        <QuickEditModal
          employee={quickEditEmp}
          onClose={() => setQuickEditEmp(null)}
          onSaveAndRecalc={handleQuickEdit}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link
          href={`/companies/${companyId}/payroll`}
          className="inline-flex items-center gap-1 hover:text-[var(--brand)] transition-colors"
        >
          <ArrowLeft size={14} />
          {company?.name ?? 'Perusahaan'} · Payroll
        </Link>
      </div>

      {/* Header */}
      <header className="bg-white border border-[var(--border-default)] rounded-xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                {BULAN_NAMES[Number(bulan) - 1]} {tahun}
              </h1>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${
                  STATUS_CHIP[runStatus] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
                }`}
              >
                <StatusIconCmp size={11} />
                {runStatus === 'calculating' ? 'Menghitung…' : runStatus}
              </span>
            </div>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {company?.name ?? '—'} · {results.length} karyawan
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {isCalculated && (
              <>
                <button
                  onClick={() => printAllSlipGaji(results, company, Number(bulan), Number(tahun))}
                  title="Cetak semua slip gaji dalam satu jendela"
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <Printer size={14} />
                  Cetak Semua
                </button>
                <button
                  onClick={() => exportSPTMasa(results, company, employees, Number(bulan), Number(tahun))}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <Download size={14} />
                  SPT PPh 21
                </button>
                <button
                  onClick={() => exportBPJSTK(results, employees, company, Number(bulan), Number(tahun))}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <Download size={14} />
                  BPJS TK
                </button>
                <button
                  onClick={() => exportBPJSKes(results, employees, company, Number(bulan), Number(tahun))}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <Download size={14} />
                  BPJS Kes
                </button>
              </>
            )}
            {existingRun?.status === 'locked' && (
              <button
                onClick={handleShare}
                disabled={sharing}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Share2 size={14} />
                {shareCopied ? 'Tersalin!' : sharing ? '…' : 'Bagikan'}
              </button>
            )}

            {isCalcing ? (
              <div className="flex items-center gap-3 px-3 py-2 bg-white border border-[var(--border-default)] rounded-lg">
                <div className="w-32 h-1.5 rounded-full overflow-hidden bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[var(--brand)] transition-all duration-150"
                    style={{
                      width: `${(calcProgress.current / calcProgress.total) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  {calcProgress.current}/{calcProgress.total}
                </span>
              </div>
            ) : (
              !isLocked && (
                <button
                  onClick={handleCalculate}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <RefreshCw size={14} />
                  {isCalculated ? 'Hitung Ulang' : 'Hitung'}
                </button>
              )
            )}

            {isCalculated && !isLocked && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              >
                <Save size={14} />
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            )}
            {existingRun?.status === 'calculated' && (
              <button
                onClick={handleLock}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-50 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Lock size={14} />
                Kunci
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Auto-calc indicator */}
      {isCalcing && !isCalculated && (
        <div className="bg-white border border-[var(--border-default)] rounded-xl p-10 text-center animate-fade-in">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--brand)] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">
            Menghitung {calcProgress.current} / {calcProgress.total} karyawan…
          </p>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">
            Otomatis dihitung saat halaman dibuka
          </p>
        </div>
      )}

      {/* Summary cards */}
      {isCalculated && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label="Total Bruto" value={formatRupiah(totalBruto)} />
          <SummaryCard label="Total PPh 21" value={formatRupiah(totalPph)} tone="amber" />
          <SummaryCard label="Total THP" value={formatRupiah(totalThp)} tone="emerald" />
          <SummaryCard label="Total CTC" value={formatRupiah(totalCtc)} tone="sky" />
        </div>
      )}

      {/* December warning */}
      {isDesember && isCalculated && (
        <div className="rounded-xl p-5 flex items-start gap-3 bg-amber-50 border border-amber-200 animate-fade-in">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Equalisasi Desember</p>
            <p className="text-[13px] text-amber-700 mt-1 leading-relaxed">
              Equalisasi Desember akan menghasilkan PPh{' '}
              <span className="font-semibold font-mono">{formatRupiah(totalPph)}</span> untuk{' '}
              {results.length} karyawan menggunakan metode Pasal 17 tahunan.
            </p>
          </div>
        </div>
      )}

      {/* YTD Ledger */}
      {isCalculated && hasYTD && (
        <div className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowYTD((v) => !v)}
            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <TrendingUp size={15} className="text-[var(--brand)]" />
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                YTD Ledger — s/d {BULAN_NAMES[Number(bulan) - 2] || BULAN_NAMES[0]}
              </span>
            </div>
            {showYTD ? (
              <ChevronDown size={16} className="text-[var(--text-muted)]" />
            ) : (
              <ChevronRight size={16} className="text-[var(--text-muted)]" />
            )}
          </button>
          {showYTD && (
            <div className="overflow-x-auto border-t border-[var(--border-subtle)]">
              <table>
                <thead>
                  <tr>
                    {['Nama', 'Akum. Bruto', 'Akum. PPh', 'Bulan Ini', 'Est. Tahunan'].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((res, i) => {
                    const acc       = accumMap[res.employee_id] ?? { akum_bruto: 0, pph_jan_nov: 0 };
                    const thisBruto = res.bruto ?? res.total_upah ?? 0;
                    const projected = ((acc.akum_bruto + thisBruto) / Number(bulan)) * 12;
                    return (
                      <tr key={i}>
                        <td className="font-semibold text-[var(--text-primary)]">
                          {res.employee_name}
                        </td>
                        <td className="font-mono">{formatRupiah(acc.akum_bruto)}</td>
                        <td className="font-mono text-amber-700">{formatRupiah(acc.pph_jan_nov)}</td>
                        <td className="font-mono">{formatRupiah(thisBruto)}</td>
                        <td className="font-mono text-sky-700">{formatRupiah(projected)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Per-employee results */}
      {isCalculated && (
        <div className="space-y-4">
          {results.map((res, i) => {
            const isTetap     = !res.mode || res.mode === undefined;
            const bpjsK       = res.bpjs?.karyawan_potong ?? res.tot_bpjs ?? 0;
            const ctc         = (res.bruto || res.total_upah || 0) + (res.bpjs?.employer_offslip ?? 0);
            const bpjsJKK     = res.bpjs?.jkk ?? 0;
            const bpjsJKM     = res.bpjs?.jkm ?? 0;
            const bpjsKesE    = res.bpjs?.kes_e ?? 0;
            const bpjsTunjJHT = res.bpjs?.tunj_jht ?? 0;
            const bpjsTunjJP  = res.bpjs?.tunj_jp  ?? 0;
            const bpjsTunjKes = res.bpjs?.tunj_kes ?? 0;
            const bpjsJHTE    = res.bpjs?.jht_e ?? 0;
            const bpjsJPE     = res.bpjs?.jp_e  ?? 0;
            const bpjsInBruto = bpjsJKK + bpjsJKM + bpjsKesE;
            const bpjsTunj    = bpjsTunjJHT + bpjsTunjJP + bpjsTunjKes;
            const bpjsPotJHT  = res.bpjs?.pot_jht ?? 0;
            const bpjsPotJP   = res.bpjs?.pot_jp  ?? 0;
            const bpjsPotKes  = res.bpjs?.pot_kes ?? 0;
            const grossPend   = (res.gaji_pokok ?? 0) + (res.allowance_total ?? 0);

            const sourceEmp = employees.find((e) => e.id === res.employee_id);

            // ── Calculation breakdown tooltips ───────────────────────────────
            const basis    = res.bpjs?._basis    ?? res.basis ?? res.gaji_pokok ?? 0;
            const jpBasis  = res.bpjs?._jp_basis  ?? Math.min(basis, JP_MAX_BASIS);
            const kesBasis = res.bpjs?._kes_basis ?? Math.min(basis, KES_MAX_BASIS);
            const jkkRate  = sourceEmp?.jkk_rate ?? 0;
            const rpFmt    = (n: number) => formatRupiah(Math.round(n));
            const pct      = (r: number) => `${(r * 100).toFixed(2)}%`;

            const calcBruto: CalcTooltipData | undefined = isTetap ? {
              title: 'BRUTO',
              description: 'Total penghasilan kena pajak',
              steps: [
                { label: 'Gaji Pokok',            value: rpFmt(res.gaji_pokok ?? 0),    op: '+' },
                ...((res.allowance_total ?? 0) > 0 ? [{ label: 'Total Tunjangan',   value: rpFmt(res.allowance_total ?? 0), op: '+' as const }] : []),
                ...(bpjsInBruto > 0 ? [{ label: 'BPJS Employer (bruto)', value: rpFmt(bpjsInBruto), op: '+' as const }] : []),
                ...(bpjsTunj > 0 ? [{ label: 'Tunj. BPJS Karyawan',   value: rpFmt(bpjsTunj),    op: '+' as const }] : []),
                ...((res.tunj_pph ?? 0) > 0 ? [{ label: 'Tunj. PPh 21 (Grossup)', value: rpFmt(res.tunj_pph ?? 0), op: '+' as const }] : []),
                { label: 'BRUTO', value: rpFmt(res.bruto ?? 0), highlight: true },
              ],
            } : undefined;

            const calcPph: CalcTooltipData | undefined = (isTetap && res.ter != null) ? {
              title: 'PPh 21 — Metode TER',
              description: 'TER% × Bruto',
              steps: [
                { label: `PTKP ${res.status_ptkp ?? '—'} → Grup ${res.grup ?? '—'}`, value: '', muted: true },
                { label: 'Bruto',    value: rpFmt(res.bruto ?? 0),  op: '×' },
                { label: 'TER Rate', value: pct(res.ter),           op: '=' },
                ...((res.punya_npwp === false) ? [{ label: 'Non-NPWP (×1.2)', value: '', muted: true }] : []),
                { label: 'PPh 21',   value: rpFmt(res.pph ?? 0),    highlight: true },
              ],
              footer: 'PMK 168/2023',
            } : undefined;

            const calcPphDes: CalcTooltipData | undefined = (isTetap && res.ter == null) ? (() => {
              const M = res.months_in_year ?? 12;
              const isMidYear = res.is_last_month === true && res.bulan !== 12;
              const periodTitle = isMidYear
                ? `Bulan Terakhir Kerja (${M} bulan)`
                : 'Desember (12 bulan)';

              const steps: Array<{ label: string; value: string; op?: '+' | '-' | '×' | '÷' | '='; highlight?: boolean; muted?: boolean }> = [];

              // Step 1: Bruto setahun
              if (res.bulan === 12 && (res.proyeksi?.bruto_setahun ?? 0) > (res.base ?? 0)) {
                // Show Jan-Nov + this month breakdown when accumulator data available
                const akum = (res.bs ?? 0) - (res.base ?? 0);
                steps.push({ label: `Bruto Jan–Nov (akumulasi)`, value: rpFmt(akum), op: '+', muted: true });
                steps.push({ label: `Bruto bulan ini`, value: rpFmt(res.base ?? 0), op: '+', muted: true });
              }
              steps.push({ label: `Bruto setahun (${M} bulan)`, value: rpFmt(res.bs ?? 0) });

              // Step 2: Biaya Jabatan
              steps.push({
                label: `− Biaya Jabatan (cap ${formatRupiah(500_000 * M)})`,
                value: rpFmt(res.bj ?? 0),
                op: '-',
              });

              // Step 3: Iuran karyawan (JHT + JP separately)
              if ((res.jht_k_tahunan ?? 0) > 0) {
                steps.push({ label: '− Iuran JHT Karyawan', value: rpFmt(res.jht_k_tahunan ?? 0), op: '-' });
              }
              if ((res.jp_k_tahunan ?? 0) > 0) {
                steps.push({ label: '− Iuran JP Karyawan', value: rpFmt(res.jp_k_tahunan ?? 0), op: '-' });
              }

              // Netto + PTKP
              steps.push({ label: 'Netto Setahun', value: rpFmt(res.netto ?? 0), muted: true });
              steps.push({ label: `− PTKP ${res.status_ptkp ?? ''}`, value: rpFmt(res.ptkp ?? 0), op: '-' });
              steps.push({ label: 'PKP (pembulatan ribuan)', value: rpFmt(res.pkp ?? 0), muted: true });

              // Step 5: Pasal 17 progressive brackets — show portions actually used
              const pkp = res.pkp ?? 0;
              if (pkp > 0) {
                const brackets: Array<{ width: number; rate: number }> = [
                  { width: 60_000_000,    rate: 0.05 },
                  { width: 190_000_000,   rate: 0.15 },
                  { width: 250_000_000,   rate: 0.25 },
                  { width: 4_500_000_000, rate: 0.30 },
                  { width: Number.POSITIVE_INFINITY, rate: 0.35 },
                ];
                let remaining = pkp;
                let cumLo = 0;
                for (const b of brackets) {
                  if (remaining <= 0) break;
                  const portion = Math.min(remaining, b.width);
                  const tax = portion * b.rate;
                  const loM = Math.round(cumLo / 1_000_000);
                  const hiM = Math.round((cumLo + portion) / 1_000_000);
                  const label = b.width === Number.POSITIVE_INFINITY
                    ? `> Rp ${loM}jt × ${(b.rate * 100).toFixed(0)}%`
                    : `${loM}jt – ${hiM}jt × ${(b.rate * 100).toFixed(0)}%`;
                  steps.push({ label, value: rpFmt(tax), muted: true });
                  cumLo += portion;
                  remaining -= portion;
                }
              }
              if (res.punya_npwp === false) {
                steps.push({ label: 'Non-NPWP (×1.2)', value: '', muted: true });
              }
              steps.push({ label: 'PPh Tahunan', value: rpFmt(res.pph_tahunan ?? 0) });

              // Step 6: Selisih
              steps.push({ label: '− PPh sudah dipotong', value: rpFmt(res.pph_jan_nov ?? 0), op: '-' });

              if (res.is_refund) {
                steps.push({
                  label: 'Refund (kelebihan potong)',
                  value: `−${rpFmt(res.refund_amount ?? 0)}`,
                  highlight: true,
                });
              } else {
                const finalLabel = isMidYear ? 'PPh Bulan Terakhir' : 'PPh Desember';
                steps.push({ label: finalLabel, value: rpFmt(res.pph ?? 0), highlight: true });
              }

              return {
                title: `PPh 21 — ${periodTitle}`,
                description: 'Equalisasi tarif progresif Pasal 17',
                steps,
                footer: 'UU HPP Pasal 17 — pembulatan PKP ke ribuan bawah',
              };
            })() : undefined;

            const calcJKK: CalcTooltipData = {
              title: 'JKK — Jaminan Kecelakaan Kerja',
              description: 'Basis × JKK Rate (industri)',
              steps: [
                { label: 'Basis BPJS', value: rpFmt(basis), op: '×' },
                { label: 'JKK Rate',   value: pct(jkkRate), op: '=' },
                { label: 'JKK',        value: rpFmt(bpjsJKK), highlight: true },
              ],
              footer: 'Beban perusahaan, masuk bruto',
            };
            const calcJKM: CalcTooltipData = {
              title: 'JKM — Jaminan Kematian',
              description: 'Basis × 0.30%',
              steps: [
                { label: 'Basis BPJS', value: rpFmt(basis), op: '×' },
                { label: 'JKM Rate',   value: pct(BPJS_RATES.jkm), op: '=' },
                { label: 'JKM',        value: rpFmt(bpjsJKM), highlight: true },
              ],
              footer: 'Beban perusahaan, masuk bruto',
            };
            const calcKesE: CalcTooltipData = {
              title: 'Kesehatan Employer (4%)',
              description: 'min(basis, 12jt) × 4%',
              steps: [
                { label: 'Basis Kes (capped 12jt)', value: rpFmt(kesBasis), op: '×' },
                { label: 'Kes Employer Rate', value: pct(BPJS_RATES.kes_e), op: '=' },
                { label: 'Kes Employer', value: rpFmt(bpjsKesE), highlight: true },
              ],
              footer: 'Beban perusahaan, masuk bruto',
            };
            const calcTunjJHT: CalcTooltipData = {
              title: 'JHT Karyawan (Co. Tanggung)',
              description: 'Basis × 2% — dibayar perusahaan',
              steps: [
                { label: 'Basis BPJS', value: rpFmt(basis), op: '×' },
                { label: 'JHT Karyawan Rate', value: pct(BPJS_RATES.jht_k), op: '=' },
                { label: 'Tunj. JHT', value: rpFmt(bpjsTunjJHT), highlight: true },
              ],
              footer: 'Tunjangan ini masuk bruto karyawan',
            };
            const calcTunjJP: CalcTooltipData = {
              title: 'JP Karyawan (Co. Tanggung)',
              description: 'min(basis, 10.5jt) × 1% — dibayar perusahaan',
              steps: [
                { label: 'Basis JP (capped 10.5jt)', value: rpFmt(jpBasis), op: '×' },
                { label: 'JP Karyawan Rate', value: pct(BPJS_RATES.jp_k), op: '=' },
                { label: 'Tunj. JP', value: rpFmt(bpjsTunjJP), highlight: true },
              ],
              footer: 'Tunjangan ini masuk bruto karyawan',
            };
            const calcTunjKes: CalcTooltipData = {
              title: 'Kes Karyawan (Co. Tanggung)',
              description: 'min(basis, 12jt) × 1% — dibayar perusahaan',
              steps: [
                { label: 'Basis Kes (capped 12jt)', value: rpFmt(kesBasis), op: '×' },
                { label: 'Kes Karyawan Rate', value: pct(BPJS_RATES.kes_k), op: '=' },
                { label: 'Tunj. Kes', value: rpFmt(bpjsTunjKes), highlight: true },
              ],
              footer: 'Tunjangan ini masuk bruto karyawan',
            };
            const calcPotJHT: CalcTooltipData = {
              title: 'JHT Karyawan 2% (Dipotong)',
              description: 'Basis × 2% — dipotong dari gaji',
              steps: [
                { label: 'Basis BPJS', value: rpFmt(basis), op: '×' },
                { label: 'JHT Rate',   value: pct(BPJS_RATES.jht_k), op: '=' },
                { label: 'Potongan JHT', value: rpFmt(bpjsPotJHT), highlight: true },
              ],
            };
            const calcPotJP: CalcTooltipData = {
              title: 'JP Karyawan 1% (Dipotong)',
              description: 'min(basis, 10.5jt) × 1% — dipotong dari gaji',
              steps: [
                { label: 'Basis JP (capped)', value: rpFmt(jpBasis), op: '×' },
                { label: 'JP Rate',           value: pct(BPJS_RATES.jp_k), op: '=' },
                { label: 'Potongan JP',       value: rpFmt(bpjsPotJP), highlight: true },
              ],
            };
            const calcPotKes: CalcTooltipData = {
              title: 'Kesehatan Karyawan 1% (Dipotong)',
              description: 'min(basis, 12jt) × 1% — dipotong dari gaji',
              steps: [
                { label: 'Basis Kes (capped)', value: rpFmt(kesBasis), op: '×' },
                { label: 'Kes Rate',           value: pct(BPJS_RATES.kes_k), op: '=' },
                { label: 'Potongan Kes',       value: rpFmt(bpjsPotKes), highlight: true },
              ],
            };
            const calcGrossup: CalcTooltipData | undefined = ((res.tunj_pph ?? 0) > 0) ? (
              res.is_last_month ? {
                title: 'Tunjangan PPh 21 (Grossup Pasal 17)',
                description: 'Iterasi Pasal 17: PPh setahun(bs + TP) = TP',
                steps: [
                  { label: 'Bruto setahun (tanpa TP)', value: rpFmt(res.bs_base ?? res.bs ?? 0), muted: true },
                  { label: 'PPh setahun (konvergen)', value: rpFmt(res.pph_tahunan ?? 0), muted: true },
                  { label: '− PPh sudah dibayar Jan–Nov', value: rpFmt(res.pph_jan_nov ?? 0), op: '-', muted: true },
                  { label: 'TP bulan ini', value: rpFmt(res.tunj_pph ?? 0), highlight: true },
                ],
                footer: 'Pasal 17 rekonsiliasi — employer menanggung selisih PPh tahunan',
              } : {
                title: 'Tunjangan PPh 21 (Grossup TER)',
                description: 'Iterasi: PPh = TER × (Base + PPh) / (1 − TER)',
                steps: [
                  { label: 'Base (gaji + tunjangan + BPJS)', value: rpFmt((res.base ?? res.bruto ?? 0) - (res.tunj_pph ?? 0)), muted: true },
                  ...(res.ter != null ? [{ label: 'TER (konvergen)', value: pct(res.ter), muted: true }] : []),
                  { label: 'PPh hasil iterasi', value: rpFmt(res.tunj_pph ?? 0), highlight: true },
                ],
                footer: 'Perusahaan menanggung PPh sebagai tunjangan',
              }
            ) : undefined;

            const calcThp: CalcTooltipData = {
              title: 'TAKE HOME PAY',
              description: 'Yang diterima karyawan',
              steps: [
                { label: 'Gaji + Tunjangan', value: rpFmt(grossPend), op: '+' },
                ...(!res.pph_ditanggung && (res.pph ?? 0) > 0 ? [{ label: '− PPh 21', value: rpFmt(res.pph ?? 0), op: '-' as const }] : []),
                ...(bpjsK > 0 ? [{ label: '− BPJS Karyawan dipotong', value: rpFmt(bpjsK), op: '-' as const }] : []),
                ...((res.kasbon ?? 0) > 0 ? [{ label: '− Kasbon', value: rpFmt(res.kasbon ?? 0), op: '-' as const }] : []),
                ...((res.alpha_telat ?? 0) > 0 ? [{ label: '− Alpha/Telat', value: rpFmt(res.alpha_telat ?? 0), op: '-' as const }] : []),
                ...((res.pot_lain ?? 0) > 0 ? [{ label: '− Potongan Lain', value: rpFmt(res.pot_lain ?? 0), op: '-' as const }] : []),
                { label: 'THP', value: rpFmt(res.thp ?? 0), highlight: true },
              ],
            };

            const calcCtc: CalcTooltipData = {
              title: 'COST TO COMPANY',
              description: 'Total biaya perusahaan',
              steps: [
                { label: 'Bruto', value: rpFmt(res.bruto ?? res.total_upah ?? 0), op: '+' },
                ...(bpjsJHTE > 0 ? [{ label: 'JHT Employer (offslip)', value: rpFmt(bpjsJHTE), op: '+' as const }] : []),
                ...(bpjsJPE > 0 ? [{ label: 'JP Employer (offslip)', value: rpFmt(bpjsJPE), op: '+' as const }] : []),
                { label: 'CTC', value: rpFmt(ctc), highlight: true },
              ],
              footer: 'Offslip = tidak terlihat di slip gaji',
            };

            return (
              <div
                key={i}
                className="bg-white border border-[var(--border-default)] rounded-xl animate-fade-in-up"
                style={{ animationDelay: `${Math.min(i, 8) * 0.04}s`, opacity: 0 }}
              >
                {/* Employee header */}
                <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] rounded-t-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <Link
                      href={`/companies/${companyId}/employees/${res.employee_id}?from=payroll&tahun=${tahun}&bulan=${bulan}`}
                      className="text-base font-semibold text-[var(--text-primary)] hover:text-[var(--brand)] transition-colors truncate"
                    >
                      {res.employee_name}
                    </Link>
                    {!isLocked && sourceEmp && (
                      <button
                        onClick={() => setQuickEditEmp(sourceEmp)}
                        title="Edit kompensasi & hitung ulang"
                        className="shrink-0 p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-white transition-colors cursor-pointer"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3 flex-wrap">
                    <span className="inline-flex text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset bg-slate-100 text-slate-700 ring-slate-200">
                      {res.mode ? res.mode : 'Tetap'}
                    </span>
                    <span className="text-[12px] text-[var(--text-muted)] font-medium">
                      {res.status_ptkp ?? '—'}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                        res.punya_npwp !== false
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {res.punya_npwp !== false ? 'NPWP ✓' : 'NO NPWP'}
                    </span>
                    {res.pph_ditanggung && (
                      <span className="inline-flex text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset bg-amber-50 text-amber-700 ring-amber-200">
                        Grossup
                      </span>
                    )}
                    {res.is_last_month && (
                      <span
                        title={`Bulan terakhir kerja — perhitungan Pasal 17 (${res.months_in_year ?? 12} bulan)`}
                        className="inline-flex text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset bg-purple-50 text-purple-700 ring-purple-200"
                      >
                        Bulan Terakhir · {res.months_in_year ?? 12}m
                      </span>
                    )}
                    <button
                      onClick={() => printSlipGaji(res, company, Number(bulan), Number(tahun))}
                      title="Cetak Slip Gaji"
                      className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-white transition-colors cursor-pointer"
                    >
                      <Printer size={14} />
                    </button>
                  </div>
                </div>

                {/* Ledger body */}
                <div className="px-5 sm:px-6 py-5">
                  {(res.proyeksi?.is_estimate === true || res.is_estimate === true) && (
                    <div className="mb-4 flex items-start gap-2.5 bg-sky-50 border border-sky-200 rounded-lg px-4 py-2.5">
                      <AlertTriangle size={16} className="text-sky-600 mt-0.5 shrink-0" />
                      <div className="text-[13px] text-sky-900 leading-relaxed">
                        <p className="font-semibold">Estimasi — data PPh Jan–Nov belum tersimpan</p>
                        <p className="mt-0.5">
                          Perhitungan Desember membutuhkan akumulasi PPh bulan-bulan sebelumnya.
                          Karena data tersebut belum ada, PPh dihitung berdasarkan perkiraan gaji bulan ini × sisa bulan.
                          Simpan run Jan–Nov terlebih dahulu lalu hitung ulang untuk hasil yang akurat.
                        </p>
                      </div>
                    </div>
                  )}
                  {res.is_refund && (
                    <div className="mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                      <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-[13px] text-amber-900 leading-relaxed">
                        <p className="font-semibold">Kelebihan potong PPh — karyawan berhak refund</p>
                        <p className="mt-0.5">
                          PPh tahunan ({formatRupiah(res.pph_tahunan ?? 0)}) lebih kecil dari PPh yang sudah dipotong
                          {' '}({formatRupiah(res.pph_jan_nov ?? 0)}). Selisih:
                          {' '}<span className="font-semibold font-mono">{formatRupiah(res.refund_amount ?? 0)}</span>
                          {' '}harus dikembalikan tunai kepada karyawan di luar slip ini.
                        </p>
                      </div>
                    </div>
                  )}
                  {isTetap ? (
                    <>
                      <LedgerSectionLabel text="Pendapatan" />
                      <LedgerRow label="Gaji Pokok" value={formatRupiah(res.gaji_pokok ?? 0)} />
                      {(res.benefit ?? 0) > 0 && <LedgerRow label="Benefit / Tunj. Tetap"   value={formatRupiah(res.benefit)}     indent />}
                      {(res.kendaraan ?? 0) > 0 && <LedgerRow label="Tunjangan Kendaraan"   value={formatRupiah(res.kendaraan)}   indent />}
                      {(res.pulsa ?? 0) > 0 && <LedgerRow label="Tunjangan Pulsa"           value={formatRupiah(res.pulsa)}       indent />}
                      {(res.operasional ?? 0) > 0 && <LedgerRow label="Tunjangan Operasional" value={formatRupiah(res.operasional)} indent />}
                      {(res.tunj_lain ?? 0) > 0 && <LedgerRow label="Tunjangan Lain"        value={formatRupiah(res.tunj_lain)}   indent />}

                      {bpjsInBruto + bpjsTunj > 0 && (
                        <>
                          <LedgerSectionLabel text="BPJS Masuk Bruto" />
                          {bpjsJKK > 0     && <LedgerRow label="JKK Employer"                value={formatRupiah(bpjsJKK)}     indent calc={calcJKK} />}
                          {bpjsJKM > 0     && <LedgerRow label="JKM Employer"                value={formatRupiah(bpjsJKM)}     indent calc={calcJKM} />}
                          {bpjsKesE > 0    && <LedgerRow label="Kesehatan 4% (Employer)"     value={formatRupiah(bpjsKesE)}    indent calc={calcKesE} />}
                          {bpjsTunjJHT > 0 && <LedgerRow label="JHT Karyawan (Co. Tanggung)" value={formatRupiah(bpjsTunjJHT)} indent calc={calcTunjJHT} />}
                          {bpjsTunjJP > 0  && <LedgerRow label="JP Karyawan (Co. Tanggung)"  value={formatRupiah(bpjsTunjJP)}  indent calc={calcTunjJP} />}
                          {bpjsTunjKes > 0 && <LedgerRow label="Kes Karyawan (Co. Tanggung)" value={formatRupiah(bpjsTunjKes)} indent calc={calcTunjKes} />}
                        </>
                      )}

                      {res.pph_ditanggung && (res.tunj_pph ?? 0) > 0 && (
                        <>
                          <LedgerSectionLabel text="PPh Grossup" />
                          <LedgerRow
                            label="Tunjangan PPh 21 (Co. Tanggung)"
                            value={formatRupiah(res.tunj_pph ?? 0)}
                            color="text-amber-700"
                            indent
                            calc={calcGrossup}
                          />
                        </>
                      )}

                      <LedgerSep />
                      <LedgerTotal label="BRUTO" value={formatRupiah(res.bruto ?? 0)} color="text-[var(--text-primary)]" calc={calcBruto} />
                      <LedgerRow
                        label="TER Rate"
                        value={res.ter != null ? `${(res.ter * 100).toFixed(2)}%` : 'Pasal 17 ✓'}
                        indent
                        dim
                      />
                      <LedgerRow
                        label={res.ter != null ? "PPh 21 = TER × Bruto" : "PPh 21 (Pasal 17)"}
                        value={formatRupiah(res.pph ?? 0)}
                        color="text-amber-700"
                        indent
                        calc={calcPph ?? calcPphDes}
                      />

                      {(res.thr_nominal > 0 || res.bonus_nominal > 0) && (
                        <>
                          <LedgerSectionLabel text="THR / Bonus — Selisih Pasal 17" />
                          {res.thr_nominal > 0 && (
                            <>
                              <LedgerRow label="THR Nominal" value={formatRupiah(res.thr_nominal)}   indent />
                              <LedgerRow label="PPh THR"     value={formatRupiah(res.thr_pph ?? 0)}  color="text-amber-700" indent />
                              <LedgerRow label="THR Net"     value={formatRupiah(res.thr_thp ?? 0)}  color="text-emerald-700" indent />
                            </>
                          )}
                          {res.bonus_nominal > 0 && (
                            <>
                              <LedgerRow label="Bonus Nominal" value={formatRupiah(res.bonus_nominal)} indent />
                              <LedgerRow label="PPh Bonus"     value={formatRupiah(res.bonus_pph ?? 0)} color="text-amber-700" indent />
                              <LedgerRow label="Bonus Net"     value={formatRupiah(res.bonus_thp ?? 0)} color="text-emerald-700" indent />
                            </>
                          )}
                        </>
                      )}

                      {(!res.pph_ditanggung ||
                        bpjsPotJHT > 0 ||
                        bpjsPotJP > 0 ||
                        bpjsPotKes > 0 ||
                        (res.kasbon ?? 0) > 0 ||
                        (res.alpha_telat ?? 0) > 0 ||
                        (res.pot_lain ?? 0) > 0) && (
                        <>
                          <LedgerSectionLabel text="Potongan dari Gaji" />
                          {!res.pph_ditanggung && (res.pph ?? 0) > 0 && (
                            <LedgerRow label="PPh 21 Dipotong" value={`− ${formatRupiah(res.pph ?? 0)}`} color="text-red-600" indent />
                          )}
                          {bpjsPotJHT > 0 && <LedgerRow label="JHT Karyawan 2%"       value={`− ${formatRupiah(bpjsPotJHT)}`}     color="text-red-600" indent calc={calcPotJHT} />}
                          {bpjsPotJP  > 0 && <LedgerRow label="JP Karyawan 1%"        value={`− ${formatRupiah(bpjsPotJP)}`}      color="text-red-600" indent calc={calcPotJP} />}
                          {bpjsPotKes > 0 && <LedgerRow label="Kesehatan Karyawan 1%" value={`− ${formatRupiah(bpjsPotKes)}`}     color="text-red-600" indent calc={calcPotKes} />}
                          {(res.kasbon ?? 0) > 0      && <LedgerRow label="Kasbon"         value={`− ${formatRupiah(res.kasbon)}`}      color="text-red-600" indent />}
                          {(res.alpha_telat ?? 0) > 0 && <LedgerRow label="Alpha / Telat"  value={`− ${formatRupiah(res.alpha_telat)}`} color="text-red-600" indent />}
                          {(res.pot_lain ?? 0) > 0    && <LedgerRow label="Potongan Lain"  value={`− ${formatRupiah(res.pot_lain)}`}    color="text-red-600" indent />}
                        </>
                      )}

                      <LedgerSep />
                      <LedgerTotal label="TAKE HOME PAY" value={formatRupiah(res.thp ?? 0)} color="text-emerald-700" calc={calcThp} calcPosition="above" />
                      <LedgerRow label="Gaji + Tunjangan" value={formatRupiah(grossPend)} indent dim />
                      {!res.pph_ditanggung && (res.pph ?? 0) > 0 && (
                        <LedgerRow label="− PPh 21" value={`− ${formatRupiah(res.pph ?? 0)}`} indent dim />
                      )}
                      {bpjsK > 0 && (
                        <LedgerRow label="− BPJS Karyawan Dipotong" value={`− ${formatRupiah(bpjsK)}`} indent dim />
                      )}
                      <LedgerSep />
                      <LedgerTotal label="COST TO COMPANY" value={formatRupiah(ctc)} color="text-sky-700" calc={calcCtc} calcPosition="above" />
                      <LedgerRow label="Bruto" value={formatRupiah(res.bruto ?? 0)} indent dim />
                      {bpjsJHTE > 0 && (
                        <LedgerRow label="+ JHT Employer (offslip)" value={`+ ${formatRupiah(bpjsJHTE)}`} indent dim />
                      )}
                      {bpjsJPE > 0 && (
                        <LedgerRow label="+ JP Employer (offslip)" value={`+ ${formatRupiah(bpjsJPE)}`} indent dim />
                      )}
                    </>
                  ) : (
                    <>
                      <LedgerSectionLabel text="Upah Tidak Tetap" />
                      <LedgerRow label="Total Upah" value={formatRupiah(res.total_upah ?? 0)} />
                      <LedgerRow label="PPh 21" value={formatRupiah(res.total_pph ?? 0)} color="text-amber-700" />
                      {bpjsK > 0 && (
                        <LedgerRow label="BPJS Karyawan" value={`− ${formatRupiah(bpjsK)}`} color="text-red-600" />
                      )}
                      <LedgerSep />
                      <LedgerTotal label="TAKE HOME PAY" value={formatRupiah(res.thp ?? 0)} color="text-emerald-700" calc={calcThp} calcPosition="above" />
                      <LedgerTotal label="COST TO COMPANY" value={formatRupiah(ctc)} color="text-sky-700" calc={calcCtc} calcPosition="above" />
                    </>
                  )}

                  {/* Pasal 17 equalization steps — only for December / last-month employees */}
                  {isTetap && res.is_last_month && (
                    <Pasal17BreakdownPanel res={res} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label, value, tone,
}: {
  label: string;
  value: string;
  tone?: 'amber' | 'emerald' | 'sky';
}) {
  const toneMap = {
    amber:   { text: 'text-amber-700',   bg: 'bg-amber-50' },
    emerald: { text: 'text-emerald-700', bg: 'bg-emerald-50' },
    sky:     { text: 'text-sky-700',     bg: 'bg-sky-50' },
  } as const;
  const t = tone ? toneMap[tone] : { text: 'text-[var(--text-primary)]', bg: 'bg-[var(--bg-subtle)]' };
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </p>
        <span className={`w-2 h-2 rounded-full ${t.bg}`} />
      </div>
      <p className={`mt-2 text-[17px] font-bold font-mono ${t.text}`}>{value}</p>
    </div>
  );
}
