import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import MiosLogo from '@/components/ui/MiosLogo';

const BULAN = ['','Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

export default async function SharePage({ params }: { params: { token: string } }) {
  const supabase = await createClient();

  const { data: link } = await supabase
    .from('payroll_share_links')
    .select('*, payroll_runs(tahun, bulan, status), companies(name, npwp_perusahaan)')
    .eq('token', params.token)
    .single();

  if (!link) notFound();
  if (new Date(link.expires_at) < new Date()) {
    return (
      <div className="min-h-screen bg-[#080809] flex items-center justify-center font-mono">
        <p className="text-red-400 text-sm">Link sudah kadaluarsa.</p>
      </div>
    );
  }

  const { data: results } = await supabase
    .from('payroll_results')
    .select('employee_id, bruto, pph, thp, bpjs_karyawan, tunj_pph')
    .eq('run_id', link.run_id)
    .order('thp', { ascending: false });

  const { data: resultsWithJson } = await supabase
    .from('payroll_results')
    .select('employee_id, bruto, pph, thp, bpjs_karyawan, tunj_pph, result_json')
    .eq('run_id', link.run_id)
    .order('thp', { ascending: false });
  
  const totalBruto = (results ?? []).reduce((a, r) => a + (r.bruto ?? 0), 0);
  const totalPph   = (results ?? []).reduce((a, r) => a + (r.pph   ?? 0), 0);
  const totalThp   = (results ?? []).reduce((a, r) => a + (r.thp   ?? 0), 0);
  const company    = link.companies as any;
  const run        = link.payroll_runs as any;

  return (
    <div className="min-h-screen bg-[#080809] font-mono" style={{
      backgroundImage: 'linear-gradient(rgba(37,99,235,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.012) 1px, transparent 1px)',
      backgroundSize: '48px 48px'
    }}>
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <MiosLogo size="sm" showWordmark />
            <p className="text-[10px] text-zinc-700 mt-2 uppercase tracking-widest">Ringkasan Payroll — Hanya Baca</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-zinc-100">{company?.name ?? '—'}</p>
            {company?.npwp_perusahaan && (
              <p className="text-[11px] text-zinc-600">NPWP: {company.npwp_perusahaan}</p>
            )}
            <p className="text-[11px] text-zinc-500 mt-1">
              {BULAN[run?.bulan]} {run?.tahun}
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Bruto',  value: fmt(totalBruto), color: 'text-zinc-100' },
            { label: 'Total PPh 21', value: fmt(totalPph),   color: 'text-amber-400' },
            { label: 'Total THP',    value: fmt(totalThp),   color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="bg-[#0A0A0B] border border-[#1A1A1C] rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-widest text-zinc-700 mb-2">{s.label}</p>
              <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Employee breakdown */}
        <div className="bg-[#080809] border border-[#1A1A1C] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-[#0A0A0B] border-b border-[#1A1A1C] flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500/40" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/40" />
            <div className="w-2 h-2 rounded-full bg-green-500/40" />
            <span className="ml-2 text-[10px] text-zinc-700 uppercase tracking-widest">
              {results?.length ?? 0} karyawan
            </span>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#111113] text-[10px] uppercase tracking-widest text-zinc-700">
                <th className="px-5 py-3 text-left">Nama</th>
                <th className="px-5 py-3 text-left">PTKP</th>
                <th className="px-5 py-3 text-right">Bruto</th>
                <th className="px-5 py-3 text-right">PPh 21</th>
                <th className="px-5 py-3 text-right">THP</th>
              </tr>
            </thead>
            <tbody>
              {(resultsWithJson ?? []).map((r, i) => {
                const json  = (r.result_json as any) ?? {};
                return (
                  <tr key={i} className="border-b border-[#0F0F11] hover:bg-[#0A0A0B] transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-bold text-zinc-300 uppercase font-mono">
                        {json.employee_name ?? '—'}
                      </p>
                      <p className="text-[11px] text-zinc-700">{json.status_ptkp ?? '—'}</p>
                    </td>
                    <td className="px-5 py-3 text-zinc-400 font-mono">{fmt(r.bruto ?? 0)}</td>
                    <td className="px-5 py-3 text-amber-400 font-mono">{fmt(r.pph ?? 0)}</td>
                    <td className="px-5 py-3 font-bold text-green-400 font-mono">{fmt(r.thp ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[#1A1A1C]">
          <p className="text-[10px] text-zinc-800">PP 58/2023 · PMK 168/2023 · PPh 21 TER</p>
          <p className="text-[10px] text-zinc-800">
            Berlaku sampai {new Date(link.expires_at).toLocaleDateString('id-ID')}
          </p>
        </div>
      </div>
    </div>
  );
}
