import { unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Cache TTL values in seconds
const TTL = {
  companies:  60,   // 1 min — changes rarely during a session
  employees:  60,   // 1 min
  workspace:  300,  // 5 min — almost never changes
  payroll:    30,   // 30s — changes during active work
  dashboard:  20,   // 20s — needs to feel live
};

export const getCachedCompanies = (workspaceId: string) =>
  unstable_cache(
    async () => {
      const supabase = await createClient();
      const { data } = await supabase
        .from('companies')
        .select('id, name, kota, industri, aktif, npwp_perusahaan')
        .eq('workspace_id', workspaceId)
        .order('name');
      return data ?? [];
    },
    [`companies-${workspaceId}`],
    { revalidate: TTL.companies, tags: [`companies-${workspaceId}`] }
  )();

export const getCachedEmployeeCount = (workspaceId: string, companyIds: string[]) =>
  unstable_cache(
    async () => {
      if (companyIds.length === 0) return 0;
      const supabase = await createClient();
      const { count } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .in('company_id', companyIds)
        .eq('aktif', true);
      return count ?? 0;
    },
    [`emp-count-${workspaceId}`],
    { revalidate: TTL.employees, tags: [`employees-${workspaceId}`] }
  )();

export const getCachedPayrollRuns = (companyIds: string[], tahun: number, bulan: number) =>
  unstable_cache(
    async () => {
      if (companyIds.length === 0) return [];
      const supabase = await createClient();
      const { data } = await supabase
        .from('payroll_runs')
        .select('company_id, status, id')
        .in('company_id', companyIds)
        .eq('tahun', tahun)
        .eq('bulan', bulan);
      return data ?? [];
    },
    [`payroll-runs-${companyIds.sort().join('-')}-${tahun}-${bulan}`],
    { revalidate: TTL.payroll, tags: [`payroll-${tahun}-${bulan}`] }
  )();

export const getCachedWorkspace = (userId: string) =>
  unstable_cache(
    async () => {
      const supabase = await createClient();
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('workspace_id, role')
        .eq('id', userId)
        .single();
      if (!profile?.workspace_id) return null;
      const { data: ws } = await supabase
        .from('workspaces')
        .select('id, name, owner_id')
        .eq('id', profile.workspace_id)
        .single();
      return ws ? { ...ws, role: profile.role } : null;
    },
    [`workspace-${userId}`],
    { revalidate: TTL.workspace, tags: [`workspace-${userId}`] }
  )();

// Call these to invalidate cache after mutations
export { revalidateTag } from 'next/cache';
