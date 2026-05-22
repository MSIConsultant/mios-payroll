'use server';
import { randomBytes } from 'crypto';
import { assertRunAccess } from '@/lib/auth/assertAccess';
import { audit } from '@/lib/audit';
import { getAppUrl } from '@/lib/env';

export async function createShareLink(
  runId: string,
  companyId: string,
  tahun: number,
  bulan: number
) {
  const access = await assertRunAccess(runId);
  if (!access.ok) return { error: 'Akses ditolak.' };
  const { supabase, workspaceId } = access;

  const token = randomBytes(24).toString('hex');
  const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('payroll_share_links').insert({
    token, run_id: runId, company_id: companyId,
    tahun, bulan, expires_at,
  });

  if (error) return { error: error.message };

  await audit({
    workspace_id: workspaceId,
    company_id: companyId,
    action: 'SHARE_LINK_CREATED',
    entity_type: 'payroll_share_link',
    entity_name: `${tahun}-${String(bulan).padStart(2, '0')}`,
    new_values: { run_id: runId, expires_at },
  });

  const appUrl = getAppUrl();
  if (!appUrl) return { error: 'NEXT_PUBLIC_APP_URL atau VERCEL_URL belum dikonfigurasi.' };
  const url = `${appUrl}/share/${token}`;
  return { success: true, url };
}
