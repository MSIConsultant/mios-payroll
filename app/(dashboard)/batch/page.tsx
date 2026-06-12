import { redirect } from 'next/navigation';
import { cachedAuth, cachedUserProfile, getPayrollRunTotals } from '@/lib/cache';
import BatchClient, { type CompanyRow } from './BatchClient';

// Server component: companies + this/prev month runs + employee counts in
// parallel, totals via the get_payroll_run_totals RPC (lib/cache wrapper).
// Replaces the client-side waterfall that re-ran on every navigation.
export default async function BatchPage() {
  const { supabase, user } = await cachedAuth();
  if (!user) redirect('/login');

  const profile = await cachedUserProfile(user.id);
  const workspaceId = profile?.workspace_id;
  if (!workspaceId) redirect('/dashboard');

  const now = new Date();
  const bulanIni  = now.getMonth() + 1;
  const tahunIni  = now.getFullYear();
  const prevBulan = bulanIni === 1 ? 12 : bulanIni - 1;
  const prevTahun = bulanIni === 1 ? tahunIni - 1 : tahunIni;

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
      return <BatchClient rows={[]} bulanIni={bulanIni} tahunIni={tahunIni} prevBulan={prevBulan} />;
    }
  }

  const coBase = supabase
    .from('companies')
    .select('id, name, kota')
    .eq('workspace_id', workspaceId)
    .eq('aktif', true)
    .order('name');
  const { data: companies } = await (isStaff ? coBase.in('id', allowedIds!) : coBase);

  if (!companies?.length) {
    return <BatchClient rows={[]} bulanIni={bulanIni} tahunIni={tahunIni} prevBulan={prevBulan} />;
  }
  const companyIds = companies.map((c) => c.id);

  const [{ data: thisRuns }, { data: prevRuns }, { data: emps }] = await Promise.all([
    supabase.from('payroll_runs').select('id, company_id, status')
      .in('company_id', companyIds).eq('tahun', tahunIni).eq('bulan', bulanIni),
    supabase.from('payroll_runs').select('id, company_id, status')
      .in('company_id', companyIds).eq('tahun', prevTahun).eq('bulan', prevBulan),
    supabase.from('employees').select('company_id')
      .in('company_id', companyIds).eq('aktif', true),
  ]);

  const [thisTotals, prevTotals] = await Promise.all([
    getPayrollRunTotals(supabase, (thisRuns ?? []).map((r) => r.id)),
    getPayrollRunTotals(supabase, (prevRuns ?? []).map((r) => r.id)),
  ]);

  const thisMap = Object.fromEntries(thisTotals.map((r) => [r.run_id, r]));
  const prevMap = Object.fromEntries(prevTotals.map((r) => [r.run_id, r]));
  const thisRunByCompany = Object.fromEntries((thisRuns ?? []).map((r) => [r.company_id, r]));
  const prevRunByCompany = Object.fromEntries((prevRuns ?? []).map((r) => [r.company_id, r]));
  const empCountByCompany: Record<string, number> = {};
  for (const e of emps ?? []) {
    empCountByCompany[e.company_id] = (empCountByCompany[e.company_id] ?? 0) + 1;
  }

  const rows: CompanyRow[] = companies.map((co) => {
    const thisRun = thisRunByCompany[co.id];
    const prevRun = prevRunByCompany[co.id];
    const thisTot = thisRun ? thisMap[thisRun.id] : null;
    const prevTot = prevRun ? prevMap[prevRun.id] : null;

    let anomaly: 'up' | 'down' | null = null;
    if (thisTot?.total_bruto && prevTot?.total_bruto) {
      const diff = (thisTot.total_bruto - prevTot.total_bruto) / prevTot.total_bruto;
      if (diff > 0.15) anomaly = 'up';
      if (diff < -0.15) anomaly = 'down';
    }

    type RunStatus = NonNullable<CompanyRow['thisMonth']>['status'];
    return {
      id: co.id, name: co.name, kota: co.kota,
      empCount: empCountByCompany[co.id] ?? 0,
      thisMonth: thisRun
        ? { status: thisRun.status as RunStatus, runId: thisRun.id, bruto: thisTot?.total_bruto, pph: thisTot?.total_pph, thp: thisTot?.total_thp }
        : null,
      lastMonth: prevRun
        ? { status: prevRun.status as RunStatus, bruto: prevTot?.total_bruto }
        : null,
      anomaly,
    };
  });

  return <BatchClient rows={rows} bulanIni={bulanIni} tahunIni={tahunIni} prevBulan={prevBulan} />;
}
