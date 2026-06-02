-- 2026-06-02-workspace-limits.sql
-- Hard tenant-capacity caps, enforced at the database so NO code path
-- (server action, create_workspace_for_user RPC, onboarding, magic-link
-- invite, or a direct insert) can bypass them.
--
--   * Max 10 non-owner members (staff) per workspace.
--   * Max 2 workspace memberships per user (the `dev` role is exempt).
--
-- These numbers mirror lib/limits.ts — keep both in sync if they change.
-- Existing data does not violate these caps (verified 2026-06-02: every
-- workspace has a single owner member), so adding the triggers is safe.

begin;

-- 1) Max staff (non-owner members) per workspace ---------------------------
create or replace function public.enforce_staff_per_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- The workspace owner never counts against the staff cap.
  if new.role = 'owner' then
    return new;
  end if;

  select count(*) into v_count
  from workspace_members
  where workspace_id = new.workspace_id
    and role <> 'owner';

  if v_count >= 10 then
    raise exception 'Workspace sudah mencapai batas 10 staff.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_staff_per_workspace on public.workspace_members;
create trigger trg_staff_per_workspace
  before insert on public.workspace_members
  for each row execute function public.enforce_staff_per_workspace();

-- 2) Max workspaces per user (dev exempt) ----------------------------------
create or replace function public.enforce_workspaces_per_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_role  text;
begin
  select role into v_role from user_profiles where id = new.user_id;
  if v_role = 'dev' then
    return new;
  end if;

  select count(*) into v_count
  from workspace_members
  where user_id = new.user_id;

  if v_count >= 2 then
    raise exception 'User sudah tergabung di 2 workspace (batas maksimal).'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_workspaces_per_user on public.workspace_members;
create trigger trg_workspaces_per_user
  before insert on public.workspace_members
  for each row execute function public.enforce_workspaces_per_user();

commit;

-- ───────────────────────────────────────────────────────────────────────
-- ROLLBACK (paste & run to undo this migration):
-- begin;
-- drop trigger if exists trg_staff_per_workspace on public.workspace_members;
-- drop trigger if exists trg_workspaces_per_user on public.workspace_members;
-- drop function if exists public.enforce_staff_per_workspace();
-- drop function if exists public.enforce_workspaces_per_user();
-- commit;
