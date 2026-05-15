'use client';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Props {
  companyIds:   string[];
  workspaceId:  string;
}

export default function DashboardRealtime({ companyIds, workspaceId }: Props) {
  const router    = useRouter();
  const timerRef  = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (companyIds.length === 0) return;
    const supabase = createClient();

    // Debounced router refresh — prevents too many re-renders
    function scheduleRefresh() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => router.refresh(), 800);
    }

    const channel = supabase
      .channel(`dashboard-${workspaceId}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'payroll_runs',
        filter: `company_id=in.(${companyIds.join(',')})`,
      }, scheduleRefresh)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        filter: `workspace_id=eq.${workspaceId}`,
      }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [companyIds.join(','), workspaceId]);

  return null; // Pure effect component
}
