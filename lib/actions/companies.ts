'use server';
import { revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createCompany(formData: FormData) {
  const supabase = await createClient();
  const workspace_id      = formData.get('workspace_id') as string;
  const name              = formData.get('name') as string;
  const npwp_perusahaan   = formData.get('npwp_perusahaan') as string;
  const alamat            = formData.get('alamat') as string;
  const kota              = formData.get('kota') as string;
  const industri          = formData.get('industri') as string;
  if (!name || !workspace_id) return { error: 'Nama perusahaan dan workspace wajib diisi.' };
  const { error } = await supabase.from('companies').insert({ workspace_id, name, npwp_perusahaan, alamat, kota, industri, aktif: true });
  revalidateTag(`companies-${workspaceId}`);
  if (error) return { error: error.message };
  revalidatePath('/companies');
  return { success: true };
}

export async function updateCompany(id: string, formData: FormData) {
  const supabase = await createClient();
  const name = formData.get('name') as string;
  if (!name) return { error: 'Nama perusahaan wajib diisi.' };
  const { error } = await supabase.from('companies').update({
    name,
    npwp_perusahaan: formData.get('npwp_perusahaan') as string,
    alamat:          formData.get('alamat') as string,
    kota:            formData.get('kota') as string,
    industri:        formData.get('industri') as string,
  }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/companies');
  revalidatePath(`/companies/${id}`);
  return { success: true };
}

export async function archiveCompany(id: string, aktif: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from('companies').update({ aktif }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/companies');
  return { success: true };
}

export async function deleteCompany(id: string) {
  const supabase = await createClient();

  // 1. Get all payroll runs for this company
  const { data: runs } = await supabase.from('payroll_runs').select('id').eq('company_id', id);
  const runIds = (runs ?? []).map(r => r.id);

  // 2. Delete payroll results
  if (runIds.length > 0) {
    const { error } = await supabase.from('payroll_results').delete().in('run_id', runIds);
    if (error) return { error: error.message };
  }

  // 3. Delete payroll runs
  const { error: runErr } = await supabase.from('payroll_runs').delete().eq('company_id', id);
  if (runErr) return { error: runErr.message };

  // 4. Delete employee events
  const { error: evtErr } = await supabase.from('employee_events').delete().eq('company_id', id);
  if (evtErr) return { error: evtErr.message };

  // 5. Delete employees
  const { error: empErr } = await supabase.from('employees').delete().eq('company_id', id);
  if (empErr) return { error: empErr.message };

  // 6. Delete company
  const { error: coErr } = await supabase.from('companies').delete().eq('id', id);
  if (coErr) return { error: coErr.message };

  revalidatePath('/companies');
  revalidatePath('/dashboard');
  return { success: true };
}
