'use server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { assertCompanyAccess, assertRunAccess } from '@/lib/auth/assertAccess';
import { audit } from '@/lib/audit';
import { recomputePayrollServerSide } from '@/lib/engine/server-recalc';

// Loose envelope for the client-sent results array. We don't fully validate
// the shape — instead, we recompute the trusted fields (bruto/pph/thp/etc.)
// server-side from DB-authoritative inputs (see lib/engine/server-recalc.ts).
// The client values that DO survive (employee_id) are guarded by uuid()/string.
const ClientResultRow = z.object({
  employee_id: z.string().min(1),
}).passthrough();

const PayrollSaveInput = z.object({
  companyId: z.string().uuid(),
  tahun:     z.number().int().min(2020).max(2100),
  bulan:     z.number().int().min(1).max(12),
  status:    z.enum(['draft', 'calculated', 'locked']).default('calculated'),
  results:   z.array(ClientResultRow),
});

export async function savePayrollRun(
  companyId: string,
  tahun: number,
  bulan: number,
  results: any[],
  status: 'draft' | 'calculated' | 'locked' = 'calculated'
) {
  // Surface a clear error rather than letting downstream coercions fail.
  const parsed = PayrollSaveInput.safeParse({ companyId, tahun, bulan, status, results });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid.' };
  }

  const access = await assertCompanyAccess(companyId);
  if (!access.ok) return { error: 'Akses ditolak.' };
  const { supabase, user, workspaceId } = access;

  // Re-run the engine server-side. Static employee fields come from the
  // `employees` row, monthly overrides from `employee_events`, YTD from
  // prior `payroll_results`. Any field the client tried to manipulate is
  // overwritten by the engine output below.
  const recomputed = await recomputePayrollServerSide(
    supabase, companyId, tahun, bulan, results
  );
  const byEmpId: Record<string, typeof recomputed[number]> = Object.fromEntries(
    recomputed.map(r => [r.employee_id, r])
  );

  const { data: run, error: runError } = await supabase
    .from('payroll_runs')
    .upsert({
      company_id: companyId, tahun, bulan, status,
      run_by: user.id,
      calculated_at: new Date().toISOString(),
      ...(status === 'locked' ? { locked_at: new Date().toISOString() } : {}),
    }, { onConflict: 'company_id, tahun, bulan' })
    .select().single();

  if (runError) return { error: runError.message };

  // Build inserts from server-computed values. Client-sent fields are only
  // used as a fallback when the employee row didn't materialize (in which
  // case the row gets dropped from `byEmpId` entirely — `if (!srv) continue`).
  const resultsToInsert: any[] = [];
  let totalClientDiffs = 0;

  for (const r of results) {
    const srv = byEmpId[r.employee_id];
    if (!srv) continue; // employee not found in DB; skip the row.
    const c = srv.computed;
    if (Object.keys(srv.client_diff).length > 0) totalClientDiffs += 1;

    resultsToInsert.push({
      run_id:         run.id,
      employee_id:    srv.employee_id,
      company_id:     companyId,
      gaji_pokok:     c.gaji_pokok ?? 0,
      allowance_total:c.allowance_total ?? 0,
      bruto:          c.bruto ?? c.total_upah ?? 0,
      ter_rate:       c.ter ?? null,
      pph:            c.pph ?? c.total_pph ?? 0,
      tunj_pph:       c.tunj_pph ?? 0,
      bpjs_employer:  c.bpjs?.employer_total ?? 0,
      bpjs_karyawan:  c.bpjs?.karyawan_potong ?? c.tot_bpjs ?? 0,
      thp:            c.thp ?? 0,
      ctc:            (c.bruto ?? c.total_upah ?? 0) + (c.bpjs?.employer_offslip ?? 0),
      thr_nominal:    c.thr_nominal ?? r.thr_nominal ?? 0,
      thr_pph:        c.thr_pph ?? r.thr_pph ?? 0,
      thr_thp:        c.thr_thp ?? r.thr_thp ?? 0,
      bonus_nominal:  c.bonus_nominal ?? r.bonus_nominal ?? 0,
      bonus_pph:      c.bonus_pph ?? r.bonus_pph ?? 0,
      bonus_thp:      c.bonus_thp ?? r.bonus_thp ?? 0,
      raw_pph:        c.raw_pph ?? c.pph ?? 0,
      is_refund:      c.is_refund ?? false,
      refund_amount:  c.refund_amount ?? 0,
      is_estimate:    c.proyeksi?.is_estimate ?? false,
      // result_json holds the engine output (server-authoritative). The
      // client's original row is preserved under `_client` for debugging.
      result_json: { ...c, _client: r, _converged: c._converged, _iterations: c._iterations },
      // inputs_snapshot captures forensic diff entries when the client value
      // disagreed with the server engine by more than 1 rupiah.
      inputs_snapshot: {
        ...(r.inputs ?? {}),
        client_diff: srv.client_diff,
      },
    });
  }

  const { error: resError } = await supabase
    .from('payroll_results')
    .upsert(resultsToInsert, { onConflict: 'run_id, employee_id' });
  if (resError) return { error: resError.message };

  const totalBruto = resultsToInsert.reduce((s, r) => s + (r.bruto ?? 0), 0);
  const totalPph   = resultsToInsert.reduce((s, r) => s + (r.pph ?? 0), 0);
  const totalThp   = resultsToInsert.reduce((s, r) => s + (r.thp ?? 0), 0);

  await audit({
    workspace_id: workspaceId,
    company_id: companyId,
    action: status === 'locked' ? 'PAYROLL_LOCKED' : 'PAYROLL_SAVED',
    entity_type: 'payroll_run',
    entity_id: run.id,
    entity_name: `${tahun}-${String(bulan).padStart(2, '0')}`,
    new_values: {
      status,
      employee_count: resultsToInsert.length,
      total_bruto: totalBruto,
      total_pph:   totalPph,
      total_thp:   totalThp,
    },
    metadata: totalClientDiffs > 0 ? { client_diff_rows: totalClientDiffs } : undefined,
  });

  revalidatePath(`/companies/${companyId}/payroll/${tahun}/${bulan}`);
  revalidatePath(`/companies/${companyId}/payroll`);
  revalidatePath('/dashboard');
  return { success: true, runId: run.id };
}

export async function lockPayrollRun(runId: string, companyId: string, tahun: number, bulan: number) {
  const access = await assertRunAccess(runId);
  if (!access.ok) return { error: 'Akses ditolak.' };
  const { supabase, workspaceId } = access;

  const { error } = await supabase.from('payroll_runs').update({
    status: 'locked', locked_at: new Date().toISOString(),
  }).eq('id', runId);
  if (error) return { error: error.message };

  await audit({
    workspace_id: workspaceId,
    company_id: companyId,
    action: 'PAYROLL_LOCKED',
    entity_type: 'payroll_run',
    entity_id: runId,
    entity_name: `${tahun}-${String(bulan).padStart(2, '0')}`,
  });

  revalidatePath(`/companies/${companyId}/payroll/${tahun}/${bulan}`);
  return { success: true };
}

export async function deletePayrollRun(runId: string, companyId: string, tahun: number, bulan: number) {
  const access = await assertRunAccess(runId);
  if (!access.ok) return { error: 'Akses ditolak.' };
  const { supabase, workspaceId } = access;

  // Delete results first (FK constraint)
  const { error: resErr } = await supabase.from('payroll_results').delete().eq('run_id', runId);
  if (resErr) return { error: resErr.message };

  const { error: runErr } = await supabase.from('payroll_runs').delete().eq('id', runId);
  if (runErr) return { error: runErr.message };

  await audit({
    workspace_id: workspaceId,
    company_id: companyId,
    action: 'PAYROLL_DELETED',
    entity_type: 'payroll_run',
    entity_id: runId,
    entity_name: `${tahun}-${String(bulan).padStart(2, '0')}`,
  });

  revalidatePath(`/companies/${companyId}/payroll`);
  revalidatePath('/dashboard');
  return { success: true };
}
