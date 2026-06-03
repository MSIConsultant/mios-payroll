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

  // Server-enforced required set. The UI hints at format/required, but a
  // crafted submission could bypass them. These are the fields the accountant
  // and the engine both need to be present:
  //   Nama, NIK/Paspor, Jenis Kelamin, Jabatan, Alamat, Status PTKP.
  // NPWP is intentionally NOT required — since 2026 the NIK=NPWP integration
  // makes a separate NPWP value optional (PENG-6/PJ.09/2024).
  // `punya_npwp` is derived from whether `npwp` was provided.
  const nik = String(fields.nik ?? '').trim();
  const nama = String(fields.nama ?? '').trim();
  const jabatan = String(fields.jabatan ?? '').trim();
  const alamat = String(fields.alamat ?? '').trim();
  const jk = String(fields.jenis_kelamin ?? '').trim().toUpperCase();
  if (nama.length < 2) return { error: 'Nama wajib diisi.' };
  if (nik.length < 5) return { error: 'NIK / paspor minimal 5 karakter.' };
  if (jabatan.length < 2) return { error: 'Jabatan wajib diisi.' };
  if (alamat.length < 5) return { error: 'Alamat wajib diisi (minimal 5 karakter).' };
  if (jk !== 'L' && jk !== 'P') return { error: 'Jenis kelamin wajib dipilih (L / P).' };
  const validPtkp = ['TK0','TK1','TK2','TK3','K0','K1','K2','K3'];
  if (!validPtkp.includes(fields.status_ptkp)) return { error: 'Status PTKP tidak valid.' };
  if (fields.jenis_karyawan === 'tetap' && (Number(fields.gaji_pokok) || 0) < 0) {
    return { error: 'Gaji pokok tidak boleh negatif.' };
  }

  // Derive punya_npwp from presence of a non-empty npwp value.
  const npwpStr = String(fields.npwp ?? '').trim();
  fields.punya_npwp = npwpStr.length > 0;
  if (!fields.punya_npwp) fields.npwp = null;

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

  // Validate only fields actually present in the submission (partial updates
  // from QuickEdit should not be rejected for missing nama/jabatan/etc).
  if ('nama' in fields) {
    const v = String(fields.nama ?? '').trim();
    if (v.length < 2) return { error: 'Nama tidak boleh kosong.' };
  }
  if ('nik' in fields) {
    const v = String(fields.nik ?? '').trim();
    if (v.length < 5) return { error: 'NIK / paspor minimal 5 karakter.' };
  }
  if ('jabatan' in fields) {
    const v = String(fields.jabatan ?? '').trim();
    if (v.length < 2) return { error: 'Jabatan tidak boleh kosong.' };
  }
  if ('alamat' in fields) {
    const v = String(fields.alamat ?? '').trim();
    if (v.length < 5) return { error: 'Alamat minimal 5 karakter.' };
  }
  if ('jenis_kelamin' in fields) {
    const v = String(fields.jenis_kelamin ?? '').trim().toUpperCase();
    if (v !== 'L' && v !== 'P') return { error: 'Jenis kelamin harus L atau P.' };
  }
  if ('status_ptkp' in fields) {
    const validPtkp = ['TK0','TK1','TK2','TK3','K0','K1','K2','K3'];
    if (!validPtkp.includes(fields.status_ptkp)) return { error: 'Status PTKP tidak valid.' };
  }

  // If the npwp field was submitted, re-derive punya_npwp from its presence.
  if ('npwp' in fields) {
    const npwpStr = String(fields.npwp ?? '').trim();
    fields.punya_npwp = npwpStr.length > 0;
    if (!fields.punya_npwp) fields.npwp = null;
  }

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
  const { supabase, workspaceId, appRole } = access;
  if (appRole === 'staff') return { error: 'Staff tidak punya akses menghapus karyawan.' };

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

/**
 * Per-month upah override for tidak_tetap_bulanan workers.
 *
 * Bulanan workers' upah can vary month to month. Rather than touch the
 * static `employees.upah_bulanan_tt` (which acts as the default), this
 * action writes an `employee_events` row with `tipe='upah_bulanan_override'`
 * scoped to (employee_id, tahun, bulan). The unique partial index in the
 * 2026-05-29-employee-flexibility migration guarantees one row per period.
 *
 * The engine (server-recalc.ts and the client runCalculation) reads this
 * override when computing payroll for the month; absent an override, it
 * falls back to upah_bulanan_tt.
 *
 * Passing nilai === null clears any existing override for that period.
 */
export async function setUpahBulananOverride(
  employeeId: string,
  tahun: number,
  bulan: number,
  nilai: number | null,
) {
  // Resolve company from employee row first so we can run assertCompanyAccess.
  const sb0 = await createClient();
  const { data: emp } = await sb0
    .from('employees')
    .select('id, company_id, jenis_karyawan')
    .eq('id', employeeId)
    .maybeSingle();
  if (!emp) return { error: 'Karyawan tidak ditemukan.' };
  if (emp.jenis_karyawan !== 'tidak_tetap_bulanan') {
    return { error: 'Upah per bulan hanya berlaku untuk karyawan Tidak Tetap Bulanan.' };
  }

  const access = await assertCompanyAccess(emp.company_id as string);
  if (!access.ok) return { error: 'Akses ditolak.' };
  const { supabase, workspaceId, appRole } = access;
  if (appRole === 'staff') return { error: 'Staff tidak punya akses mengubah upah bulanan.' };

  if (!Number.isInteger(tahun) || tahun < 2020 || tahun > 2100) {
    return { error: 'Tahun tidak valid.' };
  }
  if (!Number.isInteger(bulan) || bulan < 1 || bulan > 12) {
    return { error: 'Bulan harus 1–12.' };
  }
  if (nilai !== null) {
    if (typeof nilai !== 'number' || !Number.isFinite(nilai) || nilai < 0) {
      return { error: 'Nilai upah tidak valid.' };
    }
  }

  // Delete any existing override for this period (partial unique index allows
  // at most one, but be defensive). Then insert the new value if provided.
  const { error: delErr } = await supabase
    .from('employee_events')
    .delete()
    .eq('employee_id', employeeId)
    .eq('tahun', tahun)
    .eq('bulan', bulan)
    .eq('tipe', 'upah_bulanan_override');
  if (delErr) return { error: delErr.message };

  if (nilai !== null) {
    const { error: insErr } = await supabase.from('employee_events').insert({
      employee_id: employeeId,
      company_id: emp.company_id,
      tahun, bulan,
      tipe: 'upah_bulanan_override',
      nilai: Math.round(nilai),
    });
    if (insErr) return { error: insErr.message };
  }

  await audit({
    workspace_id: workspaceId,
    company_id: emp.company_id as string,
    action: 'EVENT_ADDED',
    entity_type: 'employee_event',
    new_values: {
      employee_id: employeeId,
      tipe: 'upah_bulanan_override',
      nilai: nilai ?? 0,
      cleared: nilai === null,
      tahun, bulan,
    },
  });

  revalidatePath(`/companies/${emp.company_id}/employees/${employeeId}`);
  revalidatePath(`/companies/${emp.company_id}/payroll/${tahun}/${bulan}`);

  return { success: true };
}
