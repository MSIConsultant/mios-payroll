'use server';
import { createClient } from '@/lib/supabase/server';
import { assertAuth } from '@/lib/auth/assertAccess';
import { revalidatePath } from 'next/cache';

// The invite/registration flow was removed (2026-06): users are created
// manually in Supabase and workspaces via the SQL editor
// (create_workspace_for_user RPC). Only the two read/switch helpers remain.

// Switch the caller's active workspace. user_profiles.workspace_id is the
// server-side source of truth for which workspace every SSR page renders;
// the client-side useWorkspace hook reflects this value rather than driving it.
export async function setActiveWorkspace(workspaceId: string) {
  const auth = await assertAuth();
  if (!auth.ok) return { error: 'Not authenticated' };

  // Verify caller is actually a member of the target workspace before
  // updating their profile. RLS would also block the profile update from
  // pointing at a workspace they don't belong to, but we want a clean
  // error message instead of a silent no-op.
  const { data: member } = await auth.supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!member) return { error: 'Anda bukan anggota workspace ini.' };

  const { error } = await auth.supabase
    .from('user_profiles')
    .update({ workspace_id: workspaceId })
    .eq('id', auth.user.id);
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { success: true, workspaceId };
}

export async function getWorkspaceActivity(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('workspace_activity')
    .select('*').eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false }).limit(50);
  return data ?? [];
}
