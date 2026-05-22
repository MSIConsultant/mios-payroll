-- 2026-05-22 — handle_new_user resilience + historical backfill
--
-- Diagnosis behind this migration:
--   The on_auth_user_created trigger that inserts into user_profiles was
--   added around 2026-05-15. Anyone who signed up via Supabase Auth BEFORE
--   that date has no corresponding user_profiles row. That orphan state
--   is invisible from /dev/admin (which reads user_profiles), so an
--   affected user can never be approved and stays locked at /pending-approval.
--
--   Concretely, nanangkuncoro09@gmail.com signed up 2026-05-07 — pre-trigger
--   — and has been stuck for two weeks.
--
-- This migration does three things:
--   (1) Hardens the trigger so future schema drift doesn't silently break
--       new signups. ON CONFLICT (id) DO NOTHING makes the insert idempotent;
--       the EXCEPTION block makes profile-insert failures non-fatal to the
--       underlying auth signup.
--   (2) Backfills any auth.users without a profile row. Catches Nanang and
--       any other historical orphan.
--   (3) Re-runnable: every block is idempotent.
--
-- Apply: paste into the Supabase SQL editor, click Run, verify with the
--        SELECT statements at the bottom.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- (1) Harden the trigger function
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role   text := 'staff';
  v_status text := 'pending_approval';
begin
  if new.email = 'msiconsultant.international@gmail.com' then
    v_role   := 'dev';
    v_status := 'approved';
  end if;

  insert into user_profiles (id, email, role, status, approved_at)
  values (
    new.id,
    new.email,
    v_role,
    v_status,
    case when v_status = 'approved' then now() else null end
  )
  on conflict (id) do nothing;

  return new;
exception
  when others then
    -- Never let a profile insert block the underlying auth signup. The
    -- orphan is recoverable via the backfill block below or by re-running
    -- this migration.
    raise warning '[handle_new_user] profile insert failed for %: %', new.email, sqlerrm;
    return new;
end;
$function$;

-- ──────────────────────────────────────────────────────────────────────────
-- (2) Historical backfill
-- ──────────────────────────────────────────────────────────────────────────

INSERT INTO user_profiles (id, email, role, status, approved_at)
SELECT
  u.id,
  u.email,
  CASE WHEN u.email = 'msiconsultant.international@gmail.com' THEN 'dev'      ELSE 'staff'            END,
  CASE WHEN u.email = 'msiconsultant.international@gmail.com' THEN 'approved' ELSE 'pending_approval' END,
  CASE WHEN u.email = 'msiconsultant.international@gmail.com' THEN now()      ELSE NULL               END
FROM auth.users u
LEFT JOIN user_profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ──────────────────────────────────────────────────────────────────────────
-- Post-apply verification — paste these into the SQL editor separately.
--
-- Expect 0 rows (every auth user now has a profile):
--   SELECT u.id, u.email
--   FROM auth.users u
--   LEFT JOIN user_profiles p ON p.id = u.id
--   WHERE p.id IS NULL;
--
-- Expect 1 row for Nanang with status='pending_approval':
--   SELECT id, email, role, status FROM user_profiles
--   WHERE email = 'nanangkuncoro09@gmail.com';
--
-- ──────────────────────────────────────────────────────────────────────────
-- Rollback (run in a separate session if needed):
--
-- The function-hardening is non-destructive; rolling back means restoring
-- the prior (less safe) function body. Backfilled profiles can be removed
-- by id if needed but doing so will block the affected user from /dev/admin
-- again — usually you want to keep them.
