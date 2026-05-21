'use client';
import { FlaskConical } from 'lucide-react';
import { PayrollSimulator } from '@/components/payroll/PayrollSimulator';

export default function SimulasiPage() {
  return (
    <div className="max-w-[1400px] mx-auto pb-12 animate-fade-in-up">
      <header className="flex items-start gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center shrink-0 shadow-[var(--shadow-sm)]">
          <FlaskConical size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Simulasi</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Proyeksi payroll setahun tanpa menyimpan data. Gunakan preset atau isi manual untuk analisis skenario gaji.
          </p>
        </div>
      </header>

      <PayrollSimulator
        showPresets
        intro={
          <div className="rounded-xl border border-[var(--amber-border)] bg-[var(--amber-soft)] px-4 py-3 text-[13px] text-[var(--amber)]">
            <span className="font-semibold">Scratchpad:</span>{' '}
            isi data karyawan apa pun atau pilih preset di bawah untuk melihat proyeksi 12 bulan lengkap dengan CTC dan TER.
            Tidak ada data yang disimpan ke database.
          </div>
        }
      />
    </div>
  );
}
