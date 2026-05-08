'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Terminal, Database, Users, Building2, Calculator,
  Trash2, RefreshCw, Download, Shield, AlertTriangle,
  ChevronDown, ChevronRight, Eye, Copy, Check, Layers
} from 'lucide-react';

const TABLES = ['workspaces','workspace_members','workspace_invitations','workspace_activity','companies','employees','employee_events','payroll_runs','payroll_results'];

function Section({ title, icon: Icon, children, defaultOpen = false }: {
  title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[#0A0A0B] border border-[#1A1A1C] rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#0F0F11] transition-colors">
        <div className="flex items-center gap-3">
          <Icon size={14} className="text-[#2563EB]" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 font-mono">{title}</span>
        </div>
        {open ? <ChevronDown size={13} className="text-zinc-700" /> : <ChevronRight size={13} className="text-zinc-700" />}
      </button>
      {open && <div className="border-t border-[#1A1A1C] p-5">{children}</div>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => {
      await navigator.clipboard.writeText(text);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    }} className="p-1 text-zinc-700 hover:text-[#2563EB] transition-colors">
      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
    </button>
  );
}

export default function DevDashboard({ userEmail }: { userEmail: string }) {
  const [stats, setStats]             = useState<Record<string, number>>({});
  const [workspaces, setWorkspaces]   = useState<any[]>([]);
  const [selWorkspace, setSelWorkspace] = useState<string>('all');
  const [wsStats, setWsStats]         = useState<any>(null);
  const [tableData, setTableData]     = useState<Record<string, any[]>>({});
  const [viewTable, setViewTable]     = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [engineResult, setEngineResult] = useState<any>(null);
  const [engineInput, setEngineInput]   = useState(JSON.stringify({
    nama: 'Test Employee', nik: '1234567890123456', npwp: '000.000.000.0-000.000',
    bulan: 1, tahun: 2026, status_ptkp: 'TK0', punya_npwp: true,
    gaji_pokok: 9150000, benefit: 0, kendaraan: 0, pulsa: 0, operasional: 0, tunj_lain: 0,
    thr: 0, bonus: 0, ikut_jht: true, ikut_jp: true, ikut_jkp: false,
    jkk_rate: 0.0024, tanggung_jht_k: true, tanggung_jp_k: true,
    ikut_kes: true, tanggung_kes_k: true, pph_ditanggung: false,
    kasbon: 0, alpha_telat: 0, pot_lain: 0, pph_jan_nov: 0, akum_bruto: 0,
    divisi: 'Dev', jenis_kelamin: 'L',
  }, null, 2));

  async function fetchStats() {
    setLoading(true);
    const supabase = createClient();

    // Global counts
    const results: Record<string, number> = {};
    await Promise.all(TABLES.map(async t => {
      const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
      results[t] = count ?? 0;
    }));
    setStats(results);

    // All workspaces with member + company counts
    const { data: wsList } = await supabase.from('workspaces').select('id, name, owner_id, created_at');
    if (wsList) {
      const enriched = await Promise.all(wsList.map(async ws => {
        const [
          { count: memberCount },
          { count: companyCount },
          { data: coIds },
        ] = await Promise.all([
          supabase.from('workspace_members').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
          supabase.from('companies').select('*', { count: 'exact', head: true }).eq('workspace_id', ws.id),
          supabase.from('companies').select('id').eq('workspace_id', ws.id),
        ]);
        const compIds = (coIds ?? []).map(c => c.id);
        const { count: empCount } = compIds.length > 0
          ? await supabase.from('employees').select('*', { count: 'exact', head: true }).in('company_id', compIds)
          : { count: 0 };
        const { count: runCount } = compIds.length > 0
          ? await supabase.from('payroll_runs').select('*', { count: 'exact', head: true }).in('company_id', compIds)
          : { count: 0 };
        // Get owner email
        const { data: ownerData } = await supabase.from('workspace_members')
          .select('user_id').eq('workspace_id', ws.id).eq('role', 'owner').single();
        return { ...ws, memberCount, companyCount, empCount, runCount };
      }));
      setWorkspaces(enriched);
    }
    setLoading(false);
  }

  async function fetchWorkspaceDetail(wsId: string) {
    const supabase = createClient();
    const { data: companies } = await supabase.from('companies').select('id, name, aktif').eq('workspace_id', wsId);
    const compIds = (companies ?? []).map(c => c.id);
    const [
      { data: members },
      { data: runs },
      { count: empCount },
      { data: activity },
    ] = await Promise.all([
      supabase.from('workspace_members').select('user_id, role, created_at').eq('workspace_id', wsId),
      compIds.length > 0
        ? supabase.from('payroll_runs').select('company_id, tahun, bulan, status').in('company_id', compIds).order('calculated_at', { ascending: false }).limit(10)
        : { data: [] },
      compIds.length > 0
        ? supabase.from('employees').select('*', { count: 'exact', head: true }).in('company_id', compIds).eq('aktif', true)
        : { count: 0 },
      supabase.from('workspace_activity').select('action, entity_name, user_email, created_at').eq('workspace_id', wsId).order('created_at', { ascending: false }).limit(10),
    ]);
    setWsStats({ companies, members, runs, empCount, activity });
  }

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => {
    if (selWorkspace !== 'all') fetchWorkspaceDetail(selWorkspace);
    else setWsStats(null);
  }, [selWorkspace]);

  async function fetchTable(table: string) {
    const supabase = createClient();
    const { data } = await supabase.from(table).select('*').limit(50).order('created_at', { ascending: false });
    setTableData(td => ({ ...td, [table]: data ?? [] }));
    setViewTable(table);
  }

  async function clearTable(table: string) {
    if (!confirm(`DELETE ALL rows from ${table}? Cannot be undone.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) toast.error(error.message);
    else { toast.success(`${table} cleared`); fetchStats(); }
  }

  async function exportTableCSV(table: string) {
    const supabase = createClient();
    const { data } = await supabase.from(table).select('*').limit(5000);
    if (!data?.length) { toast.error('No data'); return; }
    const keys = Object.keys(data[0]);
    const csv = [keys.join(','), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${table}_${Date.now()}.csv`; a.click();
    toast.success(`${table} exported`);
  }

async function runEngineTest() {
  setEngineResult(null); // ← reset first so UI clears
  try {
    const input = JSON.parse(engineInput);

    // Validate required fields
    const required = ['gaji_pokok','status_ptkp','bulan','tahun','jkk_rate'];
    for (const f of required) {
      if (input[f] === undefined) throw new Error(`Missing required field: ${f}`);
    }

    // Ensure boolean fields are actual booleans not strings
    const boolFields = ['punya_npwp','ikut_jht','ikut_jp','ikut_jkp',
      'tanggung_jht_k','tanggung_jp_k','ikut_kes','tanggung_kes_k','pph_ditanggung'];
    for (const f of boolFields) {
      if (typeof input[f] === 'string') {
        input[f] = input[f] === 'true';
      }
      if (input[f] === undefined) input[f] = false;
    }

    // Ensure number fields
    const numFields = ['gaji_pokok','benefit','kendaraan','pulsa','operasional',
      'tunj_lain','thr','bonus','kasbon','alpha_telat','pot_lain',
      'pph_jan_nov','akum_bruto','jkk_rate'];
    for (const f of numFields) {
      input[f] = Number(input[f]) || 0;
    }

    const { calculateMonthlySalary } = await import('@/lib/engine/payroll');
    const result = calculateMonthlySalary(input);
    setEngineResult(result);
    toast.success('Engine ran — ' + (result.jenis ?? 'OK'));
  } catch (e: any) {
    toast.error(e.message);
    setEngineResult({ error: e.message });
  }
}

  const totalRows = Object.values(stats).reduce((a, b) => a + b, 0);
  const BULAN_SHORT = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

  return (
    <div className="max-w-5xl space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="border-b border-[#1A1A1C] pb-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 font-mono">Dev Mode — Restricted Access</p>
        </div>
        <h1 className="text-3xl font-black text-zinc-100 font-mono">DEV CONSOLE</h1>
        <p className="text-[11px] text-zinc-700 font-mono mt-1">{userEmail} · MIOS Payroll v5 · RLS Enabled</p>
      </div>

      {/* Tenant Control Panel */}
      <Section title="Tenant Control Panel" icon={Layers} defaultOpen>
        <div className="grid grid-cols-4 gap-2 mb-5">
          <div className="bg-[#0D0D0F] border border-[#1A1A1C] rounded p-4 col-span-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-700 mb-2 font-mono">Total Tenants</p>
            <p className="text-3xl font-black font-mono text-[#2563EB]">{workspaces.length}</p>
          </div>
          <div className="bg-[#0D0D0F] border border-[#1A1A1C] rounded p-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-700 mb-2 font-mono">DB Rows</p>
            <p className="text-3xl font-black font-mono text-zinc-100">{loading ? '...' : totalRows}</p>
          </div>
          <div className="bg-[#0D0D0F] border border-[#1A1A1C] rounded p-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-700 mb-2 font-mono">Total Employees</p>
            <p className="text-3xl font-black font-mono text-zinc-100">{loading ? '...' : stats['employees'] ?? 0}</p>
          </div>
          <div className="bg-[#0D0D0F] border border-[#1A1A1C] rounded p-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-700 mb-2 font-mono">Payroll Runs</p>
            <p className="text-3xl font-black font-mono text-zinc-100">{loading ? '...' : stats['payroll_runs'] ?? 0}</p>
          </div>
        </div>

        {/* Workspace list */}
        <div className="space-y-2 mb-5">
          {workspaces.map((ws, i) => (
            <button key={ws.id}
              onClick={() => setSelWorkspace(selWorkspace === ws.id ? 'all' : ws.id)}
              className={`w-full text-left bg-[#0D0D0F] border rounded-lg px-4 py-3 transition-all animate-fade-in-up ${
                selWorkspace === ws.id
                  ? 'border-[#2563EB]/40 bg-[#0F0F0A]'
                  : 'border-[#1A1A1C] hover:border-zinc-700'
              }`}
              style={{ animationDelay: `${i * 0.05}s`, opacity: 0 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-1.5 h-1.5 rounded-full ${selWorkspace === ws.id ? 'bg-[#2563EB]' : 'bg-zinc-700'}`} />
                  <div>
                    <p className="text-sm font-bold text-zinc-300 font-mono">{ws.name}</p>
                    <p className="text-[10px] text-zinc-700 font-mono">{ws.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-base font-black font-mono text-zinc-400">{ws.memberCount}</p>
                    <p className="text-[9px] text-zinc-800 uppercase tracking-widest">members</p>
                  </div>
                  <div>
                    <p className="text-base font-black font-mono text-zinc-400">{ws.companyCount}</p>
                    <p className="text-[9px] text-zinc-800 uppercase tracking-widest">companies</p>
                  </div>
                  <div>
                    <p className="text-base font-black font-mono text-zinc-400">{ws.empCount}</p>
                    <p className="text-[9px] text-zinc-800 uppercase tracking-widest">employees</p>
                  </div>
                  <div>
                    <p className="text-base font-black font-mono text-zinc-400">{ws.runCount}</p>
                    <p className="text-[9px] text-zinc-800 uppercase tracking-widest">runs</p>
                  </div>
                  <ChevronRight size={13} className={`transition-colors ${selWorkspace === ws.id ? 'text-[#2563EB] rotate-90' : 'text-zinc-800'}`} />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Workspace detail */}
        {selWorkspace !== 'all' && wsStats && (
          <div className="bg-[#060607] border border-[#1A1A1C] rounded-lg overflow-hidden font-mono animate-fade-in">
            <div className="px-4 py-2.5 bg-[#0A0A0B] border-b border-[#1A1A1C] flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500/40" />
              <div className="w-2 h-2 rounded-full bg-yellow-500/40" />
              <div className="w-2 h-2 rounded-full bg-green-500/40" />
              <span className="ml-2 text-[10px] text-zinc-700 uppercase tracking-widest">workspace.inspect</span>
            </div>
            <div className="p-4 grid grid-cols-3 gap-4">
              {/* Companies */}
              <div>
                <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-2">Companies ({wsStats.companies?.length ?? 0})</p>
                {(wsStats.companies ?? []).map((co: any) => (
                  <div key={co.id} className="text-[11px] py-1 border-b border-[#0F0F11] flex justify-between">
                    <span className="text-zinc-400 truncate">{co.name}</span>
                    <span className={co.aktif ? 'text-green-500' : 'text-zinc-700'}>{co.aktif ? 'aktif' : 'arsip'}</span>
                  </div>
                ))}
              </div>
              {/* Members */}
              <div>
                <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-2">Members ({wsStats.members?.length ?? 0})</p>
                {(wsStats.members ?? []).map((m: any, i: number) => (
                  <div key={i} className="text-[11px] py-1 border-b border-[#0F0F11] flex justify-between">
                    <span className="text-zinc-500 truncate text-[10px]">{m.user_id.slice(0,12)}…</span>
                    <span className={m.role === 'owner' ? 'text-[#2563EB]' : 'text-zinc-600'}>{m.role}</span>
                  </div>
                ))}
              </div>
              {/* Recent runs */}
              <div>
                <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-2">Recent Runs ({wsStats.runs?.length ?? 0})</p>
                {(wsStats.runs ?? []).map((r: any, i: number) => (
                  <div key={i} className="text-[11px] py-1 border-b border-[#0F0F11] flex justify-between">
                    <span className="text-zinc-600">{BULAN_SHORT[r.bulan]} {r.tahun}</span>
                    <span className={
                      r.status === 'locked' ? 'text-green-400' :
                      r.status === 'calculated' ? 'text-sky-400' : 'text-zinc-600'
                    }>{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Recent activity */}
            {wsStats.activity?.length > 0 && (
              <div className="border-t border-[#1A1A1C] p-4">
                <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-2">Recent Activity</p>
                {wsStats.activity.map((a: any, i: number) => (
                  <div key={i} className="text-[11px] py-1 border-b border-[#0F0F11] flex items-center justify-between">
                    <span className="text-zinc-600">
                      <span className="text-[#2563EB]">$</span> {a.action}
                      {a.entity_name ? <span className="text-zinc-500"> {a.entity_name}</span> : ''}
                    </span>
                    <span className="text-[10px] text-zinc-800">{a.user_email?.split('@')[0]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* DB Table Inspector */}
      <Section title="Table Inspector" icon={Database}>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {TABLES.map(t => (
            <div key={t} className="bg-[#0D0D0F] border border-[#1A1A1C] rounded p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono text-zinc-500 truncate">{t}</p>
                <p className="text-xl font-black font-mono text-zinc-200">{loading ? '—' : stats[t] ?? 0}</p>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => fetchTable(t)} title="View"
                  className="p-1.5 text-zinc-700 hover:text-sky-400 transition-colors"><Eye size={11} /></button>
                <button onClick={() => exportTableCSV(t)} title="Export"
                  className="p-1.5 text-zinc-700 hover:text-[#2563EB] transition-colors"><Download size={11} /></button>
                <button onClick={() => clearTable(t)} title="Clear"
                  className="p-1.5 text-zinc-700 hover:text-red-400 transition-colors"><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
        </div>

        {viewTable && tableData[viewTable] && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 font-mono">
                {viewTable} ({tableData[viewTable].length} rows)
              </p>
              <button onClick={() => setViewTable(null)} className="text-[10px] text-zinc-700 hover:text-zinc-400 font-mono">× close</button>
            </div>
            <div className="overflow-x-auto bg-[#060607] border border-[#1A1A1C] rounded-lg font-mono text-[10px]">
              {tableData[viewTable].length === 0 ? (
                <p className="px-4 py-6 text-zinc-700">$ empty table</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1A1A1C] bg-[#0A0A0B]">
                      {Object.keys(tableData[viewTable][0]).slice(0,8).map(k => (
                        <th key={k} className="px-3 py-2 text-left text-zinc-700 uppercase tracking-wider whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData[viewTable].slice(0,20).map((row, i) => (
                      <tr key={i} className="border-b border-[#0F0F11] hover:bg-[#0A0A0B]">
                        {Object.values(row).slice(0,8).map((val: any, j) => (
                          <td key={j} className="px-3 py-2 text-zinc-500 whitespace-nowrap max-w-[160px] truncate">
                            {val === null ? <span className="text-zinc-800">null</span> :
                             typeof val === 'object' ? <span className="text-zinc-700">{'{…}'}</span> :
                             String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* Engine Tester */}
      <Section title="Payroll Engine Tester" icon={Calculator}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-zinc-700 mb-2 font-mono">Input JSON</p>
            <textarea value={engineInput} onChange={e => setEngineInput(e.target.value)} rows={20}
              className="w-full px-3 py-2.5 bg-[#060607] border border-[#1A1A1C] rounded-lg text-[11px] text-zinc-300 font-mono outline-none focus:border-[#2563EB]/30 resize-none" />
            <button onClick={runEngineTest}
              className="mt-3 w-full py-2.5 bg-[#2563EB] text-[#0A0A0B] rounded-lg font-black text-xs uppercase tracking-widest hover:bg-[#1D4ED8] transition-colors flex items-center justify-center gap-2">
              <Terminal size={13} />$ run engine
            </button>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-widest text-zinc-700 font-mono">Output</p>
              {engineResult && <CopyButton text={JSON.stringify(engineResult, null, 2)} />}
            </div>
            <div className="bg-[#060607] border border-[#1A1A1C] rounded-lg p-3 h-[490px] overflow-y-auto font-mono text-[11px]">
              {!engineResult ? (
                <p className="text-zinc-800">$ waiting...</p>
              ) : engineResult.error ? (
                <pre className="text-red-400 whitespace-pre-wrap">{JSON.stringify(engineResult, null, 2)}</pre>
              ) : (
                <div className="space-y-1">
                  {[
                    ['bruto',               engineResult.bruto,                    'text-zinc-100'],
                    ['ter_rate',            engineResult.ter != null ? `${(engineResult.ter*100).toFixed(2)}%` : 'Pasal 17 ✓', 'text-sky-400'],
                    ['pph21',              engineResult.pph,                       'text-amber-400'],
                    ['tunj_pph',           engineResult.tunj_pph,                  'text-amber-300'],
                    ['thp',                engineResult.thp,                       'text-green-400'],
                    ['bpjs.employer_in_bruto', engineResult.bpjs?.employer_in_bruto, 'text-zinc-500'],
                    ['bpjs.karyawan_tunj', engineResult.bpjs?.karyawan_tunj,       'text-zinc-500'],
                    ['bpjs.karyawan_potong', engineResult.bpjs?.karyawan_potong,   'text-red-400'],
                  ].filter(([,v]) => v !== undefined).map(([l, v, c]) => (
                    <div key={l as string} className="flex justify-between py-0.5 border-b border-[#0F0F11]">
                      <span className="text-zinc-700">{l as string}</span>
                      <span className={c as string}>{typeof v === 'number' ? ('Rp ' + Math.round(v).toLocaleString('id-ID')) : String(v)}</span>
                    </div>
                  ))}
                  <details className="mt-3">
                    <summary className="text-[10px] text-zinc-700 cursor-pointer hover:text-zinc-500">full JSON</summary>
                    <pre className="text-[10px] text-zinc-600 mt-2 whitespace-pre-wrap">{JSON.stringify(engineResult, null, 2)}</pre>
                  </details>
                </div>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* Quick Actions */}
      <Section title="Quick Actions" icon={Terminal}>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Refresh All Stats',      desc: 'Re-fetch counts',                  icon: RefreshCw,  color: 'hover:border-sky-900/50 hover:text-sky-400',      action: fetchStats },
            { label: 'Export Payroll Results', desc: 'payroll_results.csv',               icon: Download,   color: 'hover:border-[#2563EB]/30 hover:text-[#2563EB]', action: () => exportTableCSV('payroll_results') },
            { label: 'Export Employees',       desc: 'employees.csv',                     icon: Users,      color: 'hover:border-green-900/40 hover:text-green-400',  action: () => exportTableCSV('employees') },
            { label: 'Export Activity Log',    desc: 'workspace_activity.csv',            icon: Shield,     color: 'hover:border-amber-900/40 hover:text-amber-400', action: () => exportTableCSV('workspace_activity') },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              className={`bg-[#0D0D0F] border border-[#1A1A1C] rounded-lg p-4 text-left transition-all ${item.color} group`}>
              <div className="flex items-center gap-3 mb-2">
                <item.icon size={13} className="text-zinc-700 group-hover:text-current transition-colors" />
                <p className="text-[11px] font-bold uppercase tracking-widest font-mono text-zinc-400 group-hover:text-current transition-colors">{item.label}</p>
              </div>
              <p className="text-[10px] text-zinc-700 font-mono">{item.desc}</p>
            </button>
          ))}
        </div>
      </Section>

      {/* Danger Zone */}
      <Section title="Danger Zone" icon={AlertTriangle}>
        <p className="text-[11px] text-red-500/60 font-mono mb-4">
          <span className="text-red-500">WARNING:</span> Affects ALL tenants. Irreversible.
        </p>
        <div className="space-y-2">
          {[
            { label: 'Clear All Payroll Results', table: 'payroll_results' },
            { label: 'Clear All Payroll Runs',    table: 'payroll_runs' },
            { label: 'Clear All Events',          table: 'employee_events' },
            { label: 'Clear Activity Log',        table: 'workspace_activity' },
          ].map(item => (
            <div key={item.table} className="flex items-center justify-between bg-[#0F0A0A] border border-red-900/20 rounded-lg px-4 py-3">
              <p className="text-[11px] font-bold text-zinc-500 font-mono">{item.label}</p>
              <button onClick={() => clearTable(item.table)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-900/20 border border-red-900/30 text-red-500/60 hover:text-red-400 rounded text-[10px] font-bold uppercase tracking-widest font-mono transition-colors">
                <Trash2 size={10} />Run
              </button>
            </div>
          ))}
        </div>
      </Section>

      <div className="bg-[#060607] border border-[#1A1A1C] rounded-lg p-4 font-mono text-[10px] text-zinc-800">
        <p>$ mios-payroll-v5 · next.js 15 · supabase · vercel · <span className="text-green-700">rls: enabled</span></p>
        <p>$ pp 58/2023 · pmk 168/2023 · ter method · pasal 17 dec equalization</p>
        <p>$ dev: {userEmail} · {new Date().toISOString().split('T')[0]}</p>
      </div>
    </div>
  );
}
