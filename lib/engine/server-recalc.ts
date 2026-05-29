// Server-side payroll re-computation.
//
// Mirror image of the in-browser calc the payroll page runs (page.tsx:328-388),
// but pulling all inputs from the database instead of trusting whatever the
// client sent. Used by `savePayrollRun` so the persisted bruto/pph/thp values
// reflect the engine, not anything the client might have manipulated.
//
// Strategy (defense-in-depth, Option B in the audit-hardening plan):
//   - Static employee fields → from `employees` row
//   - Monthly overrides (kasbon, thr, bonus, pot_lain, alpha_telat, benefit_extra)
//     → aggregated from `employee_events` for the period
//   - YTD (akum_bruto, pph_jan_nov) → summed from prior `payroll_results` rows
//     in the same tax year
//
// Output: parallel `recomputed` array keyed by `employee_id`, plus per-row
// `client_diff` capturing any field where the client value differed from the
// server value by more than 1 rupiah (forensic trail; stored in inputs_snapshot).

import { calculateMonthlySalary, calculateFreelance } from './payroll';

type Supabase = any; // structural — anything with the supabase-js .from() shape

export interface RecalcedRow {
  employee_id: string;
  employee_name: string | null;
  /** Engine output for this employee in this period (same shape the client computes). */
  computed: any;
  /** Diff vs the client-claimed values: only present fields where |delta| > 1 rupiah. */
  client_diff: Record<string, { client: number; server: number }>;
}

interface ClientResultRow {
  employee_id: string;
  employee_name?: string;
  bruto?: number;
  pph?: number;
  thp?: number;
  total_upah?: number;
  total_pph?: number;
  [k: string]: any;
}

export async function recomputePayrollServerSide(
  supabase: Supabase,
  companyId: string,
  tahun: number,
  bulan: number,
  clientResults: ClientResultRow[],
): Promise<RecalcedRow[]> {
  if (clientResults.length === 0) return [];

  const employeeIds = clientResults.map(r => r.employee_id).filter(Boolean);
  if (employeeIds.length === 0) return [];

  // 1. Employees for the company (DB-authoritative static fields).
  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .in('id', employeeIds);

  const empById: Record<string, any> = Object.fromEntries(
    (employees ?? []).map((e: any) => [e.id, e])
  );

  // 2. Events for this (company, tahun, bulan) — kasbon/thr/bonus/etc.
  const { data: events } = await supabase
    .from('employee_events')
    .select('employee_id, tipe, nilai')
    .eq('company_id', companyId)
    .eq('tahun', tahun)
    .eq('bulan', bulan);

  const eventsByEmp: Record<string, { tipe: string; nilai: number }[]> = {};
  for (const ev of (events ?? [])) {
    (eventsByEmp[ev.employee_id] ??= []).push(ev);
  }

  // 3. YTD totals for last-month equalization (akum_bruto, pph_jan_nov).
  //    Only needed when at least one row is December or flagged isLastMonth.
  let ytdByEmp: Record<string, { akum_bruto: number; pph_jan_nov: number }> = {};
  const needsYtd = bulan === 12 || clientResults.some(r => r.inputs?.isLastMonth);
  if (needsYtd) {
    const { data: prior } = await supabase
      .from('payroll_results')
      .select('employee_id, bruto, pph, payroll_runs!inner(tahun, bulan)')
      .in('employee_id', employeeIds)
      .eq('payroll_runs.tahun', tahun)
      .lt('payroll_runs.bulan', bulan);
    for (const r of (prior ?? [])) {
      const empId = (r as any).employee_id as string;
      (ytdByEmp[empId] ??= { akum_bruto: 0, pph_jan_nov: 0 });
      ytdByEmp[empId].akum_bruto += Number((r as any).bruto ?? 0);
      ytdByEmp[empId].pph_jan_nov += Number((r as any).pph ?? 0);
    }
  }

  // 4. For each client-supplied row, build the engine input from DB-authoritative
  //    sources and recompute.
  //    Reject employees who were not employed during this run month:
  //    - tanggal_keluar before the run month → already gone
  //    - tanggal_masuk after the run month   → not hired yet
  //    Either rejects them from the run (no payroll_results row written) so
  //    the client can't sneak through results for an ex-employee or future hire.
  const endOfRun = new Date(Number(tahun), Number(bulan), 0);
  const startOfRun = new Date(Number(tahun), Number(bulan) - 1, 1);
  const out: RecalcedRow[] = [];
  for (const cr of clientResults) {
    const emp = empById[cr.employee_id];
    if (!emp) {
      // Employee referenced by client but not in this company — skip.
      // (assertCompanyAccess upstream already verified the company belongs to
      // the caller's workspace; this guards an inconsistent client payload.)
      continue;
    }
    const exitDateCheck = emp.tanggal_keluar ? new Date(`${emp.tanggal_keluar}T00:00:00`) : null;
    const entryDateCheck = emp.tanggal_masuk ? new Date(`${emp.tanggal_masuk}T00:00:00`) : null;
    if (exitDateCheck && exitDateCheck < startOfRun) continue;
    if (entryDateCheck && entryDateCheck > endOfRun) continue;

    const evs = eventsByEmp[emp.id] ?? [];
    const sumEvent = (tipe: string) =>
      evs.filter(e => e.tipe === tipe).reduce((s, e) => s + Number(e.nilai ?? 0), 0);

    const kasbon        = sumEvent('kasbon');
    const alpha_telat   = sumEvent('alpha_telat');
    const pot_lain_evt  = sumEvent('pot_lain');
    const thr           = sumEvent('thr');
    const bonus         = sumEvent('bonus');
    const benefit_extra = sumEvent('benefit_extra');
    // Per-month upah override for tidak_tetap_bulanan workers. Partial
    // unique index guarantees at most one row per (employee, year, month).
    const upah_override = evs.find(e => e.tipe === 'upah_bulanan_override');
    const upah_override_val = upah_override ? Number(upah_override.nilai) : null;

    let computed: any;
    if (emp.jenis_karyawan === 'tetap') {
      // Mid-year exit detection mirrors the client-side logic.
      const runYear  = Number(tahun);
      const runMonth = Number(bulan);
      const exitDate  = emp.tanggal_keluar ? new Date(`${emp.tanggal_keluar}T00:00:00`) : null;
      const entryDate = emp.tanggal_masuk  ? new Date(`${emp.tanggal_masuk}T00:00:00`)  : null;
      const isLastMonth =
        !!exitDate &&
        exitDate.getFullYear() === runYear &&
        (exitDate.getMonth() + 1) === runMonth;
      let months_in_year = 12;
      if (isLastMonth) {
        const startMonth = entryDate && entryDate.getFullYear() === runYear
          ? (entryDate.getMonth() + 1)
          : 1;
        months_in_year = Math.max(1, Math.min(12, runMonth - startMonth + 1));
      }

      computed = calculateMonthlySalary({
        ...emp,
        bulan: runMonth, tahun: runYear,
        kasbon, alpha_telat,
        pot_lain: pot_lain_evt + (Number(emp.pot_lain) || 0),
        tunj_lain: (Number(emp.tunj_lain) || 0) + benefit_extra,
        thr, bonus,
        pph_jan_nov: ytdByEmp[emp.id]?.pph_jan_nov ?? 0,
        akum_bruto:  ytdByEmp[emp.id]?.akum_bruto  ?? 0,
        isLastMonth,
        months_in_year,
      });
    } else {
      // For tidak_tetap_bulanan, an upah_bulanan_override event for this
      // (employee, tahun, bulan) replaces the static default from
      // employees.upah_bulanan_tt. Harian uses upah_harian only.
      const upahBulanan = emp.jenis_karyawan === 'tidak_tetap_bulanan' && upah_override_val !== null
        ? upah_override_val
        : Number(emp.upah_bulanan_tt) || 0;

      computed = calculateFreelance({
        ...emp,
        mode: emp.jenis_karyawan === 'tidak_tetap_harian' ? 'harian' : 'bulanan',
        upah_harian:  Number(emp.upah_harian) || 0,
        hari_kerja:   Number(emp.hari_kerja_default) || 22,
        upah_bulanan: upahBulanan,
        tunjangan:    (Number(emp.tunjangan_tt) || 0) + benefit_extra,
        thr, bonus,
        ikut_bpjs_tk: !!(emp.ikut_jht || emp.ikut_jp),
        ikut_kes:     !!emp.ikut_kes,
        kasbon, pot_lain: pot_lain_evt + (Number(emp.pot_lain) || 0),
      });
    }

    // Forensic diff: any field where client and server disagree by > 1 rupiah.
    const fieldsToCheck = ['bruto', 'pph', 'thp', 'total_upah', 'total_pph'];
    const diff: RecalcedRow['client_diff'] = {};
    for (const k of fieldsToCheck) {
      const clientVal = Number((cr as any)[k] ?? 0);
      const serverVal = Number((computed as any)[k] ?? 0);
      if (Math.abs(clientVal - serverVal) > 1) {
        diff[k] = { client: clientVal, server: serverVal };
      }
    }

    out.push({
      employee_id: emp.id,
      employee_name: emp.nama ?? null,
      computed,
      client_diff: diff,
    });
  }

  return out;
}
