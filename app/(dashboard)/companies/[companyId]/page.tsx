'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Company, Employee } from '@/lib/types';
import {
  Users, Plus, Search, ArrowLeft, ChevronRight, Calendar,
  Edit2, X, Save, Upload, Download, Building2,
} from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { updateCompany } from '@/lib/actions/companies';
import { NpwpCompanyInput } from '@/components/ui/FormattedInput';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';

const BULAN = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function TF({
  label, name, defaultValue, placeholder,
}: { label: string; name: string; defaultValue?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">
        {label}
      </label>
      <input
        name={name}
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all"
      />
    </div>
  );
}

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

export default function CompanyDetailPage() {
  const { companyId } = useParams();
  const router = useRouter();
  const confirm = useConfirm();
  const [company, setCompany]     = useState<Company | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [lastRun, setLastRun]     = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [showEdit, setShowEdit]   = useState(false);
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const [{ data: co }, { data: emps }, { data: run }] = await Promise.all([
        supabase.from('companies').select('*').eq('id', companyId).single(),
        supabase.from('employees').select('*').eq('company_id', companyId).eq('aktif', true).order('nama'),
        supabase.from('payroll_runs').select('*').eq('company_id', companyId)
          .order('tahun', { ascending: false }).order('bulan', { ascending: false })
          .limit(1).maybeSingle(),
      ]);
      if (co) setCompany(co);
      if (emps) setEmployees(emps);
      if (run) setLastRun(run);
      setLoading(false);
    }
    if (companyId) fetchData();
  }, [companyId]);

  async function handleEditCompany(formData: FormData) {
    setSaving(true);
    const res = await updateCompany(companyId as string, formData);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('Data perusahaan diperbarui');
      setShowEdit(false);
      const supabase = createClient();
      const { data } = await supabase.from('companies').select('*').eq('id', companyId).single();
      if (data) setCompany(data);
    }
    setSaving(false);
  }

  async function handleArchive() {
    if (!company) return;
    if (!(await confirm({
      title: company.aktif ? 'Arsipkan perusahaan?' : 'Aktifkan perusahaan?',
      message: company.aktif
        ? `${company.name} akan disembunyikan dari daftar aktif. Data tetap tersimpan.`
        : `${company.name} akan ditampilkan kembali di daftar aktif.`,
      severity: 'warn',
    }))) return;
    const { archiveCompany } = await import('@/lib/actions/companies');
    const res = await archiveCompany(company.id, !company.aktif);
    if (res.error) toast.error(res.error);
    else {
      toast.success(company.aktif ? 'Perusahaan diarsipkan' : 'Perusahaan diaktifkan');
      setCompany((c) => (c ? { ...c, aktif: !c.aktif } : c));
    }
  }

  const filtered = employees.filter((e) =>
    e.nama.toLowerCase().includes(search.toLowerCase()) ||
    e.nik.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="h-20 bg-white border border-[var(--border-default)] rounded-xl animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white border border-[var(--border-default)] rounded-xl animate-pulse" />
          ))}
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-white border border-[var(--border-default)] rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!company) {
    return (
      <div className="bg-white border border-dashed border-[var(--border-default)] rounded-xl py-16 text-center">
        <Building2 size={32} className="mx-auto text-[var(--text-faint)]" />
        <p className="mt-3 text-sm text-[var(--text-secondary)]">Perusahaan tidak ditemukan.</p>
      </div>
    );
  }

  const totalBruto = employees.reduce(
    (a, e) => a + (e.gaji_pokok ?? 0) + (e.benefit ?? 0),
    0,
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Breadcrumb / back */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link
          href="/companies"
          className="inline-flex items-center gap-1 hover:text-[var(--brand)] transition-colors"
        >
          <ArrowLeft size={14} />
          Perusahaan
        </Link>
      </div>

      {/* Header card */}
      <header className="bg-white border border-[var(--border-default)] rounded-xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center">
              <Building2 size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] truncate">
                  {company.name}
                </h1>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${
                    company.aktif
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      : 'bg-slate-100 text-slate-600 ring-slate-200'
                  }`}
                >
                  {company.aktif ? 'Aktif' : 'Arsip'}
                </span>
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {company.industri ?? '—'} · {company.kota ?? '—'}
                {company.npwp_perusahaan ? (
                  <span className="font-mono"> · NPWP {company.npwp_perusahaan}</span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <Edit2 size={14} />
              Edit
            </button>
            <button
              onClick={handleArchive}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              {company.aktif ? 'Arsipkan' : 'Aktifkan'}
            </button>
            <Link
              href={`/companies/${companyId}/employees/import`}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Upload size={14} />
              Import Karyawan
            </Link>
            <Link
              href={`/companies/${companyId}/import`}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Download size={14} />
              Import Excel
            </Link>
            <Link
              href={`/companies/${companyId}/payroll`}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--brand)] text-[var(--brand)] rounded-lg text-sm font-semibold hover:bg-[var(--brand-soft)] transition-colors"
            >
              <Calendar size={14} />
              Payroll
            </Link>
            <Link
              href={`/companies/${companyId}/employees/new`}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--brand)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--brand-hover)] transition-colors shadow-sm"
            >
              <Plus size={14} />
              Karyawan
            </Link>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Karyawan Aktif" value={String(employees.length)} accent="brand" mono />
        <StatCard
          label="Payroll Terakhir"
          value={lastRun ? `${BULAN[lastRun.bulan]} ${lastRun.tahun}` : '—'}
          sub={lastRun?.status}
        />
        <StatCard label="Est. Bruto Bulanan" value={formatRupiah(totalBruto)} mono />
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

      {/* Edit modal */}
      {showEdit && (
        <div
          className="fixed inset-0 bg-[var(--bg-overlay)] z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowEdit(false)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-lg overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Edit Perusahaan
              </h3>
              <button
                onClick={() => setShowEdit(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-md cursor-pointer"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>
            <form
              action={async (fd) => {
                await handleEditCompany(fd);
              }}
              className="p-5 space-y-4"
            >
              <TF label="Nama Perusahaan *" name="name" defaultValue={company.name} placeholder="PT Bangun Jaya Abadi" />
              <NpwpCompanyInput label="NPWP Perusahaan" name="npwp_perusahaan" defaultValue={company.npwp_perusahaan ?? ''} />
              <div className="grid grid-cols-2 gap-4">
                <TF label="Industri" name="industri" defaultValue={company.industri ?? ''} placeholder="Manufaktur" />
                <TF label="Kota" name="kota" defaultValue={company.kota ?? ''} placeholder="Jakarta" />
              </div>
              <TF label="Alamat" name="alamat" defaultValue={company.alamat ?? ''} placeholder="Alamat lengkap" />
              <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Save size={14} />
                  {saving ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, sub, accent, mono,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'brand';
  mono?: boolean;
}) {
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-xl p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-bold tracking-tight ${
          accent === 'brand' ? 'text-[var(--brand)]' : 'text-[var(--text-primary)]'
        } ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider mt-1">{sub}</p>
      )}
    </div>
  );
}
