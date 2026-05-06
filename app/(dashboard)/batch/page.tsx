'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Lock, CheckCircle2, Clock, ChevronRight, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { formatRupiah } from '@/lib/format';

const BULAN_FULL  = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const BULAN_SHORT = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

type RunStatus = 'locked' | 'calculated' | 'draft' | 'none';

const STATUS_META: Record<RunStatus, { label: string; color: string; bg: string; icon: any; border: string }> = {
  locked:     { label: 'Terkunci',  color: 'text-green-400', bg: 'bg-green-900/20',  icon: Lock,         border: 'rgba(34,197,94,0.6)' },
  calculated: { label: 'Dihitung', color: 'text-sky-400',   bg: 'bg-sky-900/20',    icon: CheckCircle2, border: 'rgba(56,189,248,0.5)' },
  draft:      { label: 'Draft',    color: 'text-amber-400', bg: 'bg-amber-900/20',  icon: Clock,        border: 'rgba(245,158,11,0.4)' },
  none:       { label: 'Pending',  color: 'text-zinc-600',  bg: 'bg-zinc-900/30',   icon: Clock,        border: '#27272a' },
};

interface CompanyRow {
  id: string;
  name: string;
  kota: string | null;
  empCount: number;
  thisMonth: { status: RunStatus; runId?: string; bruto?: number; pph?: number; thp?: number } | null;
  lastMonth: { status: RunStatus; bruto?: number } | null;
  anomaly: 'up' | 'down' | null;
}

export default function BatchPage() {
  const now = new Date();
  const bulanIni  = now.getMonth() + 1;
  const tahunIni  = now.getFullYear();
  const prevBulan = bulanIni === 1 ? 12 : bulanIni - 1;
  const prevTahun = bulanIni === 1 ? tahunIni - 1 : tahunIni;

  const { workspace, loading: wsLoading } = useWorkspace();
  const [rows, setRows]       = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<RunStatus | 'all'>('all');

  useEffect(() => {
    async function fetchData() {
      if (!workspace) { setLoading(false); return; }
      const supabase = createClient();

      const { data: companies } = await supabase
        .from('companies').select('id, name, kota')
        .eq('workspace_id', workspace.id).eq('aktif', true).order('name');

      if (!companies?.length) { setLoading(false); return; }
      const companyIds = companies.map(c => c.id);

      const [
        { data: thisRuns },
        { data: prevRuns },
        { data: emps },
      ] = await Promise.all([
        supabase.from('payroll_runs').select('id, company_id, status')
          .in('company_id', companyIds).eq('tahun', tahunIni).eq('bulan', bulanIni),
        supabase.from('payroll_runs').select('id, company_id, status')
          .in('company_id', companyIds).eq('tahun', prevTahun).eq('bulan', prevBulan),
        supabase.from('employees').select('company_id')
          .in('company_id', companyIds).eq('aktif', true),
      ]);

      // Fetch totals for this month runs
      const thisRunIds = (thisRuns ?? []).map(r => r.id);
      const prevRunIds = (prevRuns ?? []).map(r => r.id);

      const [{ data: thisTotals }, { data: prevTotals }] = await Promise.all([
        thisRunIds.length > 0
          ? supabase.from('payroll_results').select('run_id, bruto, pph, thp').in('run_id', thisRunIds)
          : { data: [] },
        prevRunIds.length > 0
          ? supabase.from('payroll_results').select('run_id, bruto').in('run_id', prevRunIds)
          : { data: [] },
      ]);

      // Aggregate
      const thisMap: Record<string, { bruto: number; pph: number; thp: number }> = {};
      for (const r of thisTotals ?? []) {
        if (!thisMap[r.run_id]) thisMap[r.run_id] = { bruto: 0, pph: 0, thp: 0 };
        thisMap[r.run_id].bruto += r.bruto ?? 0;
        thisMap[r.run_id].pph   += r.pph   ?? 0;
        thisMap[r.run_id].thp   += r.thp   ?? 0;
      }
      const prevMap: Record<string, { bruto: number }> = {};
      for (const r of prevTotals ?? []) {
        if (!prevMap[r.run_id]) prevMap[r.run_id] = { bruto: 0 };
        prevMap[r.run_id].bruto += r.bruto ?? 0;
      }

      const thisRunByCompany  = Object.fromEntries((thisRuns ?? []).map(r => [r.company_id, r]));
      const prevRunByCompany  = Object.fromEntries((prevRuns ?? []).map(r => [r.company_id, r]));
      const empCountByCompany: Record<string, number> = {};
      for (const e of emps ?? []) {
        empCountByCompany[e.company_id] = (empCountByCompany[e.company_id] ?? 0) + 1;
      }

      const result: CompanyRow[] = companies.map(co => {
        const thisRun = thisRunByCompany[co.id];
        const prevRun = prevRunByCompany[co.id];
        const thisTot = thisRun ? thisMap[thisRun.id] : null;
        const prevTot = prevRun ? prevMap[prevRun.id] : null;

        let anomaly: 'up' | 'down' | null = null;
        if (thisTot?.bruto && prevTot?.bruto) {
          const diff = (thisTot.bruto - prevTot.bruto) / prevTot.bruto;
          if (diff > 0.15)  anomaly = 'up';
          if (diff < -0.15) anomaly = 'down';
        }

        return {
          id: co.id, name: co.name, kota: co.kota,
          empCount: empCountByCompany[co.id] ?? 0,
          thisMonth: thisRun ? {
            status: thisRun.status as RunStatus,
            runId:  thisRun.id,
            bruto:  thisTot?.bruto,
            pph:    thisTot?.pph,
            thp:    thisTot?.thp,
          } : null,
          lastMonth: prevRun ? {
            status: prevRun.status as RunStatus,
            bruto:  prevTot?.bruto,
          } : null,
          anomaly,
        };
      });

      setRows(result);
      setLoading(false);
    }
    if (!wsLoading) fetchData();
  }, [workspace, wsLoading]);

  const filtered = filter === 'all' ? rows : rows.filter(r => (r.thisMonth?.status ?? 'none') === filter);

  const counts = {
    locked:     rows.filter(r => r.thisMonth?.status === 'locked').length,
    calculated: rows.filter(r => r.thisMonth?.status === 'calculated').length,
    draft:      rows.filter(r => r.thisMonth?.status === 'draft').length,
    none:       rows.filter(r => !r.thisMonth).length,
  };

  const totalThp  = rows.reduce((a, r) => a + (r.thisMonth?.thp  ?? 0), 0);
  const totalPph  = rows.reduce((a, r) => a + (r.thisMonth?.pph  ?? 0), 0);
  const anomalies = rows.filter(r => r.anomaly).length;

  return (
    <div className="max-w-5xl space-y-6 animate-fade-in-up">

      {/* Header */}
      <div className="border-b border-[#1A1A1C] pb-5">
        <h1 className="text-3xl font-black text-zinc-100 font-mono tracking-tight">BATCH RUN</h1>
        <p className="text-[11px] text-zinc-700 font-mono uppercase tracking-widest mt-1">
          {BULAN_FULL[bulanIni]} {tahunIni} · {rows.length} perusahaan aktif
        </p>
      </div>

      {/* Summary row */}
      {rows.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-[#0A0A0B] border border-[#1A1A1C] rounded-lg p-4 col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700 mb-2 font-mono">Total THP Bulan Ini</p>
            <p className="text-2xl font-black font-mono text-green-400">{totalThp > 0 ? formatRupiah(totalThp) : '—'}</p>
            <p className="text-[10px] text-zinc-700 font-mono mt-1">PPh 21: <span className="text-amber-400">{totalPph > 0 ? formatRupiah(totalPph) : '—'}</span></p>
          </div>
          <div className="bg-[#0A0A0B] border border-[#1A1A1C] rounded-lg p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700 mb-2 font-mono">Progress</p>
            <p className="text-2xl font-black font-mono text-zinc-100">{counts.locked}<span className="text-zinc-700 text-lg">/{rows.length}</span></p>
            <div className="mt-2 h-1 bg-[#1A1A1C] rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: rows.length > 0 ? `${(counts.locked / rows.length) * 100}%` : '0%' }} />
            </div>
          </div>
          <div className={`border rounded-lg p-4 ${anomalies > 0 ? 'bg-amber-900/10 border-amber-900/30' : 'bg-[#0A0A0B] border-[#1A1A1C]'}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700 mb-2 font-mono">Anomali</p>
            <p className={`text-2xl font-black font-mono ${anomalies > 0 ? 'text-amber-400' : 'text-zinc-700'}`}>{anomalies}</p>
            <p className="text-[10px] text-zinc-700 font-mono mt-1">&gt;15% perubahan bruto</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {([['all', 'Semua', rows.length], ['none', 'Pending', counts.none], ['calculated', 'Dihitung', counts.calculated], ['locked', 'Terkunci', counts.locked]] as const).map(([key, label, count]) => (
          <button key={key} onClick={() => setFilter(key as any)}
            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest font-mono transition-all border ${
              filter === key
                ? 'bg-[#1A1A1C] border-[#2563EB]/40 text-zinc-100'
                : 'bg-[#0A0A0B] border-[#1A1A1C] text-zinc-600 hover:text-zinc-400'
            }`}>
            {label} <span className="ml-1 opacity-60">{count}</span>
          </button>
        ))}
      </div>

      {/* Company rows */}
      {loading || wsLoading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-[#0A0A0B] border border-[#1A1A1C] rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#0A0A0B] border border-dashed border-[#1A1A1C] rounded-lg p-16 text-center">
          <p className="text-xs text-zinc-700 font-mono">$ tidak ada hasil</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((co, i) => {
            const status = co.thisMonth?.status ?? 'none';
            const meta   = STATUS_META[status];
            const Icon   = meta.icon;

            return (
              <div key={co.id}
                className="bg-[#0A0A0B] border border-[#1A1A1C] rounded-lg overflow-hidden animate-fade-in-up"
                style={{ borderLeftColor: meta.border, borderLeftWidth: '3px', animationDelay: `${i * 0.03}s`, opacity: 0 }}>

                <div className="px-5 py-4 flex items-center gap-5">
                  {/* Status icon */}
                  <Icon size={14} className={meta.color} />

                  {/* Company info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-bold text-zinc-200 font-mono uppercase truncate">{co.name}</p>
                      {co.anomaly && (
                        <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                          co.anomaly === 'up' ? 'bg-amber-900/25 text-amber-400' : 'bg-blue-900/25 text-blue-400'
                        }`}>
                          {co.anomaly === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {co.anomaly === 'up' ? '+bruto' : '-bruto'}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-700 font-mono mt-0.5">
                      {co.kota ?? '—'} · {co.empCount} karyawan
                    </p>
                  </div>

                  {/* This month figures */}
                  {co.thisMonth?.thp ? (
                    <div className="hidden sm:grid grid-cols-3 gap-6 text-right font-mono shrink-0">
                      <div>
                        <p className="text-xs font-bold text-zinc-400">{formatRupiah(co.thisMonth.bruto ?? 0)}</p>
                        <p className="text-[9px] text-zinc-800 uppercase tracking-widest">bruto</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-400">{formatRupiah(co.thisMonth.pph ?? 0)}</p>
                        <p className="text-[9px] text-zinc-800 uppercase tracking-widest">pph 21</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-green-400">{formatRupiah(co.thisMonth.thp ?? 0)}</p>
                        <p className="text-[9px] text-zinc-800 uppercase tracking-widest">thp</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-zinc-700 font-mono shrink-0">
                      {status === 'none' ? `belum ada run ${BULAN_SHORT[bulanIni]}` : 'belum dihitung'}
                    </div>
                  )}

                  {/* Action */}
                  <Link
                    href={`/companies/${co.id}/payroll/${tahunIni}/${bulanIni}`}
                    className={`ml-4 shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest font-mono transition-all ${
                      status === 'none' || status === 'draft'
                        ? 'bg-[#2563EB] text-[#0A0A0B] hover:bg-[#1D4ED8]'
                        : status === 'calculated'
                        ? 'bg-[#111113] border border-sky-900/40 text-sky-400 hover:border-sky-700/60'
                        : 'bg-[#111113] border border-[#1A1A1C] text-zinc-600 hover:text-zinc-400'
                    }`}>
                    {status === 'none' ? 'Mulai' : status === 'draft' ? 'Lanjut' : status === 'calculated' ? 'Review' : 'Lihat'}
                    <ChevronRight size={11} />
                  </Link>
                </div>

                {/* Last month comparison bar */}
                {co.lastMonth?.bruto && co.thisMonth?.bruto && (
                  <div className="px-5 pb-3 flex items-center gap-3">
                    <p className="text-[10px] text-zinc-800 font-mono shrink-0">
                      vs {BULAN_SHORT[prevBulan]}:
                    </p>
                    <p className="text-[10px] text-zinc-700 font-mono">
                      {formatRupiah(co.lastMonth.bruto)}
                    </p>
                    {co.thisMonth.bruto && co.lastMonth.bruto && (() => {
                      const pct = ((co.thisMonth.bruto - co.lastMonth.bruto) / co.lastMonth.bruto * 100);
                      return (
                        <span className={`text-[10px] font-bold font-mono ${pct > 0 ? 'text-amber-400' : 'text-sky-400'}`}>
                          {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                        </span>
                      );
                    })()}
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
