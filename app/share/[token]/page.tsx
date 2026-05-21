import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import MiosLogo from '@/components/ui/MiosLogo';
import { AlertCircle } from 'lucide-react';

const BULAN = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

export default async function SharePage(props: {
  params: Promise<{ token: string }>;
}) {
  const params = await props.params;
  const { token } = params;

  const supabase = await createClient();

  const { data: link } = await supabase
    .from('payroll_share_links')
    .select('*, payroll_runs(tahun, bulan, status), companies(name, npwp_perusahaan)')
    .eq('token', token)
    .single();

  if (!link) notFound();

  if (new Date(link.expires_at) < new Date()) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-4">
        <div className="bg-white border border-[var(--border-default)] rounded-2xl shadow-sm p-8 text-center max-w-sm">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-50 ring-1 ring-red-200 flex items-center justify-center">
            <AlertCircle size={26} className="text-red-600" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Link sudah kadaluarsa
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Minta pemilik untuk membuat link baru.
          </p>
        </div>
      </div>
    );
  }

  const { data: results } = await supabase
    .from('payroll_results')
    .select(
      'employee_id, bruto, pph, thp, bpjs_karyawan, tunj_pph, result_json, employee_name, status_ptkp',
    )
    .eq('run_id', link.run_id)
    .order('thp', { ascending: false });

  const totalBruto = (results ?? []).reduce((a, r) => a + (Number(r.bruto) ?? 0), 0);
  const totalPph = (results ?? []).reduce((a, r) => a + (Number(r.pph) ?? 0), 0);
  const totalThp = (results ?? []).reduce((a, r) => a + (Number(r.thp) ?? 0), 0);

  const company = link.companies as any;
  const run = link.payroll_runs as any;

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-7">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <MiosLogo size="sm" showWordmark />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mt-3">
              Ringkasan Payroll · Hanya Baca
            </p>
          </div>
          <div className="sm:text-right">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {company?.name ?? '—'}
            </h1>
            {company?.npwp_perusahaan && (
              <p className="text-[12px] font-mono text-[var(--text-muted)] mt-0.5">
                NPWP {company.npwp_perusahaan}
              </p>
            )}
            <p className="text-sm font-semibold text-[var(--brand)] mt-1">
              {BULAN[run?.bulan]} {run?.tahun}
            </p>
          </div>
        </header>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryCard label="Total Bruto" value={fmt(totalBruto)} />
          <SummaryCard label="Total PPh 21" value={fmt(totalPph)} tone="amber" />
          <SummaryCard label="Total THP" value={fmt(totalThp)} tone="emerald" strong />
        </div>

        {/* Breakdown */}
        <section className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
              Rincian Karyawan{' '}
              <span className="text-[var(--text-muted)] font-normal">
                ({results?.length ?? 0})
              </span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>PTKP</th>
                  <th className="text-right">Bruto</th>
                  <th className="text-right">PPh 21</th>
                  <th className="text-right">THP</th>
                </tr>
              </thead>
              <tbody>
                {(results ?? []).map((r, i) => {
                  const json = (r.result_json as any) ?? {};
                  const name = r.employee_name ?? json.employee_name ?? '—';
                  const ptkp = r.status_ptkp ?? json.status_ptkp ?? '—';
                  return (
                    <tr key={i}>
                      <td className="font-semibold text-[var(--text-primary)]">{name}</td>
                      <td className="font-mono">{ptkp}</td>
                      <td className="text-right font-mono">{fmt(Number(r.bruto) ?? 0)}</td>
                      <td className="text-right font-mono text-amber-700">
                        {fmt(Number(r.pph) ?? 0)}
                      </td>
                      <td className="text-right font-mono font-bold text-emerald-700">
                        {fmt(Number(r.thp) ?? 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer */}
        <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-4 border-t border-[var(--border-default)]">
          <p className="text-[11px] font-mono text-[var(--text-muted)]">
            PP 58/2023 · PMK 168/2023 · PPh 21 TER
          </p>
          <p className="text-[11px] font-mono text-[var(--text-muted)]">
            Berlaku sampai {new Date(link.expires_at).toLocaleDateString('id-ID')}
          </p>
        </footer>
      </div>
    </div>
  );
}

function SummaryCard({
  label, value, tone, strong,
}: {
  label: string;
  value: string;
  tone?: 'amber' | 'emerald';
  strong?: boolean;
}) {
  const toneMap = {
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
  } as const;
  const text = tone ? toneMap[tone] : 'text-[var(--text-primary)]';
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-xl p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={`mt-2 text-xl font-mono ${strong ? 'font-bold' : 'font-semibold'} ${text}`}
      >
        {value}
      </p>
    </div>
  );
}
