'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Workspace {
  id:       string;
  name:     string;
  owner_id: string;
}

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get workspace from user profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .single();

      if (!profile?.workspace_id) { setLoading(false); return; }

      // Check localStorage for active workspace override
      const saved = typeof window !== 'undefined'
        ? localStorage.getItem('active_workspace_id')
        : null;

      const wsId = saved ?? profile.workspace_id;

      const { data: ws } = await supabase
        .from('workspaces')
        .select('id, name, owner_id')
        .eq('id', wsId)
        .single();

      if (ws) setWorkspace(ws as Workspace);
      setLoading(false);
    }
    load();
  }, []);

  return { workspace, loading };
}
