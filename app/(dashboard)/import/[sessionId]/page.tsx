import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { getImportSession } from '@/lib/actions/import';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';

const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const pct = (n: number) => `${n.toFixed(1)}%`;
const BULAN = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default async function ImportSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { session, records } = await getImportSession(sessionId);
  if (!session) notFound();

  const company = (session as any).companies?.name ?? '—';
  const diffs = records.filter((r) => r.has_diff);
  const matches = records.filter((r) => !r.has_diff);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link
          href="/import"
          className="inline-flex items-center gap-1 hover:text-[var(--brand)] transition-colors"
        >
          <ArrowLeft size={14} />
          Import
        </Link>
      </div>

      <header className="bg-white border border-[var(--border-default)] rounded-xl p-5 sm:p-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] break-all">
          {session.file_name}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {company} · {BULAN[session.bulan]} {session.tahun} ·{' '}
          {new Date(session.created_at).toLocaleString('id-ID')}
        </p>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total" value={records.length} />
        <Stat label="Match" value={matches.length} accent="emerald" />
        <Stat
          label="Beda"
          value={diffs.length}
          accent={diffs.length > 0 ? 'amber' : 'emerald'}
        />
        <Stat
          label="Total THP"
          value={fmt((session.summary as any)?.total_thp ?? 0)}
          accent="brand"
        />
      </div>

      {/* Reconciliation */}
      <section className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
            Rekonsiliasi{' '}
            <span className="text-[var(--text-muted)] font-normal">
              ({records.length})
            </span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Karyawan</th>
                <th className="text-right">Bruto (Excel)</th>
                <th className="text-right">Bruto (Engine)</th>
                <th className="text-right">PPh</th>
                <th className="text-right">THP</th>
                <th className="text-center">Delta</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i} className={r.has_diff ? 'bg-amber-50/40' : ''}>
                  <td className="font-semibold text-[var(--text-primary)]">
                    {r.employee_name}
                  </td>
                  <td className="text-right font-mono font-semibold">
                    {fmt((r.original_data as any)?.bruto ?? 0)}
                  </td>
                  <td
                    className={`text-right font-mono ${
                      r.has_diff ? 'text-amber-700 font-semibold' : ''
                    }`}
                  >
                    {fmt((r.recalculated_data as any)?.bruto ?? 0)}
                  </td>
                  <td className="text-right font-mono text-amber-700">
                    {fmt((r.original_data as any)?.pph ?? 0)}
                  </td>
                  <td className="text-right font-mono font-bold text-emerald-700">
                    {fmt((r.original_data as any)?.thp ?? 0)}
                  </td>
                  <td className="text-center">
                    {r.has_diff ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                        <AlertTriangle size={11} />
                        {pct((r.differences as any)?.diff_pct ?? 0)}
                      </span>
                    ) : (
                      <CheckCircle2 size={14} className="text-emerald-600 inline" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label, value, accent,
}: {
  label: string;
  value: string | number;
  accent?: 'brand' | 'emerald' | 'amber';
}) {
  const accentMap = {
    brand: 'text-[var(--brand)]',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
  } as const;
  const text = accent ? accentMap[accent] : 'text-[var(--text-primary)]';
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold font-mono ${text}`}>{value}</p>
    </div>
  );
}
