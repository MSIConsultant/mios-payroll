'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { assertCompanyAccess } from '@/lib/actions/access';

export async function savePayrollRun(
  companyId: string,
  tahun: number,
  bulan: number,
  results: any[],
  status: 'draft' | 'calculated' | 'locked' = 'calculated'
) {
  try {
    await assertCompanyAccess(companyId);
  } catch {
    return { error: 'Akses ditolak.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: run, error: runError } = await supabase
    .from('payroll_runs')
    .upsert({
      company_id: companyId, tahun, bulan, status,
      run_by: user?.id,
      calculated_at: new Date().toISOString(),
      ...(status === 'locked' ? { locked_at: new Date().toISOString() } : {}),
    }, { onConflict: 'company_id, tahun, bulan' })
    .select().single();

  if (runError) return { error: runError.message };

  const resultsToInsert = results.map(r => ({
    run_id:         run.id,
    employee_id:    r.employee_id,
    company_id:     companyId,
    gaji_pokok:     r.gaji_pokok ?? 0,
    allowance_total:r.allowance_total ?? 0,
    bruto:          r.bruto ?? r.total_upah ?? 0,
    ter_rate:       r.ter ?? null,
    pph:            r.pph ?? r.total_pph ?? 0,
    tunj_pph:       r.tunj_pph ?? 0,
    bpjs_employer:  r.bpjs?.employer_total ?? 0,
    bpjs_karyawan:  r.bpjs?.karyawan_potong ?? r.tot_bpjs ?? 0,
    thp:            r.thp ?? 0,
    ctc:            (r.bruto ?? r.total_upah ?? 0) + (r.bpjs?.employer_offslip ?? 0),
    thr_nominal:    r.thr_nominal ?? 0,
    thr_pph:        r.thr_pph ?? 0,
    thr_thp:        r.thr_thp ?? 0,
    bonus_nominal:  r.bonus_nominal ?? 0,
    bonus_pph:      r.bonus_pph ?? 0,
    bonus_thp:      r.bonus_thp ?? 0,
    result_json:    r,
    inputs_snapshot:r.inputs ?? {},
  }));

  const { error: resError } = await supabase
    .from('payroll_results')
    .upsert(resultsToInsert, { onConflict: 'run_id, employee_id' });
  if (resError) return { error: resError.message };

  revalidatePath(`/companies/${companyId}/payroll/${tahun}/${bulan}`);
  revalidatePath(`/companies/${companyId}/payroll`);
  revalidatePath('/dashboard');
  return { success: true, runId: run.id };
}

export async function lockPayrollRun(runId: string, companyId: string, tahun: number, bulan: number) {
  try {
    await assertCompanyAccess(companyId);
  } catch {
    return { error: 'Akses ditolak.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('payroll_runs').update({
    status: 'locked', locked_at: new Date().toISOString(),
  }).eq('id', runId);
  if (error) return { error: error.message };
  revalidatePath(`/companies/${companyId}/payroll/${tahun}/${bulan}`);
  return { success: true };
}

export async function deletePayrollRun(runId: string, companyId: string, tahun: number, bulan: number) {
  try {
    await assertCompanyAccess(companyId);
  } catch {
    return { error: 'Akses ditolak.' };
  }

  const supabase = await createClient();

  const { error: resErr } = await supabase.from('payroll_results').delete().eq('run_id', runId);
  if (resErr) return { error: resErr.message };

  const { error: runErr } = await supabase.from('payroll_runs').delete().eq('id', runId);
  if (runErr) return { error: runErr.message };

  revalidatePath(`/companies/${companyId}/payroll`);
  revalidatePath('/dashboard');
  return { success: true };
}
