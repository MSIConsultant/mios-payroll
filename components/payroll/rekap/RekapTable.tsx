'use client';
// REKAP grid (workbook PR 3) — mirrors the accountant's annual REKAP sheet:
// employee rows × month columns (Bruto/PPh/THP toggle) + annual Pasal 17
// recap columns from the saved December engine output, including the honest
// negative PPh Des (lebih potong/setor). Display-only.

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { BULAN_NAMES } from '@/lib/payroll/calc-client';

const BULAN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export type RekapMonthCell = { bruto: number; pph: number; thp: number };

export type RekapRow = {
  employee_id: string;
  nama: string;
  nik: string | null;
  jenis: string;
  aktif: boolean;
  months: (RekapMonthCell | null)[];
  total: RekapMonthCell;
  annual: {
    bs: number;
    bj: number;
    jht_jp: number;
    netto: number;
    pkp: number;
    pph_setahun: number;
    pph_jan_nov: number;
    /** Signed: negative = lebih potong/setor (the accountant's REKAP shows it negative). */
    pph_des: number;
    is_grossup: boolean;
  } | null;
};

type Metric = 'bruto' | 'pph' | 'thp';

const nf = (n: number) => Math.round(n).toLocaleString('id-ID');

function Cell({ value, signed }: { value: number | null; signed?: boolean }) {
  if (value === null) return <span className="text-[var(--text-faint)]">—</span>;
  if (signed && value < 0) return <span className="text-red-600 font-semibold">−{nf(-value)}</span>;
  return <>{nf(value)}</>;
}

export function RekapTable({ rows, savedMonths, lockedMonths, tahun, companyId }: {
  rows: RekapRow[];
  savedMonths: number[];
  lockedMonths: number[];
  tahun: number;
  companyId: string;
}) {
  const [metric, setMetric] = useState<Metric>('bruto');

  const missingMonths = Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => !savedMonths.includes(m));
  const hasAnyData = rows.some((r) => r.months.some((c) => c !== null));
  const hasAnnual = rows.some((r) => r.annual !== null);

  const monthTotals = Array.from({ length: 12 }, (_, i) =>
    rows.reduce((a, r) => a + (r.months[i]?.[metric] ?? 0), 0),
  );
  const grandTotal = rows.reduce((a, r) => a + r.total[metric], 0);

  const annualTotals = rows.reduce(
    (a, r) => r.annual ? {
      bs: a.bs + r.annual.bs, bj: a.bj + r.annual.bj, jht_jp: a.jht_jp + r.annual.jht_jp,
      netto: a.netto + r.annual.netto, pkp: a.pkp + r.annual.pkp,
      pph_setahun: a.pph_setahun + r.annual.pph_setahun,
      pph_jan_nov: a.pph_jan_nov + r.annual.pph_jan_nov,
      pph_des: a.pph_des + r.annual.pph_des,
    } : a,
    { bs: 0, bj: 0, jht_jp: 0, netto: 0, pkp: 0, pph_setahun: 0, pph_jan_nov: 0, pph_des: 0 },
  );

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header: year nav + metric toggle */}
      <div className="bg-white border border-[var(--border-default)] rounded-xl px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link
            href={`/companies/${companyId}/rekap?tahun=${tahun - 1}`}
            aria-label="Tahun sebelumnya"
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <ChevronLeft size={18} />
          </Link>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--text-primary)] font-mono">
            REKAP {tahun}
          </h1>
          <Link
            href={`/companies/${companyId}/rekap?tahun=${tahun + 1}`}
            aria-label="Tahun berikutnya"
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <ChevronRight size={18} />
          </Link>
        </div>

        <div className="flex gap-0.5 bg-[var(--bg-subtle)] border border-[var(--border-default)] rounded-lg p-0.5">
          {(['bruto', 'pph', 'thp'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1 rounded-md text-[12px] font-semibold uppercase transition-colors cursor-pointer ${
                metric === m
                  ? 'bg-white text-[var(--brand)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {m === 'pph' ? 'PPh 21' : m}
            </button>
          ))}
        </div>
      </div>

      {/* Missing months */}
      {hasAnyData && missingMonths.length > 0 && missingMonths.length < 12 && (
        <div className="rounded-xl px-4 py-3 flex items-start gap-2.5 bg-amber-50 border border-amber-200">
          <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[13px] text-amber-800 leading-relaxed">
            Bulan belum tersimpan: <span className="font-semibold">{missingMonths.map((m) => BULAN_SHORT[m - 1]).join(', ')}</span>.
            Kolom kosong = run belum disimpan; equalisasi Desember hanya menjumlahkan bulan yang ada.
          </p>
        </div>
      )}

      {!hasAnyData ? (
        <div className="bg-white border border-dashed border-[var(--border-default)] rounded-xl py-16 text-center">
          <p className="text-sm text-[var(--text-secondary)]">Belum ada run tersimpan untuk {tahun}.</p>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">
            Hitung &amp; simpan bulan di tab <span className="font-semibold">Bulan</span>, atau import workbook Excel di tab <span className="font-semibold">Data</span>.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[var(--border-default)] rounded-xl overflow-x-auto">
          <table className="w-full text-[12px] whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
                <th className="sticky left-0 z-10 bg-[var(--bg-subtle)] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] min-w-[160px]">
                  Karyawan · {metric === 'pph' ? 'PPh 21' : metric.toUpperCase()}
                </th>
                {BULAN_SHORT.map((m, i) => (
                  <th key={m} className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider">
                    <Link
                      href={`/companies/${companyId}/payroll/${tahun}/${i + 1}`}
                      className={`hover:text-[var(--brand)] transition-colors ${
                        savedMonths.includes(i + 1)
                          ? lockedMonths.includes(i + 1) ? 'text-emerald-700' : 'text-[var(--text-secondary)]'
                          : 'text-[var(--text-faint)]'
                      }`}
                      title={savedMonths.includes(i + 1) ? (lockedMonths.includes(i + 1) ? 'Terkunci' : 'Tersimpan') : 'Belum tersimpan — klik untuk hitung'}
                    >
                      {m}
                    </Link>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)] border-l border-[var(--border-subtle)]">Total</th>
                {hasAnnual && (
                  <>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-violet-700 border-l-2 border-violet-200">Bruto Setahun</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-violet-700">Bi. Jabatan</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-violet-700">JHT+JP</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-violet-700">Netto</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-violet-700">PKP</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-violet-700">PPh Setahun</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-violet-700">PPh Des</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] font-mono">
              {rows.map((r) => (
                <tr key={r.employee_id} className="hover:bg-[var(--bg-subtle)] transition-colors">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 font-sans">
                    <Link
                      href={`/companies/${companyId}/employees/${r.employee_id}`}
                      className="font-semibold text-[var(--text-primary)] hover:text-[var(--brand)] transition-colors"
                    >
                      {r.nama}
                    </Link>
                    {!r.aktif && <span className="ml-1.5 text-[10px] font-semibold uppercase px-1 py-0.5 rounded bg-slate-100 text-slate-500">Keluar</span>}
                    {r.jenis !== 'tetap' && <span className="ml-1.5 text-[10px] font-semibold uppercase px-1 py-0.5 rounded bg-slate-100 text-slate-500">{r.jenis === 'tidak_tetap_harian' ? 'Harian' : 'Bulanan'}</span>}
                    {r.annual?.is_grossup && <span className="ml-1.5 text-[10px] font-semibold uppercase px-1 py-0.5 rounded bg-violet-50 text-violet-600">Gross</span>}
                  </td>
                  {r.months.map((c, i) => (
                    <td key={i} className="px-3 py-2 text-right text-[var(--text-secondary)]">
                      <Cell value={c ? c[metric] : null} />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-bold text-[var(--text-primary)] border-l border-[var(--border-subtle)]">
                    <Cell value={r.total[metric]} />
                  </td>
                  {hasAnnual && (
                    r.annual ? (
                      <>
                        <td className="px-3 py-2 text-right text-violet-900 border-l-2 border-violet-100"><Cell value={r.annual.bs} /></td>
                        <td className="px-3 py-2 text-right text-violet-900"><Cell value={r.annual.bj} /></td>
                        <td className="px-3 py-2 text-right text-violet-900"><Cell value={r.annual.jht_jp} /></td>
                        <td className="px-3 py-2 text-right text-violet-900"><Cell value={r.annual.netto} /></td>
                        <td className="px-3 py-2 text-right text-violet-900"><Cell value={r.annual.pkp} /></td>
                        <td className="px-3 py-2 text-right font-semibold text-violet-900"><Cell value={r.annual.pph_setahun} /></td>
                        <td className="px-3 py-2 text-right font-semibold"><Cell value={r.annual.pph_des} signed /></td>
                      </>
                    ) : (
                      <td colSpan={7} className="px-3 py-2 text-center text-[11px] font-sans text-[var(--text-faint)] border-l-2 border-violet-100">
                        {r.jenis === 'tetap' ? (
                          <Link href={`/companies/${companyId}/payroll/${tahun}/12`} className="hover:text-[var(--brand)] transition-colors">
                            Desember belum disimpan →
                          </Link>
                        ) : '—'}
                      </td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--border-default)] bg-[var(--bg-subtle)] font-mono font-semibold">
                <td className="sticky left-0 z-10 bg-[var(--bg-subtle)] px-4 py-2.5 font-sans text-[12px] text-[var(--text-secondary)]">TOTAL ({rows.length})</td>
                {monthTotals.map((t, i) => (
                  <td key={i} className="px-3 py-2.5 text-right text-[var(--text-primary)]">{t > 0 ? nf(t) : <span className="text-[var(--text-faint)]">—</span>}</td>
                ))}
                <td className="px-3 py-2.5 text-right font-bold text-[var(--text-primary)] border-l border-[var(--border-subtle)]">{nf(grandTotal)}</td>
                {hasAnnual && (
                  <>
                    <td className="px-3 py-2.5 text-right text-violet-900 border-l-2 border-violet-100">{nf(annualTotals.bs)}</td>
                    <td className="px-3 py-2.5 text-right text-violet-900">{nf(annualTotals.bj)}</td>
                    <td className="px-3 py-2.5 text-right text-violet-900">{nf(annualTotals.jht_jp)}</td>
                    <td className="px-3 py-2.5 text-right text-violet-900">{nf(annualTotals.netto)}</td>
                    <td className="px-3 py-2.5 text-right text-violet-900">{nf(annualTotals.pkp)}</td>
                    <td className="px-3 py-2.5 text-right text-violet-900">{nf(annualTotals.pph_setahun)}</td>
                    <td className={`px-3 py-2.5 text-right ${annualTotals.pph_des < 0 ? 'text-red-600' : 'text-violet-900'}`}>
                      {annualTotals.pph_des < 0 ? `−${nf(-annualTotals.pph_des)}` : nf(annualTotals.pph_des)}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
        Angka dalam Rupiah, dari run yang <span className="font-semibold">tersimpan</span>. Kolom ungu = rekap Pasal 17 dari hasil Desember yang tersimpan
        (PPh Des negatif = lebih potong/setor, sama seperti sheet REKAP). Klik nama bulan untuk membuka sheet bulan itu.
      </p>
    </div>
  );
}
