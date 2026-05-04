'use server';
import { createClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

export async function createShareLink(
  runId: string,
  companyId: string,
  tahun: number,
  bulan: number
) {
  const supabase = await createClient();
  const token = randomBytes(24).toString('hex');
  const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('payroll_share_links').insert({
    token, run_id: runId, company_id: companyId,
    tahun, bulan, expires_at,
  });

  if (error) return { error: error.message };
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/share/${token}`;
  return { success: true, url };
}
