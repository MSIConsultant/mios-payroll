import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminPanel from './AdminPanel';

export default async function DevAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const DEV_EMAIL = 'msiconsultant.international@gmail.com';
  if (!user || user.email?.toLowerCase() !== DEV_EMAIL.toLowerCase()) redirect('/');
  return <AdminPanel />;
}
