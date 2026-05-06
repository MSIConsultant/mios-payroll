'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { deletePayrollRun } from '@/lib/actions/payroll';

const BULAN_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

export default function PayrollOverviewPage() {
  const { companyId } = useParams();
  const [runs, setRuns]           = useState<any[]>([]);
  const [company, setCompany]     = useState<any>(null);
  const [totalsMap, setTotalsMap] = useState<Record<string, any>>({});
  const [loading, setLoading]     = useState(true);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [selTahun, setSelTahun]   = useState(new Date().getFullYear());
  const [selBulan, setSelBulan]   = useState(new Date().getMonth() + 1);

  async function fetchData() {
    const supabase = createClient();
    const [{ data: co }, { data: runsData }] = await Promise.all([
      supabase.from('companies').select('name').eq('id', companyId).single(),
      supabase.from('payroll_runs').select('*').eq('company_id', companyId)
        .order('tahun', { ascending: false }).order('bulan', { ascending: false }),
    ]);
    if (co) setCompany(co);
    if (runsData) {
      setRuns(runsData);
      const runIds = runsData.map(r => r.id);
      if (runIds.length > 0) {
        const { data: totals } = await supabase.from('payroll_results')
          .select('run_id, thp, bruto, pph').in('run_id', runIds);
        const map: Record<string, any> = {};
        for (const t of totals ?? []) {
          if (!map[t.run_id]) map[t.run_id] = { thp: 0, bruto: 0, pph: 0, count: 0 };
          map[t.run_id].thp   += t.thp  ?? 0;
          map[t.run_id].bruto += t.bruto ?? 0;
          map[t.run_id].pph   += t.pph  ?? 0;
          map[t.run_id].count += 1;
        }
        setTotalsMap(map);
      }
    }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [companyId]);

  async function handleDeleteRun(run: any) {
    if (run.status === 'locked') {
      alert('Run yang sudah dikunci tidak bisa dihapus.');
      return;
    }
    if (!confirm(`Hapus payroll ${BULAN_NAMES[run.bulan - 1]} ${run.tahun}? Semua hasil kalkulasi akan hilang.`)) return;
    setDeleting(run.id);
    const res = await deletePayrollRun(run.id, companyId as string, run.tahun, run.bulan);
    if (res.error) { alert(res.error); setDeleting(null); }
    else { setRuns(r => r.filter(x => x.id !== run.id)); setDeleting(null); }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/companies/${companyId}`}
          className="w-9 h-9 bg-[#111113] border border-[#1A1A1C] rounded-lg flex items-center justify-center text-zinc-600 hover:text-zinc-200 transition-colors">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Payroll Hub</h1>
          <p className="text-[11px] text-zinc-600 mt-0.5">{company?.name ?? '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* New Run */}
        <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Plus size={13} className="text-[#2563EB]" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Payroll Baru</p>
          </div>
          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-[10px] font-bold text-zinc-700 uppercase tracking-widest mb-1.5">Tahun</label>
              <select value={selTahun} onChange={e => setSelTahun(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#0D0D0F] border border-[#1A1A1C] rounded-lg text-sm text-zinc-200 outline-none focus:border-[#2563EB]/40 font-mono">
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-700 uppercase tracking-widest mb-1.5">Bulan</label>
              <select value={selBulan} onChange={e => setSelBulan(Number(e.target.value))}
                className="w-full px-3 py-2 bg-[#0D0D0F] border border-[#1A1A1C] rounded-lg text-sm text-zinc-200 outline-none focus:border-[#2563EB]/40">
                {BULAN_NAMES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
              </select>
            </div>
          </div>
          <Link href={`/companies/${companyId}/payroll/${selTahun}/${selBulan}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#2563EB] text-[#0A0A0B] rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-[#1D4ED8] transition-colors group">
            Mulai Hitung
            <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Run History CLI */}
        <div className="col-span-2">
          <div className="bg-[#080809] border border-[#1A1A1C] rounded-lg overflow-hidden font-mono h-full">
            <div className="px-4 py-2 bg-[#0F0F11] border-b border-[#1A1A1C] flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500/40" />
              <div className="w-2 h-2 rounded-full bg-yellow-500/40" />
              <div className="w-2 h-2 rounded-full bg-green-500/40" />
              <span className="ml-3 text-[10px] text-zinc-700 uppercase tracking-widest">riwayat_payroll.log</span>
              <span className="ml-1 text-[#2563EB] animate-blink text-xs">_</span>
            </div>

            {loading ? (
              <div className="px-5 py-6 space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-[#111113] rounded animate-pulse" />)}
              </div>
            ) : runs.length === 0 ? (
              <div className="px-5 py-10 text-xs text-zinc-700">$ Belum ada riwayat payroll.</div>
            ) : (
              <div>
                {runs.map((run, i) => {
                  const t = totalsMap[run.id];
                  const isLocked = run.status === 'locked';
                  return (
                    <div key={run.id}
                      className={`${i < runs.length - 1 ? 'border-b border-[#131315]' : ''} animate-fade-in-up`}
                      style={{ animationDelay: `${i * 0.05}s`, opacity: 0 }}>
                      <div className="flex items-center justify-between px-5 pt-3.5 pb-1">
                        <Link href={`/companies/${companyId}/payroll/${run.tahun}/${run.bulan}`}
                          className="flex-1 hover:opacity-80 transition-opacity">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-zinc-300">
                              <span className="text-[#2563EB]">$</span>{' '}
                              <span className="font-bold">{BULAN_NAMES[run.bulan - 1]} {run.tahun}</span>
                            </span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${
                              isLocked ? 'bg-green-900/30 text-green-400' :
                              run.status === 'calculated' ? 'bg-sky-900/30 text-sky-400' :
                              'bg-zinc-800 text-zinc-600'
                            }`}>{run.status}</span>
                          </div>
                        </Link>
                        {!isLocked && (
                          <button onClick={() => handleDeleteRun(run)}
                            disabled={deleting === run.id}
                            className="p-1.5 text-zinc-700 hover:text-red-400 transition-colors disabled:opacity-50">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      {t ? (
                        <div className="pl-8 pb-3.5 grid grid-cols-4 gap-x-3 text-[11px]">
                          <span><span className="text-zinc-700">karyawan  </span><span className="text-zinc-400">{t.count}</span></span>
                          <span><span className="text-zinc-700">bruto     </span><span className="text-zinc-300">{formatRupiah(t.bruto)}</span></span>
                          <span><span className="text-zinc-700">pph21     </span><span className="text-amber-400">{formatRupiah(t.pph)}</span></span>
                          <span><span className="text-zinc-700">thp       </span><span className="text-green-400">{formatRupiah(t.thp)}</span></span>
                        </div>
                      ) : (
                        <p className="pl-8 pb-3.5 text-[11px] text-zinc-700">── belum ada hasil</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
