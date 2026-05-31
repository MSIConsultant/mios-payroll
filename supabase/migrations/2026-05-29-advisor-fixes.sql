-- ─────────────────────────────────────────────────────────────────────────
-- Supabase advisor fixes (security + performance)
-- Generated 2026-05-29 for MIOS Payroll
--
-- WHAT THIS DOES
--   1. Pin search_path on 5 functions flagged by lint 0011.
--   2. Revoke EXECUTE from anon + authenticated on trigger / RLS-helper
--      SECURITY DEFINER functions that shouldn't be REST-callable (lints 0028/0029).
--   3. Tighten `WITH CHECK (true)` INSERT policies on import_records
--      and notifications (lint 0024). Service-role writes still bypass RLS.
--   4. Wrap auth.uid() in (select auth.uid()) across 12 RLS policies to
--      stop per-row re-evaluation (lint 0003 / auth_rls_initplan).
--   5. Add covering indexes for 27 foreign keys (lint 0001).
--
-- HOW TO APPLY
--   - Open the Supabase SQL editor for project lkbayvqjymjwhdprhdvd
--   - Paste the whole file and click "Run"
--   - On success: re-run get_advisors(security) and get_advisors(performance) —
--     warn/info counts should drop significantly.
--   - On failure: BEGIN/COMMIT rolls back; nothing partial.
--
-- ROLLBACK
--   See the commented block at the bottom. Most operations are idempotent
--   (CREATE INDEX IF NOT EXISTS, ALTER FUNCTION, ALTER POLICY), but the
--   policy rewrites would need to be re-applied in their original form
--   if reverted.
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Pin search_path on functions (lint 0011) ──────────────────────────
ALTER FUNCTION public.handle_updated_at()       SET search_path = public, pg_temp;
ALTER FUNCTION public.update_modified_column()  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_workspace_member(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_company_member(uuid)   SET search_path = public, pg_temp;
ALTER FUNCTION public.is_run_member(uuid)       SET search_path = public, pg_temp;


-- ── 2. Revoke EXECUTE on functions not meant to be REST-callable ─────────
-- handle_new_user, handle_new_workspace, rls_auto_enable: triggers / event
-- triggers. They're invoked by Postgres internally; nobody should hit them
-- via PostgREST.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()      FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_workspace() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()      FROM anon, authenticated, public;

-- is_workspace_member / is_company_member / is_run_member: RLS helpers
-- used inside USING/WITH CHECK clauses. RLS engine calls them with the
-- session's role regardless of EXECUTE grants, so revoking REST access
-- doesn't break policies.
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid)   FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_run_member(uuid)       FROM anon, authenticated, public;


-- ── 3. Tighten WITH CHECK (true) INSERT policies (lint 0024) ─────────────
-- import_records: gate by workspace membership of the parent session.
-- Server actions writing via service-role key bypass RLS, so the import
-- pipeline keeps working.
DROP POLICY IF EXISTS imp_rec_insert ON public.import_records;
CREATE POLICY imp_rec_insert
  ON public.import_records
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.import_sessions s
      WHERE s.id = import_records.session_id
        AND public.is_workspace_member(s.workspace_id)
    )
  );

-- notifications: workspace_id is on the row directly. Service-role still
-- bypasses RLS for the "dev gets pinged on new signup" path.
DROP POLICY IF EXISTS notif_insert ON public.notifications;
CREATE POLICY notif_insert
  ON public.notifications
  FOR INSERT
  WITH CHECK (public.is_workspace_member(workspace_id));


-- ── 4. Wrap auth.uid() in (select auth.uid()) (lint 0003) ────────────────
ALTER POLICY ws_insert ON public.workspaces
  WITH CHECK ((SELECT auth.uid()) = owner_id);

ALTER POLICY ws_update ON public.workspaces
  USING ((SELECT auth.uid()) = owner_id);

ALTER POLICY ws_delete ON public.workspaces
  USING ((SELECT auth.uid()) = owner_id);

ALTER POLICY wm_insert ON public.workspace_members
  WITH CHECK (
    ((SELECT auth.uid()) = user_id)
    OR EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = workspace_members.workspace_id
        AND workspaces.owner_id = (SELECT auth.uid())
    )
  );

ALTER POLICY wm_delete ON public.workspace_members
  USING (
    ((SELECT auth.uid()) = user_id)
    OR EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = workspace_members.workspace_id
        AND workspaces.owner_id = (SELECT auth.uid())
    )
  );

ALTER POLICY inv_select ON public.workspace_invitations
  USING (
    public.is_workspace_member(workspace_id)
    OR invited_email = (
      SELECT u.email::text FROM auth.users u WHERE u.id = (SELECT auth.uid())
    )
  );

ALTER POLICY inv_update ON public.workspace_invitations
  USING (
    public.is_workspace_member(workspace_id)
    OR invited_email = (
      SELECT u.email::text FROM auth.users u WHERE u.id = (SELECT auth.uid())
    )
  );

ALTER POLICY notif_own ON public.notifications
  USING ((SELECT auth.uid()) = recipient_id);

ALTER POLICY notif_update ON public.notifications
  USING ((SELECT auth.uid()) = recipient_id);

ALTER POLICY profiles_own_read ON public.user_profiles
  USING ((SELECT auth.uid()) = id);

ALTER POLICY profiles_own_insert ON public.user_profiles
  WITH CHECK ((SELECT auth.uid()) = id);

ALTER POLICY profiles_own_update ON public.user_profiles
  USING ((SELECT auth.uid()) = id);


-- ── 5. Covering indexes for foreign keys (lint 0001) ──────────────────────
-- All 27 FKs the performance advisor flagged. IF NOT EXISTS keeps this safe
-- to re-run.
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx              ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_company_id_idx            ON public.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS audit_logs_workspace_id_idx          ON public.audit_logs(workspace_id);

CREATE INDEX IF NOT EXISTS companies_workspace_id_idx           ON public.companies(workspace_id);

CREATE INDEX IF NOT EXISTS company_staff_access_company_id_idx  ON public.company_staff_access(company_id);
CREATE INDEX IF NOT EXISTS company_staff_access_granted_by_idx  ON public.company_staff_access(granted_by);
CREATE INDEX IF NOT EXISTS company_staff_access_workspace_id_idx ON public.company_staff_access(workspace_id);

CREATE INDEX IF NOT EXISTS employee_events_company_id_idx       ON public.employee_events(company_id);

CREATE INDEX IF NOT EXISTS import_records_employee_id_idx       ON public.import_records(employee_id);
CREATE INDEX IF NOT EXISTS import_records_session_id_idx        ON public.import_records(session_id);

CREATE INDEX IF NOT EXISTS import_sessions_company_id_idx       ON public.import_sessions(company_id);
CREATE INDEX IF NOT EXISTS import_sessions_imported_by_idx      ON public.import_sessions(imported_by);
CREATE INDEX IF NOT EXISTS import_sessions_workspace_id_idx     ON public.import_sessions(workspace_id);

CREATE INDEX IF NOT EXISTS notifications_recipient_id_idx       ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS notifications_workspace_id_idx       ON public.notifications(workspace_id);

CREATE INDEX IF NOT EXISTS payroll_results_company_id_idx       ON public.payroll_results(company_id);
CREATE INDEX IF NOT EXISTS payroll_results_employee_id_idx      ON public.payroll_results(employee_id);

CREATE INDEX IF NOT EXISTS payroll_runs_locked_by_idx           ON public.payroll_runs(locked_by);
CREATE INDEX IF NOT EXISTS payroll_runs_run_by_idx              ON public.payroll_runs(run_by);

CREATE INDEX IF NOT EXISTS payroll_share_links_company_id_idx   ON public.payroll_share_links(company_id);
CREATE INDEX IF NOT EXISTS payroll_share_links_run_id_idx       ON public.payroll_share_links(run_id);

CREATE INDEX IF NOT EXISTS user_profiles_approved_by_idx        ON public.user_profiles(approved_by);
CREATE INDEX IF NOT EXISTS user_profiles_workspace_id_idx       ON public.user_profiles(workspace_id);

CREATE INDEX IF NOT EXISTS workspace_activity_user_id_idx       ON public.workspace_activity(user_id);
CREATE INDEX IF NOT EXISTS workspace_activity_workspace_id_idx  ON public.workspace_activity(workspace_id);

CREATE INDEX IF NOT EXISTS workspace_invitations_invited_by_idx ON public.workspace_invitations(invited_by);
CREATE INDEX IF NOT EXISTS workspace_invitations_workspace_id_idx ON public.workspace_invitations(workspace_id);

CREATE INDEX IF NOT EXISTS workspace_members_user_id_idx        ON public.workspace_members(user_id);

CREATE INDEX IF NOT EXISTS workspaces_owner_id_idx              ON public.workspaces(owner_id);

-- kompensasi_payments.created_by (slice-3 FK; missed in the initial advisor pass)
CREATE INDEX IF NOT EXISTS kompensasi_payments_created_by_idx   ON public.kompensasi_payments(created_by);

COMMIT;


-- ─────────────────────────────────────────────────────────────────────────
-- ROLLBACK (commented out — uncomment + run to undo)
-- ─────────────────────────────────────────────────────────────────────────
-- BEGIN;
--   -- Drop new FK indexes
--   DROP INDEX IF EXISTS public.audit_logs_actor_id_idx;
--   DROP INDEX IF EXISTS public.audit_logs_company_id_idx;
--   DROP INDEX IF EXISTS public.audit_logs_workspace_id_idx;
--   DROP INDEX IF EXISTS public.companies_workspace_id_idx;
--   DROP INDEX IF EXISTS public.company_staff_access_company_id_idx;
--   DROP INDEX IF EXISTS public.company_staff_access_granted_by_idx;
--   DROP INDEX IF EXISTS public.company_staff_access_workspace_id_idx;
--   DROP INDEX IF EXISTS public.employee_events_company_id_idx;
--   DROP INDEX IF EXISTS public.import_records_employee_id_idx;
--   DROP INDEX IF EXISTS public.import_records_session_id_idx;
--   DROP INDEX IF EXISTS public.import_sessions_company_id_idx;
--   DROP INDEX IF EXISTS public.import_sessions_imported_by_idx;
--   DROP INDEX IF EXISTS public.import_sessions_workspace_id_idx;
--   DROP INDEX IF EXISTS public.notifications_recipient_id_idx;
--   DROP INDEX IF EXISTS public.notifications_workspace_id_idx;
--   DROP INDEX IF EXISTS public.payroll_results_company_id_idx;
--   DROP INDEX IF EXISTS public.payroll_results_employee_id_idx;
--   DROP INDEX IF EXISTS public.payroll_runs_locked_by_idx;
--   DROP INDEX IF EXISTS public.payroll_runs_run_by_idx;
--   DROP INDEX IF EXISTS public.payroll_share_links_company_id_idx;
--   DROP INDEX IF EXISTS public.payroll_share_links_run_id_idx;
--   DROP INDEX IF EXISTS public.user_profiles_approved_by_idx;
--   DROP INDEX IF EXISTS public.user_profiles_workspace_id_idx;
--   DROP INDEX IF EXISTS public.workspace_activity_user_id_idx;
--   DROP INDEX IF EXISTS public.workspace_activity_workspace_id_idx;
--   DROP INDEX IF EXISTS public.workspace_invitations_invited_by_idx;
--   DROP INDEX IF EXISTS public.workspace_invitations_workspace_id_idx;
--   DROP INDEX IF EXISTS public.workspace_members_user_id_idx;
--   DROP INDEX IF EXISTS public.workspaces_owner_id_idx;
--   -- Restore prior INSERT policies
--   DROP POLICY IF EXISTS imp_rec_insert ON public.import_records;
--   CREATE POLICY imp_rec_insert ON public.import_records FOR INSERT WITH CHECK (true);
--   DROP POLICY IF EXISTS notif_insert  ON public.notifications;
--   CREATE POLICY notif_insert  ON public.notifications  FOR INSERT WITH CHECK (true);
--   -- Restore EXECUTE grants
--   GRANT EXECUTE ON FUNCTION public.handle_new_user()      TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.handle_new_workspace() TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.rls_auto_enable()      TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.is_company_member(uuid)   TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.is_run_member(uuid)       TO anon, authenticated;
--   -- Reset search_path
--   ALTER FUNCTION public.handle_updated_at()       RESET search_path;
--   ALTER FUNCTION public.update_modified_column()  RESET search_path;
--   ALTER FUNCTION public.is_workspace_member(uuid) RESET search_path;
--   ALTER FUNCTION public.is_company_member(uuid)   RESET search_path;
--   ALTER FUNCTION public.is_run_member(uuid)       RESET search_path;
--   -- RLS policy auth.uid() rewrites would need original definitions re-applied
--   --   (see git history before this migration for the originals).
-- COMMIT;
