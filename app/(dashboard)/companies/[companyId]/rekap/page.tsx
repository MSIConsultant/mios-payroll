import { redirect } from 'next/navigation';
import { cachedAuth } from '@/lib/cache';
import { RekapTable, type RekapRow, type RekapMonthCell } from '@/components/payroll/rekap/RekapTable';

// REKAP tab (workbook PR 3) — the accountant's annual recap sheet, live:
// rows = employees, columns = months 1..12 from SAVED payroll_results +
// annual Pasal 17 recap from the saved December result_json. Nothing is
// recomputed here — annual numbers come from the engine output persisted at
// save time; unsaved months/December show as gaps, never as estimates.
export default async function RekapPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ tahun?: string }>;
}) {
  const { companyId } = await params;
  const sp = await searchParams;
  const tahun = Number(sp?.tahun) || new Date().getFullYear();

  const { supabase, user } = await cachedAuth();
  if (!user) redirect('/login');

  // 1. All runs of the year — archival imports create one run per jenis
  //    (tetap/harian/tidak_final) per month, so a month can have several.
  const { data: runs } = await supabase
    .from('payroll_runs')
    .select('id, bulan, jenis, status')
    .eq('company_id', companyId)
    .eq('tahun', tahun);

  const runIds = (runs ?? []).map((r) => r.id);
  const decemberRunIds = (runs ?? []).filter((r) => Number(r.bulan) === 12).map((r) => r.id);
  const bulanByRun: Record<string, number> = Object.fromEntries((runs ?? []).map((r) => [r.id, Number(r.bulan)]));
  const savedMonths = [...new Set((runs ?? []).map((r) => Number(r.bulan)))].sort((a, b) => a - b);
  const lockedMonths = [...new Set((runs ?? []).filter((r) => r.status === 'locked').map((r) => Number(r.bulan)))];

  // 2.–4. Scalars for the grid, December result_json for the annual recap,
  //       employees for names (no aktif filter — exited employees keep rows).
  const [{ data: resultRows }, { data: decRows }, { data: employees }] = await Promise.all([
    runIds.length > 0
      ? supabase.from('payroll_results').select('run_id, employee_id, bruto, pph, thp').in('run_id', runIds)
      : Promise.resolve({ data: [] as any[] }),
    decemberRunIds.length > 0
      ? supabase.from('payroll_results').select('employee_id, result_json').in('run_id', decemberRunIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('employees').select('id, nama, nik, jenis_karyawan, aktif').eq('company_id', companyId).order('nama'),
  ]);

  // Per-employee per-month cells, summed across jenis runs of the same month.
  const cells = new Map<string, (RekapMonthCell | null)[]>();
  const ensure = (empId: string) => {
    let arr = cells.get(empId);
    if (!arr) { arr = Array.from({ length: 12 }, () => null); cells.set(empId, arr); }
    return arr;
  };
  for (const r of resultRows ?? []) {
    const bulan = bulanByRun[r.run_id];
    if (!bulan) continue;
    const arr = ensure(r.employee_id);
    const cell = arr[bulan - 1] ?? { bruto: 0, pph: 0, thp: 0 };
    cell.bruto += Number(r.bruto ?? 0);
    cell.pph   += Number(r.pph ?? 0);
    cell.thp   += Number(r.thp ?? 0);
    arr[bulan - 1] = cell;
  }

  // Annual recap from the saved December engine output (tetap rows carry the
  // Pasal 17 fields; freelance rows don't → no annual columns for them).
  // Older saved results predate `lebih_potong` — fall back to the refund pair.
  const annualByEmp = new Map<string, RekapRow['annual']>();
  for (const d of decRows ?? []) {
    const j = d.result_json ?? {};
    if (j.bs == null && j.pph_tahunan == null) continue;
    const lebihPotong = (j.lebih_potong ?? (j.is_refund ? (j.refund_amount ?? 0) : 0)) || 0;
    annualByEmp.set(d.employee_id, {
      bs: Number(j.bs ?? 0),
      bj: Number(j.bj ?? 0),
      jht_jp: Number(j.jht_k_tahunan ?? 0) + Number(j.jp_k_tahunan ?? 0),
      netto: Number(j.netto ?? 0),
      pkp: Number(j.pkp ?? 0),
      pph_setahun: Number(j.pph_tahunan ?? 0),
      pph_jan_nov: Number(j.pph_jan_nov ?? 0),
      pph_des: lebihPotong > 0 ? -lebihPotong : Number(j.pph ?? 0),
      is_grossup: !!j.pph_ditanggung,
    });
  }

  const empById = new Map((employees ?? []).map((e) => [e.id, e]));
  const rowIds = new Set<string>([
    ...(employees ?? []).filter((e) => e.aktif).map((e) => e.id),
    ...cells.keys(),
  ]);

  const rows: RekapRow[] = [...rowIds]
    .map((id) => {
      const emp = empById.get(id);
      const months = cells.get(id) ?? Array.from({ length: 12 }, () => null);
      const total = months.reduce<RekapMonthCell>(
        (a, c) => c ? { bruto: a.bruto + c.bruto, pph: a.pph + c.pph, thp: a.thp + c.thp } : a,
        { bruto: 0, pph: 0, thp: 0 },
      );
      return {
        employee_id: id,
        nama: emp?.nama ?? '(karyawan terhapus)',
        nik: emp?.nik ?? null,
        jenis: emp?.jenis_karyawan ?? 'tetap',
        aktif: emp?.aktif ?? false,
        months,
        total,
        annual: annualByEmp.get(id) ?? null,
      };
    })
    .sort((a, b) => a.nama.localeCompare(b.nama));

  return (
    <RekapTable
      rows={rows}
      savedMonths={savedMonths}
      lockedMonths={lockedMonths}
      tahun={tahun}
      companyId={companyId}
    />
  );
}
