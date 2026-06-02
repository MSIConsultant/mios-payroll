'use server';
import { createClient } from '@/lib/supabase/server';
import { assertWorkspaceAccess } from '@/lib/auth/assertAccess';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getAppUrl } from '@/lib/env';
import { inviteRatelimit, checkRateLimit } from '@/lib/ratelimit';
import { MAX_STAFF_PER_WORKSPACE, MAX_WORKSPACES_PER_USER } from '@/lib/limits';

// Option C: create an auth user immediately (no /register, no pending-approval),
// wire them into the workspace, and let Supabase send the magic-link email.
export async function inviteStaffMagicLink(
  workspaceId: string,
  email: string,
  companyIds: string[] = [],
) {
  const supabase = await createClient();
  const { data: { user: caller } } = await supabase.auth.getUser();
  if (!caller) return { error: 'Not authenticated' };

  // Verify caller belongs to this workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', caller.id)
    .single();
  if (!membership) return { error: 'Tidak memiliki akses ke workspace ini.' };

  const normalizedEmail = email.trim().toLowerCase();

  const { allowed } = await checkRateLimit(inviteRatelimit, `invite:${workspaceId}`);
  if (!allowed) return { error: 'Terlalu banyak undangan. Coba lagi dalam satu jam.' };

  // Idempotency: already a member?
  const { data: existing } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('user_email', normalizedEmail)
    .maybeSingle();
  if (existing) return { error: 'Email ini sudah menjadi anggota workspace.' };

  const admin = createAdminClient();

  // Capacity guards (admin client → bypasses RLS for accurate counts).
  // The DB trigger backstops these, but we check here for a clean message.
  const { count: staffCount } = await admin
    .from('workspace_members')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .neq('role', 'owner');
  if ((staffCount ?? 0) >= MAX_STAFF_PER_WORKSPACE)
    return { error: `Workspace sudah mencapai batas ${MAX_STAFF_PER_WORKSPACE} staff.` };

  const { count: inviteeWsCount } = await admin
    .from('workspace_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_email', normalizedEmail);
  if ((inviteeWsCount ?? 0) >= MAX_WORKSPACES_PER_USER)
    return { error: `Email ini sudah tergabung di ${MAX_WORKSPACES_PER_USER} workspace (batas maksimal).` };

  const appUrl = getAppUrl();
  const redirectTo = appUrl ? `${appUrl}/auth/callback?next=/dashboard` : undefined;

  // Create auth user + send magic-link email in one call
  const { data: inviteData, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(normalizedEmail, { redirectTo });
  if (inviteErr) return { error: inviteErr.message };

  const newUserId = inviteData.user.id;

  // handle_new_user trigger fires synchronously and creates a pending_approval
  // row. Approve it (or insert if the trigger happened to fail).
  const { data: existingProfile } = await admin
    .from('user_profiles')
    .select('status')
    .eq('id', newUserId)
    .maybeSingle();

  if (!existingProfile || existingProfile.status === 'pending_approval') {
    await admin.from('user_profiles').upsert(
      {
        id: newUserId,
        email: normalizedEmail,
        role: 'staff',
        status: 'approved',
        approved_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
  }

  // Link to workspace
  await admin.from('workspace_members').upsert(
    {
      workspace_id: workspaceId,
      user_id: newUserId,
      user_email: normalizedEmail,
      role: 'member',
    },
    { onConflict: 'user_id,workspace_id' },
  );

  // Grant any pre-selected company access
  if (companyIds.length > 0) {
    const rows = companyIds.map(cid => ({
      workspace_id: workspaceId,
      staff_user_id: newUserId,
      company_id: cid,
      granted_by: caller.id,
    }));
    await admin.from('company_staff_access').upsert(rows, {
      onConflict: 'staff_user_id,company_id',
      ignoreDuplicates: true,
    });
  }

  await audit({
    workspace_id: workspaceId,
    action: 'STAFF_INVITED',
    entity_type: 'user',
    entity_name: normalizedEmail,
    new_values: { method: 'magic_link', companies_granted: companyIds.length },
  });

  revalidatePath('/staff');
  return { success: true };
}

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
  const access = await assertWorkspaceAccess(workspaceId);
  if (!access.ok) return { error: 'Akses ditolak' };
  if (!['owner', 'admin'].includes(access.role))
    return { error: 'Hanya owner atau admin yang bisa memberikan akses perusahaan.' };

  const { supabase, user } = access;

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
  const access = await assertWorkspaceAccess(workspaceId);
  if (!access.ok) return { error: 'Akses ditolak' };
  if (!['owner', 'admin'].includes(access.role))
    return { error: 'Hanya owner atau admin yang bisa mencabut akses perusahaan.' };

  const { supabase } = access;

  // Scope delete to workspace to prevent cross-tenant mutations
  const { error } = await supabase
    .from('company_staff_access')
    .delete()
    .eq('workspace_id', workspaceId)
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
  const access = await assertWorkspaceAccess(workspaceId);
  if (!access.ok) return { error: 'Akses ditolak' };
  if (!['owner', 'admin'].includes(access.role))
    return { error: 'Hanya owner atau admin yang bisa menghapus staff.' };

  const { supabase } = access;

  // Prevent removing the workspace owner
  const { data: ws } = await supabase.from('workspaces')
    .select('owner_id').eq('id', workspaceId).single();
  if (ws?.owner_id === userId)
    return { error: 'Owner tidak bisa dihapus dari workspace.' };

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
