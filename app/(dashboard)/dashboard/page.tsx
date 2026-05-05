import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Lock, CheckCircle2, Clock } from 'lucide-react';

const BULAN_ID = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const BULAN_SHORT = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const now = new Date();
  const bulanIni = now.getMonth() + 1;
  const tahunIni = now.getFullYear();

  const { data: membership } = await supabase
    .from('workspace_members').select('workspace_id, workspaces(id, name)')
    .eq('user_id', user.id).limit(1).single();

  const workspaceId = membership?.workspace_id;
  const ws = membership?.workspaces;
  const wsName = (Array.isArray(ws) ? ws[0]?.name : (ws as any)?.name) ?? '—';

  const { data: companies } = await supabase
    .from('companies').select('id, name, kota')
    .eq('workspace_id', workspaceId ?? '').eq('aktif', true);

  const companyIds = (companies ?? []).map(c => c.id);

  const { count: empCount } = companyIds.length > 0
    ? await supabase.from('employees').select('*', { count: 'exact', head: true })
        .in('company_id', companyIds).eq('aktif', true)
    : { count: 0 };

  // This month's payroll runs
  const { data: thisMonthRuns } = companyIds.length > 0
    ? await supabase.from('payroll_runs').select('company_id, status')
        .in('company_id', companyIds).eq('tahun', tahunIni).eq('bulan', bulanIni)
    : { data: [] };

  const runMap = Object.fromEntries((thisMonthRuns ?? []).map(r => [r.company_id, r.status]));
  const locked = (thisMonthRuns ?? []).filter(r => r.status === 'locked').length;
  const calculated = (thisMonthRuns ?? []).filter(r => r.status === 'calculated').length;
  const pending = (companies?.length ?? 0) - locked - calculated;

  // Recent payroll log
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

  return (
    <div className="max-w-4xl space-y-8 animate-fade-in-up">

      {/* Period header — the hero */}
      <div className="border-b border-[#1A1A1C] pb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700 font-mono mb-2">
          {wsName} · Periode Aktif
        </p>
        <div className="flex items-baseline gap-4">
          <h1 className="text-5xl font-black text-zinc-100 font-mono tracking-tighter leading-none">
            {BULAN_ID[bulanIni].toUpperCase()}
          </h1>
          <span className="text-2xl font-bold text-zinc-600 font-mono">{tahunIni}</span>
        </div>

        {/* This month status bar */}
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
            <Clock size={11} className="text-zinc-600" />
            <span className="text-xs font-bold text-zinc-600 font-mono">{pending} pending</span>
          </div>
          {/* Visual progress */}
          {(companies?.length ?? 0) > 0 && (
            <div className="flex-1 max-w-32 h-1 bg-[#1A1A1C] rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all duration-1000"
                style={{ width: `${(locked / (companies?.length ?? 1)) * 100}%` }} />
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Perusahaan Aktif',
            value: companies?.length ?? 0,
            sub: 'klien terdaftar',
            color: '#3B82F6',
            bg: 'rgba(37,99,235,0.06)',
            border: 'rgba(37,99,235,0.15)',
          },
          {
            label: 'Karyawan Aktif',
            value: empCount ?? 0,
            sub: 'seluruh perusahaan',
            color: '#22C55E',
            bg: 'rgba(34,197,94,0.06)',
            border: 'rgba(34,197,94,0.15)',
          },
          {
            label: `Run ${BULAN_SHORT[bulanIni]} ${tahunIni}`,
            value: (thisMonthRuns ?? []).length,
            sub: `dari ${companies?.length ?? 0} perusahaan`,
            color: '#F59E0B',
            bg: 'rgba(245,158,11,0.06)',
            border: 'rgba(245,158,11,0.15)',
          },
        ].map((s, i) => (
          <div key={s.label}
            className="animate-fade-in-up"
            style={{
              background: s.bg,
              border: `1px solid ${s.border}`,
              borderRadius: 12,
              padding: '20px 24px',
              animationDelay: `${i * 0.08}s`,
              opacity: 0,
            }}>
            <p style={{
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: s.color, opacity: 0.7, marginBottom: 12,
            }}>
              {s.label}
            </p>
            <p style={{
              fontSize: 48, fontWeight: 900, lineHeight: 1,
              color: s.color, marginBottom: 8,
              fontFamily: "'Courier New', monospace",
              }}>
              {s.value}
            </p>
            <p style={{ fontSize: 13, color: '#52525B' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Company status grid — the "mission board" */}
      {(companies ?? []).length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700 mb-3 font-mono">
            Status Payroll {BULAN_SHORT[bulanIni]} {tahunIni}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(companies ?? []).map((co, i) => {
              const status = runMap[co.id];
              const borderColor = status === 'locked' ? '#22c55e' : status === 'calculated' ? '#38bdf8' : '#27272a';
              const statusLabel = status === 'locked' ? 'locked' : status === 'calculated' ? 'calculated' : 'pending';
              const statusColor = status === 'locked' ? 'text-green-400' : status === 'calculated' ? 'text-sky-400' : 'text-zinc-700';
              return (
                <Link key={co.id} href={`/companies/${co.id}/payroll/${tahunIni}/${bulanIni}`}
                  className="flex items-center justify-between bg-[#0A0A0B] border border-[#1A1A1C] rounded-lg px-4 py-3 hover:bg-[#111113] transition-all group animate-fade-in-up"
                  style={{ borderLeftColor: borderColor, borderLeftWidth: '3px', animationDelay: `${i * 0.04}s`, opacity: 0 }}>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-300 group-hover:text-zinc-100 transition-colors truncate font-mono">
                      {co.name}
                    </p>
                    <p className="text-[10px] text-zinc-700 mt-0.5">{co.kota ?? '—'}</p>
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest font-mono ${statusColor} shrink-0 ml-3`}>
                    {statusLabel}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Payroll log */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700 mb-3 font-mono">
          Log Payroll Terbaru
        </p>
        <div className="bg-[#060607] border border-[#1A1A1C] rounded-lg overflow-hidden font-mono">
          <div className="px-4 py-2.5 bg-[#0A0A0B] border-b border-[#1A1A1C] flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
            <span className="ml-3 text-[10px] text-zinc-800 uppercase tracking-widest">payroll.log</span>
            <span className="ml-1 text-[#D4AF37] animate-blink text-xs">_</span>
          </div>

          {(recentRuns ?? []).length === 0 ? (
            <div className="px-5 py-10 text-xs text-zinc-800">
              $ belum ada run.{' '}
              <Link href="/companies" className="text-[#D4AF37] hover:underline">mulai dari sini →</Link>
            </div>
          ) : (recentRuns ?? []).map((run, i) => {
            const t = totalsMap[run.id];
            const co = companyMap[run.company_id];
            return (
              <Link key={run.id}
                href={`/companies/${run.company_id}/payroll/${run.tahun}/${run.bulan}`}
                className={`block px-5 py-3.5 hover:bg-[#0A0A0B] transition-colors animate-fade-in-up ${
                  i < (recentRuns ?? []).length - 1 ? 'border-b border-[#0F0F11]' : ''
                }`}
                style={{ animationDelay: `${i * 0.03}s`, opacity: 0 }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-400">
                    <span className="text-[#D4AF37]">$</span>{' '}
                    <span className="font-bold text-zinc-200">{co?.name ?? '—'}</span>
                    <span className="text-zinc-700"> ── {BULAN_SHORT[run.bulan]} {run.tahun}</span>
                  </span>
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded tracking-widest ${
                    run.status === 'locked'     ? 'bg-green-900/25 text-green-500' :
                    run.status === 'calculated' ? 'bg-sky-900/25 text-sky-400' :
                    'bg-zinc-900 text-zinc-700'
                  }`}>{run.status}</span>
                </div>
                {t ? (
                  <div className="pl-3 grid grid-cols-4 gap-x-4 text-[11px]">
                    <span><span className="text-zinc-800">kar  </span><span className="text-zinc-500">{t.count}</span></span>
                    <span><span className="text-zinc-800">bruto </span><span className="text-zinc-400">{fmt(t.bruto)}</span></span>
                    <span><span className="text-zinc-800">pph   </span><span className="text-amber-500">{fmt(t.pph)}</span></span>
                    <span><span className="text-zinc-800">thp   </span><span className="text-green-400 font-bold">{fmt(t.thp)}</span></span>
                  </div>
                ) : (
                  <p className="pl-3 text-[11px] text-zinc-800">── belum ada hasil</p>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
