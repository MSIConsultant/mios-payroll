import { redirect } from 'next/navigation';
import { cachedAuth, cachedUserProfile, getPayrollRunTotals } from '@/lib/cache';
import HomeClient, { type HomeCompany, type HomeRunStatus } from './HomeClient';

// Home (workbook PR 4) — the list of company "databases" with current-month
// status + totals. Replaces the old dashboard/batch/companies-list trio;
// those routes now redirect here. One parallel fetch pass per request,
// deduped via lib/cache helpers.
export default async function Home() {
  const { supabase, user } = await cachedAuth();
  if (!user) redirect('/login');

  const profile = await cachedUserProfile(user.id);
  const workspaceId = profile?.workspace_id;

  const now = new Date();
  const bulanIni = now.getMonth() + 1;
  const tahunIni = now.getFullYear();

  if (!workspaceId) {
    return <HomeClient companies={[]} bulanIni={bulanIni} tahunIni={tahunIni} hasWorkspace={false} />;
  }

  // Legacy staff rows may still exist in the DB; keep the company filter.
  const isStaff = profile?.role === 'staff';
  let allowedIds: string[] | null = null;
  if (isStaff) {
    const { data: access } = await supabase
      .from('company_staff_access')
      .select('company_id')
      .eq('staff_user_id', user.id);
    allowedIds = (access ?? []).map((a) => a.company_id as string);
    if (allowedIds.length === 0) {
      return <HomeClient companies={[]} bulanIni={bulanIni} tahunIni={tahunIni} hasWorkspace />;
    }
  }

  const coBase = supabase
    .from('companies')
    .select('id, name, kota')
    .eq('workspace_id', workspaceId)
    .eq('aktif', true)
    .order('name');
  const { data: companiesData } = await (isStaff ? coBase.in('id', allowedIds!) : coBase);
  const companies = companiesData ?? [];
  const companyIds = companies.map((c) => c.id);

  let runByCompany: Record<string, { id: string; status: HomeRunStatus }> = {};
  let empMap: Record<string, number> = {};
  if (companyIds.length > 0) {
    const [{ data: runs }, { data: emps }] = await Promise.all([
      supabase
        .from('payroll_runs')
        .select('id, company_id, status')
        .in('company_id', companyIds)
        .eq('tahun', tahunIni)
        .eq('bulan', bulanIni),
      supabase
        .from('employees')
        .select('company_id')
        .in('company_id', companyIds)
        .eq('aktif', true),
    ]);
    // Archival imports can yield several jenis runs per month — prefer tetap.
    for (const r of runs ?? []) {
      const prev = runByCompany[r.company_id];
      if (!prev) runByCompany[r.company_id] = { id: r.id, status: r.status as HomeRunStatus };
    }
    for (const e of emps ?? []) empMap[e.company_id] = (empMap[e.company_id] ?? 0) + 1;
  }

  // Per-run totals (bruto/pph/thp) for this month's runs, in one RPC.
  const runIds = Object.values(runByCompany).map((r) => r.id);
  const totals = await getPayrollRunTotals(supabase, runIds);
  const totalsByRun = Object.fromEntries(totals.map((t) => [t.run_id, t]));

  const rows: HomeCompany[] = companies.map((co) => {
    const run = runByCompany[co.id];
    const t = run ? totalsByRun[run.id] : undefined;
    return {
      id: co.id,
      name: co.name,
      kota: co.kota,
      empCount: empMap[co.id] ?? 0,
      status: run?.status ?? 'none',
      bruto: t?.total_bruto,
      pph: t?.total_pph,
      thp: t?.total_thp,
    };
  });

  return <HomeClient companies={rows} bulanIni={bulanIni} tahunIni={tahunIni} hasWorkspace />;
}
