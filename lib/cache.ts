/**
 * Cache layer for server-side reads.
 *
 * Two distinct concerns:
 *
 *   1. **Per-request dedupe** via React.cache(). When the dashboard layout and
 *      the dashboard page both need the current user / workspace / role within
 *      the same render, they should share one round-trip. React.cache memoizes
 *      across a single request.
 *
 *   2. **Typed RPC helpers** around the SECURITY DEFINER aggregator functions
 *      added in supabase/migrations/2026-05-29-perf-rpcs.sql. Pages call these
 *      instead of building SQL inline, so the response shapes stay consistent.
 *
 * History: the previous version of this file wrapped Supabase queries with
 * unstable_cache and called createClient() inside the cached callback. That
 * pattern is incompatible with Next.js 15 because createClient() reads
 * cookies(), and cookies() is not allowed inside unstable_cache. The dashboard
 * page hit this in production. Cross-request caching of user-scoped reads is
 * deferred; the high-impact wins (per-request dedupe + collapsing the
 * dashboard waterfall into one RPC) live here instead.
 */

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/* -------------------------------------------------------------------------- */
/* Per-request memoized helpers                                               */
/* -------------------------------------------------------------------------- */

/**
 * Cached Supabase server client + authenticated user for the current request.
 *
 * Use this in server components and server actions that would otherwise call
 * `createClient()` followed by `supabase.auth.getUser()`. Repeated calls within
 * the same request resolve to the same Supabase client and the same user
 * object — no duplicate auth round-trips.
 *
 * Returns `{ supabase, user: null }` if the request is unauthenticated; the
 * caller decides how to handle that (redirect, return error envelope, etc.).
 */
export const cachedAuth = cache(async (): Promise<{
  supabase: Supabase;
  user: User | null;
}> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
});

/**
 * Cached user profile (role, status, workspace_id) for the current request.
 *
 * Memoized per (userId) so multiple call sites in one render share one query.
 */
export const cachedUserProfile = cache(async (userId: string) => {
  const { supabase } = await cachedAuth();
  const { data } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, role, status, workspace_id')
    .eq('id', userId)
    .maybeSingle();
  return data ?? null;
});

/**
 * Cached workspace membership (workspace_id + workspace.name + role) for the
 * current user. Memoized per request.
 *
 * Returns null if the user has no workspace yet (e.g. mid-onboarding).
 */
export const cachedWorkspaceForUser = cache(async (userId: string) => {
  const { supabase } = await cachedAuth();
  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (!data?.workspace_id) return null;
  const ws = Array.isArray(data.workspaces) ? data.workspaces[0] : data.workspaces;
  return {
    workspace_id: data.workspace_id as string,
    name: (ws as { name?: string } | null)?.name ?? '—',
    role: data.role as string,
  };
});

/* -------------------------------------------------------------------------- */
/* Typed wrappers around the perf RPCs                                        */
/* -------------------------------------------------------------------------- */

export type PayrollRunTotal = {
  run_id: string;
  total_bruto: number;
  total_pph: number;
  total_thp: number;
  employee_count: number;
};

/**
 * Per-run totals (bruto, pph, thp, employee count) for a list of run ids.
 *
 * Membership is enforced inside the RPC; rows the caller can't see are
 * silently filtered out. Returns an empty array if `runIds` is empty.
 */
export const getPayrollRunTotals = cache(async (
  supabase: Supabase,
  runIds: string[],
): Promise<PayrollRunTotal[]> => {
  if (runIds.length === 0) return [];
  const { data, error } = await supabase
    .rpc('get_payroll_run_totals', { p_run_ids: runIds });
  if (error) {
    console.error('[cache] get_payroll_run_totals failed', error);
    return [];
  }
  return (data ?? []) as PayrollRunTotal[];
});

export type EmployeeYTDRow = {
  employee_id: string;
  akum_bruto: number;
  pph_jan_nov: number;
};

/**
 * Per-employee YTD totals (akum_bruto, pph_jan_nov) for a company, summed
 * across all prior months in the given tahun (bulan < excludeBulan).
 *
 * Used by calculateLastMonth equalization. Returns an empty array if no
 * prior runs exist — the caller's fallback (`akum_bruto === 0`) still
 * applies.
 */
export const getEmployeeYTD = cache(async (
  supabase: Supabase,
  companyId: string,
  tahun: number,
  excludeBulan: number,
): Promise<EmployeeYTDRow[]> => {
  const { data, error } = await supabase.rpc('get_employee_ytd', {
    p_company_id: companyId,
    p_tahun: tahun,
    p_exclude_bulan: excludeBulan,
  });
  if (error) {
    console.error('[cache] get_employee_ytd failed', error);
    return [];
  }
  return (data ?? []) as EmployeeYTDRow[];
});

export type DashboardCompany = { id: string; name: string; kota: string | null };
export type DashboardThisMonthRun = { id: string; company_id: string; status: string };
export type DashboardRecentRun = {
  id: string;
  company_id: string;
  tahun: number;
  bulan: number;
  status: string;
  calculated_at: string | null;
  total_bruto: number;
  total_pph: number;
  total_thp: number;
  employee_count: number;
};

export type DashboardSnapshot = {
  companies: DashboardCompany[];
  company_ids: string[];
  employee_count: number;
  this_month_runs: DashboardThisMonthRun[];
  recent_runs: DashboardRecentRun[];
};

export type DashboardSnapshotResult =
  | { ok: true; snapshot: DashboardSnapshot }
  | { ok: false; error: 'unauthenticated' | 'forbidden' | 'rpc_failed' };

/**
 * One-round-trip dashboard snapshot. Replaces the 8-query waterfall.
 *
 * Memoized per (workspaceId, tahun, bulan) within a single request so the
 * layout + page can both consume it without a double fetch.
 */
export const getDashboardSnapshot = cache(async (
  supabase: Supabase,
  workspaceId: string,
  tahun: number,
  bulan: number,
): Promise<DashboardSnapshotResult> => {
  const { data, error } = await supabase.rpc('get_workspace_dashboard_snapshot', {
    p_workspace_id: workspaceId,
    p_tahun: tahun,
    p_bulan: bulan,
  });
  if (error) {
    console.error('[cache] get_workspace_dashboard_snapshot failed', error);
    return { ok: false, error: 'rpc_failed' };
  }
  if (data && typeof data === 'object' && 'error' in data) {
    const errKind = (data as { error: string }).error;
    if (errKind === 'unauthenticated' || errKind === 'forbidden') {
      return { ok: false, error: errKind };
    }
    return { ok: false, error: 'rpc_failed' };
  }
  return { ok: true, snapshot: data as DashboardSnapshot };
});

/* -------------------------------------------------------------------------- */
/* Re-exports for server actions                                              */
/* -------------------------------------------------------------------------- */

// Tag-based invalidation still works for any future unstable_cache adoption.
export { revalidateTag } from 'next/cache';
