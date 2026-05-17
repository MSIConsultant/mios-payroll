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
  const { supabase, user } = await assertDev();

  const { data: profile } = await supabase
    .from('user_profiles').select('email, workspace_id').eq('id', userId).single();

  const { error } = await supabase.from('user_profiles').update({
    status:      'approved',
    role,
    approved_by: user.id,
    approved_at: new Date().toISOString(),
  }).eq('id', userId);

  if (error) return { error: error.message };

  // Send in-app notification to the user
  await supabase.from('notifications').insert({
    workspace_id: profile?.workspace_id ?? '00000000-0000-0000-0000-000000000000',
    recipient_id: userId,
    type:         'ACCOUNT_APPROVED',
    title:        'Akun Anda Disetujui',
    message:      `Selamat! Akun Anda telah disetujui sebagai ${role === 'accountant' ? 'Akuntan' : 'Staff'}.`,
    data:         { role },
  });
  await notifyUserApproved(profile?.email ?? '', role);

  revalidatePath('/dev/admin');
  return { success: true };
}

export async function rejectUser(userId: string, reason: string) {
  const { supabase } = await assertDev();

  const { data: profile } = await supabase
    .from('user_profiles').select('email').eq('id', userId).single();

  const { error } = await supabase.from('user_profiles').update({
    status:          'rejected',
    rejected_reason: reason,
  }).eq('id', userId);

  if (error) return { error: error.message };

  await notifyUserRejected(profile?.email ?? '', reason);
  revalidatePath('/dev/admin');
  return { success: true };
}

export async function suspendUser(userId: string) {
  const { supabase } = await assertDev();
  const { error } = await supabase.from('user_profiles')
    .update({ status: 'suspended' }).eq('id', userId);
  if (error) return { error: error.message };
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
