'use client';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createEmployee } from '@/lib/actions/employees';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { NpwpInput, NikInput, NominalInput, DateInput} from '@/components/ui/FormattedInput';

function SF({ label, name, children, defaultValue }: { label: string; name: string; children: React.ReactNode; defaultValue?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">{label}</label>
      <select name={name} defaultValue={defaultValue} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className="w-full px-3 py-2.5 bg-[#0D0D0F] border rounded-lg text-sm text-zinc-200 outline-none transition-colors font-mono"
        style={{ borderColor: focused ? 'rgba(37,99,235,0.4)' : '#1A1A1C' }}>
        {children}
      </select>
    </div>
  );
}

function TF({ label, name, placeholder, type = 'text', required }: { label: string; name: string; placeholder?: string; type?: string; required?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">{label}</label>
      <input name={name} type={type} required={required} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className="w-full px-3 py-2.5 bg-[#0D0D0F] border rounded-lg text-sm text-zinc-200 placeholder:text-zinc-700 outline-none transition-colors font-mono"
        style={{ borderColor: focused ? 'rgba(37,99,235,0.4)' : '#1A1A1C' }} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-[#1A1A1C] bg-[#0F0F11]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Chk({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <input type="checkbox" name={name} defaultChecked={defaultChecked}
        className="w-4 h-4 rounded border-zinc-700 bg-[#0D0D0F] text-[#2563EB] focus:ring-0 cursor-pointer" />
      <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors uppercase tracking-widest font-bold">{label}</span>
    </label>
  );
}

export default function NewEmployeePage() {
  const router = useRouter();
  const { companyId } = useParams();
  const [loading, setLoading]           = useState(false);
  const [jenisKaryawan, setJenisKaryawan] = useState('tetap');

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await createEmployee(formData);
    if (result.error) {
      toast.error(result.error);
      setLoading(false);
    } else {
      toast.success('Karyawan berhasil ditambahkan');
      router.push(`/companies/${companyId}`);
    }
  }

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      <div className="flex items-center gap-4">
        <Link href={`/companies/${companyId}`}
          className="w-9 h-9 bg-[#111113] border border-[#1A1A1C] rounded-lg flex items-center justify-center text-zinc-600 hover:text-zinc-200 transition-colors">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Karyawan Baru</h1>
          <p className="text-[11px] text-zinc-600 mt-0.5">Tambahkan personel ke perusahaan</p>
        </div>
      </div>

      <form action={handleSubmit} className="space-y-5">
        <input type="hidden" name="company_id" value={companyId} />

        <Section title="Identitas Diri">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <TF label="Nama Lengkap *" name="nama" required />
            </div>
            <NikInput  label="NIK *"   name="nik"  required />
            <SF label="Jenis Kelamin" name="jenis_kelamin">
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </SF>
            <NpwpInput label="NPWP (Opsional)" name="npwp" />
            <SF label="Punya NPWP?" name="punya_npwp">
              <option value="true">Ya (NPWP Valid)</option>
              <option value="false">Tidak (+20% PPh)</option>
            </SF>
            <SF label="Status PTKP *" name="status_ptkp">
              {['TK0','TK1','TK2','TK3','K0','K1','K2','K3'].map(s => <option key={s}>{s}</option>)}
            </SF>
            <DateInput label="Tanggal Masuk" name="tanggal_masuk" />
            <TF label="Divisi"   name="divisi"   placeholder="Engineering" />
            <TF label="Jabatan"  name="jabatan"  placeholder="Staff Akuntansi" />
          </div>
        </Section>

        <Section title="Kompensasi & Gaji">
          <div className="mb-5">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Tipe Karyawan *</p>
            <div className="flex gap-2 flex-wrap">
              {['tetap','tidak_tetap_harian','tidak_tetap_bulanan'].map(t => (
                <button key={t} type="button" onClick={() => setJenisKaryawan(t)}
                  className={`px-4 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                    jenisKaryawan === t
                      ? 'bg-[#1A1A1C] border-[#2563EB]/60 text-[#2563EB]'
                      : 'bg-[#0D0D0F] border-[#1A1A1C] text-zinc-600 hover:border-zinc-600'
                  }`}>{t.replace(/_/g,' ')}</button>
              ))}
              <input type="hidden" name="jenis_karyawan" value={jenisKaryawan} />
            </div>
          </div>

          {jenisKaryawan === 'tetap' && (
            <div className="grid grid-cols-3 gap-4">
              <NominalInput label="Gaji Pokok *"       name="gaji_pokok"  required />
              <NominalInput label="Benefit / Tunj. Tetap" name="benefit"   />
              <NominalInput label="Tunj. Kendaraan"    name="kendaraan"   />
              <NominalInput label="Tunj. Pulsa"        name="pulsa"       />
              <NominalInput label="Tunj. Operasional"  name="operasional" />
              <NominalInput label="Tunjangan Lain"     name="tunj_lain"   />
            </div>
          )}
          {jenisKaryawan === 'tidak_tetap_harian' && (
            <div className="grid grid-cols-2 gap-4">
              <NominalInput label="Upah Harian *"       name="upah_harian"       required />
              <TF           label="Hari Kerja Default"  name="hari_kerja_default" type="number" placeholder="22" />
            </div>
          )}
          {jenisKaryawan === 'tidak_tetap_bulanan' && (
            <div className="grid grid-cols-2 gap-4">
              <NominalInput label="Upah Bulanan *"   name="upah_bulanan_tt" required />
              <NominalInput label="Tunjangan TT"     name="tunjangan_tt"   />
            </div>
          )}
        </Section>

        <Section title="BPJS & PPh 21">
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Kepesertaan BPJS TK</p>
              <Chk name="ikut_jht" label="JHT" defaultChecked />
              <Chk name="ikut_jp"  label="JP"  defaultChecked />
              <Chk name="ikut_jkp" label="JKP" defaultChecked />
              <div className="pt-3 border-t border-[#1A1A1C]">
                <SF label="Tarif JKK" name="jkk_rate" defaultValue="0.0024">
                  <option value="0.0024">0.24% – Sangat Rendah</option>
                  <option value="0.0054">0.54% – Rendah</option>
                  <option value="0.0089">0.89% – Sedang</option>
                  <option value="0.0127">1.27% – Tinggi</option>
                  <option value="0.0174">1.74% – Sangat Tinggi</option>
                </SF>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Tunjangan Iuran Karyawan</p>
              <Chk name="tanggung_jht_k" label="Tunjangan JHT Karyawan" defaultChecked />
              <Chk name="tanggung_jp_k"  label="Tunjangan JP Karyawan"  defaultChecked />
              <Chk name="ikut_kes"       label="BPJS Kesehatan"         defaultChecked />
              <Chk name="tanggung_kes_k" label="Tunjangan Kes Karyawan" defaultChecked />
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Skema PPh 21</p>
              <div className="bg-[#0D0D0F] border border-[#1A1A1C] rounded-lg p-4">
                <Chk name="pph_ditanggung" label="Grossup (Ditanggung Co.)" defaultChecked />
                <p className="text-[10px] text-zinc-700 mt-3 leading-relaxed font-mono">
                  Perusahaan menanggung PPh 21. THP = nominal gaji di atas.
                </p>
              </div>
            </div>
          </div>
        </Section>

        <div className="flex justify-end gap-3">
          <Link href={`/companies/${companyId}`}
            className="px-5 py-2.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Batal</Link>
          <button type="submit" disabled={loading}
            className="inline-flex items-center gap-2 bg-[#2563EB] text-[#0A0A0B] px-6 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors">
            <Save size={13} />
            {loading ? 'Menyimpan...' : 'Simpan Karyawan'}
          </button>
        </div>
      </form>
    </div>
  );
}
