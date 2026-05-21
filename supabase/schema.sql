-- WORKSPACES: one per accounting office / team
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- WORKSPACE MEMBERS: who can access what
CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('owner','admin','member')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- WORKSPACE INVITATIONS: token-based invite links
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  invited_email text,
  token text UNIQUE DEFAULT md5(random()::text),
  invited_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  accepted_at timestamptz NULL,
  expires_at timestamptz DEFAULT now() + interval '7 days',
  created_at timestamptz DEFAULT now()
);

-- COMPANIES: each client company
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  npwp_perusahaan text,
  alamat text,
  kota text,
  industri text,
  aktif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- EMPLOYEES: static employee data
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  nik text NOT NULL,
  nama text NOT NULL,
  npwp text,
  divisi text,
  jabatan text,
  jenis_kelamin text CHECK (jenis_kelamin IN ('L','P')),
  tanggal_masuk date,
  status_ptkp text CHECK (status_ptkp IN ('TK0','TK1','TK2','TK3','K0','K1','K2','K3')),
  punya_npwp boolean DEFAULT true,
  jenis_karyawan text CHECK (jenis_karyawan IN ('tetap','tidak_tetap_harian','tidak_tetap_bulanan')),
  -- Base salary & allowances
  gaji_pokok bigint NOT NULL DEFAULT 0,
  benefit bigint DEFAULT 0,
  kendaraan bigint DEFAULT 0,
  pulsa bigint DEFAULT 0,
  operasional bigint DEFAULT 0,
  tunj_lain bigint DEFAULT 0,
  -- BPJS TK
  ikut_jht boolean DEFAULT true,
  ikut_jp boolean DEFAULT true,
  ikut_jkp boolean DEFAULT true,
  jkk_rate numeric DEFAULT 0.0024,
  tanggung_jht_k boolean DEFAULT true,
  tanggung_jp_k boolean DEFAULT true,
  -- BPJS Kes
  ikut_kes boolean DEFAULT true,
  tanggung_kes_k boolean DEFAULT true,
  -- PPh 21
  pph_ditanggung boolean DEFAULT true,
  -- Karyawan tidak tetap fields
  upah_harian bigint,
  hari_kerja_default int,
  upah_bulanan_tt bigint,
  tunjangan_tt bigint,
  ikut_bpjs_tk boolean DEFAULT false,
  aktif boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, nik)
);

-- EMPLOYEE EVENTS: monthly variations
CREATE TABLE IF NOT EXISTS employee_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  tahun int NOT NULL,
  bulan int CHECK (bulan BETWEEN 1 AND 12),
  tipe text NOT NULL,
  nilai bigint NOT NULL DEFAULT 0,
  keterangan text,
  created_at timestamptz DEFAULT now()
);

-- PAYROLL RUNS: one per company per month
CREATE TABLE IF NOT EXISTS payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  tahun int NOT NULL,
  bulan int CHECK (bulan BETWEEN 1 AND 12),
  status text CHECK (status IN ('draft','calculated','locked')) DEFAULT 'draft',
  notes text,
  run_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  calculated_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, tahun, bulan)
);

-- PAYROLL RESULTS: cached output per employee per run
CREATE TABLE IF NOT EXISTS payroll_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  gaji_pokok bigint,
  allowance_total bigint,
  bruto bigint,
  ter_rate numeric,        
  pph bigint,
  tunj_pph bigint,
  bpjs_employer bigint,
  bpjs_karyawan bigint,
  thp bigint,
  ctc bigint,
  thr_nominal bigint DEFAULT 0,
  thr_pph bigint DEFAULT 0,
  thr_thp bigint DEFAULT 0,
  bonus_nominal bigint DEFAULT 0,
  bonus_pph bigint DEFAULT 0,
  bonus_thp bigint DEFAULT 0,
  result_json jsonb NOT NULL,
  inputs_snapshot jsonb NOT NULL,
  calculated_at timestamptz DEFAULT now(),
  UNIQUE(run_id, employee_id)
);

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_company_modified ON companies;
CREATE TRIGGER update_company_modified BEFORE UPDATE ON companies FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

DROP TRIGGER IF EXISTS update_employee_modified ON employees;
CREATE TRIGGER update_employee_modified BEFORE UPDATE ON employees FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Note: employee_events only has created_at per spec, no updated_at trigger needed

-- TRIGGER: After INSERT on workspaces -> auto-insert owner into workspace_members as 'owner'
CREATE OR REPLACE FUNCTION handle_new_workspace()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner');
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS on_workspace_created ON workspaces;
CREATE TRIGGER on_workspace_created
    AFTER INSERT ON workspaces
    FOR EACH ROW EXECUTE PROCEDURE handle_new_workspace();

-- SECURITY DEFINER admin functions (bypass profiles_own_update RLS for dev-only mutations)
-- Each verifies auth.uid() belongs to the dev email before proceeding.

CREATE OR REPLACE FUNCTION admin_approve_user(target_id uuid, new_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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
  SET status      = 'approved',
      role        = new_role,
      approved_by = auth.uid(),
      approved_at = now()
  WHERE id = target_id;

  -- workspace_id is null at approval time; assigned during onboarding
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

CREATE OR REPLACE FUNCTION admin_reject_user(target_id uuid, reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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

CREATE OR REPLACE FUNCTION admin_suspend_user(target_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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
