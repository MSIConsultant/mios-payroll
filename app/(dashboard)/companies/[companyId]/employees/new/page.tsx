'use client';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createEmployee } from '@/lib/actions/employees';
import { ArrowLeft, Save, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  NpwpInput, NikInput, NominalInput, DateInput,
} from '@/components/ui/FormattedInput';

function SF({
  label, name, children, defaultValue,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  defaultValue?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
      >
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all"
      >
        {children}
      </select>
    </div>
  );
}

function TF({
  label, name, placeholder, type = 'text', required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
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
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all"
      />
    </div>
  );
}

function Section({
  title, description, children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
      <header className="px-5 py-4 border-b border-[var(--border-subtle)]">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</h2>
        {description && (
          <p className="text-[13px] text-[var(--text-muted)] mt-0.5">{description}</p>
        )}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Chk({
  name, label, defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group select-none">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="w-4 h-4 rounded border-[var(--border-strong)] text-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] cursor-pointer"
      />
      <span className="text-[14px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
        {label}
      </span>
    </label>
  );
}

const TYPE_LABEL: Record<string, string> = {
  tetap: 'Tetap',
  tidak_tetap_harian: 'Tidak Tetap · Harian',
  tidak_tetap_bulanan: 'Tidak Tetap · Bulanan',
};

export default function NewEmployeePage() {
  const router = useRouter();
  const { companyId } = useParams();
  const [loading, setLoading] = useState(false);
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
    <div className="max-w-3xl mx-auto space-y-6 pb-12 animate-fade-in-up">
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link
          href={`/companies/${companyId}`}
          className="inline-flex items-center gap-1 hover:text-[var(--brand)] transition-colors"
        >
          <ArrowLeft size={14} />
          Perusahaan
        </Link>
      </div>

      <header className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center">
          <UserPlus size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Karyawan Baru
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Tambahkan personel ke perusahaan.
          </p>
        </div>
      </header>

      <form action={handleSubmit} className="space-y-4">
        <input type="hidden" name="company_id" value={companyId} />

        <Section title="Identitas Diri">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <TF label="Nama Lengkap *" name="nama" required />
            </div>
            <NikInput label="NIK *" name="nik" required />
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
              {['TK0', 'TK1', 'TK2', 'TK3', 'K0', 'K1', 'K2', 'K3'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </SF>
            <DateInput label="Tanggal Masuk" name="tanggal_masuk" />
            <TF label="Divisi" name="divisi" placeholder="Engineering" />
            <TF label="Jabatan" name="jabatan" placeholder="Staff Akuntansi" />
          </div>
        </Section>

        <Section title="Kompensasi & Gaji">
          <div className="mb-5">
            <p className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">
              Tipe Karyawan *
            </p>
            <div className="flex gap-2 flex-wrap">
              {(['tetap', 'tidak_tetap_harian', 'tidak_tetap_bulanan'] as const).map((t) => {
                const active = jenisKaryawan === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setJenisKaryawan(t)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--brand)] text-white'
                        : 'bg-white border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {TYPE_LABEL[t]}
                  </button>
                );
              })}
              <input type="hidden" name="jenis_karyawan" value={jenisKaryawan} />
            </div>
          </div>

          {jenisKaryawan === 'tetap' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <NominalInput label="Gaji Pokok *" name="gaji_pokok" required />
              <NominalInput label="Benefit / Tunj. Tetap" name="benefit" />
              <NominalInput label="Tunj. Kendaraan" name="kendaraan" />
              <NominalInput label="Tunj. Pulsa" name="pulsa" />
              <NominalInput label="Tunj. Operasional" name="operasional" />
              <NominalInput label="Tunjangan Lain" name="tunj_lain" />
            </div>
          )}
          {jenisKaryawan === 'tidak_tetap_harian' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NominalInput label="Upah Harian *" name="upah_harian" required />
              <TF
                label="Hari Kerja Default"
                name="hari_kerja_default"
                type="number"
                placeholder="22"
              />
            </div>
          )}
          {jenisKaryawan === 'tidak_tetap_bulanan' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NominalInput label="Upah Bulanan *" name="upah_bulanan_tt" required />
              <NominalInput label="Tunjangan TT" name="tunjangan_tt" />
            </div>
          )}
        </Section>

        <Section title="BPJS & PPh 21">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <p className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Kepesertaan BPJS TK
              </p>
              <div className="space-y-2.5">
                <Chk name="ikut_jht" label="JHT" defaultChecked />
                <Chk name="ikut_jp" label="JP" defaultChecked />
                <Chk name="ikut_jkp" label="JKP" defaultChecked />
              </div>
              <div className="pt-3 border-t border-[var(--border-subtle)]">
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
              <p className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Tunjangan Iuran Karyawan
              </p>
              <div className="space-y-2.5">
                <Chk name="tanggung_jht_k" label="Tunjangan JHT Karyawan" defaultChecked />
                <Chk name="tanggung_jp_k" label="Tunjangan JP Karyawan" defaultChecked />
                <Chk name="ikut_kes" label="BPJS Kesehatan" defaultChecked />
                <Chk name="tanggung_kes_k" label="Tunjangan Kes Karyawan" defaultChecked />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Skema PPh 21
              </p>
              <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-lg p-4">
                <Chk name="pph_ditanggung" label="Grossup (Ditanggung Co.)" defaultChecked />
                <p className="text-[12px] text-[var(--text-muted)] mt-3 leading-relaxed">
                  Perusahaan menanggung PPh 21. THP = nominal gaji di atas.
                </p>
              </div>
            </div>
          </div>
        </Section>

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href={`/companies/${companyId}`}
            className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] rounded-lg transition-colors"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
          >
            <Save size={14} />
            {loading ? 'Menyimpan…' : 'Simpan Karyawan'}
          </button>
        </div>
      </form>
    </div>
  );
}
