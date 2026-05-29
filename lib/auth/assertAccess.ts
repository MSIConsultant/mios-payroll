// Server-action access guards. Defense-in-depth on top of Supabase RLS:
// returns a clear `{ ok: false, error }` to the caller instead of relying on
// RLS to silently zero-row a mutation. Every mutating server action should
// gate on the appropriate helper before touching the DB.
//
// Usage in actions:
//   const access = await assertCompanyAccess(companyId);
//   if (!access.ok) return { error: access.error };
//   const { supabase, user, workspaceId } = access;

import { createClient } from '@/lib/supabase/server';
import { cachedAuth } from '@/lib/cache';

type Supabase = Awaited<ReturnType<typeof createClient>>;
type User = NonNullable<Awaited<ReturnType<Supabase['auth']['getUser']>>['data']['user']>;

export type AccessOk<T> = { ok: true } & T;
export type AccessFail = { ok: false; error: 'unauthenticated' | 'forbidden' | 'not_found' };

export async function assertAuth(): Promise<
  AccessOk<{ supabase: Supabase; user: User }> | AccessFail
> {
  const { supabase, user } = await cachedAuth();
  if (!user) return { ok: false, error: 'unauthenticated' };
  return { ok: true, supabase, user };
}

export async function assertWorkspaceAccess(workspaceId: string): Promise<
  AccessOk<{ supabase: Supabase; user: User; role: string }> | AccessFail
> {
  const auth = await assertAuth();
  if (!auth.ok) return auth;

  const { data: member } = await auth.supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (!member) return { ok: false, error: 'forbidden' };
  return { ok: true, supabase: auth.supabase, user: auth.user, role: member.role as string };
}

export async function assertCompanyAccess(companyId: string): Promise<
  | AccessOk<{ supabase: Supabase; user: User; workspaceId: string; role: string }>
  | AccessFail
> {
  const auth = await assertAuth();
  if (!auth.ok) return auth;

  const { data: company } = await auth.supabase
    .from('companies')
    .select('workspace_id')
    .eq('id', companyId)
    .maybeSingle();

  if (!company) return { ok: false, error: 'not_found' };

  const { data: member } = await auth.supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', company.workspace_id)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (!member) return { ok: false, error: 'forbidden' };
  return {
    ok: true,
    supabase: auth.supabase,
    user: auth.user,
    workspaceId: company.workspace_id as string,
    role: member.role as string,
  };
}

export async function assertRunAccess(runId: string): Promise<
  | AccessOk<{
      supabase: Supabase;
      user: User;
      workspaceId: string;
      companyId: string;
      role: string;
    }>
  | AccessFail
> {
  const auth = await assertAuth();
  if (!auth.ok) return auth;

  const { data: run } = await auth.supabase
    .from('payroll_runs')
    .select('company_id, companies!inner(workspace_id)')
    .eq('id', runId)
    .maybeSingle();

  if (!run) return { ok: false, error: 'not_found' };

  const companies = run.companies as { workspace_id: string } | { workspace_id: string }[] | null;
  const workspaceId = Array.isArray(companies) ? companies[0]?.workspace_id : companies?.workspace_id;
  if (!workspaceId) return { ok: false, error: 'not_found' };

  const { data: member } = await auth.supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (!member) return { ok: false, error: 'forbidden' };
  return {
    ok: true,
    supabase: auth.supabase,
    user: auth.user,
    workspaceId,
    companyId: run.company_id as string,
    role: member.role as string,
  };
}
