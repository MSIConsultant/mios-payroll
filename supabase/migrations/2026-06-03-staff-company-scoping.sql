-- 2026-06-03-staff-company-scoping.sql
-- Close the staff-scoping RLS gap: staff users could read EVERY company,
-- employee, and payroll record in their workspace (via direct URL), because
-- is_company_member() / is_run_member() checked workspace membership only and
-- never consulted company_staff_access.
--
-- After this migration:
--   * staff (user_profiles.role = 'staff') can access ONLY companies granted
--     to them in company_staff_access;
--   * owner / accountant / dev keep full workspace-wide access (unchanged).
--
-- Because employees, employee_events, payroll_runs and payroll_results already
-- gate on is_company_member(company_id), fixing that one function scopes them
-- all. The `companies` table used is_workspace_member directly, so its
-- select/update/delete policies are re-pointed to is_company_member(id).
--
-- ⚠ Behaviour note: prod currently has 1 staff profile with 0 access grants —
-- after this runs, that account sees no companies until granted some. That is
-- the intended secure default.

begin;

-- 1) Role-aware company membership ----------------------------------------
create or replace function public.is_company_member(co_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from companies c
    join workspace_members wm on wm.workspace_id = c.workspace_id
    left join user_profiles up on up.id = wm.user_id
    where c.id = co_id
      and wm.user_id = auth.uid()
      and (
        -- owner / accountant / dev (anything but staff) → all workspace companies
        coalesce(up.role, '') <> 'staff'
        -- staff → only explicitly granted companies
        or exists (
          select 1 from company_staff_access csa
          where csa.staff_user_id = auth.uid()
            and csa.company_id = c.id
        )
      )
  );
$function$;

-- 2) Run membership now delegates to the role-aware check ------------------
create or replace function public.is_run_member(r_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from payroll_runs pr
    where pr.id = r_id and public.is_company_member(pr.company_id)
  );
$function$;

-- 3) Re-point companies read/update/delete to the company-scoped check -----
--    (INSERT stays workspace-scoped: the new company has no access grant yet,
--     and createCompany already blocks staff at the app layer.)
drop policy if exists co_select on public.companies;
create policy co_select on public.companies
  for select using (public.is_company_member(id));

drop policy if exists co_update on public.companies;
create policy co_update on public.companies
  for update using (public.is_company_member(id));

drop policy if exists co_delete on public.companies;
create policy co_delete on public.companies
  for delete using (public.is_company_member(id));

commit;

-- ───────────────────────────────────────────────────────────────────────
-- ROLLBACK (paste & run to undo):
-- begin;
-- create or replace function public.is_company_member(co_id uuid)
-- returns boolean language sql stable security definer
-- set search_path to 'public','pg_temp' as $f$
--   select exists (select 1 from companies c
--     join workspace_members wm on wm.workspace_id = c.workspace_id
--     where c.id = co_id and wm.user_id = auth.uid());
-- $f$;
-- create or replace function public.is_run_member(r_id uuid)
-- returns boolean language sql stable security definer
-- set search_path to 'public','pg_temp' as $f$
--   select exists (select 1 from payroll_runs pr
--     join companies c on c.id = pr.company_id
--     join workspace_members wm on wm.workspace_id = c.workspace_id
--     where pr.id = r_id and wm.user_id = auth.uid());
-- $f$;
-- drop policy if exists co_select on public.companies;
-- create policy co_select on public.companies for select using (is_workspace_member(workspace_id));
-- drop policy if exists co_update on public.companies;
-- create policy co_update on public.companies for update using (is_workspace_member(workspace_id));
-- drop policy if exists co_delete on public.companies;
-- create policy co_delete on public.companies for delete using (is_workspace_member(workspace_id));
-- commit;
