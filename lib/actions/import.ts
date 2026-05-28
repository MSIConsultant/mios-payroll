'use server';
import { createClient } from '@/lib/supabase/server';
import { assertCompanyAccess } from '@/lib/auth/assertAccess';
import { audit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';

export interface ImportRecord {
  nik:            string;
  nama:           string;
  divisi:         string;
  npwp:           string;
  punya_npwp:     boolean;
  status_ptkp:    string;
  jenis_kelamin:  string;
  gaji_pokok:     number;
  benefit:        number;
  kendaraan:      number;
  pulsa:          number;
  operasional:    number;
  jkk_rate:       number;
  ikut_jht:       boolean;
  ikut_jp:        boolean;
  ikut_kes:       boolean;
  jenis_karyawan: string;
  tunj_pph:       number;
  upah_harian?:   number;
  excel_bruto:    number;
  excel_pph:      number;
  excel_thp:      number;
  engine_bruto:   number;
  engine_pph:     number;
  engine_thp:     number;
  has_diff:       boolean;
  diff_pct:       number;
  full_result:    Record<string, any>;
}

export interface SaveImportPayload {
  workspaceId:      string;
  companyId:        string;
  bulan:            number;
  tahun:            number;
  fileName:         string;
  mode:             'employees_only' | 'full';
  update_existing?: boolean;
  records:          ImportRecord[];
}

export async function saveImport(payload: SaveImportPayload) {
  const access = await assertCompanyAccess(payload.companyId);
  if (!access.ok) return { error: access.error === 'unauthenticated' ? 'Not authenticated' : 'Akses ditolak' };
  // workspaceId derived server-side from company record, not trusted from client payload
  const { supabase, user, workspaceId } = access;

  const { companyId, bulan, tahun, fileName, mode, update_existing = false, records } = payload;

  // ── 1. Resolve existing employees by NIK ──────────────────────────
  const { data: existing } = await supabase
    .from('employees').select('id, nik').eq('company_id', companyId);
  const existingByNIK: Record<string, string> = {};
  for (const e of existing ?? []) existingByNIK[e.nik] = e.id;

  // ── 2. Create or update employees ────────────────────────────────
  const empIdMap: Record<string, string> = { ...Object.fromEntries(Object.entries(existingByNIK)) };
  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const rec of records) {
    if (existingByNIK[rec.nik]) {
      empIdMap[rec.nik] = existingByNIK[rec.nik];
      if (update_existing) {
        await supabase.from('employees').update({
          gaji_pokok:     rec.gaji_pokok,
          status_ptkp:    rec.status_ptkp,
          benefit:        rec.benefit,
          kendaraan:      rec.kendaraan,
          pulsa:          rec.pulsa,
          operasional:    rec.operasional,
          jkk_rate:       rec.jkk_rate,
          ikut_jht:       rec.ikut_jht,
          ikut_jp:        rec.ikut_jp,
          ikut_kes:       rec.ikut_kes,
          pph_ditanggung: rec.tunj_pph > 0,
          punya_npwp:     rec.punya_npwp,
          npwp:           rec.npwp || null,
        }).eq('id', existingByNIK[rec.nik]);
        updated++;
      } else {
        skipped++;
      }
      continue;
    }

    const { data: newEmp, error } = await supabase
      .from('employees')
      .insert({
        company_id:     companyId,
        nama:           rec.nama,
        nik:            rec.nik,
        npwp:           rec.npwp || null,
        punya_npwp:     rec.punya_npwp,
        status_ptkp:    rec.status_ptkp,
        jenis_kelamin:  rec.jenis_kelamin,
        divisi:         rec.divisi,
        jabatan:        '',
        jenis_karyawan: rec.jenis_karyawan,
        gaji_pokok:     rec.gaji_pokok,
        benefit:        rec.benefit,
        kendaraan:      rec.kendaraan,
        pulsa:          rec.pulsa,
        operasional:    rec.operasional,
        tunj_lain:      0,
        jkk_rate:       rec.jkk_rate,
        ikut_jht:       rec.ikut_jht,
        ikut_jp:        rec.ikut_jp,
        ikut_kes:       rec.ikut_kes,
        tanggung_jht_k: rec.ikut_jht,
        tanggung_jp_k:  rec.ikut_jp,
        tanggung_kes_k: rec.ikut_kes,
        pph_ditanggung: rec.tunj_pph > 0,
        upah_harian:    rec.upah_harian ?? 0,
        aktif:          true,
      })
      .select('id').single();

    if (!error && newEmp) { empIdMap[rec.nik] = newEmp.id; created++; }
  }

  if (mode === 'employees_only') {
    await audit({
      workspace_id: workspaceId, company_id: companyId,
      action: 'IMPORT_COMPLETED', entity_name: fileName,
      metadata: { mode, created, skipped, updated, bulan, tahun },
    });
    revalidatePath(`/companies/${companyId}`);
    revalidatePath('/import');
    return { success: true, created, skipped, updated, payroll: false };
  }

  // ── 3. Create payroll run ─────────────────────────────────────────
  const { data: existingRun } = await supabase
    .from('payroll_runs').select('id')
    .eq('company_id', companyId).eq('tahun', tahun).eq('bulan', bulan).maybeSingle();

  let runId = existingRun?.id;
  if (!runId) {
    const { data: newRun, error: runErr } = await supabase
      .from('payroll_runs')
      .insert({
        company_id: companyId, tahun, bulan,
        status: 'locked',
        calculated_at: new Date().toISOString(),
        locked_at:     new Date().toISOString(),
        run_by:        user.id,
      })
      .select('id').single();
    if (runErr || !newRun) return { error: runErr?.message ?? 'Gagal membuat payroll run' };
    runId = newRun.id;
  } else {
    const { error: lockErr } = await supabase.from('payroll_runs').update({
      status: 'locked', locked_at: new Date().toISOString(), run_by: user.id,
    }).eq('id', runId);
    if (lockErr) return { error: lockErr.message };
  }

  // ── 4. Insert payroll results ─────────────────────────────────────
  const resultRows = records
    .filter(r => empIdMap[r.nik])
    .map(r => ({
      run_id:        runId,
      employee_id:   empIdMap[r.nik],
      bruto:         r.excel_bruto,
      pph:           r.excel_pph,
      thp:           r.excel_thp,
      bpjs_karyawan: 0,
      tunj_pph:      r.tunj_pph,
      result_json:   { ...r.full_result, employee_name: r.nama, employee_id: empIdMap[r.nik] },
      calculated_at: new Date().toISOString(),
    }));

  if (resultRows.length > 0) {
    await supabase.from('payroll_results').delete().eq('run_id', runId);
    const { error: resErr } = await supabase.from('payroll_results').insert(resultRows);
    if (resErr) return { error: resErr.message };
  }

  // ── 5. Create import session ──────────────────────────────────────
  const { data: session } = await supabase
    .from('import_sessions')
    .insert({
      workspace_id:  workspaceId,
      company_id:    companyId,
      imported_by:   user.id,
      file_name:     fileName,
      bulan, tahun,
      total_rows:    records.length,
      imported_rows: resultRows.length,
      status:        'completed',
      summary: {
        created, skipped,
        has_diffs:   records.filter(r => r.has_diff).length,
        total_bruto: records.reduce((a, r) => a + r.excel_bruto, 0),
        total_pph:   records.reduce((a, r) => a + r.excel_pph,   0),
        total_thp:   records.reduce((a, r) => a + r.excel_thp,   0),
      },
    })
    .select('id').single();

  // ── 6. Create import records (reconciliation trail) ───────────────
  if (session) {
    const importRecords = records.map(r => ({
      session_id:        session.id,
      employee_id:       empIdMap[r.nik] ?? null,
      employee_name:     r.nama,
      original_data:     { bruto: r.excel_bruto, pph: r.excel_pph, thp: r.excel_thp, gaji_pokok: r.gaji_pokok },
      recalculated_data: { bruto: r.engine_bruto, pph: r.engine_pph, thp: r.engine_thp },
      differences:       { bruto: r.excel_bruto - r.engine_bruto, pph: r.excel_pph - r.engine_pph, thp: r.excel_thp - r.engine_thp, diff_pct: r.diff_pct },
      has_diff:          r.has_diff,
    }));
    await supabase.from('import_records').insert(importRecords);
  }

  // ── 7. Audit ──────────────────────────────────────────────────────
  await audit({
    workspace_id: workspaceId, company_id: companyId,
    action: 'IMPORT_COMPLETED', entity_name: fileName,
    metadata: { mode, created, skipped, updated, bulan, tahun, run_id: runId, diffs: records.filter(r => r.has_diff).length },
  });

  revalidatePath(`/companies/${companyId}`);
  revalidatePath('/import');
  return { success: true, created, skipped, updated, payroll: true, runId, sessionId: session?.id };
}

/**
 * Returns accumulated bruto + PPh for each employee (keyed by NIK) from all
 * saved payroll runs for companyId+tahun where bulan < bulanSampai.
 * Used by the reconcile step to give December/last-month a realistic akum_bruto.
 */
export async function fetchEmployeeAccumDataByNik(
  companyId: string,
  tahun: number,
  bulanSampai: number,
): Promise<Record<string, { akum_bruto: number; pph_jan_nov: number }>> {
  if (bulanSampai <= 1) return {};

  const supabase = await createClient();

  const { data: runs } = await supabase
    .from('payroll_runs')
    .select('id')
    .eq('company_id', companyId)
    .eq('tahun', tahun)
    .lt('bulan', bulanSampai)
    .in('status', ['locked', 'calculated']);

  if (!runs || runs.length === 0) return {};

  const runIds = runs.map((r: any) => r.id as string);

  const [{ data: emps }, { data: results }] = await Promise.all([
    supabase.from('employees').select('id, nik').eq('company_id', companyId),
    supabase.from('payroll_results').select('employee_id, bruto, pph').in('run_id', runIds),
  ]);

  const nikById: Record<string, string> = {};
  for (const e of emps ?? []) nikById[e.id] = e.nik;

  const accum: Record<string, { akum_bruto: number; pph_jan_nov: number }> = {};
  for (const r of results ?? []) {
    const nik = nikById[r.employee_id];
    if (!nik) continue;
    if (!accum[nik]) accum[nik] = { akum_bruto: 0, pph_jan_nov: 0 };
    accum[nik].akum_bruto  += (r.bruto as number) ?? 0;
    accum[nik].pph_jan_nov += (r.pph   as number) ?? 0;
  }

  return accum;
}

/**
 * Returns current DB employee data (gaji_pokok, status_ptkp, divisi) keyed by
 * NIK, for comparing against Excel-parsed values in the reconcile step.
 */
export async function fetchExistingEmployeeDataByNik(
  companyId: string,
): Promise<Record<string, { gaji_pokok: number; status_ptkp: string; divisi: string; bpjs_basis: number | null }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('employees')
    .select('nik, gaji_pokok, status_ptkp, divisi, bpjs_basis')
    .eq('company_id', companyId)
    .eq('aktif', true);

  const map: Record<string, { gaji_pokok: number; status_ptkp: string; divisi: string; bpjs_basis: number | null }> = {};
  for (const e of data ?? []) {
    map[e.nik] = {
      gaji_pokok: e.gaji_pokok ?? 0,
      status_ptkp: e.status_ptkp ?? '',
      divisi: e.divisi ?? '',
      bpjs_basis: (e as any).bpjs_basis ?? null,
    };
  }
  return map;
}

export async function getImportHistory(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('import_sessions')
    .select('*, companies(name)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function getImportSession(sessionId: string) {
  const supabase = await createClient();
  const [{ data: session }, { data: records }] = await Promise.all([
    supabase.from('import_sessions').select('*, companies(name)').eq('id', sessionId).single(),
    supabase.from('import_records').select('*').eq('session_id', sessionId).order('employee_name'),
  ]);
  return { session, records: records ?? [] };
}
