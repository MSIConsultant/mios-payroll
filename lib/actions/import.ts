'use server';
import { createClient } from '@/lib/supabase/server';
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
  workspaceId: string;
  companyId:   string;
  bulan:       number;
  tahun:       number;
  fileName:    string;
  mode:        'employees_only' | 'full';
  records:     ImportRecord[];
}

export async function saveImport(payload: SaveImportPayload) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { workspaceId, companyId, bulan, tahun, fileName, mode, records } = payload;

  // ── 1. Resolve existing employees by NIK ──────────────────────────
  const { data: existing } = await supabase
    .from('employees').select('id, nik').eq('company_id', companyId);
  const existingByNIK: Record<string, string> = {};
  for (const e of existing ?? []) existingByNIK[e.nik] = e.id;

  // ── 2. Create new employees ───────────────────────────────────────
  const empIdMap: Record<string, string> = { ...Object.fromEntries(Object.entries(existingByNIK)) };
  let created = 0;
  let skipped = 0;

  for (const rec of records) {
    if (existingByNIK[rec.nik]) { skipped++; continue; }

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
      metadata: { mode, created, skipped, bulan, tahun },
    });
    revalidatePath(`/companies/${companyId}`);
    revalidatePath('/import');
    return { success: true, created, skipped, payroll: false };
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
      employee_name: r.nama,
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
    metadata: { mode, created, skipped, bulan, tahun, run_id: runId, diffs: records.filter(r => r.has_diff).length },
  });

  revalidatePath(`/companies/${companyId}`);
  revalidatePath('/import');
  return { success: true, created, skipped, payroll: true, runId, sessionId: session?.id };
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
