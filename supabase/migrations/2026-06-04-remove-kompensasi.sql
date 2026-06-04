-- 2026-06-04-remove-kompensasi.sql
-- Remove the severance / kompensasi feature entirely (never used in product).
-- Drops the kompensasi_payments table and removes 'kompensasi' from the
-- payroll_runs.jenis CHECK. Engine code (calculateSeverance, PESANGON_BRACKETS)
-- and tests are removed in the same PR.
--
-- Verified safe 2026-06-04: kompensasi_payments has 0 rows and 0 payroll_runs
-- use jenis = 'kompensasi', so neither change drops live data.

begin;

-- 1. Drop the table (cascades its RLS policies, indexes, and update trigger).
drop table if exists public.kompensasi_payments cascade;

-- 2. Tighten payroll_runs.jenis — remove the now-unused 'kompensasi' value.
alter table public.payroll_runs drop constraint if exists payroll_runs_jenis_check;
alter table public.payroll_runs
  add constraint payroll_runs_jenis_check
  check (jenis = any (array['tetap'::text, 'tidak_final'::text, 'harian'::text]));

commit;

-- ───────────────────────────────────────────────────────────────────────
-- ROLLBACK: re-applying 2026-05-20-slice-3-schema.sql recreates the table,
-- its policies/indexes/trigger, and the 'kompensasi' jenis value. (The table
-- would come back empty.)
