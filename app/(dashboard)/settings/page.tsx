'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { archiveCompany, deleteCompany } from '@/lib/actions/companies';
import { sendInvite, removeMember, revokeInvite, getWorkspaceActivity } from '@/lib/actions/workspace';
import { Trash2, Archive, AlertTriangle, Building2, UserPlus, UserX, Copy, Check, Clock, Activity } from 'lucide-react';

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  WORKSPACE_CREATED:  { label: 'Workspace dibuat',       color: 'text-[#2563EB]' },
  MEMBER_INVITED:     { label: 'Undangan dikirim ke',    color: 'text-sky-400' },
  MEMBER_JOINED:      { label: 'Bergabung ke workspace', color: 'text-green-400' },
  MEMBER_REMOVED:     { label: 'Anggota dihapus',        color: 'text-red-400' },
  INVITE_REVOKED:     { label: 'Undangan dicabut untuk', color: 'text-zinc-500' },
  COMPANY_CREATED:    { label: 'Perusahaan dibuat',      color: 'text-emerald-400' },
  COMPANY_ARCHIVED:   { label: 'Perusahaan diarsipkan',  color: 'text-amber-400' },
  COMPANY_DELETED:    { label: 'Perusahaan dihapus',     color: 'text-red-500' },
};

function Tab({ id, active, label, onClick }: any) {
  return (
    <button onClick={() => onClick(id)}
      className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-all ${
        active ? 'bg-[#1A1A1C] text-zinc-100' : 'text-zinc-600 hover:text-zinc-400'
      }`}>{label}</button>
  );
}

export default function SettingsPage() {
  const { workspace, workspaces, switchWorkspace } = useWorkspace();
  const [tab, setTab] = useState<'members'|'companies'|'activity'>('members');

  // Members state
  const [members, setMembers]       = useState<any[]>([]);
  const [invites, setInvites]       = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied]         = useState(false);
  const [inviting, setInviting]     = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Companies state
  const [companies, setCompanies]   = useState<any[]>([]);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [confirmId, setConfirmId]   = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  // Activity state
  const [activity, setActivity]     = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!workspace) return;
    setLoadingData(true);
    const supabase = createClient();

    const [{ data: mems }, { data: invs }, { data: cos }] = await Promise.all([
      supabase.from('workspace_members').select('*, user:user_id(email)').eq('workspace_id', workspace.id),
      supabase.from('workspace_invitations').select('*').eq('workspace_id', workspace.id).is('accepted_at', null).gt('expires_at', new Date().toISOString()),
      supabase.from('companies').select('id, name, aktif').eq('workspace_id', workspace.id).order('name'),
    ]);

    if (mems) setMembers(mems);
    if (invs) setInvites(invs);
    if (cos) setCompanies(cos);

    const acts = await getWorkspaceActivity(workspace.id);
    setActivity(acts);
    setLoadingData(false);
  }, [workspace]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleInvite() {
    if (!workspace || !inviteEmail) return;
    setInviting(true); setInviteError(''); setInviteLink('');
    const res = await sendInvite(workspace.id, inviteEmail);
    if (res.error) { setInviteError(res.error); }
    else {
      setInviteLink(res.inviteUrl!);
      setInviteEmail('');
      await fetchAll();
    }
    setInviting(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRemoveMember(userId: string, email: string) {
    if (!workspace) return;
    if (!confirm(`Hapus ${email} dari workspace?`)) return;
    const res = await removeMember(workspace.id, userId, email);
    if (res.error) alert(res.error);
    else await fetchAll();
  }

  async function handleRevokeInvite(id: string, email: string) {
    if (!workspace) return;
    const res = await revokeInvite(id, workspace.id, email);
    if (res.error) alert(res.error);
    else await fetchAll();
  }

  async function handleArchive(id: string, aktif: boolean) {
    setDeleting(id);
    const res = await archiveCompany(id, !aktif);
    if (res.error) alert(res.error);
    else { setCompanies(c => c.map(x => x.id === id ? { ...x, aktif: !aktif } : x)); }
    setDeleting(null);
  }

  async function handleHardDelete(id: string) {
    const co = companies.find(c => c.id === id);
    if (confirmText !== co?.name) { alert('Nama tidak cocok.'); return; }
    setDeleting(id);
    const res = await deleteCompany(id);
    if (res.error) { alert(res.error); }
    else { setCompanies(c => c.filter(x => x.id !== id)); setConfirmId(null); setConfirmText(''); }
    setDeleting(null);
  }

  const isOwner = workspace && workspaces.find(w => w.id === workspace.id);

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Pengaturan</h1>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-[11px] text-zinc-600 font-mono">Workspace aktif:</p>
          <select value={workspace?.id ?? ''}
            onChange={e => switchWorkspace(e.target.value)}
            className="bg-[#111113] border border-[#1A1A1C] text-zinc-300 text-[11px] rounded px-2 py-1 outline-none focus:border-[#2563EB]/40 font-mono">
            {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-[#111113] border border-[#1A1A1C] rounded-lg p-1 w-fit">
        <Tab id="members"  active={tab === 'members'}  label="Anggota & Undangan" onClick={setTab} />
        <Tab id="companies" active={tab === 'companies'} label="Kelola Data" onClick={setTab} />
        <Tab id="activity" active={tab === 'activity'} label="Log Aktivitas" onClick={setTab} />
      </div>

      {/* MEMBERS TAB */}
      {tab === 'members' && (
        <div className="space-y-4">
          {/* Invite form */}
          <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus size={13} className="text-[#2563EB]" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Undang Anggota</p>
            </div>
            <div className="flex gap-2">
              <input type="email" value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="email@akuntan.com"
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
                className="flex-1 px-3 py-2 bg-[#0D0D0F] border border-[#1A1A1C] rounded-lg text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-[#2563EB]/40 transition-colors font-mono" />
              <button onClick={handleInvite} disabled={inviting || !inviteEmail}
                className="px-4 py-2 bg-[#2563EB] text-[#0A0A0B] rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors">
                {inviting ? '...' : 'Kirim'}
              </button>
            </div>
            {inviteError && <p className="text-[11px] text-red-400 mt-2 font-mono"><span className="text-red-600">ERR </span>{inviteError}</p>}

            {/* Invite link */}
            {inviteLink && (
              <div className="mt-4 animate-fade-in">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">Link undangan (salin & kirim via WhatsApp/Email)</p>
                <div className="flex gap-2">
                  <div className="flex-1 px-3 py-2 bg-[#0D0D0F] border border-[#2563EB]/20 rounded-lg text-[11px] text-zinc-500 font-mono truncate">
                    {inviteLink}
                  </div>
                  <button onClick={handleCopy}
                    className="px-3 py-2 bg-[#2563EB]/10 border border-[#2563EB]/30 text-[#2563EB] rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-[#2563EB]/20 transition-colors flex items-center gap-1.5">
                    {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-700 mt-2">Link berlaku 7 hari. Penerima harus login/daftar dengan email yang sama.</p>
              </div>
            )}
          </div>

          {/* Current members */}
          <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1A1A1C]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Anggota Aktif ({members.length})</p>
            </div>
            <div className="divide-y divide-[#131315]">
              {members.map(m => {
                const email = (m.user as any)?.email ?? '—';
                const isOwnerMember = m.role === 'owner';
                return (
                  <div key={m.id} className="px-5 py-3 flex items-center justify-between font-mono">
                    <div>
                      <p className="text-sm text-zinc-300">{email}</p>
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                        isOwnerMember ? 'bg-[#2563EB]/10 text-[#2563EB]' : 'bg-zinc-800 text-zinc-500'
                      }`}>{m.role}</span>
                    </div>
                    {!isOwnerMember && (
                      <button onClick={() => handleRemoveMember(m.user_id, email)}
                        className="p-2 text-zinc-700 hover:text-red-400 transition-colors">
                        <UserX size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending invites */}
          {invites.length > 0 && (
            <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1A1A1C]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Undangan Pending ({invites.length})</p>
              </div>
              <div className="divide-y divide-[#131315]">
                {invites.map(inv => (
                  <div key={inv.id} className="px-5 py-3 flex items-center justify-between font-mono">
                    <div>
                      <p className="text-sm text-zinc-400">{inv.invited_email}</p>
                      <p className="text-[10px] text-zinc-700 flex items-center gap-1 mt-0.5">
                        <Clock size={9} />
                        Berakhir {new Date(inv.expires_at).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                    <button onClick={() => handleRevokeInvite(inv.id, inv.invited_email)}
                      className="text-[10px] text-zinc-700 hover:text-red-400 transition-colors uppercase tracking-widest font-bold">
                      Cabut
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* COMPANIES TAB */}
      {tab === 'companies' && (
        <div className="bg-[#0F0A0A] border border-red-900/30 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-red-900/20 flex items-center gap-2">
            <AlertTriangle size={13} className="text-red-500" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-500">Danger Zone — Kelola Data Perusahaan</p>
          </div>
          <div className="p-5">
            <p className="text-xs text-zinc-600 mb-4 font-mono leading-relaxed">
              <span className="text-amber-400">PERINGATAN:</span> Hapus permanen menghapus semua karyawan, variasi, dan riwayat payroll. Tidak dapat dibatalkan.
            </p>
            {loadingData ? (
              <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-14 bg-[#111113] rounded animate-pulse" />)}</div>
            ) : companies.length === 0 ? (
              <p className="text-xs text-zinc-700 font-mono">$ Belum ada perusahaan.</p>
            ) : (
              <div className="space-y-2">
                {companies.map(co => (
                  <div key={co.id} className="bg-[#111113] border border-[#1A1A1C] rounded-lg p-4 font-mono">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 size={13} className="text-zinc-600" />
                        <span className="text-sm text-zinc-300">{co.name}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-widest font-bold ${
                          co.aktif ? 'bg-green-900/25 text-green-400' : 'bg-zinc-800 text-zinc-600'
                        }`}>{co.aktif ? 'aktif' : 'arsip'}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleArchive(co.id, co.aktif)} disabled={deleting === co.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0D0D0F] border border-[#1A1A1C] text-zinc-500 hover:text-zinc-200 rounded text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50">
                          <Archive size={10} />{co.aktif ? 'Archive' : 'Restore'}
                        </button>
                        <button onClick={() => { setConfirmId(co.id); setConfirmText(''); }} disabled={deleting === co.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0D0D0F] border border-red-900/40 text-red-500/60 hover:text-red-400 rounded text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50">
                          <Trash2 size={10} />Hapus
                        </button>
                      </div>
                    </div>
                    {confirmId === co.id && (
                      <div className="mt-3 pt-3 border-t border-red-900/20 animate-fade-in">
                        <p className="text-[10px] text-red-400 mb-2">Ketik <span className="font-bold text-red-300">{co.name}</span> untuk konfirmasi:</p>
                        <div className="flex gap-2">
                          <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
                            placeholder={co.name}
                            className="flex-1 px-3 py-2 bg-[#0D0D0F] border border-red-900/30 rounded text-xs text-zinc-200 placeholder:text-zinc-800 outline-none focus:border-red-700/50 font-mono" />
                          <button onClick={() => handleHardDelete(co.id)}
                            disabled={deleting === co.id || confirmText !== co.name}
                            className="px-4 py-2 bg-red-900/30 border border-red-800/40 text-red-400 rounded text-[10px] font-bold uppercase tracking-widest disabled:opacity-30 transition-colors">
                            {deleting === co.id ? '...' : 'Konfirmasi'}
                          </button>
                          <button onClick={() => { setConfirmId(null); setConfirmText(''); }}
                            className="px-3 py-2 bg-[#0D0D0F] border border-[#1A1A1C] text-zinc-600 hover:text-zinc-400 rounded text-[10px] font-bold uppercase tracking-widest transition-colors">
                            Batal
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACTIVITY TAB */}
      {tab === 'activity' && (
        <div className="bg-[#080809] border border-[#1A1A1C] rounded-lg overflow-hidden font-mono">
          <div className="px-4 py-2.5 bg-[#0F0F11] border-b border-[#1A1A1C] flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500/40" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/40" />
            <div className="w-2 h-2 rounded-full bg-green-500/40" />
            <span className="ml-3 text-[10px] text-zinc-700 uppercase tracking-widest">workspace.activity.log</span>
            <span className="ml-1 text-[#2563EB] animate-blink text-xs">_</span>
          </div>

          {loadingData ? (
            <div className="p-5 space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-10 bg-[#111113] rounded animate-pulse" />)}</div>
          ) : activity.length === 0 ? (
            <div className="px-5 py-10 text-xs text-zinc-700">$ Belum ada aktivitas tercatat.</div>
          ) : (
            <div>
              {activity.map((a, i) => {
                const meta = ACTION_LABELS[a.action] ?? { label: a.action, color: 'text-zinc-500' };
                const time = new Date(a.created_at);
                return (
                  <div key={a.id}
                    className={`px-5 py-3 ${i < activity.length - 1 ? 'border-b border-[#131315]' : ''} hover:bg-[#0F0F11] transition-colors`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <span className="text-[#2563EB] text-xs mr-2">$</span>
                        <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
                        {a.entity_name && <span className="text-zinc-400 text-xs ml-1">{a.entity_name}</span>}
                        <div className="pl-4 mt-0.5">
                          <span className="text-[10px] text-zinc-700">oleh </span>
                          <span className="text-[10px] text-zinc-500">{a.user_email ?? '—'}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-zinc-700">
                          {time.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </p>
                        <p className="text-[10px] text-zinc-800">
                          {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
