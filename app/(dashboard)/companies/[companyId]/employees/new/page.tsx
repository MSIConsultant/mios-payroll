'use client';
import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createEmployee } from '@/lib/actions/employees';
import { ArrowLeft, Save, UserPlus, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { NpwpInput, NikInput, NominalInput, DateInput } from '@/components/ui/FormattedInput';
import { calculateMonthlySalary } from '@/lib/engine/payroll';
import type { KaryawanTetap } from '@/lib/engine/payroll';

// ── Constants ────────────────────────────────────────────────────────────────

const BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const BULAN_FULL  = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const INPUT_CLS   = 'w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all';
const TYPE_LABEL: Record<string, string> = {
  tetap: 'Tetap',
  tidak_tetap_harian: 'Tidak Tetap · Harian',
  tidak_tetap_bulanan: 'Tidak Tetap · Bulanan',
};

function rpShort(n: number): string {
  if (n === 0) return '-';
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return (m % 1 === 0 ? String(m) : m.toFixed(1)) + 'jt';
  }
  return Math.round(n / 1_000) + 'rb';
}

function rpFull(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

// ── Projection ───────────────────────────────────────────────────────────────

type ProjParams = {
  gajiPokok: number; benefit: number; kendaraan: number;
  pulsa: number; operasional: number; tunjLain: number;
  statusPtkp: string; punyaNpwp: boolean; jkkRate: number;
  ikutJht: boolean; ikutJp: boolean; ikutJkp: boolean;
  tanggungJhtK: boolean; tanggungJpK: boolean;
  ikutKes: boolean; tanggungKesK: boolean;
  pphDitanggung: boolean;
  thrBulan: number; thrPct: number;
  bonusBulan: number; bonusPct: number;
};

type ProjRow = {
  bulan: number; hasThr: boolean; hasBonus: boolean;
  bruto: number; pph: number; thp: number; isRefund: boolean;
};

function runProjection(p: ProjParams): { rows: ProjRow[]; total: { bruto: number; pph: number; thp: number } } | null {
  if (p.gajiPokok === 0) return null;
  const tahun = new Date().getFullYear();
  const rows: ProjRow[] = [];
  let akum_bruto = 0;
  let pph_jan_nov = 0;

  for (let bulan = 1; bulan <= 12; bulan++) {
    const thr   = bulan === p.thrBulan   ? Math.round(p.gajiPokok * p.thrPct / 100)   : 0;
    const bonus = bulan === p.bonusBulan ? Math.round(p.gajiPokok * p.bonusPct / 100) : 0;
    const k: KaryawanTetap = {
      nama: '', nik: '', npwp: '', divisi: '', jenis_kelamin: 'L',
      bulan, tahun,
      status_ptkp: p.statusPtkp, punya_npwp: p.punyaNpwp,
      gaji_pokok: p.gajiPokok, benefit: p.benefit, kendaraan: p.kendaraan,
      pulsa: p.pulsa, operasional: p.operasional, tunj_lain: p.tunjLain,
      thr, bonus,
      ikut_jht: p.ikutJht, ikut_jp: p.ikutJp, ikut_jkp: p.ikutJkp,
      jkk_rate: p.jkkRate,
      tanggung_jht_k: p.tanggungJhtK, tanggung_jp_k: p.tanggungJpK,
      ikut_kes: p.ikutKes, tanggung_kes_k: p.tanggungKesK,
      pph_ditanggung: p.pphDitanggung,
      kasbon: 0, alpha_telat: 0, pot_lain: 0,
      pph_jan_nov, akum_bruto,
    };
    const res = calculateMonthlySalary(k) as {
      bruto: number; pph: number; thp: number;
      proyeksi: { pph_setahun: number };
    };
    const isRefund = bulan === 12 && (res.proyeksi.pph_setahun - pph_jan_nov) < 0;
    rows.push({ bulan, hasThr: thr > 0, hasBonus: bonus > 0, bruto: res.bruto, pph: res.pph, thp: res.thp, isRefund });
    if (bulan < 12) { akum_bruto += res.bruto; pph_jan_nov += res.pph; }
  }

  const total = rows.reduce((acc, r) => ({
    bruto: acc.bruto + r.bruto,
    pph:   acc.pph   + r.pph,
    thp:   acc.thp   + r.thp,
  }), { bruto: 0, pph: 0, thp: 0 });

  return { rows, total };
}

// ── UI primitives ────────────────────────────────────────────────────────────

function Label({ text, htmlFor }: { text: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">
      {text}
    </label>
  );
}

function TF({ label, name, placeholder, type = 'text', required }: {
  label: string; name: string; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div>
      <Label text={label} htmlFor={name} />
      <input id={name} name={name} type={type} required={required} placeholder={placeholder} className={INPUT_CLS} />
    </div>
  );
}

function CSel({ label, name, value, onChange, children, className }: {
  label?: string; name: string; value: string;
  onChange: (v: string) => void; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      {label && <Label text={label} htmlFor={name} />}
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
        className="w-4 h-4 rounded border-[var(--border-strong)] text-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] cursor-pointer"
      />
      <span className="text-[14px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
        {label}
      </span>
    </label>
  );
}

function Section({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
      <header className="px-5 py-4 border-b border-[var(--border-subtle)]">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</h2>
        {description && <p className="text-[13px] text-[var(--text-muted)] mt-0.5">{description}</p>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

const PCT_INPUT = 'w-full px-2 py-2 pr-6 bg-white border border-[var(--border-default)] rounded-lg text-[13px] text-right outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]';
const MONTH_SEL = 'flex-1 px-2 py-2 bg-white border border-[var(--border-default)] rounded-lg text-[13px] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]';

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NewEmployeePage() {
  const router = useRouter();
  const { companyId } = useParams();
  const [loading, setLoading] = useState(false);
  const [jenisKaryawan, setJenisKaryawan] = useState('tetap');

  // Projection-driving state (tetap only)
  const [gajiPokok,    setGajiPokok]    = useState(0);
  const [benefit,      setBenefit]      = useState(0);
  const [kendaraan,    setKendaraan]    = useState(0);
  const [pulsa,        setPulsa]        = useState(0);
  const [operasional,  setOperasional]  = useState(0);
  const [tunjLain,     setTunjLain]     = useState(0);
  const [statusPtkp,   setStatusPtkp]   = useState('TK0');
  const [punyaNpwp,    setPunyaNpwp]    = useState(true);
  const [jkkRate,      setJkkRate]      = useState(0.0024);
  const [ikutJht,      setIkutJht]      = useState(true);
  const [ikutJp,       setIkutJp]       = useState(true);
  const [ikutJkp,      setIkutJkp]      = useState(true);
  const [tanggungJhtK, setTanggungJhtK] = useState(true);
  const [tanggungJpK,  setTanggungJpK]  = useState(true);
  const [ikutKes,      setIkutKes]      = useState(true);
  const [tanggungKesK, setTanggungKesK] = useState(true);
  const [pphDitanggung,setPphDitanggung]= useState(true);
  const [thrBulan,     setThrBulan]     = useState(3);   // March default
  const [thrPct,       setThrPct]       = useState(100);
  const [bonusBulan,   setBonusBulan]   = useState(8);   // August default
  const [bonusPct,     setBonusPct]     = useState(50);

  const projection = useMemo(() => runProjection({
    gajiPokok, benefit, kendaraan, pulsa, operasional, tunjLain,
    statusPtkp, punyaNpwp, jkkRate,
    ikutJht, ikutJp, ikutJkp,
    tanggungJhtK, tanggungJpK, ikutKes, tanggungKesK,
    pphDitanggung,
    thrBulan, thrPct, bonusBulan, bonusPct,
  }), [
    gajiPokok, benefit, kendaraan, pulsa, operasional, tunjLain,
    statusPtkp, punyaNpwp, jkkRate,
    ikutJht, ikutJp, ikutJkp,
    tanggungJhtK, tanggungJpK, ikutKes, tanggungKesK,
    pphDitanggung,
    thrBulan, thrPct, bonusBulan, bonusPct,
  ]);

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

      <header className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center">
          <UserPlus size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Karyawan Baru</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Tambahkan personel ke perusahaan.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">

        {/* ── Form ── */}
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="company_id" value={String(companyId)} />

          {/* Identitas */}
          <Section title="Identitas Diri">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <TF label="Nama Lengkap *" name="nama" required />
              </div>
              <NikInput label="NIK *" name="nik" required />
              <div>
                <Label text="Jenis Kelamin" htmlFor="jenis_kelamin" />
                <select id="jenis_kelamin" name="jenis_kelamin" defaultValue="L" className={INPUT_CLS}>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <NpwpInput label="NPWP (Opsional)" name="npwp" />
              <CSel label="Punya NPWP?" name="punya_npwp"
                value={punyaNpwp ? 'true' : 'false'}
                onChange={(v) => setPunyaNpwp(v === 'true')}
              >
                <option value="true">Ya (NPWP Valid)</option>
                <option value="false">Tidak (+20% PPh)</option>
              </CSel>
              <CSel label="Status PTKP *" name="status_ptkp" value={statusPtkp} onChange={setStatusPtkp}>
                {['TK0','TK1','TK2','TK3','K0','K1','K2','K3'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </CSel>
              <DateInput label="Tanggal Masuk" name="tanggal_masuk" />
              <TF label="Divisi" name="divisi" placeholder="Engineering" />
              <TF label="Jabatan" name="jabatan" placeholder="Staff Akuntansi" />
            </div>
          </Section>

          {/* Kompensasi */}
          <Section title="Kompensasi & Gaji">
            <div className="mb-5">
              <p className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">Tipe Karyawan *</p>
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

                {/* THR & Bonus defaults */}
                <div className="mt-5 pt-5 border-t border-[var(--border-subtle)]">
                  <p className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                    Default THR & Bonus
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">THR</p>
                      <div className="flex gap-2">
                        <select value={thrBulan} onChange={(e) => setThrBulan(Number(e.target.value))} className={MONTH_SEL}>
                          {BULAN_FULL.map((b, i) => <option key={i + 1} value={i + 1}>{b}</option>)}
                        </select>
                        <div className="relative w-24">
                          <input type="number" min={0} max={500} step={10} value={thrPct}
                            onChange={(e) => setThrPct(Number(e.target.value))}
                            className={PCT_INPUT}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-[var(--text-muted)] pointer-events-none">%</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-1">100% gaji — THR</p>
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Bonus</p>
                      <div className="flex gap-2">
                        <select value={bonusBulan} onChange={(e) => setBonusBulan(Number(e.target.value))} className={MONTH_SEL}>
                          {BULAN_FULL.map((b, i) => <option key={i + 1} value={i + 1}>{b}</option>)}
                        </select>
                        <div className="relative w-24">
                          <input type="number" min={0} max={500} step={10} value={bonusPct}
                            onChange={(e) => setBonusPct(Number(e.target.value))}
                            className={PCT_INPUT}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-[var(--text-muted)] pointer-events-none">%</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-1">50% gaji — Bonus</p>
                    </div>
                  </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NominalInput label="Upah Bulanan *" name="upah_bulanan_tt" required />
                <NominalInput label="Tunjangan TT" name="tunjangan_tt" />
              </div>
            )}
          </Section>

          {/* BPJS & PPh */}
          <Section title="BPJS & PPh 21">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <p className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Kepesertaan BPJS TK</p>
                <div className="space-y-2.5">
                  <Chk name="ikut_jht" label="JHT"  checked={ikutJht}  onChange={setIkutJht} />
                  <Chk name="ikut_jp"  label="JP"   checked={ikutJp}   onChange={setIkutJp} />
                  <Chk name="ikut_jkp" label="JKP"  checked={ikutJkp}  onChange={setIkutJkp} />
                </div>
                <div className="pt-3 border-t border-[var(--border-subtle)]">
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
                <p className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Tunjangan Iuran Karyawan</p>
                <div className="space-y-2.5">
                  <Chk name="tanggung_jht_k" label="Tunjangan JHT Karyawan" checked={tanggungJhtK} onChange={setTanggungJhtK} />
                  <Chk name="tanggung_jp_k"  label="Tunjangan JP Karyawan"  checked={tanggungJpK}  onChange={setTanggungJpK} />
                  <Chk name="ikut_kes"        label="BPJS Kesehatan"         checked={ikutKes}       onChange={setIkutKes} />
                  <Chk name="tanggung_kes_k"  label="Tunjangan Kes Karyawan" checked={tanggungKesK}  onChange={setTanggungKesK} />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Skema PPh 21</p>
                <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-lg p-4">
                  <Chk name="pph_ditanggung" label="Grossup (Ditanggung Co.)" checked={pphDitanggung} onChange={setPphDitanggung} />
                  <p className="text-[12px] text-[var(--text-muted)] mt-3 leading-relaxed">
                    Perusahaan menanggung PPh 21. THP = nominal gaji di atas.
                  </p>
                </div>
              </div>
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

        {/* ── Projection panel ── */}
        <div className="lg:sticky lg:top-6">
          {jenisKaryawan !== 'tetap' ? (
            <div className="bg-white border border-[var(--border-default)] rounded-xl p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center mx-auto mb-3">
                <TrendingUp size={20} className="text-[var(--text-muted)]" />
              </div>
              <p className="text-[14px] font-medium text-[var(--text-secondary)]">
                Proyeksi tersedia untuk karyawan Tetap
              </p>
            </div>
          ) : !projection ? (
            <div className="bg-white border border-[var(--border-default)] rounded-xl p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center mx-auto mb-3">
                <TrendingUp size={20} className="text-[var(--text-muted)]" />
              </div>
              <p className="text-[14px] font-semibold text-[var(--text-secondary)] mb-1">Proyeksi Tahunan</p>
              <p className="text-[13px] text-[var(--text-muted)]">Masukkan gaji pokok untuk simulasi 12 bulan</p>
            </div>
          ) : (
            <div className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
              <header className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center gap-2">
                <TrendingUp size={16} className="text-[var(--brand)]" />
                <div>
                  <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Proyeksi Tahunan</h2>
                  <p className="text-[12px] text-[var(--text-muted)]">Real-time · {new Date().getFullYear()}</p>
                </div>
              </header>

              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Bln</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Bruto</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">PPh</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">THP</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.rows.map((row) => {
                    let rowBg = '';
                    if (row.hasThr)        rowBg = 'bg-amber-50';
                    else if (row.hasBonus) rowBg = 'bg-blue-50';
                    else if (row.bulan === 12) rowBg = 'bg-purple-50';

                    return (
                      <tr key={row.bulan} className={`border-b border-[var(--border-subtle)] ${rowBg}`}>
                        <td className="px-4 py-2 font-medium text-[var(--text-secondary)]">
                          {BULAN_SHORT[row.bulan - 1]}
                          {row.hasThr && (
                            <span className="ml-1.5 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1 py-0.5 rounded">THR</span>
                          )}
                          {row.hasBonus && (
                            <span className="ml-1.5 text-[10px] font-semibold text-blue-700 bg-blue-100 px-1 py-0.5 rounded">Bon</span>
                          )}
                          {row.bulan === 12 && !row.hasThr && !row.hasBonus && (
                            <span className="ml-1.5 text-[10px] font-semibold text-purple-700 bg-purple-100 px-1 py-0.5 rounded">P17</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-[var(--text-primary)]">{rpShort(row.bruto)}</td>
                        <td className="px-4 py-2 text-right font-mono">
                          {row.isRefund
                            ? <span className="text-amber-600 font-semibold text-[11px]">↩ refund</span>
                            : <span className={row.pph > 0 ? 'text-red-500' : 'text-[var(--text-muted)]'}>{rpShort(row.pph)}</span>
                          }
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-semibold text-emerald-700">{rpShort(row.thp)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--bg-subtle)] border-t-2 border-[var(--border-default)]">
                    <td className="px-4 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Total</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-[var(--text-primary)]">{rpShort(projection.total.bruto)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-red-500">{rpShort(projection.total.pph)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{rpShort(projection.total.thp)}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)] space-y-1">
                <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Asumsi</p>
                <p className="text-[12px] text-[var(--text-muted)]">
                  <span className="font-semibold text-amber-600">THR</span>
                  {' '}{BULAN_FULL[thrBulan - 1]} · {thrPct}% gaji
                  {gajiPokok > 0 && <> = <span className="text-[var(--text-primary)] font-semibold">{rpFull(Math.round(gajiPokok * thrPct / 100))}</span></>}
                </p>
                <p className="text-[12px] text-[var(--text-muted)]">
                  <span className="font-semibold text-blue-600">Bonus</span>
                  {' '}{BULAN_FULL[bonusBulan - 1]} · {bonusPct}% gaji
                  {gajiPokok > 0 && <> = <span className="text-[var(--text-primary)] font-semibold">{rpFull(Math.round(gajiPokok * bonusPct / 100))}</span></>}
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
