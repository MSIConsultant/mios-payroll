'use client';
import { Calculator } from 'lucide-react';
import { MonthlyLedgerSimulator } from '@/components/payroll/MonthlyLedgerSimulator';

export default function SimulasiPage() {
  return (
    <div className="max-w-[1400px] mx-auto pb-12 animate-fade-in-up">
      <header className="flex items-start gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center shrink-0 shadow-[var(--shadow-sm)]">
          <Calculator size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Kalkulator Payroll</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Hitung gaji, BPJS, dan PPh 21 untuk 12 bulan — setiap bulan dari angka aktualnya sendiri. Ubah nilai apa pun per bulan.
          </p>
        </div>
      </header>

      <MonthlyLedgerSimulator
        intro={
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] px-4 py-3 text-[13px] text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">Cara pakai:</span>{' '}
            atur nilai default, lalu ubah bulan mana pun yang berbeda (kenaikan gaji, THR, bonus, potongan, atau bulan tidak bekerja).
            Desember menghitung equalisasi Pasal 17 dari akumulasi nyata — bukan proyeksi. Tidak ada data yang disimpan ke database.
          </div>
        }
      />
    </div>
  );
}
