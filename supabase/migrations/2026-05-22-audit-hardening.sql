-- 2026-05-22 — Audit-hardening schema additions
--
-- Companion to the `feat/audit-hardening` PR. Two independent groups:
--
-- (1) New columns on payroll_results for refund / estimate tracking.
--     The engine already returns raw_pph, is_refund, refund_amount (December
--     over-withholding case) and proyeksi.is_estimate (last-month fallback
--     when no prior data exists). Promoting them from result_json JSONB into
--     real columns makes them queryable for dashboards ("refund liabilities
--     this period") and warning lists ("which runs used the base × M estimate").
--
-- (2) Tighten public share-link RLS so the page-component expiry check is no
--     longer the only barrier. Previously `for select using (true)` exposed
--     every row to anyone with a token; now expired rows are filtered at the
--     DB layer.
--
-- Apply: paste into the Supabase SQL editor, click Run, verify no errors.
-- This file is idempotent — running it twice is a no-op (IF NOT EXISTS guards).

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- (1) payroll_results: refund + estimate columns
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE payroll_results
  ADD COLUMN IF NOT EXISTS raw_pph numeric DEFAULT 0;

ALTER TABLE payroll_results
  ADD COLUMN IF NOT EXISTS is_refund boolean DEFAULT false;

ALTER TABLE payroll_results
  ADD COLUMN IF NOT EXISTS refund_amount numeric DEFAULT 0;

ALTER TABLE payroll_results
  ADD COLUMN IF NOT EXISTS is_estimate boolean DEFAULT false;

-- Helpful index for the eventual "refund liabilities this period" dashboard.
CREATE INDEX IF NOT EXISTS payroll_results_is_refund_idx
  ON payroll_results (is_refund) WHERE is_refund = true;

-- ──────────────────────────────────────────────────────────────────────────
-- (2) payroll_share_links: drop the public-read policy, replace with
--     expires_at > now() filter
-- ──────────────────────────────────────────────────────────────────────────

-- Drop whichever name the existing public-read policy uses. We try both
-- common names rather than asserting one so this migration works against
-- the production project regardless of which name the original policy got.
DROP POLICY IF EXISTS "share_links_select_all" ON payroll_share_links;
DROP POLICY IF EXISTS "Public read share links" ON payroll_share_links;
DROP POLICY IF EXISTS "public_read"            ON payroll_share_links;

CREATE POLICY "share_links_unexpired_only"
  ON payroll_share_links
  FOR SELECT
  USING (expires_at > now());

COMMIT;

-- ──────────────────────────────────────────────────────────────────────────
-- Rollback (run in a separate session if needed):
--
-- BEGIN;
--
-- DROP INDEX IF EXISTS payroll_results_is_refund_idx;
-- ALTER TABLE payroll_results DROP COLUMN IF EXISTS is_estimate;
-- ALTER TABLE payroll_results DROP COLUMN IF EXISTS refund_amount;
-- ALTER TABLE payroll_results DROP COLUMN IF EXISTS is_refund;
-- ALTER TABLE payroll_results DROP COLUMN IF EXISTS raw_pph;
--
-- DROP POLICY IF EXISTS "share_links_unexpired_only" ON payroll_share_links;
-- CREATE POLICY "share_links_select_all"
--   ON payroll_share_links FOR SELECT USING (true);
--
-- COMMIT;
