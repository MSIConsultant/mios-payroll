export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          company_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          company_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          company_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          aktif: boolean | null
          alamat: string | null
          created_at: string | null
          id: string
          industri: string | null
          kota: string | null
          name: string
          npwp_perusahaan: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          aktif?: boolean | null
          alamat?: string | null
          created_at?: string | null
          id?: string
          industri?: string | null
          kota?: string | null
          name: string
          npwp_perusahaan?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          aktif?: boolean | null
          alamat?: string | null
          created_at?: string | null
          id?: string
          industri?: string | null
          kota?: string | null
          name?: string
          npwp_perusahaan?: string | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      company_staff_access: {
        Row: {
          company_id: string | null
          created_at: string | null
          granted_by: string | null
          id: string
          staff_user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          granted_by?: string | null
          id?: string
          staff_user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          granted_by?: string | null
          id?: string
          staff_user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_staff_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_staff_access_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_events: {
        Row: {
          bulan: number | null
          company_id: string | null
          created_at: string | null
          employee_id: string | null
          id: string
          keterangan: string | null
          nilai: number
          tahun: number
          tipe: string
        }
        Insert: {
          bulan?: number | null
          company_id?: string | null
          created_at?: string | null
          employee_id?: string | null
          id?: string
          keterangan?: string | null
          nilai?: number
          tahun: number
          tipe: string
        }
        Update: {
          bulan?: number | null
          company_id?: string | null
          created_at?: string | null
          employee_id?: string | null
          id?: string
          keterangan?: string | null
          nilai?: number
          tahun?: number
          tipe?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          aktif: boolean | null
          benefit: number | null
          company_id: string | null
          created_at: string | null
          divisi: string | null
          gaji_pokok: number
          hari_kerja_default: number | null
          id: string
          ikut_bpjs_tk: boolean | null
          ikut_jht: boolean | null
          ikut_jkp: boolean | null
          ikut_jp: boolean | null
          ikut_kes: boolean | null
          jabatan: string | null
          jenis_karyawan: string | null
          jenis_kelamin: string | null
          jkk_rate: number | null
          kendaraan: number | null
          nama: string
          nik: string
          npwp: string | null
          operasional: number | null
          pph_ditanggung: boolean | null
          pulsa: number | null
          punya_npwp: boolean | null
          status_ptkp: string | null
          tanggal_masuk: string | null
          tanggung_jht_k: boolean | null
          tanggung_jp_k: boolean | null
          tanggung_kes_k: boolean | null
          tunj_lain: number | null
          tunjangan_tt: number | null
          upah_bulanan_tt: number | null
          upah_harian: number | null
          updated_at: string | null
        }
        Insert: {
          aktif?: boolean | null
          benefit?: number | null
          company_id?: string | null
          created_at?: string | null
          divisi?: string | null
          gaji_pokok?: number
          hari_kerja_default?: number | null
          id?: string
          ikut_bpjs_tk?: boolean | null
          ikut_jht?: boolean | null
          ikut_jkp?: boolean | null
          ikut_jp?: boolean | null
          ikut_kes?: boolean | null
          jabatan?: string | null
          jenis_karyawan?: string | null
          jenis_kelamin?: string | null
          jkk_rate?: number | null
          kendaraan?: number | null
          nama: string
          nik: string
          npwp?: string | null
          operasional?: number | null
          pph_ditanggung?: boolean | null
          pulsa?: number | null
          punya_npwp?: boolean | null
          status_ptkp?: string | null
          tanggal_masuk?: string | null
          tanggung_jht_k?: boolean | null
          tanggung_jp_k?: boolean | null
          tanggung_kes_k?: boolean | null
          tunj_lain?: number | null
          tunjangan_tt?: number | null
          upah_bulanan_tt?: number | null
          upah_harian?: number | null
          updated_at?: string | null
        }
        Update: {
          aktif?: boolean | null
          benefit?: number | null
          company_id?: string | null
          created_at?: string | null
          divisi?: string | null
          gaji_pokok?: number
          hari_kerja_default?: number | null
          id?: string
          ikut_bpjs_tk?: boolean | null
          ikut_jht?: boolean | null
          ikut_jkp?: boolean | null
          ikut_jp?: boolean | null
          ikut_kes?: boolean | null
          jabatan?: string | null
          jenis_karyawan?: string | null
          jenis_kelamin?: string | null
          jkk_rate?: number | null
          kendaraan?: number | null
          nama?: string
          nik?: string
          npwp?: string | null
          operasional?: number | null
          pph_ditanggung?: boolean | null
          pulsa?: number | null
          punya_npwp?: boolean | null
          status_ptkp?: string | null
          tanggal_masuk?: string | null
          tanggung_jht_k?: boolean | null
          tanggung_jp_k?: boolean | null
          tanggung_kes_k?: boolean | null
          tunj_lain?: number | null
          tunjangan_tt?: number | null
          upah_bulanan_tt?: number | null
          upah_harian?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      import_records: {
        Row: {
          created_at: string | null
          differences: Json | null
          employee_id: string | null
          employee_name: string | null
          has_diff: boolean | null
          id: string
          original_data: Json
          recalculated_data: Json | null
          session_id: string | null
        }
        Insert: {
          created_at?: string | null
          differences?: Json | null
          employee_id?: string | null
          employee_name?: string | null
          has_diff?: boolean | null
          id?: string
          original_data: Json
          recalculated_data?: Json | null
          session_id?: string | null
        }
        Update: {
          created_at?: string | null
          differences?: Json | null
          employee_id?: string | null
          employee_name?: string | null
          has_diff?: boolean | null
          id?: string
          original_data?: Json
          recalculated_data?: Json | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "import_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      import_sessions: {
        Row: {
          bulan: number | null
          company_id: string | null
          created_at: string | null
          file_name: string | null
          id: string
          imported_by: string | null
          imported_rows: number | null
          status: string | null
          summary: Json | null
          tahun: number | null
          total_rows: number | null
          workspace_id: string | null
        }
        Insert: {
          bulan?: number | null
          company_id?: string | null
          created_at?: string | null
          file_name?: string | null
          id?: string
          imported_by?: string | null
          imported_rows?: number | null
          status?: string | null
          summary?: Json | null
          tahun?: number | null
          total_rows?: number | null
          workspace_id?: string | null
        }
        Update: {
          bulan?: number | null
          company_id?: string | null
          created_at?: string | null
          file_name?: string | null
          id?: string
          imported_by?: string | null
          imported_rows?: number | null
          status?: string | null
          summary?: Json | null
          tahun?: number | null
          total_rows?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          message: string | null
          read: boolean | null
          recipient_id: string | null
          title: string
          type: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message?: string | null
          read?: boolean | null
          recipient_id?: string | null
          title: string
          type: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message?: string | null
          read?: boolean | null
          recipient_id?: string | null
          title?: string
          type?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_results: {
        Row: {
          allowance_total: number | null
          bonus_nominal: number | null
          bonus_pph: number | null
          bonus_thp: number | null
          bpjs_employer: number | null
          bpjs_karyawan: number | null
          bruto: number | null
          calculated_at: string | null
          company_id: string | null
          ctc: number | null
          employee_id: string | null
          gaji_pokok: number | null
          id: string
          inputs_snapshot: Json
          is_estimate: boolean | null
          is_refund: boolean | null
          pph: number | null
          raw_pph: number | null
          refund_amount: number | null
          result_json: Json
          run_id: string | null
          ter_rate: number | null
          thp: number | null
          thr_nominal: number | null
          thr_pph: number | null
          thr_thp: number | null
          tunj_pph: number | null
        }
        Insert: {
          allowance_total?: number | null
          bonus_nominal?: number | null
          bonus_pph?: number | null
          bonus_thp?: number | null
          bpjs_employer?: number | null
          bpjs_karyawan?: number | null
          bruto?: number | null
          calculated_at?: string | null
          company_id?: string | null
          ctc?: number | null
          employee_id?: string | null
          gaji_pokok?: number | null
          id?: string
          inputs_snapshot: Json
          is_estimate?: boolean | null
          is_refund?: boolean | null
          pph?: number | null
          raw_pph?: number | null
          refund_amount?: number | null
          result_json: Json
          run_id?: string | null
          ter_rate?: number | null
          thp?: number | null
          thr_nominal?: number | null
          thr_pph?: number | null
          thr_thp?: number | null
          tunj_pph?: number | null
        }
        Update: {
          allowance_total?: number | null
          bonus_nominal?: number | null
          bonus_pph?: number | null
          bonus_thp?: number | null
          bpjs_employer?: number | null
          bpjs_karyawan?: number | null
          bruto?: number | null
          calculated_at?: string | null
          company_id?: string | null
          ctc?: number | null
          employee_id?: string | null
          gaji_pokok?: number | null
          id?: string
          inputs_snapshot?: Json
          is_estimate?: boolean | null
          is_refund?: boolean | null
          pph?: number | null
          raw_pph?: number | null
          refund_amount?: number | null
          result_json?: Json
          run_id?: string | null
          ter_rate?: number | null
          thp?: number | null
          thr_nominal?: number | null
          thr_pph?: number | null
          thr_thp?: number | null
          tunj_pph?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_results_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_results_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          bulan: number | null
          calculated_at: string | null
          company_id: string | null
          created_at: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          run_by: string | null
          status: string | null
          tahun: number
        }
        Insert: {
          bulan?: number | null
          calculated_at?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          run_by?: string | null
          status?: string | null
          tahun: number
        }
        Update: {
          bulan?: number | null
          calculated_at?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          run_by?: string | null
          status?: string | null
          tahun?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_share_links: {
        Row: {
          bulan: number
          company_id: string | null
          created_at: string | null
          expires_at: string
          id: string
          run_id: string | null
          tahun: number
          token: string
        }
        Insert: {
          bulan: number
          company_id?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          run_id?: string | null
          tahun: number
          token: string
        }
        Update: {
          bulan?: number
          company_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          run_id?: string | null
          tahun?: number
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_share_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_share_links_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          rejected_reason: string | null
          role: string
          status: string
          workspace_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          rejected_reason?: string | null
          role?: string
          status?: string
          workspace_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          rejected_reason?: string | null
          role?: string
          status?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_activity: {
        Row: {
          action: string
          created_at: string | null
          entity_name: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_email: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_email?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_email?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_activity_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          invited_by: string | null
          invited_email: string | null
          role: string | null
          token: string | null
          workspace_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          role?: string | null
          token?: string | null
          workspace_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          role?: string | null
          token?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string | null
          id: string
          role: string | null
          user_email: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string | null
          user_email?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string | null
          user_email?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string | null
          id: string
          name: string
          owner_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          owner_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          owner_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_approve_user: {
        Args: { new_role: string; target_id: string }
        Returns: Json
      }
      admin_reject_user: {
        Args: { reason?: string; target_id: string }
        Returns: Json
      }
      admin_suspend_user: { Args: { target_id: string }; Returns: Json }
      create_workspace_for_user:
        | { Args: { p_name: string; p_owner_id: string }; Returns: string }
        | {
            Args: { p_name: string; p_owner_email?: string; p_owner_id: string }
            Returns: string
          }
      get_all_profiles: {
        Args: never
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          rejected_reason: string | null
          role: string
          status: string
          workspace_id: string | null
        }[]
      }
      is_company_member: { Args: { co_id: string }; Returns: boolean }
      is_run_member: { Args: { r_id: string }; Returns: boolean }
      is_workspace_member: { Args: { ws_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
