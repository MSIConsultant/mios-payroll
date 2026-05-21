'use client';
import { useState, useMemo } from 'react';
import {
  ScrollText, Search, Building2, User, Clock, Download, ChevronDown,
} from 'lucide-react';

interface AuditLog {
  id: string;
  company_id: string | null;
  actor_email: string;
  actor_role: string;
  action: string;
  entity_type: string | null;
  entity_name: string | null;
  old_values: any;
  new_values: any;
  metadata: any;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
}

interface Props {
  logs: AuditLog[];
  companies: Company[];
  workspaceId: string;
}

const ACTION_META: Record<string, { chip: string; label: string }> = {
  PAYROLL_LOCKED:     { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: 'Dikunci' },
  PAYROLL_SAVED:      { chip: 'bg-sky-50 text-sky-700 ring-sky-200',             label: 'Disimpan' },
  PAYROLL_CALCULATED: { chip: 'bg-blue-50 text-blue-700 ring-blue-200',          label: 'Dihitung' },
  PAYROLL_DELETED:    { chip: 'bg-red-50 text-red-700 ring-red-200',             label: 'Dihapus' },
  EMPLOYEE_CREATED:   { chip: 'bg-violet-50 text-violet-700 ring-violet-200',    label: 'Karyawan Dibuat' },
  EMPLOYEE_UPDATED:   { chip: 'bg-violet-50 text-violet-700 ring-violet-200',    label: 'Karyawan Diubah' },
  EMPLOYEE_DELETED:   { chip: 'bg-red-50 text-red-700 ring-red-200',             label: 'Karyawan Dihapus' },
  SALARY_UPDATED:     { chip: 'bg-amber-50 text-amber-700 ring-amber-200',       label: 'Gaji Diubah' },
  IMPORT_COMPLETED:   { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: 'Import Selesai' },
  EXPORT_SPT:         { chip: 'bg-sky-50 text-sky-700 ring-sky-200',             label: 'Export SPT' },
  COMPANY_CREATED:    { chip: 'bg-amber-50 text-amber-700 ring-amber-200',       label: 'Perusahaan Dibuat' },
  COMPANY_UPDATED:    { chip: 'bg-amber-50 text-amber-700 ring-amber-200',       label: 'Perusahaan Diubah' },
  PERMISSION_CHANGED: { chip: 'bg-red-50 text-red-700 ring-red-200',             label: 'Hak Akses Diubah' },
  USER_APPROVED:      { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: 'User Disetujui' },
  USER_REJECTED:      { chip: 'bg-red-50 text-red-700 ring-red-200',             label: 'User Ditolak' },
  STAFF_REMOVED:      { chip: 'bg-red-50 text-red-700 ring-red-200',             label: 'Staff Dihapus' },
};

function getActionConfig(action: string) {
  return (
    ACTION_META[action] ?? {
      chip: 'bg-slate-100 text-slate-600 ring-slate-200',
      label: action.replace(/_/g, ' '),
    }
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  if (days < 7) return `${days} hari lalu`;
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function LogsClient({ logs, companies }: Props) {
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));

  const uniqueActions = useMemo(
    () => [...new Set(logs.map((l) => l.action))].sort(),
    [logs],
  );

  const filtered = useMemo(
    () =>
      logs.filter((log) => {
        if (filterAction && log.action !== filterAction) return false;
        if (filterCompany && log.company_id !== filterCompany) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            log.actor_email?.toLowerCase().includes(q) ||
            log.action?.toLowerCase().includes(q) ||
            log.entity_name?.toLowerCase().includes(q) ||
            log.entity_type?.toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [logs, filterAction, filterCompany, search],
  );

  function handleExport() {
    setExporting(true);
    try {
      const headers = [
        'Tanggal', 'Aksi', 'Aktor', 'Role',
        'Entitas', 'Nama Entitas', 'Perusahaan', 'Detail',
      ];
      const rows = logs.map((log) =>
        [
          new Date(log.created_at).toLocaleString('id-ID'),
          log.action,
          log.actor_email ?? '',
          log.actor_role ?? '',
          log.entity_type ?? '',
          log.entity_name ?? '',
          log.company_id ? companyMap[log.company_id] ?? log.company_id : '',
          log.metadata ? JSON.stringify(log.metadata) : '',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      );

      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent fail
    }
    setExporting(false);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const today = new Date().toDateString();
  const todayCount = logs.filter((l) => new Date(l.created_at).toDateString() === today).length;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 pb-5 border-b border-[var(--border-default)] flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Audit Log
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Rekam jejak seluruh aktivitas penting dalam workspace.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Download size={14} />
          {exporting ? 'Mengekspor…' : 'Export CSV'}
        </button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Total Entri" value={logs.length} />
        <StatCard label="Hari Ini" value={todayCount} accent="brand" />
        <StatCard label="Ditampilkan" value={filtered.length} accent="emerald" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
          />
          <input
            type="text"
            placeholder="Cari email, aksi, entitas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-[var(--border-default)] rounded-lg text-sm placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all"
          />
        </div>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="px-3 py-2 bg-white border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
        >
          <option value="">Semua Aksi</option>
          {uniqueActions.map((a) => (
            <option key={a} value={a}>
              {getActionConfig(a).label || a}
            </option>
          ))}
        </select>
        <select
          value={filterCompany}
          onChange={(e) => setFilterCompany(e.target.value)}
          className="px-3 py-2 bg-white border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
        >
          <option value="">Semua Perusahaan</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-[var(--border-default)] rounded-xl py-16 text-center">
          <ScrollText size={32} className="mx-auto text-[var(--text-faint)]" />
          <p className="mt-3 text-sm text-[var(--text-secondary)]">Tidak ada log ditemukan.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((log, i) => {
            const cfg = getActionConfig(log.action);
            const isExpanded = expanded.has(log.id);
            const hasDetails = log.old_values || log.new_values || log.metadata;

            return (
              <li
                key={log.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${Math.min(i, 12) * 0.02}s`, opacity: 0 }}
              >
                <div className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => hasDetails && toggleExpand(log.id)}
                    className={`w-full px-4 py-3.5 flex items-center gap-3 text-left ${
                      hasDetails ? 'hover:bg-[var(--bg-subtle)] cursor-pointer' : 'cursor-default'
                    } transition-colors`}
                  >
                    <span
                      className={`shrink-0 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${cfg.chip}`}
                    >
                      {cfg.label}
                    </span>

                    <div className="flex-1 min-w-0">
                      {log.entity_name && (
                        <p className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                          {log.entity_name}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] font-mono">
                          <User size={11} />
                          {log.actor_email}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-muted)]">
                          {log.actor_role}
                        </span>
                        {log.company_id && companyMap[log.company_id] && (
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
                            <Building2 size={11} />
                            {companyMap[log.company_id]}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 text-[12px] font-mono text-[var(--text-muted)]">
                        <Clock size={11} />
                        {timeAgo(log.created_at)}
                      </span>
                      {hasDetails && (
                        <ChevronDown
                          size={14}
                          className={`text-[var(--text-muted)] transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </div>
                  </button>

                  {isExpanded && hasDetails && (
                    <div className="px-4 pb-4 border-t border-[var(--border-subtle)]">
                      <div className="mt-3 rounded-lg p-4 bg-[var(--bg-subtle)] font-mono text-[12px] overflow-x-auto">
                        {log.old_values && (
                          <div className="mb-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700 mb-2">
                              Sebelum
                            </p>
                            <pre className="text-[var(--text-secondary)] whitespace-pre-wrap">
                              {JSON.stringify(log.old_values, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.new_values && (
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 mb-2">
                              Sesudah
                            </p>
                            <pre className="text-[var(--text-secondary)] whitespace-pre-wrap">
                              {JSON.stringify(log.new_values, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] font-mono mt-2 text-[var(--text-muted)]">
                        {new Date(log.created_at).toLocaleString('id-ID')}
                      </p>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatCard({
  label, value, accent,
}: {
  label: string;
  value: number;
  accent?: 'brand' | 'emerald';
}) {
  const accentMap = {
    brand: 'text-[var(--brand)]',
    emerald: 'text-emerald-700',
  } as const;
  const text = accent ? accentMap[accent] : 'text-[var(--text-primary)]';
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold font-mono ${text}`}>{value}</p>
    </div>
  );
}
