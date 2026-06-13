'use client';
// Data tab — company "database" settings (workbook PR 2): edit company info,
// archive/restore, and the entry point to seed/extend this database from the
// accountant's Excel workbook. Lifted from the old company detail page.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/lib/types';
import { Building2, Edit2, X, Save, Upload, FileSpreadsheet } from 'lucide-react';
import { updateCompany } from '@/lib/actions/companies';
import { NpwpCompanyInput } from '@/components/ui/FormattedInput';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';

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

export default function CompanyDataPage() {
  const { companyId } = useParams();
  const confirm = useConfirm();
  const [company, setCompany]   = useState<Company | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: co } = await supabase.from('companies')
        .select('id, name, npwp_perusahaan, aktif, industri, kota, alamat')
        .eq('id', companyId).single();
      if (co) setCompany(co as Company);
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
      const { data } = await supabase.from('companies')
        .select('id, name, npwp_perusahaan, aktif, industri, kota, alamat')
        .eq('id', companyId).single();
      if (data) setCompany(data as Company);
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

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 bg-white border border-[var(--border-default)] rounded-xl animate-pulse" />
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

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Company info */}
      <section className="bg-white border border-[var(--border-default)] rounded-xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Info Perusahaan</h2>
            <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-1.5 text-[13px]">
              <dt className="text-[var(--text-muted)]">Nama</dt>
              <dd className="font-semibold text-[var(--text-primary)]">{company.name}</dd>
              <dt className="text-[var(--text-muted)]">NPWP</dt>
              <dd className="font-mono text-[var(--text-secondary)]">{company.npwp_perusahaan || '—'}</dd>
              <dt className="text-[var(--text-muted)]">Industri</dt>
              <dd className="text-[var(--text-secondary)]">{company.industri || '—'}</dd>
              <dt className="text-[var(--text-muted)]">Kota</dt>
              <dd className="text-[var(--text-secondary)]">{company.kota || '—'}</dd>
              <dt className="text-[var(--text-muted)]">Alamat</dt>
              <dd className="text-[var(--text-secondary)]">{company.alamat || '—'}</dd>
            </dl>
          </div>
          <div className="flex gap-2">
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
          </div>
        </div>
      </section>

      {/* Import — seed/extend this company database from Excel */}
      <section className="bg-white border border-[var(--border-default)] rounded-xl p-5 sm:p-6">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Import dari Excel</h2>
        <p className="text-[13px] text-[var(--text-muted)] mt-1 leading-relaxed">
          Isi database perusahaan ini dari workbook payroll akuntan (format <span className="font-mono">Grossup PPh 21 MM-YYYY.xlsx</span>):
          karyawan dibuat/diperbarui via NIK, run bulanan tersimpan terkunci.
        </p>
        <div className="mt-4 flex gap-2 flex-wrap">
          <Link
            href="/import/bulk"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--brand)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--brand-hover)] transition-colors shadow-sm"
          >
            <Upload size={14} />
            Import Bulk (multi-bulan)
          </Link>
          <Link
            href="/import/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors"
          >
            <FileSpreadsheet size={14} />
            Import Satu Bulan (rekonsiliasi detail)
          </Link>
        </div>
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
