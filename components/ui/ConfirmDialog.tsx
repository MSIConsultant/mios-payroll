'use client';

// Themed confirmation dialog used by all destructive actions (lock payroll,
// delete employee, suspend account, …). Replaces the native window.confirm()
// which has no a11y, no theming, and (for `danger` severity) no retype-to-confirm.
//
// Usage:
//   const confirm = useConfirm();
//   if (!(await confirm({
//     title: 'Hapus run payroll?',
//     message: 'Tindakan ini tidak bisa dibatalkan.',
//     severity: 'danger',
//     retypeToConfirm: company.name,
//   }))) return;
//
// Mount <ConfirmProvider> once near the top of the tree (in the dashboard layout).

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** 'warn' = ordinary yes/no. 'danger' = destructive; ranges from red styling to retype-confirm. */
  severity?: 'warn' | 'danger';
  /** When set on a `danger` confirm, the user must type this string before the Confirm button enables. */
  retypeToConfirm?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const Ctx = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const fn = useContext(Ctx);
  if (!fn) throw new Error('useConfirm() called outside <ConfirmProvider>');
  return fn;
}

interface PendingState {
  opts: ConfirmOptions;
  resolve: (v: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);
  const [retypeValue, setRetypeValue] = useState('');
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const retypeInputRef = useRef<HTMLInputElement | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setRetypeValue('');
    return new Promise<boolean>((resolve) => {
      setPending({ opts, resolve });
    });
  }, []);

  function resolveAndClose(value: boolean) {
    pending?.resolve(value);
    setPending(null);
  }

  // Esc closes (as cancel). Initial focus goes to the retype input if present,
  // otherwise the cancel button (safer default for destructive actions).
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolveAndClose(false);
    };
    document.addEventListener('keydown', onKey);

    const t = setTimeout(() => {
      if (pending.opts.retypeToConfirm) retypeInputRef.current?.focus();
      else cancelBtnRef.current?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const sev = pending?.opts.severity ?? 'warn';
  const retypeTarget = pending?.opts.retypeToConfirm;
  const retypeOk = !retypeTarget || retypeValue.trim() === retypeTarget.trim();

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
        >
          {/* overlay */}
          <div
            className="absolute inset-0 bg-[var(--bg-overlay)]"
            onClick={() => resolveAndClose(false)}
          />

          {/* dialog */}
          <div className="relative w-full max-w-md bg-white border border-[var(--border-default)] rounded-2xl shadow-xl overflow-hidden animate-fade-in-up">
            <button
              type="button"
              onClick={() => resolveAndClose(false)}
              aria-label="Tutup"
              className="absolute top-3 right-3 p-1.5 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
            >
              <X size={16} />
            </button>

            <div className="p-6">
              <div className="flex items-start gap-3">
                <div
                  className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                    sev === 'danger'
                      ? 'bg-[var(--red-soft)] text-[var(--red)]'
                      : 'bg-[var(--amber-soft)] text-[var(--amber)]'
                  }`}
                  aria-hidden
                >
                  <AlertTriangle size={20} />
                </div>
                <div className="min-w-0">
                  <h2
                    id="confirm-title"
                    className="text-base font-bold text-[var(--text-primary)] tracking-tight"
                  >
                    {pending.opts.title}
                  </h2>
                  {pending.opts.message && (
                    <p className="text-[14px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                      {pending.opts.message}
                    </p>
                  )}
                </div>
              </div>

              {retypeTarget && (
                <div className="mt-5">
                  <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">
                    Ketik <span className="font-mono text-[var(--text-primary)]">{retypeTarget}</span> untuk mengonfirmasi
                  </label>
                  <input
                    ref={retypeInputRef}
                    type="text"
                    value={retypeValue}
                    onChange={(e) => setRetypeValue(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[var(--border-default)] rounded-lg text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
                    autoComplete="off"
                  />
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  ref={cancelBtnRef}
                  type="button"
                  onClick={() => resolveAndClose(false)}
                  className="px-3.5 py-2 rounded-lg text-[14px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  {pending.opts.cancelLabel ?? 'Batal'}
                </button>
                <button
                  ref={confirmBtnRef}
                  type="button"
                  disabled={!retypeOk}
                  onClick={() => resolveAndClose(true)}
                  className={`px-3.5 py-2 rounded-lg text-[14px] font-semibold text-white transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                    sev === 'danger'
                      ? 'bg-[var(--red)] hover:brightness-95'
                      : 'bg-[var(--brand)] hover:bg-[var(--brand-hover)]'
                  }`}
                >
                  {pending.opts.confirmLabel ?? 'Konfirmasi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
