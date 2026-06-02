'use client';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createEmployee } from '@/lib/actions/employees';
import {
  ArrowLeft, Save, UserPlus, Sparkles, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { NpwpInput, NikInput, NominalInput, DateInput } from '@/components/ui/FormattedInput';

const INPUT_CLS  = 'w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all';
const TEXTAREA_CLS = `${INPUT_CLS} resize-none min-h-[80px] leading-relaxed`;

const TYPE_LABEL: Record<string, string> = {
  tetap: 'Tetap',
  tidak_tetap_harian: 'Tidak Tetap · Harian',
  tidak_tetap_bulanan: 'Tidak Tetap · Bulanan',
};

// One-click BPJS + PPh 21 scheme presets. Mirrors the PRESETS array in
// components/payroll/MonthlyLedgerSimulator.tsx so the accountant gets the
// same muscle-memory in both flows.
type SchemeId = 'skema1' | 'skema2' | 'skema3' | 'skema4';
const SCHEME_PRESETS: {
  id: SchemeId; emoji: string; label: string; desc: string;
  tanggungJhtK: boolean; tanggungJpK: boolean; tanggungKesK: boolean;
  pphDitanggung: boolean;
}[] = [
  { id: 'skema1', emoji: '📋', label: 'PPH & BPJS Potong',  desc: 'Paling umum — dipotong dari gaji', tanggungJhtK: false, tanggungJpK: false, tanggungKesK: false, pphDitanggung: false },
  { id: 'skema2', emoji: '🏥', label: 'BPJS Ditanggung',    desc: 'BPJS ditanggung perusahaan; PPh dipotong', tanggungJhtK: true,  tanggungJpK: true,  tanggungKesK: true,  pphDitanggung: false },
  { id: 'skema3', emoji: '🧾', label: 'PPH Grossup',         desc: 'BPJS dipotong; PPh ditanggung perusahaan', tanggungJhtK: false, tanggungJpK: false, tanggungKesK: false, pphDitanggung: true },
  { id: 'skema4', emoji: '✅', label: 'Full Grossup',        desc: 'BPJS & PPh ditanggung perusahaan', tanggungJhtK: true,  tanggungJpK: true,  tanggungKesK: true,  pphDitanggung: true },
];

function Label({ text, htmlFor, required }: { text: string; htmlFor?: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">
      {text}{required && <span className="text-[var(--red)] ml-0.5">*</span>}
    </label>
  );
}

function TF({ label, name, placeholder, type = 'text', required, defaultValue }: {
  label: string; name: string; placeholder?: string; type?: string; required?: boolean; defaultValue?: string;
}) {
  return (
    <div>
      <Label text={label} htmlFor={name} required={required} />
      <input id={name} name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} className={INPUT_CLS} />
    </div>
  );
}

function CSel({ label, name, value, onChange, children, required }: {
  label?: string; name: string; value: string;
  onChange: (v: string) => void; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div>
      {label && <Label text={label} htmlFor={name} required={required} />}
      <select id={name} name={name} value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS}>
        {children}
      </select>
    </div>
  );
}

function Chk({ name, label, checked, onChange }: {
  name: string; label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group select-none">
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-[var(--border-strong)] text-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] cursor-pointer accent-[var(--brand)]"
      />
      <span className="text-[14px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
        {label}
      </span>
    </label>
  );
}

function Section({ num, title, subtitle, children }: { num: number; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
      <header className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center gap-3">
        <div className="w-6 h-6 rounded-full bg-[var(--brand-soft)] text-[var(--brand)] text-[11px] font-bold flex items-center justify-center shrink-0">
          {num}
        </div>
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)] leading-none">{title}</h2>
          {subtitle && <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug">{subtitle}</p>}
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function NewEmployeePage() {
  const router = useRouter();
  const { companyId } = useParams();
  const [loading, setLoading] = useState(false);
  const [jenisKaryawan, setJenisKaryawan] = useState('tetap');
  const [npwpValue, setNpwpValue] = useState('');
  const [showAdvancedBpjs, setShowAdvancedBpjs] = useState(false);
  const [activeScheme, setActiveScheme] = useState<SchemeId>('skema1');

  const [gajiPokok,    setGajiPokok]    = useState(0);
  const [benefit,      setBenefit]      = useState(0);
  const [kendaraan,    setKendaraan]    = useState(0);
  const [pulsa,        setPulsa]        = useState(0);
  const [operasional,  setOperasional]  = useState(0);
  const [tunjLain,     setTunjLain]     = useState(0);
  const [statusPtkp,   setStatusPtkp]   = useState('TK0');
  const [jkkRate,      setJkkRate]      = useState(0.0024);
  const [ikutJht,      setIkutJht]      = useState(true);
  const [ikutJp,       setIkutJp]       = useState(true);
  const [ikutJkp,      setIkutJkp]      = useState(true);
  const [tanggungJhtK, setTanggungJhtK] = useState(false);
  const [tanggungJpK,  setTanggungJpK]  = useState(false);
  const [ikutKes,      setIkutKes]      = useState(true);
  const [tanggungKesK, setTanggungKesK] = useState(false);
  const [pphDitanggung,setPphDitanggung]= useState(false);

  // `punya_npwp` is derived from whether the user entered an NPWP value.
  // No "Punya NPWP?" dropdown — the field's presence IS the answer.
  const punyaNpwp = npwpValue.trim().length > 0;

  function applyScheme(s: SchemeId) {
    const p = SCHEME_PRESETS.find(x => x.id === s);
    if (!p) return;
    setTanggungJhtK(p.tanggungJhtK);
    setTanggungJpK(p.tanggungJpK);
    setTanggungKesK(p.tanggungKesK);
    setPphDitanggung(p.pphDitanggung);
    setActiveScheme(s);
  }

  // If any advanced control diverges from the active scheme, clear the chip
  // highlight so the user knows they're now on a custom config.
  function markCustom() { setActiveScheme('skema1'); /* noop visual reset */ }

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
    <div className="max-w-[1400px] mx-auto pb-12 animate-fade-in-up">
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-4">
        <Link href={`/companies/${companyId}`} className="inline-flex items-center gap-1 hover:text-[var(--brand)] transition-colors">
          <ArrowLeft size={14} />
          Perusahaan
        </Link>
      </div>

      <header className="flex items-start gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center shrink-0">
          <UserPlus size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Karyawan Baru</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Isi data karyawan. Untuk simulasi gaji 12 bulan, gunakan halaman Kalkulator.</p>
        </div>
      </header>

      <div className="max-w-3xl">
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="company_id" value={String(companyId)} />

          {/* Section 1 — Identitas (wajib) */}
          <Section num={1} title="Identitas (wajib)" subtitle="Nama, NIK, Jabatan, Alamat, Jenis Kelamin, Status PTKP.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <TF label="Nama Lengkap" name="nama" required placeholder="Contoh: Budi Santoso" />
              </div>
              <NikInput label="NIK / Paspor *" name="nik" required />
              <div>
                <Label text="Jenis Kelamin" htmlFor="jenis_kelamin" required />
                <select id="jenis_kelamin" name="jenis_kelamin" defaultValue="L" className={INPUT_CLS} required>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <TF label="Jabatan" name="jabatan" required placeholder="Contoh: Staff Akuntansi" />
              <CSel label="Status PTKP" name="status_ptkp" value={statusPtkp} onChange={setStatusPtkp} required>
                {['TK0','TK1','TK2','TK3','K0','K1','K2','K3'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </CSel>
              <div className="sm:col-span-2">
                <Label text="Alamat" htmlFor="alamat" required />
                <textarea id="alamat" name="alamat" required placeholder="Alamat tempat tinggal" rows={2} className={TEXTAREA_CLS} />
              </div>
              <DateInput label="Tanggal Masuk" name="tanggal_masuk" />
              <DateInput label="Tanggal Keluar (Opsional)" name="tanggal_keluar" />
              <TF label="Divisi (Opsional)" name="divisi" placeholder="Engineering" />
            </div>
          </Section>

          {/* Section 2 — NPWP (opsional) */}
          <Section num={2} title="NPWP (opsional)" subtitle="Opsional sejak PENG-6/PJ.09/2024 — NIK valid sudah berfungsi sebagai NPWP.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <NpwpInput label="NPWP" name="npwp" onChange={setNpwpValue} />
              <div className={`rounded-lg border px-3 py-2.5 text-[12px] leading-relaxed flex items-start gap-2 ${
                punyaNpwp
                  ? 'bg-[var(--green-soft)] border-[var(--green-border)] text-[var(--green)]'
                  : 'bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)]'
              }`}>
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>
                  {punyaNpwp
                    ? 'NPWP terdeteksi — akan ditulis di slip gaji & SPT Masa.'
                    : 'Tanpa NPWP tidak dikenakan tambahan PPh — NIK valid sudah jadi NPWP per PENG-6/PJ.09/2024.'
                  }
                </span>
              </div>
            </div>
          </Section>

          {/* Section 3 — Tipe & Kompensasi */}
          <Section num={3} title="Tipe & Kompensasi">
            <div className="mb-5">
              <Label text="Tipe Karyawan" required />
              <div className="flex gap-2 flex-wrap">
                {(['tetap', 'tidak_tetap_harian', 'tidak_tetap_bulanan'] as const).map((t) => {
                  const active = jenisKaryawan === t;
                  return (
                    <button key={t} type="button" onClick={() => setJenisKaryawan(t)}
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
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <NominalInput label="Gaji Pokok *" name="gaji_pokok" required onChange={setGajiPokok} />
                  <NominalInput label="Benefit / Tunj. Tetap" name="benefit" onChange={setBenefit} />
                  <NominalInput label="Tunj. Kendaraan" name="kendaraan" onChange={setKendaraan} />
                  <NominalInput label="Tunj. Pulsa" name="pulsa" onChange={setPulsa} />
                  <NominalInput label="Tunj. Operasional" name="operasional" onChange={setOperasional} />
                  <NominalInput label="Tunjangan Lain" name="tunj_lain" onChange={setTunjLain} />
                </div>

              </>
            )}

            {jenisKaryawan === 'tidak_tetap_harian' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NominalInput label="Upah Harian *" name="upah_harian" required />
                <TF label="Hari Kerja Default" name="hari_kerja_default" type="number" placeholder="22" />
              </div>
            )}

            {jenisKaryawan === 'tidak_tetap_bulanan' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NominalInput label="Upah Bulanan (default) *" name="upah_bulanan_tt" required />
                  <NominalInput label="Tunjangan TT" name="tunjangan_tt" />
                </div>
                <div className="rounded-lg border border-[var(--sky-border)] bg-[var(--sky-soft)] px-3 py-2.5 flex items-start gap-2 text-[12px] text-[var(--sky)] leading-relaxed">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <span>
                    Upah bulanan di sini adalah <strong>default</strong>. Untuk bulan tertentu dengan upah berbeda,
                    ubah inline di halaman payroll bulan itu, atau buka tab <strong>Upah per Bulan</strong> di profil karyawan.
                  </span>
                </div>
              </div>
            )}
          </Section>

          {/* Section 4 — BPJS & PPh 21 (preset chips + advanced) */}
          <Section num={4} title="BPJS & PPh 21" subtitle="Pilih skema satu klik. Default Skema 1 (paling umum di Indonesia).">
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {SCHEME_PRESETS.map(p => {
                  const active = activeScheme === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyScheme(p.id)}
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        active
                          ? 'border-[var(--brand)] bg-[var(--brand-soft)] shadow-sm'
                          : 'border-[var(--border-default)] bg-white hover:border-[var(--border-strong)] hover:shadow-sm'
                      }`}
                    >
                      <div className="text-xl mb-1.5">{p.emoji}</div>
                      <div className="text-[12px] font-semibold text-[var(--text-primary)] leading-tight">{p.label}</div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-tight">{p.desc}</div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setShowAdvancedBpjs(v => !v)}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <Sparkles size={12} />
                Pengaturan lanjut (BPJS kepesertaan, JKK, tunjangan iuran)
                {showAdvancedBpjs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showAdvancedBpjs && (
                <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Kepesertaan BPJS TK</p>
                    <div className="space-y-2.5">
                      <Chk name="ikut_jht" label="JHT" checked={ikutJht} onChange={(v) => { setIkutJht(v); markCustom(); }} />
                      <Chk name="ikut_jp"  label="JP"  checked={ikutJp}  onChange={(v) => { setIkutJp(v); markCustom(); }} />
                      <Chk name="ikut_jkp" label="JKP" checked={ikutJkp} onChange={(v) => { setIkutJkp(v); markCustom(); }} />
                    </div>
                    <div className="pt-2 border-t border-[var(--border-subtle)]">
                      <CSel label="Tarif JKK" name="jkk_rate" value={String(jkkRate)} onChange={(v) => setJkkRate(Number(v))}>
                        <option value="0.0024">0.24% – Sangat Rendah</option>
                        <option value="0.0054">0.54% – Rendah</option>
                        <option value="0.0089">0.89% – Sedang</option>
                        <option value="0.0127">1.27% – Tinggi</option>
                        <option value="0.0174">1.74% – Sangat Tinggi</option>
                      </CSel>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Tunjangan Iuran Karyawan</p>
                    <div className="space-y-2.5">
                      <Chk name="tanggung_jht_k" label="Tunjangan JHT (2%)" checked={tanggungJhtK} onChange={(v) => { setTanggungJhtK(v); markCustom(); }} />
                      <Chk name="tanggung_jp_k"  label="Tunjangan JP (1%)"  checked={tanggungJpK}  onChange={(v) => { setTanggungJpK(v); markCustom(); }} />
                      <Chk name="ikut_kes"        label="BPJS Kesehatan"      checked={ikutKes}       onChange={(v) => { setIkutKes(v); markCustom(); }} />
                      <Chk name="tanggung_kes_k"  label="Tunjangan Kes (1%)" checked={tanggungKesK}  onChange={(v) => { setTanggungKesK(v); markCustom(); }} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Skema PPh 21</p>
                    <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-lg p-4">
                      <Chk name="pph_ditanggung" label="Grossup (Ditanggung Co.)" checked={pphDitanggung} onChange={(v) => { setPphDitanggung(v); markCustom(); }} />
                      <p className="text-[12px] text-[var(--text-muted)] mt-2 leading-relaxed">
                        Perusahaan menanggung PPh 21. THP = nominal gaji di atas.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Section>

          <div className="flex justify-end gap-3 pt-2">
            <Link href={`/companies/${companyId}`}
              className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] rounded-lg transition-colors"
            >
              Batal
            </Link>
            <button type="submit" disabled={loading}
              className="inline-flex items-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              <Save size={14} />
              {loading ? 'Menyimpan…' : 'Simpan Karyawan'}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
