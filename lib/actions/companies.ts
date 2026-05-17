'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function createCompany(formData: FormData) {
  const supabase     = await createClient();
  const workspace_id = formData.get('workspace_id') as string;
  const name         = formData.get('name')         as string;

  if (!name || !workspace_id)
    return { error: 'Nama perusahaan dan workspace wajib diisi.' };

  const { error } = await supabase.from('companies').insert({
    workspace_id,
    name,
    npwp_perusahaan: formData.get('npwp_perusahaan') as string,
    alamat:          formData.get('alamat')           as string,
    kota:            formData.get('kota')             as string,
    industri:        formData.get('industri')         as string,
    aktif:           true,
  });

  if (error) return { error: error.message };

  revalidateTag(`companies-${workspace_id}`);
  revalidatePath('/companies');
  return { success: true };
}

export async function updateCompany(id: string, formData: FormData) {
  const supabase = await createClient();
  const name     = formData.get('name') as string;
  if (!name) return { error: 'Nama perusahaan wajib diisi.' };

  // Get workspace_id from existing company
  const { data: existing } = await supabase
    .from('companies').select('workspace_id').eq('id', id).single();

  const { error } = await supabase.from('companies').update({
    name,
    npwp_perusahaan: formData.get('npwp_perusahaan') as string,
    alamat:          formData.get('alamat')           as string,
    kota:            formData.get('kota')             as string,
    industri:        formData.get('industri')         as string,
  }).eq('id', id);

  if (error) return { error: error.message };

  if (existing?.workspace_id) revalidateTag(`companies-${existing.workspace_id}`);
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

  const { data: runs } = await supabase
    .from('payroll_runs').select('id').eq('company_id', id);
  const runIds = (runs ?? []).map(r => r.id);

  if (runIds.length > 0) {
    const { error } = await supabase
      .from('payroll_results').delete().in('run_id', runIds);
    if (error) return { error: error.message };
  }

  const { error: runErr } = await supabase
    .from('payroll_runs').delete().eq('company_id', id);
  if (runErr) return { error: runErr.message };

  const { error: evtErr } = await supabase
    .from('employee_events').delete().eq('company_id', id);
  if (evtErr) return { error: evtErr.message };

  const { error: empErr } = await supabase
    .from('employees').delete().eq('company_id', id);
  if (empErr) return { error: empErr.message };

  const { error: coErr } = await supabase
    .from('companies').delete().eq('id', id);
  if (coErr) return { error: coErr.message };

  revalidatePath('/companies');
  revalidatePath('/dashboard');
  return { success: true };
}
