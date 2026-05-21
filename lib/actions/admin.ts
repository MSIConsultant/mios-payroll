'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { notifyUserApproved, notifyUserRejected } from '@/lib/actions/notify';

const DEV_EMAIL = 'msiconsultant.international@gmail.com';

async function assertDev() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== DEV_EMAIL.toLowerCase()) {
    throw new Error('Unauthorized');
  }
  return { supabase, user };
}

export async function approveUser(userId: string, role: 'accountant' | 'staff') {
  const { supabase } = await assertDev();

  const { data, error } = await supabase.rpc('admin_approve_user', {
    target_id: userId,
    new_role:  role,
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error as string };

  await notifyUserApproved((data.email as string) ?? '', role);
  revalidatePath('/dev/admin');
  return { success: true };
}

export async function rejectUser(userId: string, reason: string) {
  const { supabase } = await assertDev();

  const { data, error } = await supabase.rpc('admin_reject_user', {
    target_id: userId,
    reason:    reason || null,
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error as string };

  await notifyUserRejected((data.email as string) ?? '', reason);
  revalidatePath('/dev/admin');
  return { success: true };
}

export async function suspendUser(userId: string) {
  const { supabase } = await assertDev();
  const { data, error } = await supabase.rpc('admin_suspend_user', { target_id: userId });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error as string };
  revalidatePath('/dev/admin');
  return { success: true };
}

export async function getPendingUsers() {
  const { supabase } = await assertDev();
  const { data } = await supabase.from('user_profiles')
    .select('*').eq('status', 'pending_approval')
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function getAllUsers() {
  const { supabase } = await assertDev();
  const { data } = await supabase.from('user_profiles')
    .select('*').order('created_at', { ascending: false });
  return data ?? [];
}
