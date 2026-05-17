import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { getImportSession } from '@/lib/actions/import';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';

const fmt  = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const pct  = (n: number) => `${n.toFixed(1)}%`;
const BULAN = ['','Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'];

export default async function ImportSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { session, records } = await getImportSession(sessionId);
  if (!session) notFound();

  const company  = (session as any).companies?.name ?? '—';
  const diffs    = records.filter(r => r.has_diff);
  const matches  = records.filter(r => !r.has_diff);

  return (
    <div className="max-w-5xl space-y-6 animate-fade-in-up">

      <div className="flex items-center gap-4 border-b pb-6"
        style={{ borderColor: 'var(--border-default)' }}>
        <Link href="/import"
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
          <ArrowLeft size={15} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            {session.file_name}
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {company} · {BULAN[session.bulan]} {session.tahun} ·{' '}
            {new Date(session.created_at).toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',   value: records.length, color: 'var(--text-primary)' },
          { label: 'Match',   value: matches.length, color: '#4ADE80' },
          { label: 'Beda',    value: diffs.length,   color: diffs.length > 0 ? '#FBB040' : '#4ADE80' },
          { label: 'Total THP', value: fmt((session.summary as any)?.total_thp ?? 0), color: '#3B82F6' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-2xl font-black font-mono" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Reconciliation table */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-default)' }}>
        <div className="px-5 py-3 grid gap-3 text-[10px] font-bold uppercase tracking-widest"
          style={{
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px',
            borderBottom: '1px solid var(--border-default)',
            background: 'var(--bg-card)', color: 'var(--text-muted)',
          }}>
          <div>Karyawan</div>
          <div className="text-right">Bruto (Excel)</div>
          <div className="text-right">Bruto (Engine)</div>
          <div className="text-right">PPh</div>
          <div className="text-right">THP</div>
          <div className="text-center">Delta</div>
        </div>
        {records.map((r, i) => (
          <div key={i}
            className="px-5 py-3 grid gap-3 items-center text-[13px]"
            style={{
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px',
              borderBottom: '1px solid var(--border-subtle)',
              background: r.has_diff ? 'rgba(251,176,64,0.02)' : 'transparent',
            }}>
            <div>
              <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{r.employee_name}</p>
            </div>
            <div className="text-right font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
              {fmt((r.original_data as any)?.bruto ?? 0)}
            </div>
            <div className="text-right font-mono" style={{ color: r.has_diff ? '#FBB040' : 'var(--text-muted)' }}>
              {fmt((r.recalculated_data as any)?.bruto ?? 0)}
            </div>
            <div className="text-right font-mono text-amber-400">
              {fmt((r.original_data as any)?.pph ?? 0)}
            </div>
            <div className="text-right font-mono text-green-400 font-bold">
              {fmt((r.original_data as any)?.thp ?? 0)}
            </div>
            <div className="flex justify-center">
              {r.has_diff
                ? <span className="text-[11px] font-bold text-amber-400">
                    {pct((r.differences as any)?.diff_pct ?? 0)}
                  </span>
                : <CheckCircle2 size={14} className="text-green-500" />
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
