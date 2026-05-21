-- 2026-05-21 — Add tanggal_keluar to employees
--
-- Tracks the employee's last day of work in the tax year. When present and
-- the current payroll run matches its month, the payroll engine routes the
-- result through calculateLastMonth (Pasal 17 reconciliation) instead of TER.
--
-- Nullable: leave NULL for active employees with no scheduled exit.

BEGIN;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS tanggal_keluar date;

COMMIT;

-- Rollback (run in a separate session if needed):
-- BEGIN;
-- ALTER TABLE employees DROP COLUMN IF EXISTS tanggal_keluar;
-- COMMIT;
