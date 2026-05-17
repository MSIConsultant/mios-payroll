'use server';
import { createClient } from '@/lib/supabase/server';

export async function exportAuditLogCSV(workspaceId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (!data || data.length === 0) return '';

  const headers = [
    'Tanggal', 'Aksi', 'Aktor', 'Role',
    'Entitas', 'Nama Entitas', 'Perusahaan ID', 'Detail',
  ];

  const rows = data.map(log => [
    new Date(log.created_at).toLocaleString('id-ID'),
    log.action,
    log.actor_email ?? '',
    log.actor_role  ?? '',
    log.entity_type ?? '',
    log.entity_name ?? '',
    log.company_id  ?? '',
    log.metadata    ? JSON.stringify(log.metadata) : '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

  return [headers.join(','), ...rows].join('\n');
}
