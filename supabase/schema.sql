-- =============================================================================
-- MIOS Payroll — Production Schema Snapshot
-- Generated from production DB (lkbayvqjymjwhdprhdvd) on 2026-05-25.
-- This file is the source-of-truth for disaster-recovery and new-environment
-- setup. Schema changes after this date live in supabase/migrations/*.sql.
--
-- Apply order: functions → tables → triggers → event triggers → RLS.
-- All DDL is idempotent (IF NOT EXISTS / CREATE OR REPLACE).
-- =============================================================================


-- =============================================================================
-- SECTION 1: HELPER FUNCTIONS (stable, SECURITY DEFINER membership checks)
-- These are created before tables because RLS policies reference them.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_member(co_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM companies c
    JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE c.id = co_id AND wm.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_run_member(r_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM payroll_runs pr
    JOIN companies c ON c.id = pr.company_id
    JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
    WHERE pr.id = r_id AND wm.user_id = auth.uid()
  );
$$;

-- Dev-only: read all profiles bypassing RLS (avoids recursive policy on user_profiles).
CREATE OR REPLACE FUNCTION public.get_all_profiles()
RETURNS SETOF user_profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM user_profiles ORDER BY created_at DESC;
$$;


-- =============================================================================
-- SECTION 2: TABLES (dependency order)
-- =============================================================================

-- WORKSPACES: one per accounting office / team
CREATE TABLE IF NOT EXISTS workspaces (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  owner_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- WORKSPACE MEMBERS: who can access what workspace
CREATE TABLE IF NOT EXISTS workspace_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text CHECK (role IN ('owner', 'admin', 'member')),
  created_at   timestamptz DEFAULT now(),
  user_email   text,
  UNIQUE (workspace_id, user_id)
);

-- WORKSPACE INVITATIONS: token-based invite links (7-day expiry)
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  invited_email  text,
  token          text UNIQUE DEFAULT md5(random()::text),
  invited_by     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role           text DEFAULT 'member',
  accepted_at    timestamptz,
  expires_at     timestamptz DEFAULT (now() + INTERVAL '7 days'),
  created_at     timestamptz DEFAULT now()
);

-- WORKSPACE ACTIVITY: audit trail of workspace-level events
CREATE TABLE IF NOT EXISTS workspace_activity (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id),
  user_email   text,
  action       text NOT NULL,
  entity_type  text,
  entity_name  text,
  metadata     jsonb DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);

-- USER PROFILES: one row per auth user; status gate for all authenticated users
CREATE TABLE IF NOT EXISTS user_profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text NOT NULL,
  full_name       text,
  role            text NOT NULL DEFAULT 'staff'
                    CHECK (role IN ('dev', 'accountant', 'staff')),
  status          text NOT NULL DEFAULT 'pending_approval'
                    CHECK (status IN ('pending_approval', 'approved', 'rejected', 'suspended')),
  workspace_id    uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  approved_by     uuid REFERENCES auth.users(id),
  approved_at     timestamptz,
  rejected_reason text,
  created_at      timestamptz DEFAULT now()
);

-- COMPANIES: each client company managed within a workspace
CREATE TABLE IF NOT EXISTS companies (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name             text NOT NULL,
  npwp_perusahaan  text,
  alamat           text,
  kota             text,
  industri         text,
  aktif            boolean DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- COMPANY STAFF ACCESS: which staff users can see which companies
CREATE TABLE IF NOT EXISTS company_staff_access (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  staff_user_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id     uuid REFERENCES companies(id) ON DELETE CASCADE,
  granted_by     uuid REFERENCES auth.users(id),
  created_at     timestamptz DEFAULT now(),
  UNIQUE (staff_user_id, company_id)
);

-- EMPLOYEES: static employee master data
CREATE TABLE IF NOT EXISTS employees (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid REFERENCES companies(id) ON DELETE CASCADE,
  nik                 text NOT NULL,
  nama                text NOT NULL,
  npwp                text,
  divisi              text,
  jabatan             text,
  jenis_kelamin       text CHECK (jenis_kelamin IN ('L', 'P')),
  tanggal_masuk       date,
  status_ptkp         text CHECK (status_ptkp IN ('TK0','TK1','TK2','TK3','K0','K1','K2','K3')),
  punya_npwp          boolean DEFAULT true,
  jenis_karyawan      text CHECK (jenis_karyawan IN ('tetap','tidak_tetap_harian','tidak_tetap_bulanan')),
  -- Base salary & allowances (karyawan tetap)
  gaji_pokok          bigint NOT NULL DEFAULT 0,
  benefit             bigint DEFAULT 0,
  kendaraan           bigint DEFAULT 0,
  pulsa               bigint DEFAULT 0,
  operasional         bigint DEFAULT 0,
  tunj_lain           bigint DEFAULT 0,
  -- BPJS Ketenagakerjaan
  ikut_jht            boolean DEFAULT true,
  ikut_jp             boolean DEFAULT true,
  ikut_jkp            boolean DEFAULT true,
  jkk_rate            numeric DEFAULT 0.0024,
  tanggung_jht_k      boolean DEFAULT true,
  tanggung_jp_k       boolean DEFAULT true,
  -- BPJS Kesehatan
  ikut_kes            boolean DEFAULT true,
  tanggung_kes_k      boolean DEFAULT true,
  -- PPh 21
  pph_ditanggung      boolean DEFAULT true,
  -- Karyawan tidak tetap fields
  upah_harian         bigint,
  hari_kerja_default  int,
  upah_bulanan_tt     bigint,
  tunjangan_tt        bigint,
  ikut_bpjs_tk        boolean DEFAULT false,
  aktif               boolean DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  tanggal_keluar      date,
  UNIQUE (company_id, nik)
);

-- EMPLOYEE EVENTS: monthly one-off adjustments (THR, bonus, kasbon, potongan)
CREATE TABLE IF NOT EXISTS employee_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  company_id  uuid REFERENCES companies(id) ON DELETE CASCADE,
  tahun       int NOT NULL,
  bulan       int CHECK (bulan BETWEEN 1 AND 12),
  tipe        text NOT NULL,
  nilai       bigint NOT NULL DEFAULT 0,
  keterangan  text,
  created_at  timestamptz DEFAULT now()
);

-- PAYROLL RUNS: one run record per company per month
CREATE TABLE IF NOT EXISTS payroll_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid REFERENCES companies(id) ON DELETE CASCADE,
  tahun         int NOT NULL,
  bulan         int CHECK (bulan BETWEEN 1 AND 12),
  status        text DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'locked')),
  notes         text,
  run_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  calculated_at timestamptz,
  locked_at     timestamptz,
  created_at    timestamptz DEFAULT now(),
  locked_by     uuid REFERENCES auth.users(id),
  UNIQUE (company_id, tahun, bulan)
);

-- PAYROLL RESULTS: immutable per-employee snapshot for each run
-- result_json and inputs_snapshot are the canonical historical record;
-- scalar columns are denormalized for fast aggregates.
CREATE TABLE IF NOT EXISTS payroll_results (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           uuid REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id      uuid REFERENCES employees(id) ON DELETE CASCADE,
  company_id       uuid REFERENCES companies(id) ON DELETE CASCADE,
  gaji_pokok       bigint,
  allowance_total  bigint,
  bruto            numeric,
  ter_rate         numeric,
  pph              bigint,
  tunj_pph         bigint,
  bpjs_employer    numeric,
  bpjs_karyawan    numeric,
  thp              bigint,
  ctc              numeric,
  thr_nominal      bigint DEFAULT 0,
  thr_pph          bigint DEFAULT 0,
  thr_thp          bigint DEFAULT 0,
  bonus_nominal    bigint DEFAULT 0,
  bonus_pph        bigint DEFAULT 0,
  bonus_thp        bigint DEFAULT 0,
  result_json      jsonb NOT NULL,
  inputs_snapshot  jsonb NOT NULL,
  calculated_at    timestamptz DEFAULT now(),
  raw_pph          numeric DEFAULT 0,
  is_refund        boolean DEFAULT false,
  refund_amount    numeric DEFAULT 0,
  is_estimate      boolean DEFAULT false,
  UNIQUE (run_id, employee_id)
);

-- Non-unique index to quickly find refund cases across large result sets
CREATE INDEX IF NOT EXISTS payroll_results_is_refund_idx
  ON payroll_results (is_refund) WHERE is_refund = true;

-- PAYROLL SHARE LINKS: public expiring links for payroll summary pages
-- RLS uses (expires_at > now()) — no auth required to read via share link.
CREATE TABLE IF NOT EXISTS payroll_share_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token      text NOT NULL UNIQUE,
  run_id     uuid REFERENCES payroll_runs(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  tahun      int NOT NULL,
  bulan      int NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- AUDIT LOGS: immutable record of payroll-critical actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id   uuid REFERENCES companies(id) ON DELETE SET NULL,
  actor_id     uuid REFERENCES auth.users(id),
  actor_email  text,
  actor_role   text,
  action       text NOT NULL,
  entity_type  text,
  entity_id    text,
  entity_name  text,
  old_values   jsonb,
  new_values   jsonb,
  metadata     jsonb DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);

-- NOTIFICATIONS: in-app notifications per user
CREATE TABLE IF NOT EXISTS notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type         text NOT NULL,
  title        text NOT NULL,
  message      text,
  read         boolean DEFAULT false,
  data         jsonb DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);

-- IMPORT SESSIONS: tracks each Excel import operation
CREATE TABLE IF NOT EXISTS import_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id    uuid REFERENCES companies(id) ON DELETE CASCADE,
  imported_by   uuid REFERENCES auth.users(id),
  file_name     text,
  bulan         int,
  tahun         int,
  total_rows    int DEFAULT 0,
  imported_rows int DEFAULT 0,
  status        text DEFAULT 'completed'
                  CHECK (status IN ('processing', 'completed', 'failed')),
  summary       jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);

-- IMPORT RECORDS: per-employee detail for each import session
CREATE TABLE IF NOT EXISTS import_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid REFERENCES import_sessions(id) ON DELETE CASCADE,
  employee_id       uuid REFERENCES employees(id) ON DELETE SET NULL,
  employee_name     text,
  original_data     jsonb NOT NULL,
  recalculated_data jsonb,
  differences       jsonb,
  has_diff          boolean DEFAULT false,
  created_at        timestamptz DEFAULT now()
);


-- =============================================================================
-- SECTION 3: FUNCTIONS (admin operations, SECURITY DEFINER)
-- =============================================================================

-- Workspace creation bypasses RLS on workspaces INSERT.
-- Two overloads: the second (with p_owner_email) is current; first is kept for
-- backward compatibility with any existing callers.
CREATE OR REPLACE FUNCTION public.create_workspace_for_user(
  p_name       text,
  p_owner_id   uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  INSERT INTO workspaces (name, owner_id)
  VALUES (p_name, p_owner_id)
  RETURNING id INTO v_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, p_owner_id, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN v_workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_workspace_for_user(
  p_name        text,
  p_owner_id    uuid,
  p_owner_email text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  INSERT INTO workspaces (name, owner_id)
  VALUES (p_name, p_owner_id)
  RETURNING id INTO v_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, user_email, role)
  VALUES (v_workspace_id, p_owner_id, p_owner_email, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN v_workspace_id;
END;
$$;

-- Admin: approve a pending user. Only the dev email can call this.
-- Does NOT allow assigning 'dev' role — that must be done directly via SQL.
CREATE OR REPLACE FUNCTION public.admin_approve_user(target_id uuid, new_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  caller_email  text;
  target_email  text;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'msiconsultant.international@gmail.com' THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

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

CREATE OR REPLACE FUNCTION public.admin_reject_user(target_id uuid, reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  caller_email  text;
  target_email  text;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'msiconsultant.international@gmail.com' THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT email INTO target_email FROM public.user_profiles WHERE id = target_id;

  UPDATE public.user_profiles
  SET status          = 'rejected',
      rejected_reason = reason
  WHERE id = target_id;

  RETURN jsonb_build_object('success', true, 'email', target_email);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_suspend_user(target_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  caller_email text;
BEGIN
  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  IF caller_email IS DISTINCT FROM 'msiconsultant.international@gmail.com' THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  UPDATE public.user_profiles
  SET status = 'suspended'
  WHERE id = target_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- =============================================================================
-- SECTION 4: TRIGGER FUNCTIONS
-- =============================================================================

-- Sets updated_at = now() on any UPDATE; used by companies and employees.
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Alias kept for compatibility — identical body.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fires after INSERT on workspaces; adds owner to workspace_members.
-- Note: app code calls create_workspace_for_user() which also inserts the
-- member row, so this trigger acts as a safety net for direct workspace inserts.
CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$;

-- Fires after INSERT on auth.users; creates user_profiles row.
-- Dev email gets role=dev/status=approved automatically; everyone else is pending.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role   text := 'staff';
  v_status text := 'pending_approval';
BEGIN
  IF NEW.email = 'msiconsultant.international@gmail.com' THEN
    v_role   := 'dev';
    v_status := 'approved';
  END IF;

  INSERT INTO user_profiles (id, email, role, status, approved_at)
  VALUES (
    NEW.id,
    NEW.email,
    v_role,
    v_status,
    CASE WHEN v_status = 'approved' THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never let a profile insert block the underlying auth signup.
    RAISE WARNING '[handle_new_user] profile insert failed for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;

-- Event trigger function: auto-enables RLS on every new public table.
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table', 'partitioned table')
  LOOP
    IF cmd.schema_name IS NOT NULL
       AND cmd.schema_name IN ('public')
       AND cmd.schema_name NOT IN ('pg_catalog', 'information_schema')
       AND cmd.schema_name NOT LIKE 'pg_toast%'
       AND cmd.schema_name NOT LIKE 'pg_temp%'
    THEN
      BEGIN
        EXECUTE format('ALTER TABLE IF EXISTS %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
    END IF;
  END LOOP;
END;
$$;


-- =============================================================================
-- SECTION 5: TRIGGERS
-- =============================================================================

-- Public-schema table triggers
DROP TRIGGER IF EXISTS update_company_modified ON companies;
CREATE TRIGGER update_company_modified
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_employee_modified ON employees;
CREATE TRIGGER update_employee_modified
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS on_workspace_created ON workspaces;
CREATE TRIGGER on_workspace_created
  AFTER INSERT ON workspaces
  FOR EACH ROW EXECUTE FUNCTION handle_new_workspace();

-- Auth-schema trigger (Supabase-managed table; run as superuser)
-- Creates a user_profiles row whenever a new auth user is created.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- SECTION 6: EVENT TRIGGER
-- Auto-enables RLS on every new table created in the public schema.
-- =============================================================================

DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_auto_enable();


-- =============================================================================
-- SECTION 7: ROW LEVEL SECURITY
-- Enable RLS on all 16 public tables (idempotent).
-- =============================================================================

ALTER TABLE workspaces            ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_activity    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_staff_access  ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees             ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_results       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_share_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_records        ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- SECTION 8: RLS POLICIES
-- All policies are PERMISSIVE. Helper functions are STABLE SECURITY DEFINER
-- so they see the full workspace_members table without recursive policy issues.
-- =============================================================================

-- ── workspaces ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS ws_select ON workspaces;
CREATE POLICY ws_select ON workspaces FOR SELECT
  USING (is_workspace_member(id));

DROP POLICY IF EXISTS ws_insert ON workspaces;
CREATE POLICY ws_insert ON workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS ws_update ON workspaces;
CREATE POLICY ws_update ON workspaces FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS ws_delete ON workspaces;
CREATE POLICY ws_delete ON workspaces FOR DELETE
  USING (auth.uid() = owner_id);

-- ── workspace_members ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS wm_select ON workspace_members;
CREATE POLICY wm_select ON workspace_members FOR SELECT
  USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS wm_insert ON workspace_members;
CREATE POLICY wm_insert ON workspace_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_members.workspace_id
        AND workspaces.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS wm_delete ON workspace_members;
CREATE POLICY wm_delete ON workspace_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = workspace_members.workspace_id
        AND workspaces.owner_id = auth.uid()
    )
  );

-- ── workspace_invitations ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS inv_select ON workspace_invitations;
CREATE POLICY inv_select ON workspace_invitations FOR SELECT
  USING (
    is_workspace_member(workspace_id)
    OR invited_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS inv_insert ON workspace_invitations;
CREATE POLICY inv_insert ON workspace_invitations FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS inv_update ON workspace_invitations;
CREATE POLICY inv_update ON workspace_invitations FOR UPDATE
  USING (
    is_workspace_member(workspace_id)
    OR invited_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS inv_delete ON workspace_invitations;
CREATE POLICY inv_delete ON workspace_invitations FOR DELETE
  USING (is_workspace_member(workspace_id));

-- ── workspace_activity ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS act_select ON workspace_activity;
CREATE POLICY act_select ON workspace_activity FOR SELECT
  USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS act_insert ON workspace_activity;
CREATE POLICY act_insert ON workspace_activity FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

-- ── user_profiles ─────────────────────────────────────────────────────────────
-- Users can only read/write their own profile row.
-- Dev reads all profiles via get_all_profiles() SECURITY DEFINER function.
DROP POLICY IF EXISTS profiles_own_read ON user_profiles;
CREATE POLICY profiles_own_read ON user_profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_own_insert ON user_profiles;
CREATE POLICY profiles_own_insert ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_own_update ON user_profiles;
CREATE POLICY profiles_own_update ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- ── companies ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS co_select ON companies;
CREATE POLICY co_select ON companies FOR SELECT
  USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS co_insert ON companies;
CREATE POLICY co_insert ON companies FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS co_update ON companies;
CREATE POLICY co_update ON companies FOR UPDATE
  USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS co_delete ON companies;
CREATE POLICY co_delete ON companies FOR DELETE
  USING (is_workspace_member(workspace_id));

-- ── company_staff_access ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS csa_select ON company_staff_access;
CREATE POLICY csa_select ON company_staff_access FOR SELECT
  USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS csa_insert ON company_staff_access;
CREATE POLICY csa_insert ON company_staff_access FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS csa_delete ON company_staff_access;
CREATE POLICY csa_delete ON company_staff_access FOR DELETE
  USING (is_workspace_member(workspace_id));

-- ── employees ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS emp_select ON employees;
CREATE POLICY emp_select ON employees FOR SELECT
  USING (is_company_member(company_id));

DROP POLICY IF EXISTS emp_insert ON employees;
CREATE POLICY emp_insert ON employees FOR INSERT
  WITH CHECK (is_company_member(company_id));

DROP POLICY IF EXISTS emp_update ON employees;
CREATE POLICY emp_update ON employees FOR UPDATE
  USING (is_company_member(company_id));

DROP POLICY IF EXISTS emp_delete ON employees;
CREATE POLICY emp_delete ON employees FOR DELETE
  USING (is_company_member(company_id));

-- ── employee_events ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS evt_select ON employee_events;
CREATE POLICY evt_select ON employee_events FOR SELECT
  USING (is_company_member(company_id));

DROP POLICY IF EXISTS evt_insert ON employee_events;
CREATE POLICY evt_insert ON employee_events FOR INSERT
  WITH CHECK (is_company_member(company_id));

DROP POLICY IF EXISTS evt_delete ON employee_events;
CREATE POLICY evt_delete ON employee_events FOR DELETE
  USING (is_company_member(company_id));

-- ── payroll_runs ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS run_select ON payroll_runs;
CREATE POLICY run_select ON payroll_runs FOR SELECT
  USING (is_company_member(company_id));

DROP POLICY IF EXISTS run_insert ON payroll_runs;
CREATE POLICY run_insert ON payroll_runs FOR INSERT
  WITH CHECK (is_company_member(company_id));

DROP POLICY IF EXISTS run_update ON payroll_runs;
CREATE POLICY run_update ON payroll_runs FOR UPDATE
  USING (is_company_member(company_id));

DROP POLICY IF EXISTS run_delete ON payroll_runs;
CREATE POLICY run_delete ON payroll_runs FOR DELETE
  USING (is_company_member(company_id));

-- ── payroll_results ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS res_select ON payroll_results;
CREATE POLICY res_select ON payroll_results FOR SELECT
  USING (is_run_member(run_id));

DROP POLICY IF EXISTS res_insert ON payroll_results;
CREATE POLICY res_insert ON payroll_results FOR INSERT
  WITH CHECK (is_company_member(company_id));

DROP POLICY IF EXISTS res_update ON payroll_results;
CREATE POLICY res_update ON payroll_results FOR UPDATE
  USING (is_company_member(company_id));

DROP POLICY IF EXISTS res_delete ON payroll_results;
CREATE POLICY res_delete ON payroll_results FOR DELETE
  USING (is_company_member(company_id));

-- ── payroll_share_links ───────────────────────────────────────────────────────
-- Public SELECT: no auth required — any bearer of a valid token can read.
-- Expiry enforced at DB layer via the USING clause; no app-layer bypass possible.
DROP POLICY IF EXISTS share_links_unexpired_only ON payroll_share_links;
CREATE POLICY share_links_unexpired_only ON payroll_share_links FOR SELECT
  USING (expires_at > now());

DROP POLICY IF EXISTS share_insert ON payroll_share_links;
CREATE POLICY share_insert ON payroll_share_links FOR INSERT
  WITH CHECK (is_company_member(company_id));

-- ── audit_logs ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS audit_accountant ON audit_logs;
CREATE POLICY audit_accountant ON audit_logs FOR SELECT
  USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS audit_insert ON audit_logs;
CREATE POLICY audit_insert ON audit_logs FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

-- ── notifications ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS notif_own ON notifications;
CREATE POLICY notif_own ON notifications FOR SELECT
  USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS notif_update ON notifications;
CREATE POLICY notif_update ON notifications FOR UPDATE
  USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS notif_insert ON notifications;
CREATE POLICY notif_insert ON notifications FOR INSERT
  WITH CHECK (true);

-- ── import_sessions ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS imp_select ON import_sessions;
CREATE POLICY imp_select ON import_sessions FOR SELECT
  USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS imp_insert ON import_sessions;
CREATE POLICY imp_insert ON import_sessions FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

-- ── import_records ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS imp_rec_select ON import_records;
CREATE POLICY imp_rec_select ON import_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM import_sessions s
      WHERE s.id = import_records.session_id
        AND is_workspace_member(s.workspace_id)
    )
  );

DROP POLICY IF EXISTS imp_rec_insert ON import_records;
CREATE POLICY imp_rec_insert ON import_records FOR INSERT
  WITH CHECK (true);


-- =============================================================================
-- ROLLBACK REFERENCE
-- To undo everything above on a fresh DB, run:
--   DROP SCHEMA public CASCADE; CREATE SCHEMA public;
-- To undo the auth trigger only:
--   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- To undo the event trigger:
--   DROP EVENT TRIGGER IF EXISTS ensure_rls;
-- =============================================================================
