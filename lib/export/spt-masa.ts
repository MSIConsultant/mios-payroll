/**
 * REKAPITULASI PPh 21 MASA — FORM 1721-I
 * Note: This follows the reference format for PPh 21 reporting (PP 58/2023).
 */

const BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function exportSPTMasa(
  results: any[],
  company: any,
  employees: any[],
  bulan: number,
  tahun: number
) {
  const empMap = Object.fromEntries(employees.map(e => [e.id, e]));

  // Helper to escape CSV fields to prevent breakage from commas/quotes
  const escapeCsv = (val: any) => {
    const stringVal = val === null || val === undefined ? '' : String(val);
    // Escape double quotes by doubling them and wrap the whole thing in quotes
    return `"${stringVal.replace(/"/g, '""')}"`;
  };

  const lines: string[] = [];
  
  // Header section
  lines.push(`REKAPITULASI PPh 21 MASA — FORM 1721-I`);
  lines.push(`Perusahaan,${escapeCsv(company.name)}`);
  lines.push(`NPWP Perusahaan,${escapeCsv(company.npwp_perusahaan ?? '-')}`);
  lines.push(`Masa Pajak,${escapeCsv(`${BULAN[bulan]} ${tahun}`)}`);
  lines.push(`Tanggal Cetak,${escapeCsv(new Date().toLocaleDateString('id-ID'))}`);
  lines.push(``);

  // Column headers
  const headers = [
    'No', 'NPWP Karyawan', 'NIK', 'Nama', 'Status PTKP',
    'Kode Objek Pajak', 'Penghasilan Bruto (Rp)', 'PPh 21 Dipotong (Rp)',
    'Tunjangan PPh / Grossup (Rp)', 'THP (Rp)', 'Metode', 'Non-NPWP', 'Keterangan'
  ];
  lines.push(headers.join(','));

  let totalBruto = 0;
  let totalPph = 0;
  let totalTunjPph = 0;
  let totalThp = 0;

  results.forEach((r, i) => {
    const emp = empMap[r.employee_id] ?? {};
    const bruto = Number(r.bruto ?? r.total_upah ?? 0);
    const pph = Number(r.pph ?? r.total_pph ?? 0);
    const tunj_pph = Number(r.tunj_pph ?? 0);
    const thp = Number(r.thp ?? 0);
    
    const isTetap = !r.mode || r.mode === 'tetap';
    const kodeObjek = isTetap ? '21-100-01' : '21-100-03';
    const metode = r.ter != null ? `TER ${(r.ter * 100).toFixed(2)}%` : 'Pasal 17 Equalisasi';
    const nonNpwp = emp.punya_npwp === false ? 'Ya (+20%)' : 'Tidak';

    totalBruto += bruto;
    totalPph += pph;
    totalTunjPph += tunj_pph;
    totalThp += thp;

    lines.push([
      i + 1,
      escapeCsv(emp.npwp ?? '-'),
      escapeCsv(emp.nik ?? '-'),
      escapeCsv(r.employee_name ?? '-'),
      escapeCsv(emp.status_ptkp ?? '-'),
      escapeCsv(kodeObjek),
      bruto,
      pph,
      tunj_pph,
      thp,
      escapeCsv(metode),
      escapeCsv(nonNpwp),
      escapeCsv(isTetap ? 'Pegawai Tetap' : (r.mode === 'harian' ? 'Tidak Tetap Harian' : 'Tidak Tetap Bulanan')),
    ].join(','));

    // Additional row for THR
    if (Number(r.thr_nominal) > 0) {
      const thrBruto = Number(r.thr_nominal);
      const thrPph = Number(r.thr_pph ?? 0);
      const thrThp = Number(r.thr_thp ?? 0);

      lines.push([
        `${i + 1}a`,
        escapeCsv(emp.npwp ?? '-'),
        escapeCsv(emp.nik ?? '-'),
        escapeCsv(r.employee_name ?? '-'),
        escapeCsv(emp.status_ptkp ?? '-'),
        '21-100-04',
        thrBruto,
        thrPph,
        0,
        thrThp,
        'Selisih Pasal 17',
        escapeCsv(nonNpwp),
        'THR',
      ].join(','));
      totalBruto += thrBruto;
      totalPph += thrPph;
      totalThp += thrThp;
    }

    // Additional row for Bonus
    if (Number(r.bonus_nominal) > 0) {
      const bonusBruto = Number(r.bonus_nominal);
      const bonusPph = Number(r.bonus_pph ?? 0);
      const bonusThp = Number(r.bonus_thp ?? 0);

      lines.push([
        `${i + 1}b`,
        escapeCsv(emp.npwp ?? '-'),
        escapeCsv(emp.nik ?? '-'),
        escapeCsv(r.employee_name ?? '-'),
        escapeCsv(emp.status_ptkp ?? '-'),
        '21-100-04',
        bonusBruto,
        bonusPph,
        0,
        bonusThp,
        'Selisih Pasal 17',
        escapeCsv(nonNpwp),
        'Bonus',
      ].join(','));
      totalBruto += bonusBruto;
      totalPph += bonusPph;
      totalThp += bonusThp;
    }
  });

  // Totals Row
  lines.push(``);
  lines.push([
    'TOTAL', '', '', '', '', '',
    totalBruto, totalPph, totalTunjPph, totalThp, '', '', '',
  ].join(','));

  // Footers
  lines.push(``);
  lines.push(`Catatan:`);
  lines.push(escapeCsv("Kode Objek Pajak 21-100-01 = Gaji/Upah Pegawai Tetap (Form 1721-I)"));
  lines.push(escapeCsv("Kode Objek Pajak 21-100-03 = Upah Pegawai Tidak Tetap"));
  lines.push(escapeCsv("Kode Objek Pajak 21-100-04 = THR/Bonus (Selisih Pasal 17)"));
  lines.push(escapeCsv("File ini adalah rekap referensi. Input ke e-SPT sesuai format DJP yang berlaku."));
  lines.push(escapeCsv("Metode TER berdasarkan PP 58/2023 dan PMK 168/2023."));

  // Generate and Download
  const csv = lines.join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  
  // Clean filename of illegal characters
  const safeCompanyName = company.name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
  
  a.href = url;
  a.download = `SPT_Masa_PPh21_${safeCompanyName}_${BULAN[bulan]}_${tahun}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
