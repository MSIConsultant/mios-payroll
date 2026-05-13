import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getImportHistory } from '@/lib/actions/import';
import Link from 'next/link';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react';

const BULAN = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

export default async function ImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles').select('role, workspace_id').eq('id', user.id).single();
  if (!profile || profile.role === 'staff') redirect('/dashboard');
  if (!profile.workspace_id) redirect('/onboarding');

  const history = await getImportHistory(profile.workspace_id);

  return (
    <div className="max-w-4xl space-y-8 animate-fade-in-up">

      {/* Header */}
      <div className="flex items-center justify-between border-b pb-6"
        style={{ borderColor: 'var(--border-default)' }}>
        <div>
          <h1 className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>
            Import Data
          </h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--text-muted)' }}>
            Impor data payroll dari Excel akuntan. Riwayat import tersimpan permanen.
          </p>
        </div>
        <Link href="/import/new"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[14px] text-white transition-colors"
          style={{ background: '#2563EB' }}>
          <Upload size={15} />
          Import Baru
        </Link>
      </div>

      {/* History */}
      {history.length === 0 ? (
        <div className="rounded-2xl p-16 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <FileSpreadsheet size={40} className="mx-auto mb-4" style={{ color: 'var(--text-ghost)' }} />
          <p className="text-[17px] font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>
            Belum ada import
          </p>
          <p className="text-[14px] mb-6" style={{ color: 'var(--text-muted)' }}>
            Mulai dengan mengimpor file Excel payroll bulanan.
          </p>
          <Link href="/import/new"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[14px] text-white"
            style={{ background: '#2563EB' }}>
            <Upload size={15} />
            Import Pertama
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((session: any, i: number) => {
            const diffs    = session.summary?.has_diffs ?? 0;
            const company  = (session.companies as any)?.name ?? '—';
            const hasDiffs = diffs > 0;

            return (
              <Link key={session.id}
                href={`/import/${session.id}`}
                className="flex items-center gap-5 px-5 py-4 rounded-xl transition-all group animate-fade-in-up"
                style={{
                  background:     'var(--bg-card)',
                  border:         '1px solid var(--border-default)',
                  animationDelay: `${i * 0.04}s`,
                  opacity:        0,
                }}>

                {/* Icon */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: hasDiffs ? 'rgba(251,176,64,0.1)' : 'rgba(34,197,94,0.1)' }}>
                  {hasDiffs
                    ? <AlertTriangle size={18} className="text-amber-400" />
                    : <CheckCircle2  size={18} className="text-green-400" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-[15px] truncate" style={{ color: 'var(--text-primary)' }}>
                      {session.file_name}
                    </p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest shrink-0"
                      style={{ background: 'rgba(37,99,235,0.1)', color: '#3B82F6' }}>
                      {BULAN[session.bulan]} {session.tahun}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                      {company}
                    </span>
                    <span style={{ color: 'var(--text-ghost)' }}>·</span>
                    <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                      {session.imported_rows} karyawan
                    </span>
                    {session.summary?.created > 0 && (
                      <>
                        <span style={{ color: 'var(--text-ghost)' }}>·</span>
                        <span className="text-[13px] text-green-400">
                          {session.summary.created} baru
                        </span>
                      </>
                    )}
                    {hasDiffs && (
                      <>
                        <span style={{ color: 'var(--text-ghost)' }}>·</span>
                        <span className="text-[13px] text-amber-400">
                          {diffs} perbedaan
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Totals */}
                {session.summary?.total_bruto && (
                  <div className="hidden md:flex flex-col items-end shrink-0">
                    <p className="text-[13px] font-bold font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {fmt(session.summary.total_thp)}
                    </p>
                    <p className="text-[11px] font-mono" style={{ color: 'var(--text-ghost)' }}>
                      Total THP
                    </p>
                  </div>
                )}

                {/* Date */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[12px] font-mono" style={{ color: 'var(--text-ghost)' }}>
                    {new Date(session.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </span>
                  <ChevronRight size={14} style={{ color: 'var(--text-ghost)' }}
                    className="group-hover:text-[#3B82F6] transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
