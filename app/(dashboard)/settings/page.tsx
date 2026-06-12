'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { archiveCompany, deleteCompany } from '@/lib/actions/companies';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { getWorkspaceActivity } from '@/lib/actions/workspace';
import { Trash2, Archive, AlertTriangle, Building2 } from 'lucide-react';
import { toast } from 'sonner';

// Labels for historical activity rows — member/invite events remain in the
// log even though the invite flow itself has been removed.
const ACTION_LABELS: Record<string, { label: string; tone: string }> = {
  WORKSPACE_CREATED:  { label: 'Workspace dibuat',       tone: 'text-[var(--brand)]' },
  MEMBER_INVITED:     { label: 'Undangan dikirim ke',    tone: 'text-sky-700' },
  MEMBER_JOINED:      { label: 'Bergabung ke workspace', tone: 'text-emerald-700' },
  MEMBER_REMOVED:     { label: 'Anggota dihapus',        tone: 'text-red-700' },
  INVITE_REVOKED:     { label: 'Undangan dicabut untuk', tone: 'text-[var(--text-muted)]' },
  COMPANY_CREATED:    { label: 'Perusahaan dibuat',      tone: 'text-emerald-700' },
  COMPANY_ARCHIVED:   { label: 'Perusahaan diarsipkan',  tone: 'text-amber-700' },
  COMPANY_DELETED:    { label: 'Perusahaan dihapus',     tone: 'text-red-700' },
};

function Tab({
  id, active, label, onClick,
}: {
  id: string;
  active: boolean;
  label: string;
  onClick: (id: any) => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
        active
          ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
      }`}
    >
      {label}
    </button>
  );
}

export default function SettingsPage() {
  const { workspace } = useWorkspace();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'companies' | 'activity'>('companies');

  const [companies, setCompanies] = useState<any[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const [activity, setActivity] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!workspace) return;
    setLoadingData(true);
    const supabase = createClient();

    const { data: cos } = await supabase
      .from('companies')
      .select('id, name, aktif')
      .eq('workspace_id', workspace.id)
      .order('name');
    if (cos) setCompanies(cos);

    const acts = await getWorkspaceActivity(workspace.id);
    setActivity(acts);
    setLoadingData(false);
  }, [workspace]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleArchive(id: string, aktif: boolean) {
    setDeleting(id);
    const res = await archiveCompany(id, !aktif);
    if (res.error) toast.error(res.error);
    else setCompanies((c) => c.map((x) => (x.id === id ? { ...x, aktif: !aktif } : x)));
    setDeleting(null);
  }

  async function handleHardDelete(id: string) {
    const co = companies.find((c) => c.id === id);
    if (confirmText !== co?.name) {
      toast.error('Nama tidak cocok.');
      return;
    }
    if (!(await confirm({
      title: 'Hapus perusahaan secara permanen?',
      message: `Semua karyawan dan riwayat payroll ${co?.name} ikut terhapus. Tidak dapat dibatalkan.`,
      severity: 'danger',
      confirmLabel: 'Hapus Permanen',
    }))) return;
    setDeleting(id);
    const res = await deleteCompany(id);
    if (res.error) {
      toast.error(res.error);
    } else {
      setCompanies((c) => c.filter((x) => x.id !== id));
      setConfirmId(null);
      setConfirmText('');
    }
    setDeleting(null);
  }

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in-up">
      <header className="pb-5 border-b border-[var(--border-default)]">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Pengaturan
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-2">
          Workspace: <span className="font-semibold text-[var(--text-secondary)]">{workspace?.name ?? '…'}</span>
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-[var(--border-default)] rounded-lg p-1 w-fit">
        <Tab id="companies" active={tab === 'companies'} label="Perusahaan" onClick={setTab} />
        <Tab id="activity" active={tab === 'activity'} label="Log Aktivitas" onClick={setTab} />
      </div>

      {tab === 'companies' && (
        <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-red-100 bg-red-50/60 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600" />
            <h2 className="text-[13px] font-semibold text-red-700 uppercase tracking-wider">
              Danger Zone — Kelola Data Perusahaan
            </h2>
          </div>
          <div className="p-5">
            <p className="text-[13px] text-[var(--text-secondary)] mb-4 leading-relaxed">
              <span className="font-semibold text-amber-700">Peringatan:</span> Hapus permanen
              menghapus semua karyawan, variasi, dan riwayat payroll. Tidak dapat dibatalkan.
            </p>
            {loadingData ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-14 bg-[var(--bg-subtle)] rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : companies.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Belum ada perusahaan.</p>
            ) : (
              <ul className="space-y-2">
                {companies.map((co) => (
                  <li
                    key={co.id}
                    className="bg-white border border-[var(--border-default)] rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <Building2 size={15} className="text-[var(--text-muted)]" />
                        <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                          {co.name}
                        </span>
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${
                            co.aktif
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              : 'bg-slate-100 text-slate-600 ring-slate-200'
                          }`}
                        >
                          {co.aktif ? 'Aktif' : 'Arsip'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleArchive(co.id, co.aktif)}
                          disabled={deleting === co.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Archive size={13} />
                          {co.aktif ? 'Arsipkan' : 'Restore'}
                        </button>
                        <button
                          onClick={() => {
                            setConfirmId(co.id);
                            setConfirmText('');
                          }}
                          disabled={deleting === co.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 text-red-700 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 size={13} />
                          Hapus
                        </button>
                      </div>
                    </div>
                    {confirmId === co.id && (
                      <div className="mt-3 pt-3 border-t border-red-100 animate-fade-in">
                        <p className="text-[12px] text-red-700 mb-2">
                          Ketik <span className="font-semibold">{co.name}</span> untuk
                          konfirmasi:
                        </p>
                        <div className="flex gap-2 flex-col sm:flex-row">
                          <input
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder={co.name}
                            className="flex-1 px-3 py-2 bg-white border border-red-200 rounded-lg text-sm text-[var(--text-primary)] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 font-mono"
                          />
                          <button
                            onClick={() => handleHardDelete(co.id)}
                            disabled={deleting === co.id || confirmText !== co.name}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold disabled:opacity-30 transition-colors cursor-pointer"
                          >
                            {deleting === co.id ? 'Menghapus…' : 'Konfirmasi'}
                          </button>
                          <button
                            onClick={() => {
                              setConfirmId(null);
                              setConfirmText('');
                            }}
                            className="px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === 'activity' && (
        <div className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
              Log Aktivitas Workspace
            </h2>
          </div>

          {loadingData ? (
            <div className="p-5 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-12 bg-[var(--bg-subtle)] rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">
              Belum ada aktivitas tercatat.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {activity.map((a) => {
                const meta = ACTION_LABELS[a.action] ?? {
                  label: a.action,
                  tone: 'text-[var(--text-secondary)]',
                };
                const time = new Date(a.created_at);
                return (
                  <li key={a.id} className="px-5 py-3 hover:bg-[var(--bg-subtle)] transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${meta.tone}`}>
                          {meta.label}
                          {a.entity_name && (
                            <span className="text-[var(--text-primary)] font-normal ml-1">
                              {a.entity_name}
                            </span>
                          )}
                        </p>
                        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                          oleh{' '}
                          <span className="font-mono">{a.user_email ?? '—'}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-mono text-[var(--text-secondary)]">
                          {time.toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                        <p className="text-[11px] font-mono text-[var(--text-muted)]">
                          {time.toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
