export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  invited_email: string;
  token: string;
  invited_by: string;
  role: 'admin' | 'member';
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface Company {
  id: string;
  workspace_id: string;
  name: string;
  npwp_perusahaan: string | null;
  alamat: string | null;
  kota: string | null;
  industri: string | null;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  company_id: string;
  nik: string;
  nama: string;
  npwp: string | null;
  divisi: string | null;
  jabatan: string | null;
  alamat: string | null;
  jenis_kelamin: 'L' | 'P';
  tanggal_masuk: string | null;
  tanggal_keluar: string | null;
  status_ptkp: 'TK0'|'TK1'|'TK2'|'TK3'|'K0'|'K1'|'K2'|'K3';
  punya_npwp: boolean;
  jenis_karyawan: 'tetap'|'tidak_tetap_harian'|'tidak_tetap_bulanan';
  gaji_pokok: number;
  benefit: number;
  kendaraan: number;
  pulsa: number;
  operasional: number;
  tunj_lain: number;
  ikut_jht: boolean;
  ikut_jp: boolean;
  ikut_jkp: boolean;
  jkk_rate: number;
  tanggung_jht_k: boolean;
  tanggung_jp_k: boolean;
  ikut_kes: boolean;
  tanggung_kes_k: boolean;
  pph_ditanggung: boolean;
  upah_harian: number | null;
  hari_kerja_default: number | null;
  upah_bulanan_tt: number | null;
  tunjangan_tt: number | null;
  ikut_bpjs_tk: boolean;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeEvent {
  id: string;
  employee_id: string;
  company_id: string;
  tahun: number;
  bulan: number;
  tipe: 'thr' | 'bonus' | 'alpha_telat' | 'kasbon' | 'pot_lain' | 'benefit_extra' | 'kendaraan_extra' | 'pulsa_extra' | 'operasional_extra' | 'hari_kerja';
  nilai: number;
  keterangan: string | null;
  created_at: string;
}

export interface PayrollRun {
  id: string;
  company_id: string;
  tahun: number;
  bulan: number;
  status: 'draft' | 'calculated' | 'locked';
  notes: string | null;
  run_by: string | null;
  calculated_at: string | null;
  locked_at: string | null;
  created_at: string;
}

export interface PayrollResult {
  id: string;
  run_id: string;
  employee_id: string;
  company_id: string;
  gaji_pokok: number;
  allowance_total: number;
  bruto: number;
  ter_rate: number | null;
  pph: number;
  tunj_pph: number;
  bpjs_employer: number;
  bpjs_karyawan: number;
  thp: number;
  ctc: number;
  thr_nominal: number;
  thr_pph: number;
  thr_thp: number;
  bonus_nominal: number;
  bonus_pph: number;
  bonus_thp: number;
  result_json: Record<string, any>;
  inputs_snapshot: Record<string, any>;
  calculated_at: string;
}
