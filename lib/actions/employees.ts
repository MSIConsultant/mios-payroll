'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';

const NUMERIC_FIELDS = [
  'gaji_pokok',
  'benefit',
  'kendaraan',
  'pulsa',
  'operasional',
  'tunj_lain',
  'upah_harian',
  'hari_kerja_default',
  'upah_bulanan_tt',
  'tunjangan_tt',
  'jkk_rate',
];

const BOOLEAN_FIELDS = [
  'punya_npwp',
  'ikut_jht',
  'ikut_jp',
  'ikut_jkp',
  'tanggung_jht_k',
  'tanggung_jp_k',
  'ikut_kes',
  'tanggung_kes_k',
  'pph_ditanggung',
  'ikut_bpjs_tk',
  'aktif',
];

function parseFields(formData: FormData): Record<string, any> {
  const fields: Record<string, any> = {};

  // Default all boolean fields to false first
  // unchecked checkboxes do not exist in FormData
  for (const key of BOOLEAN_FIELDS) {
    fields[key] = false;
  }

  formData.forEach((value, key) => {
    if (key.startsWith('$')) return;

    if (NUMERIC_FIELDS.includes(key)) {
      fields[key] = Number(value) || 0;
    } else if (BOOLEAN_FIELDS.includes(key)) {
      fields[key] = value === 'on' || value === 'true';
    } else {
      fields[key] = value;
    }
  });

  return fields;
}

export async function createEmployee(formData: FormData) {
  const supabase = await createClient();

  const fields = parseFields(formData);

  fields.aktif = true;

  // Get workspace_id from company
  const { data: company } = await supabase
    .from('companies')
    .select('workspace_id')
    .eq('id', fields.company_id)
    .single();

  const workspaceId = company?.workspace_id;

  const { error } = await supabase
    .from('employees')
    .insert(fields);

  if (error) {
    console.error(error);
    return { error: error.message };
  }

  // Audit log
  await audit({
    workspace_id: workspaceId,
    company_id: fields.company_id,
    action: 'EMPLOYEE_CREATED',
    entity_type: 'employee',
    entity_name: fields.nama,
    new_values: {
      gaji_pokok: fields.gaji_pokok,
      jenis_karyawan: fields.jenis_karyawan,
    },
  });

  revalidatePath(`/companies/${fields.company_id}`);

  return { success: true };
}

export async function updateEmployee(
  id: string,
  companyId: string,
  formData: FormData
) {
  const supabase = await createClient();

  const fields = parseFields(formData);

  // Never change aktif status during edit
  delete fields.aktif;

  // Get workspace_id from company
  const { data: company } = await supabase
    .from('companies')
    .select('workspace_id')
    .eq('id', companyId)
    .single();

  const workspaceId = company?.workspace_id;

  const { error } = await supabase
    .from('employees')
    .update(fields)
    .eq('id', id);

  if (error) {
    console.error(error);
    return { error: error.message };
  }

  // Audit log
  await audit({
    workspace_id: workspaceId,
    company_id: companyId,
    action: fields.gaji_pokok
      ? 'SALARY_UPDATED'
      : 'EMPLOYEE_UPDATED',
    entity_type: 'employee',
    entity_id: id,
    entity_name: fields.nama,
    new_values: fields,
  });

  revalidatePath(`/companies/${companyId}`);
  revalidatePath(`/companies/${companyId}/employees/${id}`);

  return { success: true };
}

export async function deleteEmployee(
  id: string,
  companyId: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/companies/${companyId}`);

  return { success: true };
}

export async function addEvent(formData: FormData) {
  const supabase = await createClient();

  const employee_id = formData.get(
    'employee_id'
  ) as string;

  const company_id = formData.get(
    'company_id'
  ) as string;

  const tahun = Number(formData.get('tahun'));

  const bulan = Number(formData.get('bulan'));

  const tipe = formData.get('tipe') as string;

  const nilai = Number(formData.get('nilai'));

  const keterangan = formData.get(
    'keterangan'
  ) as string;

  const { error } = await supabase
    .from('employee_events')
    .insert({
      employee_id,
      company_id,
      tahun,
      bulan,
      tipe,
      nilai,
      keterangan,
    });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(
    `/companies/${company_id}/employees/${employee_id}`
  );

  return { success: true };
}

export async function deleteEvent(
  id: string,
  companyId: string,
  employeeId: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('employee_events')
    .delete()
    .eq('id', id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(
    `/companies/${companyId}/employees/${employeeId}`
  );

  return { success: true };
}
