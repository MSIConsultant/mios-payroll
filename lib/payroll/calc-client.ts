// Client-side payroll month helpers — pure functions extracted from the
// month page so the REKAP view and future surfaces share one implementation.
// The authoritative recompute on save remains lib/engine/server-recalc.ts.

import { calculateMonthlySalary, calculateFreelance } from '@/lib/engine/payroll';

export const BULAN_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Older saved results predate `lebih_potong` — fall back to the refund pair.
export const lebihPotongOf = (r: any): number =>
  r.lebih_potong ?? (r.is_refund ? (r.refund_amount ?? 0) : 0);

/**
 * Filter out employees who already exited before this run month AND were
 * not active at any point in this month. An employee with tanggal_keluar
 * in 2026-03 is included in March payroll (last month) but NOT in April.
 * Similarly, an employee with tanggal_masuk in May 2026 is excluded from
 * earlier months even if still flagged aktif=true (data-entry mistake).
 */
export function filterEmployeesForPeriod(emps: any[], tahun: number, bulan: number): any[] {
  const endOfRun = new Date(tahun, bulan, 0); // last day of run month
  const startOfRun = new Date(tahun, bulan - 1, 1);
  return emps.filter((emp) => {
    const exit = emp.tanggal_keluar ? new Date(`${emp.tanggal_keluar}T00:00:00`) : null;
    const entry = emp.tanggal_masuk ? new Date(`${emp.tanggal_masuk}T00:00:00`) : null;
    if (exit && exit < startOfRun) return false;
    if (entry && entry > endOfRun) return false;
    return true;
  });
}

/**
 * Pre-index events by (employee_id, tipe) once — replaces 7× linear
 * .filter() scans per employee inside the calculation loop.
 */
export function indexEventsByEmp(evts: any[]): Map<string, Map<string, any[]>> {
  const byEmp = new Map<string, Map<string, any[]>>();
  for (const e of evts) {
    let byTipe = byEmp.get(e.employee_id);
    if (!byTipe) { byTipe = new Map(); byEmp.set(e.employee_id, byTipe); }
    const arr = byTipe.get(e.tipe);
    if (arr) arr.push(e); else byTipe.set(e.tipe, [e]);
  }
  return byEmp;
}

/**
 * Compute one employee's engine result for (tahun, bulan), applying the
 * month's events. Mirrors lib/engine/server-recalc.ts — the server recompute
 * on save is the authoritative one; this powers the live preview.
 */
export function computeEmployeeResult(
  emp: any,
  byTipe: Map<string, any[]>,
  tahun: number,
  bulan: number,
): any {
  const sumOf = (tipe: string) =>
    (byTipe.get(tipe) ?? []).reduce((a: number, b: any) => a + Number(b.nilai), 0);
  const kasbon        = sumOf('kasbon');
  const alpha_telat   = sumOf('alpha_telat');
  const pot_lain      = sumOf('pot_lain');
  const thr           = sumOf('thr');
  const bonus         = sumOf('bonus');
  const benefit_extra = sumOf('benefit_extra');
  const upahOverride  = (byTipe.get('upah_bulanan_override') ?? [])[0];

  let calcResult: any = {};
  if (emp.jenis_karyawan === 'tetap') {
    const exitDate  = emp.tanggal_keluar ? new Date(`${emp.tanggal_keluar}T00:00:00`) : null;
    const entryDate = emp.tanggal_masuk  ? new Date(`${emp.tanggal_masuk}T00:00:00`)  : null;
    const isLastMonth = !!exitDate && exitDate.getFullYear() === tahun && (exitDate.getMonth() + 1) === bulan;
    let months_in_year = 12;
    if (isLastMonth) {
      const startMonth = entryDate && entryDate.getFullYear() === tahun ? (entryDate.getMonth() + 1) : 1;
      months_in_year = Math.max(1, Math.min(12, bulan - startMonth + 1));
    }
    calcResult = calculateMonthlySalary({ ...emp, bulan, tahun, kasbon, alpha_telat, pot_lain: pot_lain + (emp.pot_lain || 0), tunj_lain: (emp.tunj_lain ?? 0) + benefit_extra, thr, bonus, pph_jan_nov: emp._pph_jan_nov ?? 0, akum_bruto: emp._akum_bruto ?? 0, isLastMonth, months_in_year });
  } else {
    // For tidak_tetap_bulanan, an upah_bulanan_override event for this
    // (employee, tahun, bulan) replaces the static employees.upah_bulanan_tt.
    const upahBulanan = emp.jenis_karyawan === 'tidak_tetap_bulanan' && upahOverride
      ? Number(upahOverride.nilai)
      : emp.upah_bulanan_tt;
    calcResult = calculateFreelance({ ...emp, mode: emp.jenis_karyawan === 'tidak_tetap_harian' ? 'harian' : 'bulanan', upah_harian: emp.upah_harian, hari_kerja: emp.hari_kerja_default || 22, upah_bulanan: upahBulanan, tunjangan: (emp.tunjangan_tt || 0) + benefit_extra, thr, bonus, ikut_bpjs_tk: emp.ikut_jht || emp.ikut_jp, ikut_kes: emp.ikut_kes, kasbon, pot_lain: pot_lain + (emp.pot_lain || 0) });
  }
  return { ...calcResult, employee_id: emp.id, employee_name: emp.nama };
}
