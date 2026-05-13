'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';

export async function getWorkspaceStaff(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('workspace_members')
    .select('user_id, user_email, role, created_at')
    .eq('workspace_id', workspaceId)
    .neq('role', 'owner');
  return data ?? [];
}

export async function getStaffCompanyAccess(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('company_staff_access')
    .select('staff_user_id, company_id')
    .eq('workspace_id', workspaceId);
  return data ?? [];
}

export async function grantCompanyAccess(
  workspaceId: string,
  staffUserId: string,
  companyId:   string,
  companyName: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase.from('company_staff_access').insert({
    workspace_id:  workspaceId,
    staff_user_id: staffUserId,
    company_id:    companyId,
    granted_by:    user.id,
  });
  if (error && !error.message.includes('duplicate'))
    return { error: error.message };

  await audit({
    workspace_id: workspaceId,
    company_id:   companyId,
    action:       'PERMISSION_CHANGED',
    entity_type:  'staff_access',
    entity_name:  companyName,
    new_values:   { staff_user_id: staffUserId, granted: true },
  });

  revalidatePath('/staff');
  return { success: true };
}

export async function revokeCompanyAccess(
  workspaceId: string,
  staffUserId: string,
  companyId:   string,
  companyName: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('company_staff_access')
    .delete()
    .eq('staff_user_id', staffUserId)
    .eq('company_id', companyId);
  if (error) return { error: error.message };

  await audit({
    workspace_id: workspaceId,
    company_id:   companyId,
    action:       'PERMISSION_CHANGED',
    entity_type:  'staff_access',
    entity_name:  companyName,
    new_values:   { staff_user_id: staffUserId, granted: false },
  });

  revalidatePath('/staff');
  return { success: true };
}

export async function removeStaffFromWorkspace(
  workspaceId: string,
  userId:      string,
  userEmail:   string,
) {
  const supabase = await createClient();

  // Remove all company access first
  await supabase.from('company_staff_access')
    .delete().eq('workspace_id', workspaceId).eq('staff_user_id', userId);

  // Remove from workspace
  const { error } = await supabase.from('workspace_members')
    .delete().eq('workspace_id', workspaceId).eq('user_id', userId);
  if (error) return { error: error.message };

  await audit({
    workspace_id: workspaceId,
    action:       'STAFF_REMOVED',
    entity_type:  'user',
    entity_name:  userEmail,
  });

  revalidatePath('/staff');
  return { success: true };
}
