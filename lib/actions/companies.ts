'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { assertAuth, assertCompanyAccess } from '@/lib/auth/assertAccess';
import { audit } from '@/lib/audit';

// Derive workspace_id server-side from the authenticated user's profile rather
// than trusting whatever the client sent in the form. Prevents IDOR / forged
// workspace_id from inserting a row into someone else's tenant.
async function getCaller() {
  const auth = await assertAuth();
  if (!auth.ok) return null;
  const { data: profile } = await auth.supabase
    .from('user_profiles')
    .select('workspace_id, role')
    .eq('id', auth.user.id)
    .maybeSingle();
  return {
    workspaceId: (profile?.workspace_id as string | null) ?? null,
    appRole: (profile?.role as string | undefined) ?? 'staff',
  };
}

export async function createCompany(formData: FormData) {
  const name = formData.get('name') as string;
  if (!name) return { error: 'Nama perusahaan wajib diisi.' };

  const caller = await getCaller();
  if (!caller?.workspaceId) return { error: 'Workspace tidak ditemukan untuk akun Anda.' };
  // Staff get assignment-scoped access only; creating companies is an
  // accountant/dev action (middleware also blocks /companies/new for staff).
  if (caller.appRole === 'staff') return { error: 'Staff tidak punya akses menambah perusahaan.' };
  const workspace_id = caller.workspaceId;

  const supabase = await createClient();
  const { data: inserted, error } = await supabase
    .from('companies')
    .insert({
      workspace_id,
      name,
      npwp_perusahaan: formData.get('npwp_perusahaan') as string,
      alamat:          formData.get('alamat')           as string,
      kota:            formData.get('kota')             as string,
      industri:        formData.get('industri')         as string,
      aktif:           true,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  await audit({
    workspace_id,
    company_id: inserted?.id,
    action: 'COMPANY_CREATED',
    entity_type: 'company',
    entity_id: inserted?.id,
    entity_name: name,
    new_values: { npwp_perusahaan: formData.get('npwp_perusahaan'), kota: formData.get('kota') },
  });

  revalidateTag(`companies-${workspace_id}`);
  revalidatePath('/companies');
  revalidatePath('/');
  // Return the new id so callers (e.g. "create company from Excel" in bulk
  // import) can proceed straight into the new company. Existing callers that
  // only read `success`/`error` are unaffected.
  return { success: true, id: inserted?.id as string };
}

export async function updateCompany(id: string, formData: FormData) {
  const name = formData.get('name') as string;
  if (!name) return { error: 'Nama perusahaan wajib diisi.' };

  const access = await assertCompanyAccess(id);
  if (!access.ok) return { error: 'Akses ditolak.' };
  const { supabase, workspaceId } = access;

  const newValues = {
    name,
    npwp_perusahaan: formData.get('npwp_perusahaan') as string,
    alamat:          formData.get('alamat')           as string,
    kota:            formData.get('kota')             as string,
    industri:        formData.get('industri')         as string,
  };

  const { error } = await supabase.from('companies').update(newValues).eq('id', id);
  if (error) return { error: error.message };

  await audit({
    workspace_id: workspaceId,
    company_id: id,
    action: 'COMPANY_UPDATED',
    entity_type: 'company',
    entity_id: id,
    entity_name: name,
    new_values: newValues,
  });

  revalidateTag(`companies-${workspaceId}`);
  revalidatePath('/companies');
  revalidatePath(`/companies/${id}`);
  return { success: true };
}

export async function archiveCompany(id: string, aktif: boolean) {
  const access = await assertCompanyAccess(id);
  if (!access.ok) return { error: 'Akses ditolak.' };
  const { supabase, workspaceId, appRole } = access;
  if (appRole === 'staff') return { error: 'Staff tidak punya akses mengarsipkan perusahaan.' };

  const { error } = await supabase.from('companies').update({ aktif }).eq('id', id);
  if (error) return { error: error.message };

  await audit({
    workspace_id: workspaceId,
    company_id: id,
    action: 'COMPANY_ARCHIVED',
    entity_type: 'company',
    entity_id: id,
    new_values: { aktif },
  });

  revalidateTag(`companies-${workspaceId}`);
  revalidatePath('/companies');
  return { success: true };
}

export async function deleteCompany(id: string) {
  const access = await assertCompanyAccess(id);
  if (!access.ok) return { error: 'Akses ditolak.' };
  const { supabase, workspaceId, appRole } = access;

  // Staff cannot delete companies — they only get assignment-scoped access.
  if (appRole === 'staff') return { error: 'Staff tidak punya akses menghapus perusahaan.' };

  const { data: company } = await supabase.from('companies').select('name').eq('id', id).single();
  const entity_name = company?.name as string | undefined;

  // Refuse deletion if any payroll run is locked — those are immutable
  // regulatory records and the cascade would destroy them silently. The
  // user can still archive (aktif=false) to hide the company from listings
  // without deleting historical data.
  const { data: runs } = await supabase
    .from('payroll_runs').select('id, status').eq('company_id', id);
  const lockedCount = (runs ?? []).filter(r => r.status === 'locked').length;
  if (lockedCount > 0) {
    return { error: `Tidak bisa dihapus: ${lockedCount} payroll terkunci (catatan regulasi). Gunakan "Arsipkan" untuk menyembunyikan dari daftar.` };
  }
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

  await audit({
    workspace_id: workspaceId,
    company_id: id,
    action: 'COMPANY_DELETED',
    entity_type: 'company',
    entity_id: id,
    entity_name,
    old_values: { runs_deleted: runIds.length },
  });

  revalidateTag(`companies-${workspaceId}`);
  revalidatePath('/companies');
  revalidatePath('/dashboard');
  return { success: true };
}
