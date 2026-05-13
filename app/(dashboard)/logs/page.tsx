import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import LogsClient from './LogsClient';

export default async function LogsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles').select('role, workspace_id').eq('id', user.id).single();

  if (!profile || profile.role === 'staff') redirect('/dashboard');

  const workspaceId = profile.workspace_id;
  if (!workspaceId) redirect('/onboarding');

  const [{ data: logs }, { data: companies }] = await Promise.all([
    supabase.from('audit_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('companies')
      .select('id, name')
      .eq('workspace_id', workspaceId),
  ]);

  return <LogsClient logs={logs ?? []} companies={companies ?? []} />;
}
