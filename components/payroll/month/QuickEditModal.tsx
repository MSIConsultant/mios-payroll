'use client';
// Quick compensation edit — extracted verbatim from the month page (PR 1).

import { useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { NominalInput } from '@/components/ui/FormattedInput';

export function QuickEditModal({ employee, onClose, onSaveAndRecalc }: {
  employee: any; onClose: () => void;
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
        if (typeof employee[f] === 'boolean' && employee[f]) fd.append(f, 'on');
        else if (typeof employee[f] === 'string' || typeof employee[f] === 'number') fd.append(f, String(employee[f]));
      }
    }
    await onSaveAndRecalc(employee.id, employee.company_id, fd);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-[var(--bg-overlay)] z-50 flex items-center justify-center p-4 animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white rounded-xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--border-default)]">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Edit Kompensasi</h3>
            <p className="text-[13px] text-[var(--text-muted)] mt-0.5 truncate">{employee.nama}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer" aria-label="Tutup">
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
          <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">Perubahan akan disimpan ke database dan payroll bulan ini dihitung ulang otomatis.</p>
          <div className="flex gap-3 pt-3 border-t border-[var(--border-subtle)]">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer">Batal</button>
            <button type="submit" disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer">
              <RefreshCw size={14} className={saving ? 'animate-spin' : ''} />
              {saving ? 'Menyimpan…' : 'Simpan & Hitung Ulang'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
