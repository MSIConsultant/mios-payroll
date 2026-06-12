import { redirect } from 'next/navigation';
import { cachedAuth, cachedUserProfile } from '@/lib/cache';
import DashboardShell from './DashboardShell';
import type { UserRole } from '@/lib/types/roles';

/**
 * Server-side dashboard layout: resolves user + profile once per request,
 * then renders the client-side shell.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await cachedAuth();
  if (!user) redirect('/login');

  const profile = await cachedUserProfile(user.id);
  const role: UserRole = (profile?.role as UserRole | undefined) ?? 'staff';

  return (
    <DashboardShell
      userEmail={user.email ?? ''}
      fullName={profile?.full_name ?? null}
      role={role}
    >
      {children}
    </DashboardShell>
  );
}
