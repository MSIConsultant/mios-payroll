'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Company } from '@/lib/types';
import { Plus, Search, Lock, CheckCircle2, Clock, ChevronRight } from 'lucide-react';

const BULAN_SHORT = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

type RunStatus = 'locked' | 'calculated' | 'draft' | 'none';

interface CompanyWithMeta extends Company {
  _empCount?: number;
  _runStatus?: RunStatus;
  _runBulan?: number;
  _runTahun?: number;
}

function StatusIcon({ status }: { status: RunStatus }) {
  if (status === 'locked')     return <Lock size={10} className="text-green-400" />;
  if (status === 'calculated') return <CheckCircle2 size={10} className="text-sky-400" />;
  if (status === 'draft')      return <Clock size={10} className="text-amber-500" />;
  return <Clock size={10} className="text-zinc-700" />;
}

const STATUS_BORDER: Record<RunStatus, string> = {
  locked:     'rgba(34,197,94,0.7)',
  calculated: 'rgba(56,189,248,0.6)',
  draft:      'rgba(245,158,11,0.5)',
  none:       '#27272a',
};

const STATUS_LABEL: Record<RunStatus, string> = {
  locked:     'locked',
  calculated: 'calculated',
  draft:      'draft',
  none:       'no run',
};

const STATUS_COLOR: Record<RunStatus, string> = {
  locked:     'text-green-400',
  calculated: 'text-sky-400',
  draft:      'text-amber-500',
  none:       'text-zinc-700',
};

export default function CompaniesPage() {
  const now = new Date();
  const bulanIni  = now.getMonth() + 1;
  const tahunIni  = now.getFullYear();

  const { workspace, loading: wsLoading } = useWorkspace();
  const [companies, setCompanies] = useState<CompanyWithMeta[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState<RunStatus | 'all'>('all');

  useEffect(() => {
    async function fetchData() {
      if (!workspace) { setLoading(false); return; }
      const supabase = createClient();

      const [{ data: cos }, { data: runs }, { data: emps }] = await Promise.all([
        supabase.from('companies').select('*').eq('workspace_id', workspace.id).eq('aktif', true).order('name'),
        supabase.from('payroll_runs').select('company_id, status, bulan, tahun')
          .in('company_id', (await supabase.from('companies').select('id').eq('workspace_id', workspace.id)).data?.map(c => c.id) ?? [])
          .eq('tahun', tahunIni).eq('bulan', bulanIni),
        supabase.from('employees').select('company_id').eq('aktif', true),
      ]);

      const runMap: Record<string, RunStatus> = {};
      for (const r of runs ?? []) runMap[r.company_id] = r.status as RunStatus;

      const empMap: Record<string, number> = {};
      for (const e of emps ?? []) {
        empMap[e.company_id] = (empMap[e.company_id] ?? 0) + 1;
      }

      setCompanies((cos ?? []).map(co => ({
        ...co,
        _empCount: empMap[co.id] ?? 0,
        _runStatus: runMap[co.id] ?? 'none',
        _runBulan: bulanIni,
        _runTahun: tahunIni,
      })));
      setLoading(false);
    }
    if (!wsLoading) fetchData();
  }, [workspace, wsLoading]);

  const filtered = companies.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.kota?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c._runStatus === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    locked:     companies.filter(c => c._runStatus === 'locked').length,
    calculated: companies.filter(c => c._runStatus === 'calculated').length,
    none:       companies.filter(c => c._runStatus === 'none').length,
  };

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-zinc-100 font-mono tracking-tight">PERUSAHAAN</h1>
          <p className="text-[11px] text-zinc-700 mt-1 font-mono uppercase tracking-widest">
            {companies.length} klien aktif · periode {BULAN_SHORT[bulanIni]} {tahunIni}
          </p>
        </div>
        <Link href="/companies/new"
          className="inline-flex items-center gap-2 bg-[#2563EB] text-[#0A0A0B] px-4 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest hover:bg-[#1D4ED8] transition-colors relative overflow-hidden group"
          style={{ boxShadow: '0 0 20px rgba(37,99,235,0.2)' }}>
          <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />
          <Plus size={13} />
          <span className="relative">Tambah</span>
        </Link>
      </div>

      {/* This month status summary */}
      {companies.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'locked',     label: 'Terkunci',  count: counts.locked,     color: 'border-green-900/40 bg-green-900/10' },
            { key: 'calculated', label: 'Dihitung',  count: counts.calculated, color: 'border-sky-900/40 bg-sky-900/10' },
            { key: 'none',       label: 'Belum Run', count: counts.none,       color: 'border-zinc-800 bg-zinc-900/30' },
          ].map(s => (
            <button key={s.key}
              onClick={() => setFilterStatus(filterStatus === s.key as RunStatus ? 'all' : s.key as RunStatus)}
              className={`border rounded-lg px-4 py-3 text-left transition-all ${s.color} ${
                filterStatus === s.key ? 'ring-1 ring-[#2563EB]/40' : 'hover:border-zinc-600'
              }`}>
              <p className="text-3xl font-black font-mono text-zinc-100">{s.count}</p>
              <p className="text-[10px] uppercase tracking-widest font-mono text-zinc-600 mt-1">{s.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700" />
        <input type="text" placeholder="$ cari perusahaan..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-4 py-2.5 bg-[#0A0A0B] border border-[#1A1A1C] rounded-lg text-sm text-zinc-300 placeholder:text-zinc-800 outline-none focus:border-[#2563EB]/30 transition-colors font-mono" />
      </div>

      {/* Company list */}
      {(loading || wsLoading) ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-[#0A0A0B] border border-[#1A1A1C] rounded-lg animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#0A0A0B] border border-dashed border-[#1A1A1C] rounded-lg p-16 text-center">
          <p className="text-xs text-zinc-700 font-mono">$ tidak ada hasil</p>
          {companies.length === 0 && (
            <Link href="/companies/new" className="mt-3 inline-block text-xs text-[#2563EB] hover:underline font-mono">
              tambah perusahaan pertama →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((co, i) => {
            const status = co._runStatus ?? 'none';
            return (
              <Link key={co.id} href={`/companies/${co.id}`}
                className="flex items-center justify-between bg-[#0A0A0B] border border-[#1A1A1C] rounded-lg px-5 py-4 hover:bg-[#0F0F11] transition-all group animate-fade-in-up"
                style={{
                  borderLeftColor: STATUS_BORDER[status],
                  borderLeftWidth: '3px',
                  animationDelay: `${i * 0.04}s`,
                  opacity: 0,
                }}>
                <div className="flex items-center gap-5 min-w-0 flex-1">
                  {/* Status icon */}
                  <div className="shrink-0">
                    <StatusIcon status={status} />
                  </div>

                  {/* Company name + location */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-zinc-200 group-hover:text-zinc-100 transition-colors font-mono uppercase tracking-tight truncate">
                      {co.name}
                    </p>
                    <p className="text-[10px] text-zinc-700 mt-0.5 font-mono">
                      {co.kota ?? '—'}{co.industri ? ` · ${co.industri}` : ''}
                    </p>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-lg font-black text-zinc-400 font-mono leading-none">{co._empCount ?? 0}</p>
                      <p className="text-[9px] text-zinc-800 uppercase tracking-widest">karyawan</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5">
                        <StatusIcon status={status} />
                        <span className={`text-[10px] font-bold uppercase tracking-widest font-mono ${STATUS_COLOR[status]}`}>
                          {STATUS_LABEL[status]}
                        </span>
                      </div>
                      <p className="text-[9px] text-zinc-800 font-mono">{BULAN_SHORT[bulanIni]} {tahunIni}</p>
                    </div>
                  </div>
                </div>
                <ChevronRight size={13} className="text-zinc-800 group-hover:text-zinc-600 transition-colors ml-4 shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
