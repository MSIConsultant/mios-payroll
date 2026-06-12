'use client';
// December warnings: missing prior months + equalization summary with the
// negative lebih_potong total. Extracted verbatim from the month page (PR 1).

import { AlertTriangle } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { BULAN_NAMES } from '@/lib/payroll/calc-client';

export function DecemberBanners({
  isDesember, isCalculated, missingMonths, tahun, totalPph, totalLebihPotong, resultCount,
}: {
  isDesember: boolean;
  isCalculated: boolean;
  missingMonths: number[];
  tahun: number | string;
  totalPph: number;
  totalLebihPotong: number;
  resultCount: number;
}) {
  return (
    <>
      {/* December: missing prior months — the equalization sums only saved runs */}
      {isDesember && missingMonths.length > 0 && missingMonths.length < 11 && (
        <div className="rounded-xl p-5 flex items-start gap-3 bg-red-50 border border-red-200 animate-fade-in">
          <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">Akumulasi tidak lengkap — PPh Desember kemungkinan salah</p>
            <p className="text-[13px] text-red-700 mt-1 leading-relaxed">
              Run berikut belum tersimpan untuk {tahun}:{' '}
              <span className="font-semibold">{missingMonths.map((m) => BULAN_NAMES[m - 1]).join(', ')}</span>.
              Equalisasi Desember hanya menjumlahkan bulan yang tersimpan, jadi PPh setahun dihitung dari data yang kurang.
              Simpan run bulan-bulan tersebut dulu, lalu hitung ulang Desember. Abaikan jika perusahaan memang baru mulai payroll di tengah tahun.
            </p>
          </div>
        </div>
      )}

      {/* December warning */}
      {isDesember && isCalculated && (
        <div className="rounded-xl p-5 flex items-start gap-3 bg-amber-50 border border-amber-200 animate-fade-in">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Equalisasi Desember</p>
            <p className="text-[13px] text-amber-700 mt-1 leading-relaxed">
              Equalisasi Desember akan menghasilkan PPh{' '}
              <span className="font-semibold font-mono">{formatRupiah(totalPph)}</span> untuk{' '}
              {resultCount} karyawan menggunakan metode Pasal 17 tahunan.
            </p>
            {totalLebihPotong > 0 && (
              <p className="text-[13px] text-amber-700 mt-1.5 leading-relaxed">
                Total kelebihan potong/setor (PPh Des negatif):{' '}
                <span className="font-semibold font-mono">− {formatRupiah(totalLebihPotong)}</span>{' '}
                — rincian per karyawan ada di kartu masing-masing.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
