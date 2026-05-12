'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { approveUser, rejectUser, suspendUser } from '@/lib/actions/admin';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, PauseCircle, Users, Building2, Activity } from 'lucide-react';
import type { UserProfile } from '@/lib/types/roles';

const STATUS_COLORS: Record<string, string> = {
  pending_approval: '#FBB040',
  approved:         '#4ADE80',
  rejected:         '#EF4444',
  suspended:        '#71717A',
};

const ROLE_COLORS: Record<string, string> = {
  dev:        '#EF4444',
  accountant: '#3B82F6',
  staff:      '#4ADE80',
};

export default function AdminPanel() {
  const [users, setUsers]       = useState<UserProfile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<'pending'|'all'|'system'>('pending');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvingId, setApprovingId]   = useState<string | null>(null);
  const [approveRole, setApproveRole]   = useState<'accountant'|'staff'>('accountant');
  const [stats, setStats]       = useState({ users: 0, workspaces: 0, companies: 0, employees: 0 });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const supabase = createClient();
    const [{ data: u }, ws, cos, emps] = await Promise.all([
      supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('workspaces').select('*', { count: 'exact', head: true }),
      supabase.from('companies').select('*', { count: 'exact', head: true }),
      supabase.from('employees').select('*', { count: 'exact', head: true }),
    ]);
    if (u) setUsers(u as UserProfile[]);
    setStats({ users: u?.length ?? 0, workspaces: ws.count ?? 0, companies: cos.count ?? 0, employees: emps.count ?? 0 });
    setLoading(false);
  }

  async function handleApprove() {
    if (!approvingId) return;
    const res = await approveUser(approvingId, approveRole);
    if (res.error) toast.error(res.error);
    else { toast.success('Pengguna disetujui'); setApprovingId(null); await fetchData(); }
  }

  async function handleReject() {
    if (!rejectId || !rejectReason) return;
    const res = await rejectUser(rejectId, rejectReason);
    if (res.error) toast.error(res.error);
    else { toast.success('Pengguna ditolak'); setRejectId(null); setRejectReason(''); await fetchData(); }
  }

  async function handleSuspend(id: string) {
    if (!confirm('Tangguhkan akun ini?')) return;
    const res = await suspendUser(id);
    if (res.error) toast.error(res.error);
    else { toast.success('Akun ditangguhkan'); await fetchData(); }
  }

  const pendingUsers  = users.filter(u => u.status === 'pending_approval');
  const displayUsers  = tab === 'pending' ? pendingUsers : users;

  return (
    <div className="max-w-5xl space-y-6 animate-fade-in-up">

      {/* Header */}
      <div className="border-b pb-5" style={{ borderColor: 'var(--border-default)' }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-red-400 font-mono">
            Dev Panel — Restricted
          </p>
        </div>
        <h1 className="text-3xl font-black font-mono" style={{ color: 'var(--text-primary)' }}>
          Admin Console
        </h1>
      </div>

      {/* System stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Users',     value: stats.users,      icon: Users,     color: '#3B82F6' },
          { label: 'Workspaces',      value: stats.workspaces, icon: Activity,  color: '#4ADE80' },
          { label: 'Perusahaan',      value: stats.companies,  icon: Building2, color: '#FBB040' },
          { label: 'Karyawan',        value: stats.employees,  icon: Users,     color: '#A78BFA' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-3xl font-black font-mono" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pending alert */}
      {pendingUsers.length > 0 && (
        <div className="rounded-xl px-5 py-4 flex items-center gap-4 animate-fade-in"
          style={{ background: 'rgba(251,176,64,0.06)', border: '1px solid rgba(251,176,64,0.2)' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(251,176,64,0.15)' }}>
            <span className="text-xl">⏳</span>
          </div>
          <div>
            <p className="font-bold text-[15px]" style={{ color: '#FBB040' }}>
              {pendingUsers.length} Pengguna Menunggu Persetujuan
            </p>
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              Tinjau dan setujui atau tolak akun di bawah.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'pending', label: `Pending (${pendingUsers.length})` },
          { key: 'all',     label: 'Semua Pengguna' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
            style={{
              background: tab === t.key ? '#1A2744' : 'transparent',
              color:      tab === t.key ? '#3B82F6' : 'var(--text-muted)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* User list */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--bg-card)' }} />)}
        </div>
      ) : displayUsers.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>
            {tab === 'pending' ? 'Tidak ada pengguna yang menunggu persetujuan.' : 'Belum ada pengguna.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayUsers.map((u, i) => (
            <div key={u.id}
              className="rounded-xl p-5 animate-fade-in-up"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', animationDelay: `${i * 0.04}s`, opacity: 0 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-[15px] shrink-0"
                    style={{ background: 'var(--bg-deep)', color: 'var(--text-secondary)' }}>
                    {u.email[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[15px] truncate" style={{ color: 'var(--text-primary)' }}>
                      {u.full_name || u.email}
                    </p>
                    <p className="text-[12px] font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                      {u.email}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest"
                        style={{ background: `${STATUS_COLORS[u.status]}18`, color: STATUS_COLORS[u.status] }}>
                        {u.status.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest"
                        style={{ background: `${ROLE_COLORS[u.role]}18`, color: ROLE_COLORS[u.role] }}>
                        {u.role}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--text-ghost)' }}>
                        {new Date(u.created_at).toLocaleDateString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0 ml-4">
                  {u.status === 'pending_approval' && (
                    <>
                      <button onClick={() => setApprovingId(u.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold transition-colors"
                        style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ADE80' }}>
                        <CheckCircle2 size={13} />Setujui
                      </button>
                      <button onClick={() => setRejectId(u.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold transition-colors"
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>
                        <XCircle size={13} />Tolak
                      </button>
                    </>
                  )}
                  {u.status === 'approved' && u.role !== 'dev' && (
                    <button onClick={() => handleSuspend(u.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold transition-colors"
                      style={{ background: 'rgba(113,113,122,0.1)', border: '1px solid rgba(113,113,122,0.3)', color: '#71717A' }}>
                      <PauseCircle size={13} />Tangguhkan
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve modal */}
      {approvingId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setApprovingId(null); }}>
          <div className="rounded-2xl overflow-hidden w-full max-w-sm"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
              <p className="font-black text-[17px]" style={{ color: 'var(--text-primary)' }}>
                Setujui Pengguna
              </p>
              <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {users.find(u => u.id === approvingId)?.email}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                  Assign Role
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(['accountant', 'staff'] as const).map(r => (
                    <button key={r} onClick={() => setApproveRole(r)}
                      className="p-3 rounded-xl text-left transition-all"
                      style={{
                        background: approveRole === r ? 'rgba(37,99,235,0.08)' : 'var(--bg-input)',
                        border:     `1px solid ${approveRole === r ? 'rgba(37,99,235,0.4)' : 'var(--border-default)'}`,
                      }}>
                      <p className="font-bold text-[13px]" style={{ color: 'var(--text-primary)' }}>
                        {r === 'accountant' ? 'Akuntan' : 'Staff'}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {r === 'accountant' ? 'Akses penuh workspace' : 'Akses perusahaan terbatas'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2" style={{ borderTop: '1px solid var(--border-default)' }}>
                <button onClick={() => setApprovingId(null)}
                  className="px-4 py-2.5 rounded-xl text-[13px] font-semibold"
                  style={{ color: 'var(--text-muted)' }}>
                  Batal
                </button>
                <button onClick={handleApprove}
                  className="flex-1 py-2.5 rounded-xl font-bold text-[14px] text-white transition-colors"
                  style={{ background: '#2563EB' }}>
                  Setujui sebagai {approveRole === 'accountant' ? 'Akuntan' : 'Staff'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setRejectId(null); }}>
          <div className="rounded-2xl overflow-hidden w-full max-w-sm"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border-default)' }}>
              <p className="font-black text-[17px]" style={{ color: '#EF4444' }}>Tolak Pengguna</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-muted)' }}>
                  Alasan Penolakan
                </label>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  rows={3} placeholder="Jelaskan alasan penolakan..."
                  className="w-full px-4 py-3 rounded-xl resize-none outline-none text-[13px]"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRejectId(null)}
                  className="px-4 py-2.5 rounded-xl text-[13px]"
                  style={{ color: 'var(--text-muted)' }}>
                  Batal
                </button>
                <button onClick={handleReject} disabled={!rejectReason}
                  className="flex-1 py-2.5 rounded-xl font-bold text-[14px] text-white disabled:opacity-50"
                  style={{ background: '#EF4444' }}>
                  Tolak Akun
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
