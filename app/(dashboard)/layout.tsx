import { redirect } from 'next/navigation';
import { cachedAuth, cachedUserProfile } from '@/lib/cache';
import DashboardShell from './DashboardShell';
import type { UserRole } from '@/lib/types/roles';

/**
 * Server-side dashboard layout: resolves user + profile + initial unread
 * notification count once per request, then renders the client-side shell.
 *
 * Removes the previous client-side useEffect waterfall (getUser → profile
 * fetch → unread fetch) that ran on every dashboard navigation and flashed
 * the MIOS-letters loader before the first paint.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user } = await cachedAuth();
  if (!user) redirect('/login');

  const profile = await cachedUserProfile(user.id);
  const role: UserRole = (profile?.role as UserRole | undefined) ?? 'staff';

  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', user.id)
    .eq('read', false);

  return (
    <DashboardShell
      userEmail={user.email ?? ''}
      fullName={profile?.full_name ?? null}
      role={role}
      initialUnreadCount={count ?? 0}
    >
      {children}
    </DashboardShell>
  );
}
