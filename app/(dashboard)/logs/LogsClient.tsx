'use client';
import { useState, useMemo } from 'react';
import { ScrollText, Search, Filter, Building2, User, Clock } from 'lucide-react';
import { exportAuditLogCSV } from '@/lib/actions/logs';

interface AuditLog {
  id:           string;
  company_id:   string | null;
  actor_email:  string;
  actor_role:   string;
  action:       string;
  entity_type:  string | null;
  entity_name:  string | null;
  old_values:   any;
  new_values:   any;
  metadata:     any;
  created_at:   string;
}

interface Company { id: string; name: string; }

const [exporting, setExporting] = useState(false);

async function handleExport() {
  setExporting(true);
  const { workspaceId } = ... // get from props — add workspaceId as a prop to LogsClient
  const csv = await exportAuditLogCSV(workspaceId);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  setExporting(false);
}
const ACTION_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  PAYROLL_LOCKED:     { bg: 'rgba(34,197,94,0.1)',   text: '#4ADE80', label: 'Dikunci' },
  PAYROLL_SAVED:      { bg: 'rgba(56,189,248,0.1)',  text: '#38BDF8', label: 'Disimpan' },
  PAYROLL_CALCULATED: { bg: 'rgba(37,99,235,0.1)',   text: '#3B82F6', label: 'Dihitung' },
  PAYROLL_DELETED:    { bg: 'rgba(239,68,68,0.1)',   text: '#EF4444', label: 'Dihapus' },
  EMPLOYEE_CREATED:   { bg: 'rgba(167,139,250,0.1)', text: '#A78BFA', label: 'Karyawan Dibuat' },
  EMPLOYEE_UPDATED:   { bg: 'rgba(167,139,250,0.1)', text: '#A78BFA', label: 'Karyawan Diubah' },
  EMPLOYEE_DELETED:   { bg: 'rgba(239,68,68,0.1)',   text: '#EF4444', label: 'Karyawan Dihapus' },
  SALARY_UPDATED:     { bg: 'rgba(251,176,64,0.1)',  text: '#FBB040', label: 'Gaji Diubah' },
  IMPORT_COMPLETED:   { bg: 'rgba(34,197,94,0.1)',   text: '#4ADE80', label: 'Import Selesai' },
  EXPORT_SPT:         { bg: 'rgba(56,189,248,0.1)',  text: '#38BDF8', label: 'Export SPT' },
  COMPANY_CREATED:    { bg: 'rgba(251,176,64,0.1)',  text: '#FBB040', label: 'Perusahaan Dibuat' },
  COMPANY_UPDATED:    { bg: 'rgba(251,176,64,0.1)',  text: '#FBB040', label: 'Perusahaan Diubah' },
  PERMISSION_CHANGED: { bg: 'rgba(239,68,68,0.1)',   text: '#EF4444', label: 'Hak Akses Diubah' },
  USER_APPROVED:      { bg: 'rgba(34,197,94,0.1)',   text: '#4ADE80', label: 'User Disetujui' },
  USER_REJECTED:      { bg: 'rgba(239,68,68,0.1)',   text: '#EF4444', label: 'User Ditolak' },
  STAFF_REMOVED:      { bg: 'rgba(239,68,68,0.1)',   text: '#EF4444', label: 'Staff Dihapus' },
};

const DEFAULT_ACTION = { bg: 'rgba(113,113,122,0.1)', text: '#71717A', label: '' };

function getActionConfig(action: string) {
  return ACTION_COLORS[action] ?? { ...DEFAULT_ACTION, label: action.replace(/_/g, ' ') };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)   return 'baru saja';
  if (mins  < 60)  return `${mins} menit lalu`;
  if (hours < 24)  return `${hours} jam lalu`;
  if (days  < 7)   return `${days} hari lalu`;
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function LogsClient({ logs, companies }: { logs: AuditLog[]; companies: Company[] }) {
  const [search, setSearch]           = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());

  const uniqueActions = useMemo(() =>
    [...new Set(logs.map(l => l.action))].sort(), [logs]);

  const filtered = useMemo(() => logs.filter(log => {
    if (filterAction  && log.action     !== filterAction)  return false;
    if (filterCompany && log.company_id !== filterCompany) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        log.actor_email?.toLowerCase().includes(q) ||
        log.action?.toLowerCase().includes(q)      ||
        log.entity_name?.toLowerCase().includes(q) ||
        log.entity_type?.toLowerCase().includes(q)
      );
    }
    return true;
  }), [logs, filterAction, filterCompany, search]);

  const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]));

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="max-w-5xl space-y-6 animate-fade-in-up">

      {/* Header */}
      <div className="border-b pb-6" style={{ borderColor: 'var(--border-default)' }}>
        <h1 className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>
          Audit Log
        </h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Rekam jejak seluruh aktivitas penting dalam workspace.
        </p>
      </div>

      {/* Stats */}
      <button onClick={handleExport} disabled={exporting}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-[13px] disabled:opacity-50 transition-colors"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
        <Download size={14} />
        {exporting ? 'Mengekspor...' : 'Export CSV'}
      </button>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Entri',   value: logs.length,     color: 'var(--text-primary)' },
          { label: 'Hari Ini',      value: logs.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length, color: '#3B82F6' },
          { label: 'Ditampilkan',   value: filtered.length, color: '#4ADE80' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-3xl font-black font-mono" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-ghost)' }} />
          <input
            type="text"
            placeholder="Cari berdasarkan email, aksi..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] outline-none transition-colors"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
        </div>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
          className="px-4 py-2.5 rounded-xl text-[13px] outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
          <option value="">Semua Aksi</option>
          {uniqueActions.map(a => (
            <option key={a} value={a}>{getActionConfig(a).label || a}</option>
          ))}
        </select>
        <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
          className="px-4 py-2.5 rounded-xl text-[13px] outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
          <option value="">Semua Perusahaan</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Log entries */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <ScrollText size={32} className="mx-auto mb-4" style={{ color: 'var(--text-ghost)' }} />
          <p className="text-[15px]" style={{ color: 'var(--text-muted)' }}>Tidak ada log ditemukan.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log, i) => {
            const cfg        = getActionConfig(log.action);
            const isExpanded = expanded.has(log.id);
            const hasDetails = log.old_values || log.new_values || log.metadata;

            return (
              <div key={log.id}
                className="rounded-xl overflow-hidden animate-fade-in-up"
                style={{
                  background:     'var(--bg-card)',
                  border:         '1px solid var(--border-default)',
                  animationDelay: `${Math.min(i, 20) * 0.02}s`,
                  opacity:        0,
                }}>
                <div
                  className={`px-5 py-4 flex items-center gap-4 ${hasDetails ? 'cursor-pointer' : ''}`}
                  onClick={() => hasDetails && toggleExpand(log.id)}>

                  {/* Action badge */}
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-widest shrink-0 whitespace-nowrap"
                    style={{ background: cfg.bg, color: cfg.text }}>
                    {cfg.label}
                  </span>

                  {/* Entity */}
                  <div className="flex-1 min-w-0">
                    {log.entity_name && (
                      <p className="font-semibold text-[14px] truncate" style={{ color: 'var(--text-primary)' }}>
                        {log.entity_name}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-0.5">
                      <div className="flex items-center gap-1.5">
                        <User size={10} style={{ color: 'var(--text-ghost)' }} />
                        <span className="text-[12px] font-mono" style={{ color: 'var(--text-muted)' }}>
                          {log.actor_email}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--bg-input)', color: 'var(--text-ghost)' }}>
                          {log.actor_role}
                        </span>
                      </div>
                      {log.company_id && companyMap[log.company_id] && (
                        <>
                          <span style={{ color: 'var(--text-ghost)' }}>·</span>
                          <div className="flex items-center gap-1.5">
                            <Building2 size={10} style={{ color: 'var(--text-ghost)' }} />
                            <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                              {companyMap[log.company_id]}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Clock size={11} style={{ color: 'var(--text-ghost)' }} />
                    <span className="text-[12px] font-mono" style={{ color: 'var(--text-ghost)' }}>
                      {timeAgo(log.created_at)}
                    </span>
                    {hasDetails && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                        style={{ color: 'var(--text-ghost)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>

                {/* Expandable detail */}
                {isExpanded && hasDetails && (
                  <div className="px-5 pb-4 pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="rounded-xl p-4 font-mono text-[12px] overflow-x-auto"
                      style={{ background: 'var(--bg-deep)' }}>
                      {log.old_values && (
                        <div className="mb-3">
                          <p className="text-[10px] uppercase tracking-widest mb-2 text-red-400">Sebelum</p>
                          <pre style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify(log.old_values, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.new_values && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest mb-2 text-green-400">Sesudah</p>
                          <pre style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify(log.new_values, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] font-mono mt-2" style={{ color: 'var(--text-ghost)' }}>
                      {new Date(log.created_at).toLocaleString('id-ID')}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
