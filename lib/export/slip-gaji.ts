import { formatRupiah } from '@/lib/format';

const BULAN = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// Escape user-supplied strings (employee_name, company.name, etc.) before
// they reach window.document.write(). Otherwise a name like "Susi <script>"
// would execute in the print popup. Apply to every interpolated text value
// — numeric helpers like formatRupiah are safe by construction.
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function row(label: string, value: number, color = '#111') {
  if (!value || value === 0) return '';
  return `<tr><td>${esc(label)}</td><td class="amount" style="color:${color}">${formatRupiah(value)}</td></tr>`;
}

export function printSlipGaji(result: any, company: any, bulan: number, tahun: number) {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Slip Gaji — ${esc(result.employee_name)} — ${esc(BULAN[bulan])} ${tahun}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:11px;color:#111;background:#fff;padding:24px;max-width:560px;margin:0 auto}
  .co{font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:2px}
  .sub{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:3px;margin-top:2px}
  .divider{border:none;border-top:2px solid #111;margin:12px 0}
  .thin{border:none;border-top:1px solid #ddd;margin:8px 0}
  .emp{padding:8px 10px;background:#f5f5f5;border-left:3px solid #111;margin:12px 0}
  .emp-name{font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px}
  .emp-detail{font-size:9px;color:#666;margin-top:3px;line-height:1.6}
  .sec{font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;color:#666;margin:12px 0 6px}
  table{width:100%;border-collapse:collapse}
  td{padding:2.5px 2px;vertical-align:top}
  .amount{text-align:right;font-weight:bold}
  .total td{border-top:1px solid #111;font-weight:bold;font-size:12px;padding-top:6px}
  .thp{background:#111;color:#fff}
  .thp td{padding:8px;font-size:14px;font-weight:bold}
  .thp .amount{color:#fff}
  .footer{margin-top:16px;padding-top:10px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:9px;color:#999}
  .badge{border:1px solid #999;padding:1px 6px;font-size:8px;text-transform:uppercase;letter-spacing:1px}
  .note{font-size:9px;color:#888;margin-top:8px}
  @media print{body{padding:0}@page{margin:12mm;size:A5}}
</style>
</head>
<body>
  <div class="co">${esc(company.name)}</div>
  <div class="sub">Slip Gaji · ${esc(BULAN[bulan])} ${tahun}</div>
  ${company.npwp_perusahaan ? `<div class="sub" style="margin-top:1px">NPWP: ${esc(company.npwp_perusahaan)}</div>` : ''}
  <hr class="divider">

  <div class="emp">
    <div class="emp-name">${esc(result.employee_name)}</div>
    <div class="emp-detail">
      Status PTKP: ${esc(result.status_ptkp ?? '—')} &nbsp;·&nbsp;
      ${result.punya_npwp !== false ? 'Punya NPWP' : 'Tanpa NPWP (NIK = NPWP)'}<br>
      PPh 21: ${result.pph_ditanggung ? 'Ditanggung Perusahaan (Grossup)' : 'Dipotong dari Gaji'}
    </div>
  </div>

  <div class="sec">Pendapatan</div>
  <table>
    ${row('Gaji Pokok', result.gaji_pokok)}
    ${row('Tunjangan Tetap', result.benefit)}
    ${row('Tunjangan Kendaraan', result.kendaraan)}
    ${row('Tunjangan Pulsa', result.pulsa)}
    ${row('Tunjangan Operasional', result.operasional)}
    ${row('Tunjangan Lain', result.tunj_lain)}
    ${row('THR', result.thr_nominal)}
    ${row('Bonus', result.bonus_nominal)}
    ${row('BPJS Employer (JKK+JKM+Kes)', result.bpjs?.employer_in_bruto)}
    ${row('Tunjangan BPJS Karyawan', result.bpjs?.karyawan_tunj)}
    ${result.pph_ditanggung ? row('Tunjangan PPh 21 (Grossup)', result.tunj_pph, '#92400e') : ''}
  </table>
  <table style="margin-top:6px">
    <tr class="total"><td>TOTAL BRUTO</td><td class="amount">${formatRupiah(result.bruto ?? 0)}</td></tr>
  </table>

  <div class="sec">Potongan</div>
  <table>
    ${!result.pph_ditanggung ? row('PPh 21', result.pph, '#dc2626') : ''}
    ${row('BPJS JHT (2%)', result.bpjs?.pot_jht, '#dc2626')}
    ${row('BPJS JP (1%)', result.bpjs?.pot_jp, '#dc2626')}
    ${row('BPJS Kesehatan (1%)', result.bpjs?.pot_kes, '#dc2626')}
    ${row('Kasbon', result.kasbon, '#dc2626')}
    ${row('Potongan Alpha/Telat', result.alpha_telat, '#dc2626')}
    ${row('Potongan Lain', result.pot_lain, '#dc2626')}
  </table>

  <table style="margin-top:10px">
    <tr class="thp">
      <td>TAKE HOME PAY</td>
      <td class="amount">${formatRupiah(result.thp ?? 0)}</td>
    </tr>
  </table>

  <div class="note">
    ${result.ter != null
      ? `Metode TER · Rate ${(result.ter * 100).toFixed(2)}% · PP 58/2023`
      : 'Metode Equalisasi Pasal 17 · PMK 168/2023'}
  </div>

  <div class="footer">
    <span>MIOS Payroll · Dicetak ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
    <span class="badge">${result.pph_ditanggung ? 'GROSSUP' : 'DIPOTONG'}</span>
  </div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=680,height=900');
  if (!w) { alert('Popup diblokir browser. Izinkan popup untuk mencetak slip.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 600);
}

function slipBody(result: any, company: any, bulan: number, tahun: number): string {
  return `
  <div class="co">${esc(company.name)}</div>
  <div class="sub">Slip Gaji · ${esc(BULAN[bulan])} ${tahun}</div>
  ${company.npwp_perusahaan ? `<div class="sub" style="margin-top:1px">NPWP: ${esc(company.npwp_perusahaan)}</div>` : ''}
  <hr class="divider">

  <div class="emp">
    <div class="emp-name">${esc(result.employee_name)}</div>
    <div class="emp-detail">
      Status PTKP: ${esc(result.status_ptkp ?? '—')} &nbsp;·&nbsp;
      ${result.punya_npwp !== false ? 'Punya NPWP' : 'Tanpa NPWP (NIK = NPWP)'}<br>
      PPh 21: ${result.pph_ditanggung ? 'Ditanggung Perusahaan (Grossup)' : 'Dipotong dari Gaji'}
    </div>
  </div>

  <div class="sec">Pendapatan</div>
  <table>
    ${row('Gaji Pokok', result.gaji_pokok)}
    ${row('Tunjangan Tetap', result.benefit)}
    ${row('Tunjangan Kendaraan', result.kendaraan)}
    ${row('Tunjangan Pulsa', result.pulsa)}
    ${row('Tunjangan Operasional', result.operasional)}
    ${row('Tunjangan Lain', result.tunj_lain)}
    ${row('THR', result.thr_nominal)}
    ${row('Bonus', result.bonus_nominal)}
    ${row('BPJS Employer (JKK+JKM+Kes)', result.bpjs?.employer_in_bruto)}
    ${row('Tunjangan BPJS Karyawan', result.bpjs?.karyawan_tunj)}
    ${result.pph_ditanggung ? row('Tunjangan PPh 21 (Grossup)', result.tunj_pph, '#92400e') : ''}
  </table>
  <table style="margin-top:6px">
    <tr class="total"><td>TOTAL BRUTO</td><td class="amount">${formatRupiah(result.bruto ?? 0)}</td></tr>
  </table>

  <div class="sec">Potongan</div>
  <table>
    ${!result.pph_ditanggung ? row('PPh 21', result.pph, '#dc2626') : ''}
    ${row('BPJS JHT (2%)', result.bpjs?.pot_jht, '#dc2626')}
    ${row('BPJS JP (1%)', result.bpjs?.pot_jp, '#dc2626')}
    ${row('BPJS Kesehatan (1%)', result.bpjs?.pot_kes, '#dc2626')}
    ${row('Kasbon', result.kasbon, '#dc2626')}
    ${row('Potongan Alpha/Telat', result.alpha_telat, '#dc2626')}
    ${row('Potongan Lain', result.pot_lain, '#dc2626')}
  </table>

  <table style="margin-top:10px">
    <tr class="thp">
      <td>TAKE HOME PAY</td>
      <td class="amount">${formatRupiah(result.thp ?? 0)}</td>
    </tr>
  </table>

  <div class="note">
    ${result.ter != null
      ? `Metode TER · Rate ${(result.ter * 100).toFixed(2)}% · PP 58/2023`
      : 'Metode Equalisasi Pasal 17 · PMK 168/2023'}
  </div>

  <div class="footer">
    <span>MIOS Payroll · Dicetak ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
    <span class="badge">${result.pph_ditanggung ? 'GROSSUP' : 'DIPOTONG'}</span>
  </div>`;
}

// Opens one print window containing all employees' slips separated by page breaks.
export function printAllSlipGaji(results: any[], company: any, bulan: number, tahun: number) {
  if (results.length === 0) return;

  const sharedStyles = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',monospace;font-size:11px;color:#111;background:#fff}
    .slip{padding:24px;max-width:560px;margin:0 auto;page-break-after:always}
    .slip:last-child{page-break-after:avoid}
    .co{font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:2px}
    .sub{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:3px;margin-top:2px}
    .divider{border:none;border-top:2px solid #111;margin:12px 0}
    .thin{border:none;border-top:1px solid #ddd;margin:8px 0}
    .emp{padding:8px 10px;background:#f5f5f5;border-left:3px solid #111;margin:12px 0}
    .emp-name{font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px}
    .emp-detail{font-size:9px;color:#666;margin-top:3px;line-height:1.6}
    .sec{font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;color:#666;margin:12px 0 6px}
    table{width:100%;border-collapse:collapse}
    td{padding:2.5px 2px;vertical-align:top}
    .amount{text-align:right;font-weight:bold}
    .total td{border-top:1px solid #111;font-weight:bold;font-size:12px;padding-top:6px}
    .thp{background:#111;color:#fff}
    .thp td{padding:8px;font-size:14px;font-weight:bold}
    .thp .amount{color:#fff}
    .footer{margin-top:16px;padding-top:10px;border-top:1px solid #ddd;display:flex;justify-content:space-between;font-size:9px;color:#999}
    .badge{border:1px solid #999;padding:1px 6px;font-size:8px;text-transform:uppercase;letter-spacing:1px}
    .note{font-size:9px;color:#888;margin-top:8px}
    @media print{body{padding:0}@page{margin:12mm;size:A5}}
  `;

  const slips = results
    .map(r => `<div class="slip">${slipBody(r, company, bulan, tahun)}</div>`)
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Slip Gaji — ${esc(company.name)} — ${esc(BULAN[bulan])} ${tahun} — Semua Karyawan</title>
<style>${sharedStyles}</style>
</head>
<body>${slips}</body>
</html>`;

  const w = window.open('', '_blank', 'width=680,height=900');
  if (!w) { alert('Popup diblokir browser. Izinkan popup untuk mencetak slip.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 600);
}
