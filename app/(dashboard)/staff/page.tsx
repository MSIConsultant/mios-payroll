'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  grantCompanyAccess, revokeCompanyAccess, removeStaffFromWorkspace,
  inviteStaffMagicLink,
} from '@/lib/actions/staff';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import {
  Users, Building2, Plus, Mail, Trash2, ChevronDown, ChevronRight, Check, Loader2,
} from 'lucide-react';

interface StaffMember {
  user_id: string;
  user_email: string;
  role: string;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
  kota: string | null;
}

interface AccessMap {
  [staffId: string]: Set<string>;
}

export default function StaffPage() {
  const { workspace } = useWorkspace();
  const confirm = useConfirm();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [accessMap, setAccessMap] = useState<AccessMap>({});
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (workspace?.id) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  async function fetchData() {
    if (!workspace?.id) return;
    setLoading(true);
    const supabase = createClient();
    const [{ data: members }, { data: cos }, { data: access }] = await Promise.all([
      supabase
        .from('workspace_members')
        .select('user_id, user_email, role, created_at')
        .eq('workspace_id', workspace.id)
        .neq('role', 'owner'),
      supabase
        .from('companies')
        .select('id, name, kota')
        .eq('workspace_id', workspace.id)
        .eq('aktif', true)
        .order('name'),
      supabase
        .from('company_staff_access')
        .select('staff_user_id, company_id')
        .eq('workspace_id', workspace.id),
    ]);

    setStaff((members ?? []) as StaffMember[]);
    setCompanies((cos ?? []) as Company[]);

    const map: AccessMap = {};
    for (const a of access ?? []) {
      if (!map[a.staff_user_id]) map[a.staff_user_id] = new Set();
      map[a.staff_user_id].add(a.company_id);
    }
    setAccessMap(map);
    setLoading(false);
  }

  async function handleInvite() {
    if (!inviteEmail || !workspace?.id) return;
    setInviting(true);
    const res = await inviteStaffMagicLink(workspace.id, inviteEmail);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(`Magic link dikirim ke ${inviteEmail} — langsung aktif tanpa persetujuan`);
      setInviteEmail('');
      await fetchData();
    }
    setInviting(false);
  }

  async function handleToggleAccess(
    staffId: string,
    companyId: string,
    companyName: string,
    hasAccess: boolean,
  ) {
    if (!workspace?.id) return;
    const key = `${staffId}-${companyId}`;
    setToggling(key);

    const res = hasAccess
      ? await revokeCompanyAccess(workspace.id, staffId, companyId, companyName)
      : await grantCompanyAccess(workspace.id, staffId, companyId, companyName);

    if (res.error) {
      toast.error(res.error);
    } else {
      setAccessMap((prev) => {
        const next = { ...prev };
        if (!next[staffId]) next[staffId] = new Set();
        else next[staffId] = new Set(next[staffId]);
        if (hasAccess) next[staffId].delete(companyId);
        else next[staffId].add(companyId);
        return next;
      });
    }
    setToggling(null);
  }

  async function handleRemoveStaff(staffId: string, staffEmail: string) {
    if (!workspace?.id) return;
    if (!(await confirm({
      title: 'Hapus staff?',
      message: `${staffEmail} akan kehilangan akses ke seluruh perusahaan di workspace ini.`,
      severity: 'danger',
      confirmLabel: 'Hapus',
    }))) return;
    const res = await removeStaffFromWorkspace(workspace.id, staffId, staffEmail);
    if (res.error) toast.error(res.error);
    else {
      toast.success('Staff dihapus');
      setStaff((s) => s.filter((m) => m.user_id !== staffId));
    }
  }

  function toggleExpand(staffId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(staffId)) next.delete(staffId);
      else next.add(staffId);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 bg-white border border-[var(--border-default)] rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-7 animate-fade-in-up">
      <header className="pb-5 border-b border-[var(--border-default)]">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Manajemen Staff
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Undang staff dan atur akses perusahaan per anggota.
        </p>
      </header>

      {/* Invite card */}
      <section className="bg-white border border-[var(--border-default)] rounded-xl p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center">
            <Mail size={16} />
          </div>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
            Undang Staff Baru
          </h2>
        </div>
        <div className="flex gap-2 flex-col sm:flex-row">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            placeholder="email@staff.com"
            className="flex-1 px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all"
          />
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors shadow-sm cursor-pointer"
          >
            {inviting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {inviting ? 'Mengirim…' : 'Undang'}
          </button>
        </div>
        <p className="text-[12px] text-[var(--text-muted)] mt-3">
          Staff akan langsung aktif dan mendapat email magic link untuk masuk. Tidak perlu daftar atau tunggu persetujuan.
        </p>
      </section>

      {/* Staff list */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users size={15} className="text-[var(--text-muted)]" />
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Anggota Staff ({staff.length})
          </h2>
        </div>

        {staff.length === 0 ? (
          <div className="bg-white border border-dashed border-[var(--border-default)] rounded-xl py-12 text-center">
            <Users size={28} className="mx-auto text-[var(--text-faint)]" />
            <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">
              Belum ada staff
            </p>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">
              Undang anggota tim menggunakan form di atas.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {staff.map((member, i) => {
              const isExpanded = expanded.has(member.user_id);
              const memberAccess = accessMap[member.user_id] ?? new Set();
              const accessCount = memberAccess.size;
              const initial = member.user_email[0].toUpperCase();

              return (
                <li
                  key={member.user_id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(i, 8) * 0.04}s`, opacity: 0 }}
                >
                  <div className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
                    <div className="px-4 sm:px-5 py-4 flex items-center gap-4">
                      <div className="shrink-0 w-10 h-10 rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] flex items-center justify-center font-bold text-[15px]">
                        {initial}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px] text-[var(--text-primary)] truncate">
                          {member.user_email}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-200">
                            {member.role}
                          </span>
                          <span className="text-[12px] text-[var(--text-muted)]">
                            {accessCount === 0
                              ? 'Belum ada akses perusahaan'
                              : `${accessCount} dari ${companies.length} perusahaan`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleExpand(member.user_id)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                        >
                          <Building2 size={14} />
                          <span className="hidden sm:inline">Akses</span>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <button
                          onClick={() => handleRemoveStaff(member.user_id, member.user_email)}
                          className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Hapus dari workspace"
                          aria-label="Hapus staff"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-[var(--border-subtle)] px-4 sm:px-5 py-4 bg-[var(--bg-subtle)]">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                          Akses Perusahaan
                        </p>
                        {companies.length === 0 ? (
                          <p className="text-[13px] text-[var(--text-muted)]">
                            Belum ada perusahaan aktif.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {companies.map((co) => {
                              const hasAccess = memberAccess.has(co.id);
                              const key = `${member.user_id}-${co.id}`;
                              const busy = toggling === key;

                              return (
                                <button
                                  key={co.id}
                                  onClick={() =>
                                    handleToggleAccess(member.user_id, co.id, co.name, hasAccess)
                                  }
                                  disabled={busy}
                                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left transition-all disabled:opacity-60 cursor-pointer ${
                                    hasAccess
                                      ? 'bg-[var(--brand-soft)] border border-blue-200'
                                      : 'bg-white border border-[var(--border-default)] hover:border-[var(--border-strong)]'
                                  }`}
                                >
                                  <div
                                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all ${
                                      hasAccess
                                        ? 'bg-[var(--brand)] text-white'
                                        : 'bg-white border border-[var(--border-strong)]'
                                    }`}
                                  >
                                    {hasAccess && <Check size={13} />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={`font-semibold text-[14px] truncate ${
                                        hasAccess
                                          ? 'text-[var(--text-primary)]'
                                          : 'text-[var(--text-secondary)]'
                                      }`}
                                    >
                                      {co.name}
                                    </p>
                                    {co.kota && (
                                      <p className="text-[12px] text-[var(--text-muted)]">
                                        {co.kota}
                                      </p>
                                    )}
                                  </div>
                                  {busy && (
                                    <Loader2 size={14} className="animate-spin text-[var(--brand)]" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {companies.length > 0 && (
                          <div className="flex gap-3 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                            <button
                              onClick={async () => {
                                for (const co of companies) {
                                  if (!memberAccess.has(co.id))
                                    await handleToggleAccess(member.user_id, co.id, co.name, false);
                                }
                              }}
                              className="text-[12px] font-semibold text-[var(--brand)] hover:underline cursor-pointer"
                            >
                              Berikan semua akses
                            </button>
                            <span className="text-[var(--text-faint)]">·</span>
                            <button
                              onClick={async () => {
                                for (const co of companies) {
                                  if (memberAccess.has(co.id))
                                    await handleToggleAccess(member.user_id, co.id, co.name, true);
                                }
                              }}
                              className="text-[12px] font-semibold text-[var(--text-muted)] hover:text-red-600 cursor-pointer"
                            >
                              Cabut semua akses
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
