export type UserRole   = 'dev' | 'accountant' | 'staff';
export type UserStatus = 'pending_approval' | 'approved' | 'rejected' | 'suspended';

export interface UserProfile {
  id:              string;
  email:           string;
  full_name:       string | null;
  role:            UserRole;
  status:          UserStatus;
  workspace_id:    string | null;
  approved_by:     string | null;
  approved_at:     string | null;
  rejected_reason: string | null;
  created_at:      string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  dev:        'Developer',
  accountant: 'Akuntan',
  staff:      'Staff',
};

export const CAN = {
  manageLogs:       (r: UserRole) => r === 'dev' || r === 'accountant',
  manageStaff:      (r: UserRole) => r === 'dev' || r === 'accountant',
  manageSettings:   (r: UserRole) => r === 'dev' || r === 'accountant',
  deleteRecords:    (r: UserRole) => r === 'dev' || r === 'accountant',
  approveUsers:     (r: UserRole) => r === 'dev',
  lockPayroll:      (r: UserRole) => r === 'dev' || r === 'accountant',
  importData:       (r: UserRole) => r === 'dev' || r === 'accountant',
  viewPayroll:      (_: UserRole) => true,
  editEmployees:    (_: UserRole) => true,
};
