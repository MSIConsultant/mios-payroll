'use client';
// Per-month upah override for tidak_tetap_bulanan — extracted verbatim (PR 1).

import { useState } from 'react';
import { X, RefreshCw, Wallet, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { formatRupiah } from '@/lib/format';
import { setUpahBulananOverride } from '@/lib/actions/employees';
import { NominalInput } from '@/components/ui/FormattedInput';
import { BULAN_NAMES } from '@/lib/payroll/calc-client';

export function UpahBulananModal({ employee, tahun, bulan, currentOverride, onClose, onSaved }: {
  employee: any;
  tahun: number;
  bulan: number;
  /** Current override nilai for this (employee, tahun, bulan), or null when only the default applies. */
  currentOverride: number | null;
  onClose: () => void;
  /** Called after the action succeeds; parent should refetch events + recalc. */
  onSaved: () => void;
}) {
  const [val, setVal] = useState<number>(currentOverride ?? employee.upah_bulanan_tt ?? 0);
  const [saving, setSaving] = useState(false);
  const monthLabel = BULAN_NAMES[bulan - 1] ?? '';

  async function handleSave() {
    setSaving(true);
    const res = await setUpahBulananOverride(employee.id, tahun, bulan, val);
    if (res.error) { toast.error(res.error); setSaving(false); return; }
    toast.success(`Upah ${monthLabel} ${tahun} disimpan`);
    setSaving(false);
    onSaved();
    onClose();
  }

  async function handleResetToDefault() {
    setSaving(true);
    const res = await setUpahBulananOverride(employee.id, tahun, bulan, null);
    if (res.error) { toast.error(res.error); setSaving(false); return; }
    toast.success('Override dihapus — kembali ke upah default');
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-[var(--bg-overlay)] z-50 flex items-center justify-center p-4 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white rounded-xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--border-default)]">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Upah Bulan Ini</h3>
            <p className="text-[13px] text-[var(--text-muted)] mt-0.5 truncate">
              {employee.nama} · {monthLabel} {tahun}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-[12px] text-[var(--text-muted)] leading-relaxed bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 flex items-start gap-2">
            <Wallet size={14} className="mt-0.5 shrink-0 text-[var(--brand)]" />
            <div>
              <p>Default upah karyawan: <span className="font-mono font-semibold text-[var(--text-primary)]">{formatRupiah(employee.upah_bulanan_tt ?? 0)}</span></p>
              <p className="mt-1">Nilai di bawah akan menggantikan default <strong>khusus bulan {monthLabel} {tahun}</strong>. Bulan lain tetap pakai default.</p>
            </div>
          </div>
          <NominalInput
            key={`${employee.id}-${tahun}-${bulan}`}
            label={`Upah ${monthLabel} ${tahun}`}
            name="upah"
            defaultValue={val}
            onChange={setVal}
          />
          <div className="flex gap-3 pt-3 border-t border-[var(--border-subtle)]">
            {currentOverride !== null && (
              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
              >
                <RotateCcw size={13} />
                Reset ke default
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer">Batal</button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={saving ? 'animate-spin' : ''} />
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
