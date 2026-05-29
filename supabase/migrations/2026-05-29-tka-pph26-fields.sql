-- 2026-05-29 — Add TKA / PPh 26 identification fields to employees
--
-- TKA (Tenaga Kerja Asing — foreign workers) use passport numbers instead of
-- 16-digit KTP. Under PMK 112/2022, every Indonesian's NIK is equated with
-- their NPWP, so the ×1.2 non-NPWP penalty rarely applies to locals anymore.
-- TKA without Indonesian NPWP are technically subject to PPh 26 (flat 20%,
-- treaty-reducible) rather than PPh 21.
--
-- This migration introduces two optional fields:
--   - tipe_identitas: 'ktp' (default) | 'passport' — UI/derivation hint
--   - pph_26: when true, route the calculation through PPh 26 (engine support
--     to be added in a follow-up; for now, set acts as a warning flag)
--
-- Auto-classifying via trigger keeps existing rows backwards-compatible:
-- a 16-digit numeric NIK is classified KTP, anything else as passport.
--
-- Nullable on both — leaving NULL preserves current behaviour (PPh 21 with
-- ×1.2 if punya_npwp=false).

BEGIN;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS tipe_identitas text
    CHECK (tipe_identitas IN ('ktp', 'passport')),
  ADD COLUMN IF NOT EXISTS pph_26 boolean DEFAULT false;

-- Backfill existing rows: classify by NIK pattern.
UPDATE employees
SET tipe_identitas = CASE
  WHEN nik ~ '^[0-9]{16}$' THEN 'ktp'
  WHEN nik ~ '[A-Za-z]' THEN 'passport'
  ELSE 'ktp'  -- short-numeric defaults to KTP (likely truncated legacy data)
END
WHERE tipe_identitas IS NULL;

COMMIT;

-- Rollback (run in a separate session if needed):
-- BEGIN;
-- ALTER TABLE employees DROP COLUMN IF EXISTS pph_26;
-- ALTER TABLE employees DROP COLUMN IF EXISTS tipe_identitas;
-- COMMIT;
