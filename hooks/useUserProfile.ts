'use client';
import { useState, useEffect, createContext, useContext } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile } from '@/lib/types/roles';

interface UserProfileContext {
  profile:  UserProfile | null;
  loading:  boolean;
  isOwner:  boolean;
  isStaff:  boolean;
  isDev:    boolean;
  canDo:    (action: keyof typeof import('@/lib/types/roles').CAN) => boolean;
}

export function useUserProfile(): UserProfileContext {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('user_profiles').select('*').eq('id', user.id).single();
      if (data) setProfile(data as UserProfile);
      setLoading(false);
    }
    load();
  }, []);

  const role = profile?.role ?? 'staff';
  return {
    profile,
    loading,
    isOwner: role === 'accountant' || role === 'dev',
    isStaff: role === 'staff',
    isDev:   role === 'dev',
    canDo: (action) => {
      const { CAN } = require('@/lib/types/roles');
      return CAN[action]?.(role) ?? false;
    },
  };
}
