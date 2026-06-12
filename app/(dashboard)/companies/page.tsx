import { redirect } from 'next/navigation';
import { cachedAuth, cachedUserProfile } from '@/lib/cache';
import CompaniesClient, { type CompanyWithMeta } from './CompaniesClient';
import type { Company } from '@/lib/types';

// Server component: one parallel fetch pass per request (deduped via
// lib/cache React.cache helpers) instead of the previous client-side
// getUser → profile → companies → runs/employees waterfall.
export default async function CompaniesPage() {
  const { supabase, user } = await cachedAuth();
  if (!user) redirect('/login');

  const profile = await cachedUserProfile(user.id);
  const workspaceId = profile?.workspace_id;
  if (!workspaceId) redirect('/dashboard');

  const now = new Date();
  const bulanIni = now.getMonth() + 1;
  const tahunIni = now.getFullYear();

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
      return <CompaniesClient companies={[]} bulanIni={bulanIni} tahunIni={tahunIni} />;
    }
  }

  const coBase = supabase
    .from('companies')
    .select('id, name, kota, industri')
    .eq('workspace_id', workspaceId)
    .eq('aktif', true)
    .order('name');
  const { data: companiesData } = await (isStaff ? coBase.in('id', allowedIds!) : coBase);
  const companies = (companiesData ?? []) as Company[];
  const companyIds = companies.map((c) => c.id);

  let runMap: Record<string, CompanyWithMeta['_runStatus']> = {};
  let empMap: Record<string, number> = {};
  if (companyIds.length > 0) {
    const [{ data: runs }, { data: emps }] = await Promise.all([
      supabase
        .from('payroll_runs')
        .select('company_id, status')
        .in('company_id', companyIds)
        .eq('tahun', tahunIni)
        .eq('bulan', bulanIni),
      supabase
        .from('employees')
        .select('company_id')
        .in('company_id', companyIds)
        .eq('aktif', true),
    ]);
    runMap = Object.fromEntries((runs ?? []).map((r) => [r.company_id, r.status]));
    for (const e of emps ?? []) empMap[e.company_id] = (empMap[e.company_id] ?? 0) + 1;
  }

  const enriched: CompanyWithMeta[] = companies.map((co) => ({
    ...co,
    _empCount: empMap[co.id] ?? 0,
    _runStatus: runMap[co.id] ?? 'none',
    _runBulan: bulanIni,
    _runTahun: tahunIni,
  }));

  return <CompaniesClient companies={enriched} bulanIni={bulanIni} tahunIni={tahunIni} />;
}
