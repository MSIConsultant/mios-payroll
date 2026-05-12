import { createClient } from '@/lib/supabase/server';

export type AuditAction =
  | 'USER_LOGIN'
  | 'USER_APPROVED'
  | 'USER_REJECTED'
  | 'USER_SUSPENDED'
  | 'WORKSPACE_CREATED'
  | 'COMPANY_CREATED'
  | 'COMPANY_UPDATED'
  | 'COMPANY_ARCHIVED'
  | 'COMPANY_DELETED'
  | 'EMPLOYEE_CREATED'
  | 'EMPLOYEE_UPDATED'
  | 'EMPLOYEE_DELETED'
  | 'EMPLOYEE_TOGGLED'
  | 'SALARY_UPDATED'
  | 'PAYROLL_CALCULATED'
  | 'PAYROLL_SAVED'
  | 'PAYROLL_LOCKED'
  | 'PAYROLL_DELETED'
  | 'EVENT_ADDED'
  | 'EVENT_DELETED'
  | 'IMPORT_STARTED'
  | 'IMPORT_COMPLETED'
  | 'EXPORT_SPT'
  | 'PERMISSION_CHANGED'
  | 'STAFF_INVITED'
  | 'STAFF_REMOVED';

export interface AuditParams {
  workspace_id:  string;
  company_id?:   string;
  action:        AuditAction;
  entity_type?:  string;
  entity_id?:    string;
  entity_name?:  string;
  old_values?:   Record<string, any>;
  new_values?:   Record<string, any>;
  metadata?:     Record<string, any>;
}

export async function audit(params: AuditParams) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('id', user.id).single();

    await supabase.from('audit_logs').insert({
      workspace_id: params.workspace_id,
      company_id:   params.company_id,
      actor_id:     user.id,
      actor_email:  user.email,
      actor_role:   profile?.role ?? 'staff',
      action:       params.action,
      entity_type:  params.entity_type,
      entity_id:    params.entity_id,
      entity_name:  params.entity_name,
      old_values:   params.old_values,
      new_values:   params.new_values,
      metadata:     params.metadata ?? {},
    });
  } catch {
    // Audit never blocks main operation
  }
}
