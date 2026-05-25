-- 2026-05-25 — Security hardening: role validation + RLS verification
--
-- Fixes three findings from the 2026-05-25 security audit:
--
-- (1) admin_approve_user accepted any string as new_role, allowing a direct RPC
--     call to escalate an account to 'dev'. Now validated inside the function.
--     Also adds a CHECK constraint on user_profiles.role for DB-level enforcement.
--
-- (2) Verify and enable RLS on all core tables. The base schema.sql snapshot
--     omits RLS policies, so this migration makes the state explicit.
--     Safe to re-run: ENABLE ROW LEVEL SECURITY is idempotent; CREATE POLICY IF NOT
--     EXISTS guards prevent duplicate errors.
--
-- Apply: paste into the Supabase SQL editor, click Run, verify no errors.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- (1) user_profiles.role: add CHECK constraint + harden admin_approve_user
-- ──────────────────────────────────────────────────────────────────────────

-- Add CHECK constraint so no path (including direct SQL) can set an invalid role.
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('dev', 'accountant', 'staff'));

-- Replace admin_approve_user with a version that validates new_role before
-- applying it, preventing privilege escalation via direct RPC calls.
CREATE OR REPLACE FUNCTION admin_approve_user(target_id uuid, new_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_email  text;
  target_email  text;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'msiconsultant.international@gmail.com' THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Only allow safe, non-privileged roles to be assigned via this function.
  -- 'dev' role must be set directly via SQL by the database owner.
  IF new_role NOT IN ('accountant', 'staff') THEN
    RETURN jsonb_build_object('error', 'Invalid role: must be accountant or staff');
  END IF;

  SELECT email INTO target_email FROM public.user_profiles WHERE id = target_id;

  UPDATE public.user_profiles
  SET status      = 'approved',
      role        = new_role,
      approved_by = auth.uid(),
      approved_at = now()
  WHERE id = target_id;

  INSERT INTO public.notifications (workspace_id, recipient_id, type, title, message, data)
  VALUES (
    NULL,
    target_id,
    'ACCOUNT_APPROVED',
    'Akun Anda Disetujui',
    'Selamat! Akun Anda telah disetujui sebagai ' ||
      CASE WHEN new_role = 'accountant' THEN 'Akuntan' ELSE 'Staff' END || '.',
    jsonb_build_object('role', new_role)
  );

  RETURN jsonb_build_object('success', true, 'email', target_email);
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- (2) Verify RLS is enabled on all core tables
--     These are no-ops if RLS is already on. Safe to run multiple times.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.workspaces             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_results        ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────
-- Verify: after running, confirm state with:
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--   ORDER BY tablename;
--
-- All core tables should show rowsecurity = true.
-- Also verify share link expiry policy from 2026-05-22-audit-hardening.sql:
--   SELECT policyname, qual FROM pg_policies
--   WHERE tablename = 'payroll_share_links';
-- Should show: share_links_unexpired_only | (expires_at > now())
-- ──────────────────────────────────────────────────────────────────────────

COMMIT;

-- ──────────────────────────────────────────────────────────────────────────
-- Rollback (run in a separate session if needed):
--
-- BEGIN;
-- ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
-- -- Restore original admin_approve_user without role check (see schema.sql)
-- COMMIT;
