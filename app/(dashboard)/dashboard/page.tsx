import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Lock, CheckCircle2, Clock, Plus, Building2, Users, Play } from 'lucide-react';

const BULAN_ID    = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const BULAN_SHORT = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

{/* Real-time status is handled via RealtimeStatus component
    Company status updates live when staff calculate/lock payroll */}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const now      = new Date();
  const bulanIni = now.getMonth() + 1;
  const tahunIni = now.getFullYear();

  const { data: membership } = await supabase
    .from('workspace_members').select('workspace_id, workspaces(id, name)')
    .eq('user_id', user.id).limit(1).single();

  const workspaceId = membership?.workspace_id;
  const ws          = membership?.workspaces;
  const wsName      = (Array.isArray(ws) ? ws[0]?.name : (ws as any)?.name) ?? '—';

  const { data: companies } = await supabase
    .from('companies').select('id, name, kota')
    .eq('workspace_id', workspaceId ?? '').eq('aktif', true);

  const companyIds = (companies ?? []).map(c => c.id);

  const { count: empCount } = companyIds.length > 0
    ? await supabase.from('employees').select('*', { count: 'exact', head: true })
        .in('company_id', companyIds).eq('aktif', true)
    : { count: 0 };

  const { data: thisMonthRuns } = companyIds.length > 0
    ? await supabase.from('payroll_runs').select('company_id, status')
        .in('company_id', companyIds).eq('tahun', tahunIni).eq('bulan', bulanIni)
    : { data: [] };

  const runMap    = Object.fromEntries((thisMonthRuns ?? []).map(r => [r.company_id, r.status]));
  const locked    = (thisMonthRuns ?? []).filter(r => r.status === 'locked').length;
  const calculated = (thisMonthRuns ?? []).filter(r => r.status === 'calculated').length;
  const pending   = (companies?.length ?? 0) - locked - calculated;

  const { data: recentRuns } = companyIds.length > 0
    ? await supabase.from('payroll_runs')
        .select('id, company_id, tahun, bulan, status, calculated_at')
        .in('company_id', companyIds)
        .order('calculated_at', { ascending: false }).limit(10)
    : { data: [] };

  const runIds = (recentRuns ?? []).map(r => r.id);
  const { data: runTotals } = runIds.length > 0
    ? await supabase.from('payroll_results').select('run_id, thp, bruto, pph').in('run_id', runIds)
    : { data: [] };

  const totalsMap: Record<string, { thp: number; bruto: number; pph: number; count: number }> = {};
  for (const r of runTotals ?? []) {
    if (!totalsMap[r.run_id]) totalsMap[r.run_id] = { thp: 0, bruto: 0, pph: 0, count: 0 };
    totalsMap[r.run_id].thp   += r.thp   ?? 0;
    totalsMap[r.run_id].bruto += r.bruto ?? 0;
    totalsMap[r.run_id].pph   += r.pph   ?? 0;
    totalsMap[r.run_id].count += 1;
  }
  const companyMap = Object.fromEntries((companies ?? []).map(c => [c.id, c]));
  const isEmpty    = (companies?.length ?? 0) === 0;

  return (
    <div className="max-w-4xl space-y-8 animate-fade-in-up">

      {/* Period header */}
      <div className="border-b border-[#1E1E22] pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-2"
          style={{ color: 'var(--text-muted)' }}>
          {wsName} · Periode Aktif
        </p>
        <div className="flex items-baseline gap-4">
          <h1 className="font-black font-mono tracking-tighter leading-none"
            style={{ fontSize: 52, color: 'var(--text-primary)' }}>
            {BULAN_ID[bulanIni].toUpperCase()}
          </h1>
          <span className="text-2xl font-bold font-mono"
            style={{ color: 'var(--text-muted)' }}>{tahunIni}</span>
        </div>

        {!isEmpty && (
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <Lock size={11} className="text-green-400" />
              <span className="text-xs font-bold text-green-400 font-mono">{locked} terkunci</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={11} className="text-sky-400" />
              <span className="text-xs font-bold text-sky-400 font-mono">{calculated} dihitung</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={11} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs font-bold font-mono" style={{ color: 'var(--text-muted)' }}>
                {pending} pending
              </span>
            </div>
            {(companies?.length ?? 0) > 0 && (
              <div className="flex-1 max-w-32 h-1 rounded-full overflow-hidden"
                style={{ background: 'var(--bg-card)' }}>
                <div className="h-full bg-green-500 rounded-full transition-all duration-1000"
                  style={{ width: `${(locked / (companies?.length ?? 1)) * 100}%` }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── EMPTY STATE ── */}
      {isEmpty ? (
        <div className="space-y-6">
          {/* Welcome card */}
          <div className="rounded-2xl overflow-hidden border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            {/* Top gradient bar */}
            <div className="h-1 w-full"
              style={{ background: 'linear-gradient(90deg, #E02020, #1B4FA8, #2DB44A)' }} />
            <div className="p-10 text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
                style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)' }}>
                <Play size={24} className="text-[#3B82F6]" style={{ marginLeft: 2 }} />
              </div>
              <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--text-primary)' }}>
                Selamat Datang di MIOS Payroll
              </h2>
              <p className="text-sm mb-8 max-w-md mx-auto leading-relaxed"
                style={{ color: 'var(--text-muted)' }}>
                Mulai dengan menambahkan perusahaan klien pertama Anda. Setelah itu, tambahkan karyawan dan jalankan payroll pertama.
              </p>

              <div className="flex items-center justify-center gap-4">
                <Link href="/companies/new"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all"
                  style={{ background: '#3B82F6', color: '#fff' }}>
                  <Plus size={16} />
                  Tambah Perusahaan Pertama
                </Link>
              </div>
            </div>
          </div>

          {/* Step guide */}
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                step: '01',
                icon: Building2,
                title: 'Tambah Perusahaan',
                desc: 'Daftarkan perusahaan klien lengkap dengan NPWP dan informasi dasar.',
                href: '/companies/new',
                color: '#3B82F6',
              },
              {
                step: '02',
                icon: Users,
                title: 'Input Karyawan',
                desc: 'Tambahkan karyawan dengan data gaji, BPJS, dan skema PPh 21.',
                href: '/companies',
                color: '#22C55E',
              },
              {
                step: '03',
                icon: Play,
                title: 'Jalankan Payroll',
                desc: 'Hitung, simpan, dan kunci payroll. Cetak slip gaji dan export SPT.',
                href: '/companies',
                color: '#F59E0B',
              },
            ].map((s) => (
              <Link key={s.step} href={s.href}
                className="rounded-xl p-5 border transition-all group"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border-default)',
                }}>
                <div className="flex items-start gap-4">
                  <span className="text-xs font-black font-mono"
                    style={{ color: s.color, opacity: 0.5 }}>{s.step}</span>
                  <div>
                    <s.icon size={18} className="mb-2" style={{ color: s.color }} />
                    <p className="font-bold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                      {s.title}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {s.desc}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Perusahaan Aktif', value: companies?.length ?? 0, sub: 'klien terdaftar',
                color: '#3B82F6', bg: 'rgba(37,99,235,0.06)', border: 'rgba(37,99,235,0.15)' },
              { label: 'Karyawan Aktif',   value: empCount ?? 0,          sub: 'seluruh perusahaan',
                color: '#22C55E', bg: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.15)' },
              { label: `Run ${BULAN_SHORT[bulanIni]} ${tahunIni}`,
                value: (thisMonthRuns ?? []).length, sub: `dari ${companies?.length ?? 0} perusahaan`,
                color: '#F59E0B', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)' },
            ].map((s, i) => (
              <div key={s.label}
                className="rounded-xl animate-fade-in-up"
                style={{ background: s.bg, border: `1px solid ${s.border}`,
                  padding: '20px 24px', animationDelay: `${i * 0.08}s`, opacity: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: s.color, opacity: 0.7, marginBottom: 12 }}>
                  {s.label}
                </p>
                <p style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, color: s.color,
                  marginBottom: 8, fontFamily: "'Courier New', monospace" }}>
                  {s.value}
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Mission board */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3 font-mono"
              style={{ color: 'var(--text-muted)' }}>
              Status Payroll {BULAN_SHORT[bulanIni]} {tahunIni}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(companies ?? []).map((co, i) => {
                const status      = runMap[co.id];
                const borderColor = status === 'locked' ? '#22c55e' : status === 'calculated' ? '#38bdf8' : '#2A2A2E';
                const statusLabel = status === 'locked' ? 'locked' : status === 'calculated' ? 'calculated' : 'pending';
                const statusColor = status === 'locked' ? 'text-green-400' : status === 'calculated' ? 'text-sky-400' : '';
                return (
                  <Link key={co.id}
                    href={`/companies/${co.id}/payroll/${tahunIni}/${bulanIni}`}
                    className="flex items-center justify-between rounded-lg px-4 py-3 border transition-all group animate-fade-in-up"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)',
                      borderLeftColor: borderColor, borderLeftWidth: 3,
                      animationDelay: `${i * 0.04}s`, opacity: 0 }}>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate font-mono"
                        style={{ color: 'var(--text-secondary)' }}>
                        {co.name}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {co.kota ?? '—'}
                      </p>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest font-mono shrink-0 ml-3 ${statusColor}`}
                      style={!statusColor ? { color: 'var(--text-muted)' } : {}}>
                      {statusLabel}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Payroll log */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3 font-mono"
              style={{ color: 'var(--text-muted)' }}>
              Log Payroll Terbaru
            </p>
            <div className="rounded-lg overflow-hidden border font-mono"
              style={{ background: 'var(--bg-deep)', borderColor: 'var(--border-default)' }}>
              <div className="px-4 py-2.5 border-b flex items-center gap-1.5"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                <span className="ml-3 text-[10px] uppercase tracking-widest"
                  style={{ color: 'var(--text-ghost)' }}>payroll.log</span>
                <span className="ml-1 text-[#2563EB] animate-blink text-xs">_</span>
              </div>

              {(recentRuns ?? []).length === 0 ? (
                <div className="px-5 py-10 text-xs" style={{ color: 'var(--text-ghost)' }}>
                  $ belum ada run.{' '}
                  <Link href="/companies" className="text-[#3B82F6] hover:underline">mulai dari sini →</Link>
                </div>
              ) : (recentRuns ?? []).map((run, i) => {
                const t  = totalsMap[run.id];
                const co = companyMap[run.company_id];
                return (
                  <Link key={run.id}
                    href={`/companies/${run.company_id}/payroll/${run.tahun}/${run.bulan}`}
                    className={`block px-5 py-3.5 transition-colors animate-fade-in-up ${
                      i < (recentRuns ?? []).length - 1 ? 'border-b' : ''
                    }`}
                    style={{ borderColor: 'var(--border-subtle)', animationDelay: `${i * 0.03}s`, opacity: 0 }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span className="text-[#3B82F6]">$</span>{' '}
                        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                          {co?.name ?? '—'}
                        </span>
                        <span style={{ color: 'var(--text-ghost)' }}>
                          {' '}── {BULAN_SHORT[run.bulan]} {run.tahun}
                        </span>
                      </span>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded tracking-widest ${
                        run.status === 'locked'     ? 'bg-green-900/25 text-green-500' :
                        run.status === 'calculated' ? 'bg-sky-900/25 text-sky-400' :
                        'bg-zinc-900 text-zinc-700'
                      }`}>{run.status}</span>
                    </div>
                    {t ? (
                      <div className="pl-3 grid grid-cols-4 gap-x-4 text-[11px]">
                        <span>
                          <span style={{ color: 'var(--text-ghost)' }}>kar   </span>
                          <span style={{ color: 'var(--text-muted)' }}>{t.count}</span>
                        </span>
                        <span>
                          <span style={{ color: 'var(--text-ghost)' }}>bruto </span>
                          <span style={{ color: 'var(--text-secondary)' }}>{fmt(t.bruto)}</span>
                        </span>
                        <span>
                          <span style={{ color: 'var(--text-ghost)' }}>pph   </span>
                          <span className="text-amber-500">{fmt(t.pph)}</span>
                        </span>
                        <span>
                          <span style={{ color: 'var(--text-ghost)' }}>thp   </span>
                          <span className="text-green-400 font-bold">{fmt(t.thp)}</span>
                        </span>
                      </div>
                    ) : (
                      <p className="pl-3 text-[11px]" style={{ color: 'var(--text-ghost)' }}>
                        ── belum ada hasil
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
