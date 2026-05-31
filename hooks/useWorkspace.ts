import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { Workspace } from '@/lib/types';
import { setActiveWorkspace } from '@/lib/actions/workspace';

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWorkspaces() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Server-side source of truth for active workspace. SSR pages read this
      // same column, so the hook must reflect it (not localStorage).
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .maybeSingle();

      const { data } = await supabase
        .from('workspaces')
        .select('*, workspace_members!inner(*)')
        .eq('workspace_members.user_id', user.id);

      if (data && data.length > 0) {
        setWorkspaces(data);
        const active =
          data.find(w => w.id === profile?.workspace_id) || data[0];
        setWorkspace(active);
      }
      setLoading(false);
    }

    fetchWorkspaces();
  }, []);

  const switchWorkspace = async (id: string) => {
    const target = workspaces.find(w => w.id === id);
    if (!target) return;

    const res = await setActiveWorkspace(id);
    if (res.error) return;

    setWorkspace(target);
    // Full reload so server components re-render against the new
    // user_profiles.workspace_id; client-only state updates aren't enough
    // because all SSR pages read the column directly.
    window.location.reload();
  };

  return { workspace, workspaces, loading, switchWorkspace };
}
