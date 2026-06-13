'use client';
// Month page header: period switcher, status chip, exports + Hitung/Simpan/
// Kunci action bar. Extracted from the month page (PR 1); the MonthSwitcher
// (workbook PR 2) replaces the old 12-month payroll index page, and Hapus Run
// moved here from that page so the capability survives. Presentational —
// all behavior arrives via handlers.

import { useRouter } from 'next/navigation';
import {
  Save, Lock, Printer, Download, Share2, RefreshCw, CheckCircle2, Clock,
  ChevronLeft, ChevronRight, Trash2,
} from 'lucide-react';
import { BULAN_NAMES } from '@/lib/payroll/calc-client';

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

export interface MonthHeaderProps {
  bulan: number;
  tahun: number;
  companyId: string;
  companyName: string | null;
  runStatus: string;
  resultCount: number;
  isCalculated: boolean;
  isLocked: boolean;
  /** existingRun.status === 'calculated' — Kunci button visible. */
  canLock: boolean;
  /** existingRun.status === 'locked' — Bagikan button visible. */
  canShare: boolean;
  saving: boolean;
  sharing: boolean;
  shareCopied: boolean;
  isCalcing: boolean;
  calcProgress: { current: number; total: number };
  /** Run exists and is not locked — Hapus Run visible. */
  canDelete: boolean;
  onCalculate: () => void;
  onSave: () => void;
  onLock: () => void;
  onShare: () => void;
  onDelete: () => void;
  onPrintAll: () => void;
  onExportSPT: () => void;
  onExportBPJSTK: () => void;
  onExportBPJSKes: () => void;
}

export function MonthHeader({
  bulan, tahun, companyId, companyName, runStatus, resultCount,
  isCalculated, isLocked, canLock, canShare, canDelete,
  saving, sharing, shareCopied, isCalcing, calcProgress,
  onCalculate, onSave, onLock, onShare, onDelete,
  onPrintAll, onExportSPT, onExportBPJSTK, onExportBPJSKes,
}: MonthHeaderProps) {
  const router = useRouter();
  const StatusIconCmp = STATUS_ICON[runStatus] ?? Clock;

  function goTo(t: number, b: number) {
    router.push(`/companies/${companyId}/payroll/${t}/${b}`);
  }
  function step(delta: number) {
    let b = bulan + delta, t = tahun;
    if (b < 1) { b = 12; t -= 1; }
    if (b > 12) { b = 1; t += 1; }
    goTo(t, b);
  }
  const nowYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: nowYear - 2019 + 2 }, (_, i) => 2020 + i);

  return (
    <header className="bg-white border border-[var(--border-default)] rounded-xl p-5 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => step(-1)} aria-label="Bulan sebelumnya" className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer">
              <ChevronLeft size={18} />
            </button>
            <select
              value={bulan}
              onChange={(e) => goTo(tahun, Number(e.target.value))}
              aria-label="Pilih bulan"
              className="text-xl md:text-2xl font-bold tracking-tight text-[var(--text-primary)] bg-transparent outline-none cursor-pointer hover:text-[var(--brand)] transition-colors"
            >
              {BULAN_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select
              value={tahun}
              onChange={(e) => goTo(Number(e.target.value), bulan)}
              aria-label="Pilih tahun"
              className="text-xl md:text-2xl font-bold tracking-tight text-[var(--text-primary)] bg-transparent outline-none cursor-pointer hover:text-[var(--brand)] transition-colors font-mono"
            >
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => step(1)} aria-label="Bulan berikutnya" className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer">
              <ChevronRight size={18} />
            </button>
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${STATUS_CHIP[runStatus] ?? 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
              <StatusIconCmp size={11} />
              {runStatus === 'calculating' ? 'Menghitung…' : runStatus}
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1">{companyName ?? '—'} · {resultCount} karyawan</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {isCalculated && (
            <>
              <button onClick={onPrintAll} title="Cetak semua slip gaji" className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
                <Printer size={14} />Cetak Semua
              </button>
              <button onClick={onExportSPT} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
                <Download size={14} />SPT PPh 21
              </button>
              <button onClick={onExportBPJSTK} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
                <Download size={14} />BPJS TK
              </button>
              <button onClick={onExportBPJSKes} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
                <Download size={14} />BPJS Kes
              </button>
            </>
          )}
          {canShare && (
            <button onClick={onShare} disabled={sharing} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 cursor-pointer">
              <Share2 size={14} />{shareCopied ? 'Tersalin!' : sharing ? '…' : 'Bagikan'}
            </button>
          )}
          {isCalcing ? (
            <div className="flex items-center gap-3 px-3 py-2 bg-white border border-[var(--border-default)] rounded-lg">
              <div className="w-32 h-1.5 rounded-full overflow-hidden bg-slate-100">
                <div className="h-full rounded-full bg-[var(--brand)] transition-all duration-150" style={{ width: `${(calcProgress.current / calcProgress.total) * 100}%` }} />
              </div>
              <span className="text-xs font-mono text-[var(--text-muted)]">{calcProgress.current}/{calcProgress.total}</span>
            </div>
          ) : (
            !isLocked && (
              <button onClick={onCalculate} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
                <RefreshCw size={14} />{isCalculated ? 'Hitung Ulang' : 'Hitung'}
              </button>
            )
          )}
          {isCalculated && !isLocked && (
            <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm cursor-pointer">
              <Save size={14} />{saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          )}
          {canLock && (
            <button onClick={onLock} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-50 disabled:opacity-50 transition-colors cursor-pointer">
              <Lock size={14} />Kunci
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete} disabled={saving} title="Hapus run bulan ini" className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors cursor-pointer">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
