-- 2026-05-29 — Tighten EXECUTE on the perf aggregator RPCs.
--
-- The original migration (2026-05-29-perf-rpcs.sql) did REVOKE FROM PUBLIC +
-- GRANT TO authenticated, but Supabase ships ALTER DEFAULT PRIVILEGES that
-- auto-grant EXECUTE to anon/authenticated/postgres/service_role on every
-- new function. The end state was looser than intended.
--
-- No data is leakable today — each function gates via auth.uid() / the
-- is_workspace_member / is_company_member helpers, and anon's NULL uid
-- silently yields zero rows. But hygiene: anon has no reason to call these.
--
-- Apply: paste into Supabase SQL editor and Run. Idempotent.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_payroll_run_totals(uuid[])                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_employee_ytd(uuid, int, int)                 FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workspace_dashboard_snapshot(uuid, int, int) FROM anon;

COMMIT;

-- ──────────────────────────────────────────────────────────────────────────
-- Verify after applying:
--
--   SELECT p.proname,
--          array_agg(DISTINCT acl.grantee::regrole::text)
--            FILTER (WHERE acl.privilege_type = 'EXECUTE') AS execute_grantees
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   LEFT JOIN LATERAL aclexplode(p.proacl) acl ON TRUE
--   WHERE n.nspname = 'public'
--     AND p.proname IN ('get_payroll_run_totals', 'get_employee_ytd',
--                       'get_workspace_dashboard_snapshot')
--   GROUP BY p.proname;
--
-- Expected: anon is no longer in the array; authenticated / postgres /
-- service_role remain.
-- ──────────────────────────────────────────────────────────────────────────

-- ──────────────────────────────────────────────────────────────────────────
-- Rollback (separate session):
--
-- BEGIN;
-- GRANT EXECUTE ON FUNCTION public.get_payroll_run_totals(uuid[])                   TO anon;
-- GRANT EXECUTE ON FUNCTION public.get_employee_ytd(uuid, int, int)                 TO anon;
-- GRANT EXECUTE ON FUNCTION public.get_workspace_dashboard_snapshot(uuid, int, int) TO anon;
-- COMMIT;
-- ──────────────────────────────────────────────────────────────────────────
