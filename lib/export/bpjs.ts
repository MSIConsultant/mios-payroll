/**
 * BPJS rekapitulasi exports — reference reports for accountant use.
 * These are not official SIPP/e-dabu import files (those require member numbers
 * we don't store). They give the accountant a per-employee breakdown to verify
 * iuran amounts before entering them into the BPJS portals.
 */

const BULAN = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function esc(val: unknown): string {
  return `"${String(val ?? '').replace(/"/g, '""')}"`;
}

function r(n: number): number {
  return Math.round(n);
}

/**
 * BPJS Ketenagakerjaan rekapitulasi — JHT, JP, JKK, JKM per employee.
 * Includes employer + employee portions and grand totals.
 */
export function exportBPJSTK(
  results: any[],
  employees: any[],
  company: any,
  bulan: number,
  tahun: number,
) {
  const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));

  const lines: string[] = [];
  lines.push(`REKAPITULASI BPJS KETENAGAKERJAAN`);
  lines.push(`Perusahaan,${esc(company.name)}`);
  lines.push(`NPWP Perusahaan,${esc(company.npwp_perusahaan ?? '-')}`);
  lines.push(`Masa,${esc(`${BULAN[bulan]} ${tahun}`)}`);
  lines.push(`Tanggal Cetak,${esc(new Date().toLocaleDateString('id-ID'))}`);
  lines.push('');

  const headers = [
    'No', 'NIK', 'Nama', 'Divisi',
    'Basis BPJS',
    'JHT Perusahaan (3.7%)', 'JHT Karyawan (2%)', 'Total JHT',
    'JP Perusahaan (2%)',    'JP Karyawan (1%)',   'Total JP',
    'JKK (Employer)',        'JKM (Employer)',
    'Total Iuran TK',
    'Ket.',
  ];
  lines.push(headers.join(','));

  let totJhtE = 0, totJhtK = 0;
  let totJpE = 0, totJpK = 0;
  let totJkk = 0, totJkm = 0;

  const tkResults = results.filter((res) => {
    const emp = empMap[res.employee_id];
    return emp?.ikut_jht || emp?.ikut_jp;
  });

  tkResults.forEach((res, i) => {
    const emp  = empMap[res.employee_id] ?? {};
    const bpjs = res.bpjs ?? {};

    const jht_e = r(bpjs.jht_e ?? 0);
    const jht_k = r(bpjs.jht_k ?? 0);
    const jp_e  = r(bpjs.jp_e  ?? 0);
    const jp_k  = r(bpjs.jp_k  ?? 0);
    const jkk   = r(bpjs.jkk   ?? 0);
    const jkm   = r(bpjs.jkm   ?? 0);

    const total_jht = jht_e + jht_k;
    const total_jp  = jp_e  + jp_k;
    const total     = total_jht + total_jp + jkk + jkm;

    // basis: employer determines from gaji_pokok or bpjs_basis
    const basis = emp.bpjs_basis ?? emp.gaji_pokok ?? 0;

    const ket: string[] = [];
    if (emp.tanggung_jht_k) ket.push('JHT Ditanggung');
    if (emp.tanggung_jp_k)  ket.push('JP Ditanggung');

    totJhtE += jht_e; totJhtK += jht_k;
    totJpE  += jp_e;  totJpK  += jp_k;
    totJkk  += jkk;   totJkm  += jkm;

    lines.push([
      i + 1,
      esc(emp.nik ?? '-'),
      esc(res.employee_name ?? '-'),
      esc(emp.divisi ?? '-'),
      basis,
      jht_e, jht_k, total_jht,
      jp_e,  jp_k,  total_jp,
      jkk, jkm,
      total,
      esc(ket.join('; ')),
    ].join(','));
  });

  lines.push('');
  lines.push([
    'TOTAL', '', '', '', '',
    totJhtE, totJhtK, totJhtE + totJhtK,
    totJpE,  totJpK,  totJpE  + totJpK,
    totJkk, totJkm,
    totJhtE + totJhtK + totJpE + totJpK + totJkk + totJkm,
    '',
  ].join(','));

  lines.push('');
  lines.push(esc('Catatan: File ini adalah rekapitulasi referensi. Input ke portal BPJSTKU/Siapiap sesuai format yang berlaku.'));
  lines.push(esc('JHT Employer 3.7%, Employee 2% | JP Employer 2%, Employee 1% | JKK = sesuai kelompok risiko | JKM 0.3%'));

  const csv  = '﻿' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const safe = company.name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
  a.href     = url;
  a.download = `BPJS_TK_${safe}_${BULAN[bulan]}_${tahun}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * BPJS Kesehatan rekapitulasi — iuran Kes employer (4%) + karyawan (1%).
 */
export function exportBPJSKes(
  results: any[],
  employees: any[],
  company: any,
  bulan: number,
  tahun: number,
) {
  const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));

  const lines: string[] = [];
  lines.push(`REKAPITULASI BPJS KESEHATAN`);
  lines.push(`Perusahaan,${esc(company.name)}`);
  lines.push(`NPWP Perusahaan,${esc(company.npwp_perusahaan ?? '-')}`);
  lines.push(`Masa,${esc(`${BULAN[bulan]} ${tahun}`)}`);
  lines.push(`Tanggal Cetak,${esc(new Date().toLocaleDateString('id-ID'))}`);
  lines.push('');

  const headers = [
    'No', 'NIK', 'Nama', 'Divisi',
    'Basis Kes (maks Rp 12.000.000)',
    'Iuran Perusahaan (4%)',
    'Iuran Karyawan (1%)',
    'Total Iuran Kes',
    'Ket.',
  ];
  lines.push(headers.join(','));

  let totE = 0, totK = 0;

  const kesResults = results.filter((res) => {
    const emp = empMap[res.employee_id];
    return emp?.ikut_kes;
  });

  kesResults.forEach((res, i) => {
    const emp  = empMap[res.employee_id] ?? {};
    const bpjs = res.bpjs ?? {};

    const kes_e = r(bpjs.kes_e ?? 0);
    const kes_k = r(bpjs.kes_k ?? 0);
    const total = kes_e + kes_k;

    // Kes basis is capped at 12,000,000
    const raw_basis = emp.bpjs_basis ?? emp.gaji_pokok ?? 0;
    const kes_basis = Math.min(raw_basis, 12_000_000);

    const ket: string[] = [];
    if (emp.tanggung_kes_k) ket.push('Kes Ditanggung');

    totE += kes_e; totK += kes_k;

    lines.push([
      i + 1,
      esc(emp.nik ?? '-'),
      esc(res.employee_name ?? '-'),
      esc(emp.divisi ?? '-'),
      kes_basis,
      kes_e,
      kes_k,
      total,
      esc(ket.join('; ')),
    ].join(','));
  });

  lines.push('');
  lines.push(['TOTAL', '', '', '', '', totE, totK, totE + totK, ''].join(','));

  lines.push('');
  lines.push(esc('Catatan: File ini adalah rekapitulasi referensi. Input ke portal E-Dabu BPJS Kesehatan sesuai format yang berlaku.'));
  lines.push(esc('Basis Kes maksimal Rp 12.000.000. Iuran Perusahaan 4%, Karyawan 1%.'));

  const csv  = '﻿' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const safe = company.name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
  a.href     = url;
  a.download = `BPJS_Kes_${safe}_${BULAN[bulan]}_${tahun}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
