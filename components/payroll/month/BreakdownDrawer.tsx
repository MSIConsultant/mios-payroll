'use client';
// Right slide-over showing one employee's full breakdown (workbook PR 3).
// Lets the accountant inspect a row from the Tabel view without leaving the
// table — wraps the same EmployeeDetailCard used by the Detail view.

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { EmployeeDetailCard } from './EmployeeDetailCard';

export function BreakdownDrawer({
  res, sourceEmp, hasUpahOverride, isLocked, isDesember, maxThp,
  company, companyId, tahun, bulan, onQuickEdit, onUpahEdit, onClose,
}: {
  res: any;
  sourceEmp: any | undefined;
  hasUpahOverride: boolean;
  isLocked: boolean;
  isDesember: boolean;
  maxThp: number;
  company: any;
  companyId: string;
  tahun: number;
  bulan: number;
  onQuickEdit: (emp: any) => void;
  onUpahEdit: (emp: any) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 animate-fade-in">
      <div className="absolute inset-0 bg-[var(--bg-overlay)]" onClick={onClose} />
      <aside className="absolute top-0 right-0 bottom-0 w-full max-w-2xl bg-white shadow-xl flex flex-col animate-slide-right">
        <div className="px-5 py-3.5 border-b border-[var(--border-default)] flex items-center justify-between shrink-0">
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
            Rincian — {res.employee_name}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            aria-label="Tutup rincian"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <EmployeeDetailCard
            res={res}
            index={0}
            isExpanded
            onToggleExpand={() => {}}
            sourceEmp={sourceEmp}
            hasUpahOverride={hasUpahOverride}
            isLocked={isLocked}
            isDesember={isDesember}
            maxThp={maxThp}
            company={company}
            companyId={companyId}
            tahun={tahun}
            bulan={bulan}
            onQuickEdit={onQuickEdit}
            onUpahEdit={onUpahEdit}
          />
        </div>
      </aside>
    </div>
  );
}
