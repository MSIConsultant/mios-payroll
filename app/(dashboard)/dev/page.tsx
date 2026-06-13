import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DevDashboard from './DevDashboard';

const DEV_EMAIL = 'msiconsultant.international@gmail.com';

export default async function DevPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== DEV_EMAIL.toLowerCase()) redirect('/');
  return <DevDashboard userEmail={user.email} />;
}
