'use server';
import { createClient } from '@/lib/supabase/server';

export async function assertCompanyAccess(companyId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: company } = await supabase
    .from('companies')
    .select('workspace_id')
    .eq('id', companyId)
    .single();
  if (!company) throw new Error('Company not found');

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', company.workspace_id)
    .eq('user_id', user.id)
    .single();
  if (!member) throw new Error('Forbidden');

  return { supabase, user, workspaceId: company.workspace_id, role: member.role as string };
}

export async function assertWorkspaceAccess(workspaceId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();
  if (!member) throw new Error('Forbidden');

  return { supabase, user, role: member.role as string };
}
