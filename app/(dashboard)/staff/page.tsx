'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/lib/hooks/useWorkspace';
import { grantCompanyAccess, revokeCompanyAccess, removeStaffFromWorkspace } from '@/lib/actions/staff';
import { sendInvite } from '@/lib/actions/workspace';
import { toast } from 'sonner';
import { Users, Building2, Plus, X, Mail, Shield, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

interface StaffMember {
  user_id:    string;
  user_email: string;
  role:       string;
  created_at: string;
}

interface Company {
  id:   string;
  name: string;
  kota: string | null;
}

interface AccessMap {
  [staffId: string]: Set<string>;
}

export default function StaffPage() {
  const { workspace } = useWorkspace();
  const [staff, setStaff]         = useState<StaffMember[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [accessMap, setAccessMap] = useState<AccessMap>({});
  const [loading, setLoading]     = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting]   = useState(false);
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [toggling, setToggling]   = useState<string | null>(null);

  useEffect(() => {
    if (workspace?.id) fetchData();
  }, [workspace?.id]);

  async function fetchData() {
    if (!workspace?.id) return;
    setLoading(true);
    const supabase = createClient();
    const [{ data: members }, { data: cos }, { data: access }] = await Promise.all([
      supabase.from('workspace_members')
        .select('user_id, user_email, role, created_at')
        .eq('workspace_id', workspace.id).neq('role', 'owner'),
      supabase.from('companies')
        .select('id, name, kota')
        .eq('workspace_id', workspace.id).eq('aktif', true).order('name'),
      supabase.from('company_staff_access')
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
    const res = await sendInvite(workspace.id, inviteEmail);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(`Undangan dikirim ke ${inviteEmail}`);
      setInviteEmail('');
    }
    setInviting(false);
  }

  async function handleToggleAccess(
    staffId: string, companyId: string, companyName: string, hasAccess: boolean
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
      setAccessMap(prev => {
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
    if (!confirm(`Hapus ${staffEmail} dari workspace?`)) return;
    const res = await removeStaffFromWorkspace(workspace.id, staffId, staffEmail);
    if (res.error) toast.error(res.error);
    else {
      toast.success('Staff dihapus');
      setStaff(s => s.filter(m => m.user_id !== staffId));
    }
  }

  function toggleExpand(staffId: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(staffId)) next.delete(staffId); else next.add(staffId);
      return next;
    });
  }

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => (
        <div key={i} className="h-20 rounded-xl animate-pulse"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }} />
      ))}
    </div>
  );

  return (
    <div className="max-w-4xl space-y-8 animate-fade-in-up">

      {/* Header */}
      <div className="border-b pb-6" style={{ borderColor: 'var(--border-default)' }}>
        <h1 className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>
          Manajemen Staff
        </h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Undang staff dan atur akses perusahaan per anggota.
        </p>
      </div>

      {/* Invite */}
      <div className="rounded-2xl p-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)' }}>
            <Mail size={14} className="text-[#3B82F6]" />
          </div>
          <p className="font-bold text-[16px]" style={{ color: 'var(--text-primary)' }}>
            Undang Staff Baru
          </p>
        </div>
        <div className="flex gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleInvite()}
            placeholder="email@staff.com"
            className="flex-1 px-4 py-3 rounded-xl text-[14px] outline-none transition-colors"
            style={{
              background: 'var(--bg-input)',
              border:     '1px solid var(--border-default)',
              color:      'var(--text-primary)',
            }} />
          <button onClick={handleInvite} disabled={inviting || !inviteEmail}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[14px] text-white disabled:opacity-50 transition-colors"
            style={{ background: '#2563EB' }}>
            <Plus size={15} />
            {inviting ? 'Mengirim...' : 'Undang'}
          </button>
        </div>
        <p className="text-[12px] mt-3 font-mono" style={{ color: 'var(--text-ghost)' }}>
          Staff yang diundang perlu mendaftar dan mendapat persetujuan sebelum dapat login.
        </p>
      </div>

      {/* Staff list */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Users size={15} style={{ color: 'var(--text-muted)' }} />
          <p className="text-[12px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)' }}>
            Anggota Staff ({staff.length})
          </p>
        </div>

        {staff.length === 0 ? (
          <div className="rounded-2xl p-12 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <Users size={32} className="mx-auto mb-4" style={{ color: 'var(--text-ghost)' }} />
            <p className="text-[15px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
              Belum ada staff
            </p>
            <p className="text-[13px]" style={{ color: 'var(--text-ghost)' }}>
              Undang anggota tim menggunakan form di atas.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {staff.map((member, i) => {
              const isExpanded    = expanded.has(member.user_id);
              const memberAccess  = accessMap[member.user_id] ?? new Set();
              const accessCount   = memberAccess.size;

              return (
                <div key={member.user_id}
                  className="rounded-2xl overflow-hidden animate-fade-in-up"
                  style={{
                    background:        'var(--bg-card)',
                    border:            '1px solid var(--border-default)',
                    animationDelay:    `${i * 0.05}s`,
                    opacity:           0,
                  }}>

                  {/* Staff header row */}
                  <div className="px-5 py-4 flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-[15px] shrink-0"
                      style={{ background: 'var(--bg-deep)', color: 'var(--text-secondary)' }}>
                      {member.user_email[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[15px] truncate" style={{ color: 'var(--text-primary)' }}>
                        {member.user_email}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest"
                          style={{ background: 'rgba(34,197,94,0.1)', color: '#4ADE80' }}>
                          {member.role}
                        </span>
                        <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                          {accessCount === 0
                            ? 'Belum ada akses perusahaan'
                            : `${accessCount} dari ${companies.length} perusahaan`}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleExpand(member.user_id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold transition-colors"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                        <Building2 size={12} />
                        Atur Akses
                        {isExpanded
                          ? <ChevronDown size={11} />
                          : <ChevronRight size={11} />}
                      </button>
                      <button
                        onClick={() => handleRemoveStaff(member.user_id, member.user_email)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: 'var(--text-ghost)', border: '1px solid transparent' }}
                        title="Hapus dari workspace">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Company access matrix */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--border-default)', padding: '12px 20px 16px' }}>
                      <p className="text-[11px] font-bold uppercase tracking-widest mb-3"
                        style={{ color: 'var(--text-ghost)' }}>
                        Akses Perusahaan
                      </p>
                      {companies.length === 0 ? (
                        <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                          Belum ada perusahaan aktif.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {companies.map(co => {
                            const hasAccess = memberAccess.has(co.id);
                            const key       = `${member.user_id}-${co.id}`;
                            const busy      = toggling === key;

                            return (
                              <button
                                key={co.id}
                                onClick={() => handleToggleAccess(member.user_id, co.id, co.name, hasAccess)}
                                disabled={busy}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all disabled:opacity-60"
                                style={{
                                  background: hasAccess ? 'rgba(37,99,235,0.07)' : 'var(--bg-input)',
                                  border:     `1px solid ${hasAccess ? 'rgba(37,99,235,0.3)' : 'var(--border-default)'}`,
                                }}>
                                <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all"
                                  style={{
                                    background: hasAccess ? '#2563EB' : 'var(--border-strong)',
                                    border:     `1px solid ${hasAccess ? '#2563EB' : 'var(--border-strong)'}`,
                                  }}>
                                  {hasAccess && (
                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-[13px] truncate"
                                    style={{ color: hasAccess ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                    {co.name}
                                  </p>
                                  {co.kota && (
                                    <p className="text-[11px]" style={{ color: 'var(--text-ghost)' }}>
                                      {co.kota}
                                    </p>
                                  )}
                                </div>
                                {busy && (
                                  <div className="ml-auto w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Quick: grant all / revoke all */}
                      {companies.length > 0 && (
                        <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <button
                            onClick={async () => {
                              for (const co of companies) {
                                if (!memberAccess.has(co.id))
                                  await handleToggleAccess(member.user_id, co.id, co.name, false);
                              }
                            }}
                            className="text-[12px] font-semibold transition-colors"
                            style={{ color: '#3B82F6' }}>
                            Berikan semua akses
                          </button>
                          <span style={{ color: 'var(--text-ghost)' }}>·</span>
                          <button
                            onClick={async () => {
                              for (const co of companies) {
                                if (memberAccess.has(co.id))
                                  await handleToggleAccess(member.user_id, co.id, co.name, true);
                              }
                            }}
                            className="text-[12px] font-semibold transition-colors"
                            style={{ color: 'var(--text-ghost)' }}>
                            Cabut semua akses
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
