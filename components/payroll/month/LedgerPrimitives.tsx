'use client';
// Ledger row primitives shared by the month detail cards and the Pasal 17
// breakdown panel. Extracted verbatim from the month page (PR 1 decomposition).

import { CalcTooltipPopover, InfoDot, type CalcTooltipData } from '@/components/payroll/CalcTooltip';

export function LedgerSectionLabel({ text }: { text: string }) {
  return (
    <div className="mt-4 mb-1">
      <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-muted)]">
        {text}
      </span>
    </div>
  );
}

export function LedgerRow({
  label, value, color, indent, dim, calc, calcPosition,
}: {
  label: string; value: string; color?: string; indent?: boolean; dim?: boolean;
  calc?: CalcTooltipData; calcPosition?: 'below' | 'above';
}) {
  const labelEl = (
    <span className="text-[13px] text-[var(--text-secondary)] inline-flex items-baseline gap-1.5" style={{ paddingLeft: indent ? 16 : 0 }}>
      {label}{calc && <InfoDot />}
    </span>
  );
  const valueEl = <span className={`font-mono text-[13px] font-semibold ${color ?? 'text-[var(--text-primary)]'}`}>{value}</span>;
  if (!calc) {
    return <div className="flex justify-between items-baseline py-[3px]" style={{ opacity: dim ? 0.7 : 1 }}>{labelEl}{valueEl}</div>;
  }
  return (
    <div className="relative group" style={{ opacity: dim ? 0.7 : 1 }}>
      <div className="flex justify-between items-baseline py-[3px] cursor-help hover:bg-slate-50 rounded -mx-2 px-2 transition-colors">{labelEl}{valueEl}</div>
      <CalcTooltipPopover data={calc} position={calcPosition} />
    </div>
  );
}

export function LedgerSep() { return <div className="my-2 border-t border-[var(--border-subtle)]" />; }

export function LedgerTotal({ label, value, color, calc, calcPosition }: {
  label: string; value: string; color: string; calc?: CalcTooltipData; calcPosition?: 'below' | 'above';
}) {
  const labelEl = <span className="text-[14px] font-bold text-[var(--text-primary)] inline-flex items-baseline gap-1.5">{label}{calc && <InfoDot />}</span>;
  const valueEl = <span className={`font-mono text-[15px] font-bold ${color}`}>{value}</span>;
  if (!calc) return <div className="flex justify-between items-baseline py-1.5">{labelEl}{valueEl}</div>;
  return (
    <div className="relative group">
      <div className="flex justify-between items-baseline py-1.5 cursor-help hover:bg-slate-50 rounded -mx-2 px-2 transition-colors">{labelEl}{valueEl}</div>
      <CalcTooltipPopover data={calc} position={calcPosition} />
    </div>
  );
}

export function P17Row({ label, value, muted, bold, accent, tooltip }: {
  label: string; value: string; muted?: boolean; bold?: boolean; accent?: boolean;
  tooltip?: CalcTooltipData;
}) {
  const content = (
    <div className={`flex justify-between items-baseline py-[3px] ${tooltip ? 'cursor-help hover:bg-violet-50 rounded -mx-1 px-1 transition-colors' : ''}`}>
      <span className={`text-[12px] leading-relaxed flex items-baseline gap-1 ${muted ? 'text-[var(--text-faint)]' : 'text-[var(--text-secondary)]'}`}>
        {label}{tooltip && <InfoDot />}
      </span>
      <span className={`font-mono text-[12px] shrink-0 ml-2 ${bold ? 'font-bold' : 'font-medium'} ${accent ? 'text-violet-700' : 'text-[var(--text-primary)]'}`}>{value}</span>
    </div>
  );
  if (!tooltip) return content;
  return (
    <div className="relative group">
      {content}
      <CalcTooltipPopover data={tooltip} position="above" />
    </div>
  );
}

export function P17Divider() { return <div className="my-2 border-t border-violet-100" />; }
