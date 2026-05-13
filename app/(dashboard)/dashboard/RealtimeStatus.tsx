'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  companyIds: string[];
  initialRunMap: Record<string, string>;
}

export default function RealtimeStatus({ companyIds, initialRunMap }: Props) {
  const [runMap, setRunMap] = useState<Record<string, string>>(initialRunMap);

  useEffect(() => {
    if (companyIds.length === 0) return;
    const supabase = createClient();

    const channel = supabase
      .channel('payroll-status')
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'payroll_runs',
          filter: `company_id=in.(${companyIds.join(',')})`,
        },
        (payload: any) => {
          const { company_id, status } = payload.new ?? {};
          if (company_id && status) {
            setRunMap(prev => ({ ...prev, [company_id]: status }));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyIds.join(',')]);

  return null; // This component just manages the subscription
  // Pass runMap up via a callback or use a shared state if needed
}
