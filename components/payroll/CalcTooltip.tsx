'use client';
import { Info } from 'lucide-react';

export type CalcStep = {
  label: string;
  value: string;
  op?: '+' | '-' | '×' | '÷' | '=';
  highlight?: boolean;
  muted?: boolean;
};

export type CalcTooltipData = {
  title: string;
  description?: string;
  steps: CalcStep[];
  footer?: string;
};

export function CalcTooltipPopover({ data, position = 'below' }: {
  data: CalcTooltipData;
  position?: 'below' | 'above';
}) {
  const positionCls = position === 'above'
    ? 'bottom-full mb-2'
    : 'top-full mt-2';

  return (
    <div
      className={`
        ${positionCls}
        absolute right-0 z-50
        w-80 max-w-[calc(100vw-2rem)]
        bg-white border border-slate-200 rounded-xl shadow-lg
        opacity-0 invisible translate-y-[-2px]
        group-hover:opacity-100 group-hover:visible group-hover:translate-y-0
        transition-all duration-150 ease-out
        pointer-events-none
      `}
    >
      <div className="px-4 py-2.5 border-b border-slate-100 rounded-t-xl bg-slate-50">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{data.title}</p>
        {data.description && (
          <p className="text-[12px] text-slate-700 mt-0.5 font-mono">{data.description}</p>
        )}
      </div>
      <div className="px-4 py-3 space-y-1.5">
        {data.steps.map((step, i) => (
          <div
            key={i}
            className={`flex justify-between items-baseline gap-3 ${
              step.highlight ? 'pt-1.5 mt-1 border-t border-slate-200 font-bold' : ''
            }`}
          >
            <span
              className={`text-[12px] flex items-baseline gap-1.5 ${
                step.muted ? 'text-slate-500' : 'text-slate-700'
              }`}
            >
              {step.op && <span className="text-slate-400 font-mono w-2.5 inline-block">{step.op}</span>}
              {step.label}
            </span>
            <span
              className={`font-mono text-[12px] ${
                step.highlight ? 'text-slate-900' : step.muted ? 'text-slate-500' : 'text-slate-800'
              }`}
            >
              {step.value}
            </span>
          </div>
        ))}
      </div>
      {data.footer && (
        <div className="px-4 py-2 border-t border-slate-100 rounded-b-xl bg-slate-50">
          <p className="text-[10px] text-slate-500 italic">{data.footer}</p>
        </div>
      )}
    </div>
  );
}

export function InfoDot() {
  return <Info size={10} className="text-slate-400 opacity-50 group-hover:opacity-100 transition-opacity" />;
}
