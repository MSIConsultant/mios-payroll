-- 2026-06-03-rpc-scoping-fixes.sql
-- Two SECURITY DEFINER RPCs bypassed RLS without re-checking authorization.
-- (Audit follow-up to 2026-06-03-staff-company-scoping.sql.)
--
--   1. get_all_profiles() — EXECUTE was granted to anon AND authenticated, and
--      the body was `select * from user_profiles` with NO caller check. Any
--      authenticated user (any tenant) — and even an unauthenticated client
--      holding the public anon key — could dump every user's email/role/
--      workspace across ALL tenants. It is only meant for the dev admin panel.
--
--   2. get_payroll_run_totals(uuid[]) — scoped results by workspace membership
--      only, never company_staff_access, so a staff user could read payroll
--      totals (bruto/pph/thp/headcount) for companies they were not assigned.
--
-- Fixes: gate get_all_profiles to dev callers (+ revoke anon); re-scope
-- get_payroll_run_totals through the now role-aware is_company_member().
-- Requires 2026-06-03-staff-company-scoping.sql to be applied first.

begin;

-- 1) Dev-only guard on get_all_profiles ------------------------------------
create or replace function public.get_all_profiles()
returns setof user_profiles
language sql
stable
security definer
set search_path to 'public'
as $function$
  select *
  from user_profiles
  where exists (
    select 1 from user_profiles me
    where me.id = auth.uid() and me.role = 'dev'
  )
  order by created_at desc;
$function$;

-- anon should never have been able to call this; remove the grant.
revoke execute on function public.get_all_profiles() from anon;

-- 2) Company-scope get_payroll_run_totals ----------------------------------
create or replace function public.get_payroll_run_totals(p_run_ids uuid[])
returns table(run_id uuid, total_bruto numeric, total_pph bigint, total_thp bigint, employee_count bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with accessible as (
    select pr.id
    from public.payroll_runs pr
    where pr.id = any(p_run_ids)
      and public.is_company_member(pr.company_id)   -- role-aware: staff → granted companies only
  )
  select
    pres.run_id,
    coalesce(sum(pres.bruto), 0)         as total_bruto,
    coalesce(sum(pres.pph),   0)::bigint as total_pph,
    coalesce(sum(pres.thp),   0)::bigint as total_thp,
    count(*)::bigint                     as employee_count
  from public.payroll_results pres
  where pres.run_id in (select id from accessible)
  group by pres.run_id;
$function$;

commit;

-- ───────────────────────────────────────────────────────────────────────
-- ROLLBACK (paste & run to undo):
-- begin;
-- create or replace function public.get_all_profiles()
-- returns setof user_profiles language sql security definer set search_path to 'public'
-- as $f$ select * from user_profiles order by created_at desc; $f$;
-- grant execute on function public.get_all_profiles() to anon;  -- (restores prior, insecure, state)
-- create or replace function public.get_payroll_run_totals(p_run_ids uuid[])
-- returns table(run_id uuid, total_bruto numeric, total_pph bigint, total_thp bigint, employee_count bigint)
-- language sql stable security definer set search_path to 'public'
-- as $f$
--   with accessible as (
--     select pr.id from public.payroll_runs pr
--     join public.companies c on c.id = pr.company_id
--     join public.workspace_members m on m.workspace_id = c.workspace_id
--     where pr.id = any(p_run_ids) and m.user_id = auth.uid()
--   )
--   select pres.run_id, coalesce(sum(pres.bruto),0), coalesce(sum(pres.pph),0)::bigint,
--          coalesce(sum(pres.thp),0)::bigint, count(*)::bigint
--   from public.payroll_results pres where pres.run_id in (select id from accessible)
--   group by pres.run_id;
-- $f$;
-- commit;
