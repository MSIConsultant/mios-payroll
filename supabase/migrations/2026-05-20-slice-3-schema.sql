-- ─────────────────────────────────────────────────────────────────────────
-- Slice 3 schema migration
-- Generated 2026-05-20 for MIOS Payroll
--
-- WHAT THIS DOES
--   1. Adds employees.bpjs_basis              (declared BPJS salary override)
--   2. Adds employees.bpjs_*_start_date / end_date (membership period dates)
--   3. Adds payroll_runs.jenis                (tetap / tidak_final / harian / kompensasi)
--   4. Creates kompensasi_payments table       (one-off severance per departing employee)
--   5. Creates RLS policies + indexes on kompensasi_payments
--
-- HOW TO APPLY
--   - Open the Supabase SQL editor for the project
--   - Paste the WHOLE file in one go (it's wrapped in a single transaction)
--   - Click "Run"
--   - On success: nothing more to do — engine + UI changes in follow-up slice 3 commits
--   - On failure: the BEGIN/COMMIT block rolls back everything; nothing partial
--
-- ROLLBACK
--   See the rollback block at the bottom (commented out). Uncomment, paste,
--   and run to undo this migration. Only use BEFORE any application code
--   starts writing to the new columns/tables.
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. employees.bpjs_basis ─────────────────────────────────────────────────
-- The accountant maintains a per-employee declared BPJS salary, often lower
-- than gaji_pokok. When NULL the payroll engine falls back to gaji_pokok
-- (preserves prior behavior for any company that doesn't use this pattern).
-- Engine support already shipped (feat/engine-fixes branch); this column
-- exposes it to the database. See AUDIT.md and lib/engine/payroll.ts.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS bpjs_basis bigint NULL;

COMMENT ON COLUMN employees.bpjs_basis IS
  'Declared BPJS salary basis. When NULL, BPJS calc falls back to gaji_pokok. Often lower than gaji_pokok in real Indonesian payroll practice.';


-- ── 2. employees.bpjs_*_start_date / end_date ───────────────────────────────
-- Membership period dates per BPJS program. Source: accountant's standard
-- BPJS sheet columns "Mulai" / "Selesai". Informational/audit metadata only
-- for now — the engine still uses ikut_jht / ikut_jp / ikut_kes booleans
-- to decide enrollment for a given payroll period. A follow-up slice can
-- auto-derive ikut_* from dates if desired.
--
-- end_date NULL = still active.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS bpjs_jht_start_date date NULL,
  ADD COLUMN IF NOT EXISTS bpjs_jht_end_date   date NULL,
  ADD COLUMN IF NOT EXISTS bpjs_jp_start_date  date NULL,
  ADD COLUMN IF NOT EXISTS bpjs_jp_end_date    date NULL,
  ADD COLUMN IF NOT EXISTS bpjs_kes_start_date date NULL,
  ADD COLUMN IF NOT EXISTS bpjs_kes_end_date   date NULL;

COMMENT ON COLUMN employees.bpjs_jht_start_date IS 'JHT membership start date (informational; engine reads ikut_jht for enrollment decisions).';
COMMENT ON COLUMN employees.bpjs_jht_end_date   IS 'JHT membership end date. NULL = still active.';


-- ── 3. payroll_runs.jenis ───────────────────────────────────────────────────
-- The accountant runs FOUR distinct payment types per company per month:
-- karyawan tetap, karyawan tidak tetap "final" (bulanan), harian (daily),
-- and one-off kompensasi (severance, separate table below).
-- Currently UNIQUE(company_id, tahun, bulan) allows only one run per period.
-- This must change so the four can coexist.

ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS jenis text
  CHECK (jenis IN ('tetap','tidak_final','harian','kompensasi'))
  DEFAULT 'tetap';

-- Backfill existing rows (all current runs are 'tetap' — the only type the
-- app has supported so far).
UPDATE payroll_runs
  SET jenis = 'tetap'
  WHERE jenis IS NULL;

-- Now make it NOT NULL.
ALTER TABLE payroll_runs
  ALTER COLUMN jenis SET NOT NULL;

-- Replace the UNIQUE constraint to include jenis.
ALTER TABLE payroll_runs
  DROP CONSTRAINT IF EXISTS payroll_runs_company_id_tahun_bulan_key;

ALTER TABLE payroll_runs
  ADD CONSTRAINT payroll_runs_company_tahun_bulan_jenis_key
  UNIQUE (company_id, tahun, bulan, jenis);

COMMENT ON COLUMN payroll_runs.jenis IS
  'Payment type. Defaults to "tetap" (karyawan tetap monthly). "tidak_final" = karyawan tidak tetap bulanan; "harian" = daily workers; "kompensasi" = ONE-OFF severance/pesangon (uses kompensasi_payments table).';


-- ── 4. kompensasi_payments ──────────────────────────────────────────────────
-- One-off severance/pesangon payments per departing employee. PPh 21 final
-- uses progressive brackets per PP 68/2009 (different from Pasal 17):
--   0%  on first Rp 50,000,000
--   5%  on next  Rp 50,000,000  (50M..100M)
--   15% on next  Rp 400,000,000 (100M..500M)
--   25% above Rp 500,000,000
--
-- One row per severance event. Indonesian regulation may treat installment
-- payments differently (Pasal 17 progressive instead of final) — out of
-- scope for this migration; capture sekaligus (single-payment) for now.

CREATE TABLE IF NOT EXISTS kompensasi_payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id   uuid NULL REFERENCES employees(id) ON DELETE SET NULL,
    -- nullable: the accountant's KOMPENSASI sheet sometimes pays
    -- former employees no longer in employees (off-payroll consultants);
    -- denormalized fields below preserve the identity.

  -- Period this payment was issued in.
  tahun         int NOT NULL,
  bulan         int NOT NULL CHECK (bulan BETWEEN 1 AND 12),

  -- Severance type. Free text so we can extend later (e.g. uang manfaat pensiun).
  kategori      text NOT NULL DEFAULT 'pesangon'
                  CHECK (kategori IN ('pesangon','penghargaan','manfaat_pensiun','penggantian_hak','other')),

  -- Denormalized identity (preserved if employee row is later deleted or this
  -- was a non-employee payment).
  nama          text NOT NULL,
  nik           text NULL,
  npwp          text NULL,
  status_ptkp   text NULL CHECK (status_ptkp IS NULL OR status_ptkp IN ('TK0','TK1','TK2','TK3','K0','K1','K2','K3')),
  divisi        text NULL,

  -- Amounts (all Rp, integers).
  jumlah_bruto  bigint NOT NULL CHECK (jumlah_bruto >= 0),
  pph           bigint NOT NULL DEFAULT 0,
  thp           bigint NOT NULL DEFAULT 0,

  -- Engine snapshot — calculation breakdown, regulation cited, etc.
  result_json   jsonb NOT NULL DEFAULT '{}'::jsonb,
  inputs_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Lifecycle.
  status        text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','calculated','locked')),
  calculated_at timestamptz NULL,
  locked_at     timestamptz NULL,
  created_by    uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE kompensasi_payments IS
  'One-off severance/pesangon payments. PPh 21 final per PP 68/2009 brackets. Separate from monthly payroll_runs because each row is an independent event, not a batch.';


-- updated_at trigger (reuses the existing function from schema.sql)
DROP TRIGGER IF EXISTS update_kompensasi_modified ON kompensasi_payments;
CREATE TRIGGER update_kompensasi_modified
  BEFORE UPDATE ON kompensasi_payments
  FOR EACH ROW EXECUTE PROCEDURE update_modified_column();


-- ── 5. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS kompensasi_payments_company_period_idx
  ON kompensasi_payments(company_id, tahun, bulan);

CREATE INDEX IF NOT EXISTS kompensasi_payments_workspace_idx
  ON kompensasi_payments(workspace_id);

CREATE INDEX IF NOT EXISTS kompensasi_payments_employee_idx
  ON kompensasi_payments(employee_id)
  WHERE employee_id IS NOT NULL;


-- ── 6. Row Level Security ──────────────────────────────────────────────────
-- Workspace-scoped — same pattern as other workspace-owned tables. Uses the
-- is_workspace_member() helper assumed present in production (see CLAUDE.md
-- "Key SQL Functions"). If that helper does NOT exist in production, replace
-- with an inline subquery against workspace_members.

ALTER TABLE kompensasi_payments ENABLE ROW LEVEL SECURITY;

-- SELECT: any workspace member can read kompensasi for their workspace
DROP POLICY IF EXISTS kompensasi_select_workspace_member ON kompensasi_payments;
CREATE POLICY kompensasi_select_workspace_member
  ON kompensasi_payments
  FOR SELECT
  USING (is_workspace_member(workspace_id));

-- INSERT / UPDATE / DELETE: workspace members. Per-role gating (staff
-- assigned to specific companies vs accountant access to all) is enforced
-- at the application layer in lib/actions/, not in RLS — same pattern as
-- the existing employees / payroll_runs tables.
DROP POLICY IF EXISTS kompensasi_insert_workspace_member ON kompensasi_payments;
CREATE POLICY kompensasi_insert_workspace_member
  ON kompensasi_payments
  FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS kompensasi_update_workspace_member ON kompensasi_payments;
CREATE POLICY kompensasi_update_workspace_member
  ON kompensasi_payments
  FOR UPDATE
  USING (is_workspace_member(workspace_id))
  WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS kompensasi_delete_workspace_member ON kompensasi_payments;
CREATE POLICY kompensasi_delete_workspace_member
  ON kompensasi_payments
  FOR DELETE
  USING (is_workspace_member(workspace_id));


-- ── 7. Verification queries (read-only, won't change data) ──────────────────
-- These won't appear in the COMMIT but are useful to run AFTER the migration
-- to confirm everything landed. Run them separately if desired:
--
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'employees'
--   AND column_name IN ('bpjs_basis', 'bpjs_jht_start_date', 'bpjs_jp_end_date')
-- ORDER BY column_name;
--
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'payroll_runs' AND column_name = 'jenis';
--
-- SELECT constraint_name, constraint_type FROM information_schema.table_constraints
-- WHERE table_name = 'payroll_runs' AND constraint_type = 'UNIQUE';
--
-- SELECT count(*) AS kompensasi_table_exists
-- FROM information_schema.tables WHERE table_name = 'kompensasi_payments';

COMMIT;


-- ─────────────────────────────────────────────────────────────────────────
-- ROLLBACK (commented out — uncomment + run to undo this migration)
-- ─────────────────────────────────────────────────────────────────────────
-- BEGIN;
--   DROP TABLE IF EXISTS kompensasi_payments;
--   ALTER TABLE payroll_runs DROP CONSTRAINT IF EXISTS payroll_runs_company_tahun_bulan_jenis_key;
--   ALTER TABLE payroll_runs ADD CONSTRAINT payroll_runs_company_id_tahun_bulan_key
--     UNIQUE (company_id, tahun, bulan);
--   ALTER TABLE payroll_runs DROP COLUMN IF EXISTS jenis;
--   ALTER TABLE employees
--     DROP COLUMN IF EXISTS bpjs_basis,
--     DROP COLUMN IF EXISTS bpjs_jht_start_date,
--     DROP COLUMN IF EXISTS bpjs_jht_end_date,
--     DROP COLUMN IF EXISTS bpjs_jp_start_date,
--     DROP COLUMN IF EXISTS bpjs_jp_end_date,
--     DROP COLUMN IF EXISTS bpjs_kes_start_date,
--     DROP COLUMN IF EXISTS bpjs_kes_end_date;
-- COMMIT;
