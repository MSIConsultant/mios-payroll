-- 2026-05-29 — Employee flexibility additions
--
-- Two changes, both non-breaking:
--
-- 1. `alamat` column on employees
--    Accountant flow now requires an address for every employee. Nullable
--    here so existing rows stay valid; the server action enforces NOT NULL
--    on CREATE going forward.
--
-- 2. Monthly upah override for tidak_tetap_bulanan workers
--    Bulanan workers' upah can change month to month. Rather than introduce
--    a new table, we reuse the existing employee_events pattern with a new
--    `tipe` value 'upah_bulanan_override'. The schema already has no CHECK
--    constraint on tipe, so the addition is purely application-level.
--
--    The override row uniquely identifies a (company_id, employee_id, tahun,
--    bulan, 'upah_bulanan_override') combination. To prevent duplicates that
--    would silently let two values race, add a partial UNIQUE index limited
--    to this tipe.

BEGIN;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS alamat text;

-- Partial unique index: only one upah_bulanan_override per
-- (employee_id, tahun, bulan). Other tipe values (thr, bonus, kasbon, etc.)
-- can legitimately have multiple rows in the same month, so the index is
-- scoped via WHERE.
CREATE UNIQUE INDEX IF NOT EXISTS
  uniq_upah_bulanan_override_emp_period
  ON employee_events (employee_id, tahun, bulan)
  WHERE tipe = 'upah_bulanan_override';

COMMIT;

-- Rollback (run in a separate session if needed):
-- BEGIN;
-- DROP INDEX IF EXISTS uniq_upah_bulanan_override_emp_period;
-- ALTER TABLE employees DROP COLUMN IF EXISTS alamat;
-- COMMIT;
