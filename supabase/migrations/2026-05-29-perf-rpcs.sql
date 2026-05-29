-- 2026-05-29 — Performance RPCs: server-side aggregation
--
-- Three SECURITY DEFINER functions that replace JS-side payroll_results
-- aggregation across the dashboard, batch board, and payroll-month page.
-- All return shapes match the consumers planned in the perf optimization
-- plan (see docs / plan file); no consumer change in this migration —
-- pages start using these in the follow-up PR.
--
-- Membership is enforced inside each function via the existing
-- is_workspace_member / is_company_member / is_run_member helpers, so the
-- functions are safe to GRANT EXECUTE to authenticated.
--
-- Also adds payroll_results(run_id) index — needed by the GROUP BY paths
-- below and previously implicit-scan on every aggregation. Foreign-key
-- columns are not auto-indexed in Postgres.
--
-- Apply: paste into the Supabase SQL editor and click Run. Idempotent.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- Index: speed up every GROUP BY run_id path.
-- ──────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS payroll_results_run_id_idx
  ON public.payroll_results (run_id);

-- ──────────────────────────────────────────────────────────────────────────
-- get_payroll_run_totals(p_run_ids uuid[])
--
-- Returns one row per accessible run_id with summed bruto/pph/thp +
-- employee_count. Replaces the in-JS sum loops in dashboard/page.tsx and
-- batch/page.tsx. Membership filter is applied via a CTE join so RLS is
-- enforced without per-row EXISTS lookups.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_payroll_run_totals(p_run_ids uuid[])
RETURNS TABLE (
  run_id          uuid,
  total_bruto     numeric,
  total_pph       bigint,
  total_thp       bigint,
  employee_count  bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH accessible AS (
    SELECT pr.id
    FROM public.payroll_runs pr
    JOIN public.companies c        ON c.id = pr.company_id
    JOIN public.workspace_members m ON m.workspace_id = c.workspace_id
    WHERE pr.id = ANY(p_run_ids)
      AND m.user_id = auth.uid()
  )
  SELECT
    pres.run_id,
    COALESCE(SUM(pres.bruto), 0)            AS total_bruto,
    COALESCE(SUM(pres.pph),   0)::bigint    AS total_pph,
    COALESCE(SUM(pres.thp),   0)::bigint    AS total_thp,
    COUNT(*)::bigint                        AS employee_count
  FROM public.payroll_results pres
  WHERE pres.run_id IN (SELECT id FROM accessible)
  GROUP BY pres.run_id;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- get_employee_ytd(p_company_id, p_tahun, p_exclude_bulan)
--
-- Per-employee accumulated bruto + pph_jan_nov for the given year, excluding
-- the current bulan. Replaces the two cascaded fetches in the payroll month
-- page (one for prior runs, one for their results, then JS sum). Critical
-- for calculateLastMonth equalization.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_employee_ytd(
  p_company_id     uuid,
  p_tahun          int,
  p_exclude_bulan  int
)
RETURNS TABLE (
  employee_id  uuid,
  akum_bruto   numeric,
  pph_jan_nov  bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pres.employee_id,
    COALESCE(SUM(pres.bruto), 0)         AS akum_bruto,
    COALESCE(SUM(pres.pph),   0)::bigint AS pph_jan_nov
  FROM public.payroll_results pres
  JOIN public.payroll_runs pr ON pr.id = pres.run_id
  WHERE pr.company_id = p_company_id
    AND pr.tahun      = p_tahun
    AND pr.bulan      < p_exclude_bulan
    AND public.is_company_member(p_company_id)
  GROUP BY pres.employee_id;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- get_workspace_dashboard_snapshot(p_workspace_id, p_tahun, p_bulan)
--
-- One round-trip replacement for the dashboard's ~8-query waterfall.
-- Returns a JSON envelope with:
--   - companies           : [{ id, name, kota }]   (staff-filtered)
--   - company_ids         : uuid[]                 (also surfaced for client use)
--   - employee_count      : count of active employees across the companies
--   - this_month_runs     : [{ id, company_id, status }]
--   - recent_runs         : last 8 runs across all visible companies, with totals
--
-- Error envelopes: { error: 'unauthenticated' | 'forbidden' }
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_workspace_dashboard_snapshot(
  p_workspace_id uuid,
  p_tahun        int,
  p_bulan        int
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_role             text;
  v_is_staff         boolean;
  v_companies        jsonb;
  v_company_ids      uuid[];
  v_emp_count        bigint;
  v_this_month_runs  jsonb;
  v_recent_runs      jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT role INTO v_role FROM public.user_profiles WHERE id = v_user_id;
  v_is_staff := (v_role = 'staff');

  -- Resolve visible companies (+ id array for downstream filters)
  IF v_is_staff THEN
    SELECT
      COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'kota', c.kota)
                         ORDER BY c.name), '[]'::jsonb),
      COALESCE(array_agg(c.id ORDER BY c.name), ARRAY[]::uuid[])
      INTO v_companies, v_company_ids
    FROM public.companies c
    JOIN public.company_staff_access csa
      ON csa.company_id = c.id AND csa.staff_user_id = v_user_id
    WHERE c.workspace_id = p_workspace_id
      AND c.aktif = true;
  ELSE
    SELECT
      COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'kota', c.kota)
                         ORDER BY c.name), '[]'::jsonb),
      COALESCE(array_agg(c.id ORDER BY c.name), ARRAY[]::uuid[])
      INTO v_companies, v_company_ids
    FROM public.companies c
    WHERE c.workspace_id = p_workspace_id
      AND c.aktif = true;
  END IF;

  -- Employee count across the visible companies
  SELECT COUNT(*)::bigint INTO v_emp_count
  FROM public.employees e
  WHERE e.company_id = ANY(v_company_ids)
    AND e.aktif = true;

  -- This-month run status per company
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id',         pr.id,
           'company_id', pr.company_id,
           'status',     pr.status
         )), '[]'::jsonb)
    INTO v_this_month_runs
  FROM public.payroll_runs pr
  WHERE pr.company_id = ANY(v_company_ids)
    AND pr.tahun = p_tahun
    AND pr.bulan = p_bulan;

  -- Last 8 recent runs across visible companies, with totals already summed.
  WITH recent AS (
    SELECT pr.id, pr.company_id, pr.tahun, pr.bulan, pr.status, pr.calculated_at
    FROM public.payroll_runs pr
    WHERE pr.company_id = ANY(v_company_ids)
    ORDER BY pr.calculated_at DESC NULLS LAST
    LIMIT 8
  ),
  totals AS (
    SELECT pres.run_id,
           COALESCE(SUM(pres.bruto), 0)         AS total_bruto,
           COALESCE(SUM(pres.pph),   0)::bigint AS total_pph,
           COALESCE(SUM(pres.thp),   0)::bigint AS total_thp,
           COUNT(*)::bigint                     AS employee_count
    FROM public.payroll_results pres
    WHERE pres.run_id IN (SELECT id FROM recent)
    GROUP BY pres.run_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id',             r.id,
           'company_id',     r.company_id,
           'tahun',          r.tahun,
           'bulan',          r.bulan,
           'status',         r.status,
           'calculated_at',  r.calculated_at,
           'total_bruto',    COALESCE(t.total_bruto, 0),
           'total_pph',      COALESCE(t.total_pph,   0),
           'total_thp',      COALESCE(t.total_thp,   0),
           'employee_count', COALESCE(t.employee_count, 0)
         ) ORDER BY r.calculated_at DESC NULLS LAST), '[]'::jsonb)
    INTO v_recent_runs
  FROM recent r
  LEFT JOIN totals t ON t.run_id = r.id;

  RETURN jsonb_build_object(
    'companies',       v_companies,
    'company_ids',     to_jsonb(v_company_ids),
    'employee_count',  v_emp_count,
    'this_month_runs', v_this_month_runs,
    'recent_runs',     v_recent_runs
  );
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Permissions: callable by any authenticated user; functions enforce
-- membership internally (no anon access).
-- ──────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.get_payroll_run_totals(uuid[])              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_employee_ytd(uuid, int, int)            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_workspace_dashboard_snapshot(uuid, int, int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_payroll_run_totals(uuid[])               TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_ytd(uuid, int, int)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_dashboard_snapshot(uuid, int, int) TO authenticated;

COMMIT;

-- ──────────────────────────────────────────────────────────────────────────
-- Verification (run after applying):
--
--   -- Smoke test as the dev user (replace UUIDs with real ones):
--   SELECT * FROM get_payroll_run_totals(ARRAY['<run_id>']::uuid[]);
--   SELECT * FROM get_employee_ytd('<company_id>'::uuid, 2026, 5);
--   SELECT get_workspace_dashboard_snapshot('<workspace_id>'::uuid, 2026, 5);
--
--   -- Confirm index was created:
--   SELECT indexname FROM pg_indexes
--   WHERE tablename = 'payroll_results' AND indexname = 'payroll_results_run_id_idx';
-- ──────────────────────────────────────────────────────────────────────────

-- ──────────────────────────────────────────────────────────────────────────
-- Rollback (separate session if needed):
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.get_workspace_dashboard_snapshot(uuid, int, int);
-- DROP FUNCTION IF EXISTS public.get_employee_ytd(uuid, int, int);
-- DROP FUNCTION IF EXISTS public.get_payroll_run_totals(uuid[]);
-- DROP INDEX  IF EXISTS public.payroll_results_run_id_idx;
-- COMMIT;
-- ──────────────────────────────────────────────────────────────────────────
