'use client';
// Karyawan tab — employee master for one company (workbook PR 2). Lifted
// from the old company detail page; company header/edit moved to the Data tab.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Employee } from '@/lib/types';
import { Users, Plus, Search, ChevronRight } from 'lucide-react';
import { formatRupiah } from '@/lib/format';

function EmployeeInitials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return (
    <div
      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white"
      style={{ background: `hsl(${hue} 55% 50%)` }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export default function CompanyEmployeesPage() {
  const { companyId } = useParams();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: emps } = await supabase
        .from('employees')
        .select('id, nama, nik, jenis_karyawan, status_ptkp, punya_npwp, gaji_pokok, benefit')
        .eq('company_id', companyId).eq('aktif', true).order('nama');
      if (emps) setEmployees(emps as Employee[]);
      setLoading(false);
    }
    if (companyId) fetchData();
  }, [companyId]);

  const filtered = employees.filter((e) =>
    e.nama.toLowerCase().includes(search.toLowerCase()) ||
    e.nik.toLowerCase().includes(search.toLowerCase()),
  );

  const totalBruto = employees.reduce(
    (a, e) => a + (e.gaji_pokok ?? 0) + (e.benefit ?? 0),
    0,
  );

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-white border border-[var(--border-default)] rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-[var(--border-default)] rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Karyawan Aktif</p>
          <p className="mt-1.5 text-2xl font-bold font-mono text-[var(--brand)]">{employees.length}</p>
        </div>
        <div className="bg-white border border-[var(--border-default)] rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Total Gaji + Benefit</p>
          <p className="mt-1.5 text-2xl font-bold font-mono text-[var(--text-primary)]">{formatRupiah(totalBruto)}</p>
        </div>
      </div>

      {/* Employees */}
      <section className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[var(--text-muted)]" />
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
              Karyawan{' '}
              <span className="text-[var(--text-muted)] font-normal">({filtered.length})</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
              />
              <input
                type="text"
                placeholder="Cari nama atau NIK…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 bg-white border border-[var(--border-default)] rounded-lg text-sm placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all w-full sm:w-64"
              />
            </div>
            <Link
              href={`/companies/${companyId}/employees/new`}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--brand)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--brand-hover)] transition-colors shadow-sm shrink-0"
            >
              <Plus size={14} />
              Karyawan
            </Link>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Users size={28} className="mx-auto text-[var(--text-faint)]" />
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              {search ? 'Tidak ditemukan' : 'Belum ada karyawan'}
            </p>
            {!search && (
              <Link
                href={`/companies/${companyId}/employees/new`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:underline"
              >
                <Plus size={14} />
                Tambah karyawan pertama
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {filtered.map((emp) => (
              <li key={emp.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/companies/${companyId}/employees/${emp.id}`)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg-subtle)] transition-colors text-left group cursor-pointer"
                >
                  <EmployeeInitials name={emp.nama} />

                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors truncate">
                      {emp.nama}
                    </p>
                    <p className="text-[12px] text-[var(--text-muted)] font-mono mt-0.5">
                      NIK {emp.nik}
                    </p>
                  </div>

                  <span
                    className={`hidden sm:inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${
                      emp.jenis_karyawan === 'tetap'
                        ? 'bg-sky-50 text-sky-700 ring-sky-200'
                        : 'bg-slate-100 text-slate-600 ring-slate-200'
                    }`}
                  >
                    {emp.jenis_karyawan === 'tetap' ? 'Tetap' : 'Tidak Tetap'}
                  </span>

                  <div className="hidden md:flex items-center gap-2 shrink-0">
                    <span className="text-[12px] text-[var(--text-secondary)] font-medium">
                      {emp.status_ptkp}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        emp.punya_npwp
                          ? 'text-emerald-700 bg-emerald-50'
                          : 'text-red-700 bg-red-50'
                      }`}
                    >
                      {emp.punya_npwp ? 'NPWP ✓' : 'NO NPWP'}
                    </span>
                  </div>

                  <div className="text-right shrink-0 min-w-[120px]">
                    <p className="text-[15px] font-semibold text-[var(--text-primary)] font-mono">
                      {formatRupiah(emp.gaji_pokok)}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">gaji pokok</p>
                  </div>

                  <ChevronRight
                    size={16}
                    className="text-[var(--text-faint)] group-hover:text-[var(--brand)] group-hover:translate-x-0.5 transition-all shrink-0"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
