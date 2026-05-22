'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { audit } from '@/lib/audit';
import { assertCompanyAccess } from '@/lib/auth/assertAccess';

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

// Date fields submitted as ISO strings; empty string must become NULL for
// PostgreSQL `date` columns (otherwise insert fails with invalid date).
const DATE_FIELDS = ['tanggal_masuk', 'tanggal_keluar'];

/**
 * Parse a FormData submission into an employee-fields object.
 *
 * On CREATE the form always renders every checkbox, so missing keys mean
 * "unchecked" and should become `false`. On UPDATE the form *might* be partial
 * (e.g. QuickEdit modal touching only gaji_pokok) and pre-defaulting all
 * booleans to false would silently wipe BPJS flags. Pass `defaultBooleans:
 * false` from update callers so only booleans explicitly present in FormData
 * are written.
 */
function parseFields(
  formData: FormData,
  opts: { defaultBooleans: boolean } = { defaultBooleans: true }
): Record<string, any> {
  const fields: Record<string, any> = {};

  if (opts.defaultBooleans) {
    for (const key of BOOLEAN_FIELDS) {
      fields[key] = false;
    }
  }

  formData.forEach((value, key) => {
    if (key.startsWith('$')) return;

    if (NUMERIC_FIELDS.includes(key)) {
      fields[key] = Number(value) || 0;
    } else if (BOOLEAN_FIELDS.includes(key)) {
      fields[key] = value === 'on' || value === 'true';
    } else if (DATE_FIELDS.includes(key)) {
      const s = String(value).trim();
      fields[key] = s === '' ? null : s;
    } else {
      fields[key] = value;
    }
  });

  return fields;
}

export async function createEmployee(formData: FormData) {
  const fields = parseFields(formData, { defaultBooleans: true });
  fields.aktif = true;

  const access = await assertCompanyAccess(fields.company_id as string);
  if (!access.ok) return { error: 'Akses ditolak.' };
  const { supabase, workspaceId } = access;

  const { error } = await supabase.from('employees').insert(fields);
  if (error) return { error: error.message };

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
  const access = await assertCompanyAccess(companyId);
  if (!access.ok) return { error: 'Akses ditolak.' };
  const { supabase, workspaceId } = access;

  // defaultBooleans:false → callers that send a partial form (e.g. QuickEdit)
  // don't silently reset BPJS/PPh flags.
  const fields = parseFields(formData, { defaultBooleans: false });

  // Never change aktif status during edit
  delete fields.aktif;

  const { error } = await supabase
    .from('employees')
    .update(fields)
    .eq('id', id);

  if (error) return { error: error.message };

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
  revalidateTag(`employees-${workspaceId}`);

  return { success: true };
}

export async function deleteEmployee(
  id: string,
  companyId: string
) {
  const access = await assertCompanyAccess(companyId);
  if (!access.ok) return { error: 'Akses ditolak.' };
  const { supabase, workspaceId } = access;

  const { data: existing } = await supabase
    .from('employees').select('nama').eq('id', id).maybeSingle();

  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };

  await audit({
    workspace_id: workspaceId,
    company_id: companyId,
    action: 'EMPLOYEE_DELETED',
    entity_type: 'employee',
    entity_id: id,
    entity_name: (existing?.nama as string | undefined) ?? undefined,
  });

  revalidatePath(`/companies/${companyId}`);

  return { success: true };
}

const EventSchema = z.object({
  employee_id: z.string().uuid(),
  company_id:  z.string().uuid(),
  tahun:       z.coerce.number().int().min(2020).max(2100),
  bulan:       z.coerce.number().int().min(1).max(12),
  tipe:        z.enum(['thr', 'bonus', 'kasbon', 'pot_lain', 'benefit_extra']),
  nilai:       z.coerce.number().finite().nonnegative(),
  keterangan:  z.string().max(500).optional(),
});

export async function addEvent(formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = EventSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Input tidak valid.' };
  }
  const event = parsed.data;

  const access = await assertCompanyAccess(event.company_id);
  if (!access.ok) return { error: 'Akses ditolak.' };
  const { supabase, workspaceId } = access;

  const { error } = await supabase
    .from('employee_events')
    .insert(event);

  if (error) return { error: error.message };

  await audit({
    workspace_id: workspaceId,
    company_id: event.company_id,
    action: 'EVENT_ADDED',
    entity_type: 'employee_event',
    new_values: {
      employee_id: event.employee_id,
      tipe: event.tipe,
      nilai: event.nilai,
      tahun: event.tahun,
      bulan: event.bulan,
    },
  });

  revalidatePath(
    `/companies/${event.company_id}/employees/${event.employee_id}`
  );

  return { success: true };
}

export async function deleteEvent(
  id: string,
  companyId: string,
  employeeId: string
) {
  const access = await assertCompanyAccess(companyId);
  if (!access.ok) return { error: 'Akses ditolak.' };
  const { supabase, workspaceId } = access;

  const { error } = await supabase
    .from('employee_events')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };

  await audit({
    workspace_id: workspaceId,
    company_id: companyId,
    action: 'EVENT_DELETED',
    entity_type: 'employee_event',
    entity_id: id,
    new_values: { employee_id: employeeId },
  });

  revalidatePath(
    `/companies/${companyId}/employees/${employeeId}`
  );

  return { success: true };
}
