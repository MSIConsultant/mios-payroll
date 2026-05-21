import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getImportHistory } from '@/lib/actions/import';
import Link from 'next/link';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ChevronRight, Layers,
} from 'lucide-react';

const BULAN = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

export default async function ImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, workspace_id')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role === 'staff') redirect('/dashboard');
  if (!profile.workspace_id) redirect('/onboarding');

  const history = await getImportHistory(profile.workspace_id);

  return (
    <div className="space-y-7 animate-fade-in-up">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-5 border-b border-[var(--border-default)]">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Import Data
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Impor data payroll dari Excel akuntan. Riwayat import tersimpan permanen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/import/bulk"
            className="inline-flex items-center gap-2 bg-white border border-[var(--border-default)] hover:border-[var(--brand)] hover:text-[var(--brand)] text-[var(--text-secondary)] px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            <Layers size={16} />
            Import Bulk
          </Link>
          <Link
            href="/import/new"
            className="inline-flex items-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <Upload size={16} />
            Import Baru
          </Link>
        </div>
      </header>

      {history.length === 0 ? (
        <div className="bg-white border border-dashed border-[var(--border-default)] rounded-xl py-16 text-center">
          <FileSpreadsheet size={36} className="mx-auto text-[var(--text-faint)]" />
          <p className="mt-4 text-base font-semibold text-[var(--text-secondary)]">
            Belum ada import
          </p>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Mulai dengan mengimpor file Excel payroll bulanan.
          </p>
          <Link
            href="/import/new"
            className="mt-5 inline-flex items-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <Upload size={16} />
            Import Pertama
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {history.map((session: any, i: number) => {
            const diffs = session.summary?.has_diffs ?? 0;
            const company = (session.companies as any)?.name ?? '—';
            const hasDiffs = diffs > 0;

            return (
              <li
                key={session.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${Math.min(i, 8) * 0.04}s`, opacity: 0 }}
              >
                <Link
                  href={`/import/${session.id}`}
                  className="group flex items-center gap-4 bg-white border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:shadow-md rounded-xl px-4 py-4 transition-all"
                >
                  <div
                    className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${
                      hasDiffs ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {hasDiffs ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[15px] text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors truncate">
                        {session.file_name}
                      </p>
                      <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset bg-[var(--brand-soft)] text-[var(--brand)] ring-blue-200 font-mono">
                        {BULAN[session.bulan]} {session.tahun}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[13px] text-[var(--text-muted)] flex-wrap">
                      <span>{company}</span>
                      <span>·</span>
                      <span>{session.imported_rows} karyawan</span>
                      {session.summary?.created > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-700 font-semibold">
                            {session.summary.created} baru
                          </span>
                        </>
                      )}
                      {hasDiffs && (
                        <>
                          <span>·</span>
                          <span className="text-amber-700 font-semibold">
                            {diffs} perbedaan
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {session.summary?.total_thp && (
                    <div className="hidden md:flex flex-col items-end shrink-0">
                      <p className="text-[14px] font-mono font-semibold text-emerald-700">
                        {fmt(session.summary.total_thp)}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">Total THP</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[12px] font-mono text-[var(--text-muted)]">
                      {new Date(session.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <ChevronRight
                      size={16}
                      className="text-[var(--text-faint)] group-hover:text-[var(--brand)] group-hover:translate-x-0.5 transition-all"
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
