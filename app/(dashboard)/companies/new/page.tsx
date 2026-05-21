'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCompany } from '@/lib/actions/companies';
import { useWorkspace } from '@/hooks/useWorkspace';
import { ArrowLeft, Save, Building2 } from 'lucide-react';
import Link from 'next/link';
import { NpwpInput } from '@/components/ui/FormattedInput';
import { toast } from 'sonner';

function TF({
  label, name, placeholder, required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all"
      />
    </div>
  );
}

export default function NewCompanyPage() {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (!workspace) return;
    setLoading(true);
    const result = await createCompany(formData);
    if (result.error) {
      toast.error(result.error);
      setLoading(false);
    } else {
      toast.success('Perusahaan berhasil dibuat');
      router.push('/companies');
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link
          href="/companies"
          className="inline-flex items-center gap-1 hover:text-[var(--brand)] transition-colors"
        >
          <ArrowLeft size={14} />
          Perusahaan
        </Link>
      </div>

      <header className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center">
          <Building2 size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Tambah Perusahaan
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Daftarkan klien baru.</p>
        </div>
      </header>

      <div className="bg-white border border-[var(--border-default)] rounded-xl p-6">
        <form action={handleSubmit} className="space-y-5">
          <input type="hidden" name="workspace_id" value={workspace?.id ?? ''} />

          <TF label="Nama Perusahaan *" name="name" placeholder="PT Bangun Jaya Abadi" required />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NpwpInput label="NPWP Perusahaan" name="npwp_perusahaan" />
            <TF label="Industri" name="industri" placeholder="Manufaktur" />
            <TF label="Kota" name="kota" placeholder="Jakarta Selatan" />
          </div>

          <div>
            <label
              htmlFor="alamat"
              className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
            >
              Alamat
            </label>
            <textarea
              id="alamat"
              name="alamat"
              rows={3}
              placeholder="Alamat lengkap kantor…"
              className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
            <Link
              href="/companies"
              className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] rounded-lg transition-colors"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={loading || !workspace}
              className="inline-flex items-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              <Save size={14} />
              {loading ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
