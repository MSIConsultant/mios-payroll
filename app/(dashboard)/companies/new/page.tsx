'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCompany } from '@/lib/actions/companies';
import { useWorkspace } from '@/hooks/useWorkspace';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { NpwpInput } from '@/components/ui/FormattedInput';
import { toast } from 'sonner';

function TF({ label, name, placeholder, required }: { label: string; name: string; placeholder?: string; required?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">{label}</label>
      <input name={name} type="text" required={required} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className="w-full px-3 py-2.5 bg-[#0D0D0F] border rounded-lg text-sm text-zinc-200 placeholder:text-zinc-700 outline-none transition-colors font-mono"
        style={{ borderColor: focused ? 'rgba(37,99,235,0.4)' : '#1A1A1C' }} />
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
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/companies"
          className="w-9 h-9 bg-[#111113] border border-[#1A1A1C] rounded-lg flex items-center justify-center text-zinc-600 hover:text-zinc-200 transition-colors">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Tambah Perusahaan</h1>
          <p className="text-[11px] text-zinc-600 mt-0.5">Daftarkan klien baru</p>
        </div>
      </div>

      <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg p-6">
        <form action={handleSubmit} className="space-y-5">
          <input type="hidden" name="workspace_id" value={workspace?.id ?? ''} />
          <TF label="Nama Perusahaan *" name="name" placeholder="PT Bangun Jaya Abadi" required />
          <div className="grid grid-cols-2 gap-4">
            <NpwpInput label="NPWP Perusahaan" name="npwp_perusahaan" />
            <TF label="Industri" name="industri" placeholder="Manufaktur" />
            <TF label="Kota"     name="kota"     placeholder="Jakarta Selatan" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">Alamat</label>
            <textarea name="alamat" rows={2} placeholder="Alamat lengkap kantor..."
              className="w-full px-3 py-2.5 bg-[#0D0D0F] border border-[#1A1A1C] rounded-lg text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-[#2563EB]/40 transition-colors resize-none font-mono" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Link href="/companies" className="px-4 py-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Batal</Link>
            <button type="submit" disabled={loading || !workspace}
              className="inline-flex items-center gap-2 bg-[#2563EB] text-[#0A0A0B] px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors">
              <Save size={13} />
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
