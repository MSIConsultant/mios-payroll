'use server';
import { createClient } from '@/lib/supabase/server';
import { assertWorkspaceAccess } from '@/lib/auth/assertAccess';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomBytes } from 'crypto';
import { getAppUrl } from '@/lib/env';

async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspace_id: string,
  action: string,
  entity_type?: string,
  entity_name?: string,
  metadata?: Record<string, any>
) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('workspace_activity').insert({
    workspace_id, user_id: user?.id, user_email: user?.email,
    action, entity_type, entity_name, metadata: metadata ?? {},
  });
}

export async function createWorkspace(formData: FormData) {
  const supabase = await createClient();
  const name = formData.get('name') as string;
  if (!name) return { error: 'Nama workspace wajib diisi.' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { count } = await supabase
    .from('workspace_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'owner');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // Workspace limits per role tier.
  // dev = unlimited; accountant = 3 (manually approved, trusted);
  // staff = 1 (shouldn't be creating workspaces, but allow onboarding).
  // Replace these with a plan-column lookup once subscription tiers are added.
  const WORKSPACE_LIMIT: Record<string, number | null> = {
    dev:        null,
    accountant: 3,
    staff:      1,
  };
  const role  = (profile?.role as string) ?? 'staff';
  const limit = WORKSPACE_LIMIT[role] ?? 1;

  if (limit !== null && (count ?? 0) >= limit) {
    return { error: `Maksimal ${limit} workspace untuk akun Anda.` };
  }

  const { data, error } = await supabase.rpc('create_workspace_for_user', {
    p_name: name,
    p_owner_id: user.id,
    p_owner_email: user.email,
  });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { success: true, workspaceId: data };
}

export async function sendInvite(workspaceId: string, invitedEmail: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const normalizedEmail = invitedEmail.trim().toLowerCase();

  const { data: pendingInvite } = await supabase.from('workspace_invitations')
    .select('id').eq('workspace_id', workspaceId)
    .eq('invited_email', normalizedEmail).is('accepted_at', null).maybeSingle();
  if (pendingInvite) return { error: 'Undangan sudah dikirim ke email ini.' };

  const token = randomBytes(32).toString('hex');
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('workspace_invitations').insert({
    workspace_id: workspaceId, invited_email: normalizedEmail,
    token, invited_by: user.id, role: 'member', expires_at,
  });
  if (error) return { error: error.message };

  await logActivity(supabase, workspaceId, 'MEMBER_INVITED', 'user', normalizedEmail,
    { invited_by: user.email });

  const appUrl = getAppUrl();
  if (!appUrl) return { error: 'NEXT_PUBLIC_APP_URL atau VERCEL_URL belum dikonfigurasi.' };
  const inviteUrl = `${appUrl}/invite?token=${token}`;
  return { success: true, inviteUrl, token };
}

export async function acceptInvite(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Login terlebih dahulu.' };

  const { data: invite, error: invErr } = await supabase
    .from('workspace_invitations').select('*, workspaces(name)')
    .eq('token', token).is('accepted_at', null).single();

  if (invErr || !invite) return { error: 'Undangan tidak valid atau sudah kadaluarsa.' };
  if (new Date(invite.expires_at) < new Date()) return { error: 'Undangan sudah kadaluarsa.' };
  if ((invite.invited_email ?? '').toLowerCase() !== (user.email ?? '').toLowerCase())
    return { error: 'Undangan ini bukan untuk akun Anda.' };

  const { error: memErr } = await supabase.from('workspace_members').insert({
    workspace_id: invite.workspace_id,
    user_id: user.id,
    user_email: user.email,
    role: invite.role,
  });
  if (memErr && !memErr.message.includes('duplicate')) return { error: memErr.message };

  await supabase.from('workspace_invitations')
    .update({ accepted_at: new Date().toISOString() }).eq('id', invite.id);

  const wsName = (invite.workspaces as any)?.name ?? 'workspace';
  await logActivity(supabase, invite.workspace_id, 'MEMBER_JOINED', 'user',
    user.email, { workspace: wsName });

  revalidatePath('/');
  return { success: true, workspaceId: invite.workspace_id, workspaceName: wsName };
}

export async function removeMember(workspaceId: string, userId: string, userEmail: string) {
  const access = await assertWorkspaceAccess(workspaceId);
  if (!access.ok) return { error: 'Akses ditolak' };
  if (!['owner', 'admin'].includes(access.role))
    return { error: 'Hanya owner atau admin yang bisa menghapus anggota.' };

  const { supabase, user } = access;

  const { data: ws } = await supabase.from('workspaces')
    .select('owner_id').eq('id', workspaceId).single();
  if (ws?.owner_id === userId) return { error: 'Owner tidak bisa dihapus dari workspace.' };

  const { error } = await supabase.from('workspace_members')
    .delete().eq('workspace_id', workspaceId).eq('user_id', userId);
  if (error) return { error: error.message };

  await logActivity(supabase, workspaceId, 'MEMBER_REMOVED', 'user',
    userEmail, { removed_by: user.email });
  revalidatePath('/settings');
  return { success: true };
}

export async function revokeInvite(inviteId: string, workspaceId: string, email: string) {
  const access = await assertWorkspaceAccess(workspaceId);
  if (!access.ok) return { error: 'Akses ditolak' };
  if (!['owner', 'admin'].includes(access.role))
    return { error: 'Hanya owner atau admin yang bisa membatalkan undangan.' };

  const { supabase } = access;
  // Scope delete to workspace to prevent cross-tenant invite revocation
  const { error } = await supabase.from('workspace_invitations')
    .delete().eq('id', inviteId).eq('workspace_id', workspaceId);
  if (error) return { error: error.message };
  await logActivity(supabase, workspaceId, 'INVITE_REVOKED', 'user', email);
  revalidatePath('/settings');
  return { success: true };
}

export async function getWorkspaceActivity(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('workspace_activity')
    .select('*').eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false }).limit(50);
  return data ?? [];
}
