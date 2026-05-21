'use client';
import { Calculator } from 'lucide-react';
import { PayrollSimulator } from '@/components/payroll/PayrollSimulator';

export default function KalkulatorPage() {
  return (
    <div className="max-w-[1400px] mx-auto pb-12 animate-fade-in-up">
      <header className="flex items-start gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center shrink-0">
          <Calculator size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Kalkulator</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Simulasi payroll setahun tanpa menyimpan data. Untuk testing perhitungan dan skenario gaji.
          </p>
        </div>
      </header>

      <PayrollSimulator
        intro={
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[13px] text-amber-900">
            <span className="font-semibold">Scratchpad:</span> isi data karyawan apa pun untuk melihat proyeksi 12 bulan. Tidak ada data yang disimpan ke database.
          </div>
        }
      />
    </div>
  );
}
