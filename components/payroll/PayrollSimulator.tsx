'use client';
import { useState, useMemo } from 'react';
import { NominalInput } from '@/components/ui/FormattedInput';
import { runProjection, DEFAULT_PROJ_PARAMS, type ProjParams } from '@/lib/engine/projection';
import { ProjectionTable } from './ProjectionTable';

const BULAN_FULL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// 4 schemes from the SALARY sheet of "Grossup PPh 21 RALO.xlsx".
// All use gaji Rp 9,150,000 · TK0 · NPWP · JKK 0.24%.
// Axes: BPJS (dipotong vs ditanggung) × PPH (dipotong vs grossup).
export const PRESETS: {
  id: string; emoji: string; label: string; desc: string;
  values: Partial<ProjParams>;
}[] = [
  {
    // Employee E in the Excel — BPJS dipotong dari gaji, PPH dipotong dari gaji.
    id: 'skema1',
    emoji: '📋',
    label: 'PPH & BPJS Potong',
    desc: 'BPJS & PPH dipotong dari gaji',
    values: {
      gajiPokok: 9_150_000, benefit: 0, kendaraan: 0, pulsa: 0, operasional: 0, tunjLain: 0,
      statusPtkp: 'TK0', punyaNpwp: true, jkkRate: 0.0024,
      ikutJht: true, ikutJp: true, ikutJkp: true, ikutKes: true,
      tanggungJhtK: false, tanggungJpK: false, tanggungKesK: false,
      pphDitanggung: false, thrPct: 100, bonusPct: 0,
      kesEmployerInBruto: false,
    },
  },
  {
    // Employee C in the Excel — BPJS ditanggung (masuk bruto), PPH dipotong dari gaji.
    id: 'skema2',
    emoji: '🏥',
    label: 'BPJS Ditanggung',
    desc: 'BPJS ditanggung · PPH dipotong',
    values: {
      gajiPokok: 9_150_000, benefit: 0, kendaraan: 0, pulsa: 0, operasional: 0, tunjLain: 0,
      statusPtkp: 'TK0', punyaNpwp: true, jkkRate: 0.0024,
      ikutJht: true, ikutJp: true, ikutJkp: true, ikutKes: true,
      tanggungJhtK: true, tanggungJpK: true, tanggungKesK: true,
      pphDitanggung: false, thrPct: 100, bonusPct: 0,
      kesEmployerInBruto: true,
    },
  },
  {
    // Employee A in the Excel — BPJS dipotong dari gaji, PPH grossup (ditanggung perusahaan).
    id: 'skema3',
    emoji: '🧾',
    label: 'PPH Grossup',
    desc: 'BPJS dipotong · PPH grossup',
    values: {
      gajiPokok: 9_150_000, benefit: 0, kendaraan: 0, pulsa: 0, operasional: 0, tunjLain: 0,
      statusPtkp: 'TK0', punyaNpwp: true, jkkRate: 0.0024,
      ikutJht: true, ikutJp: true, ikutJkp: true, ikutKes: true,
      tanggungJhtK: false, tanggungJpK: false, tanggungKesK: false,
      pphDitanggung: true, thrPct: 100, bonusBulan: 8, bonusPct: 50,
      kesEmployerInBruto: false,
    },
  },
  {
    // Employee B/D in the Excel — BPJS ditanggung (masuk bruto) + PPH grossup. Full employer cover.
    id: 'skema4',
    emoji: '✅',
    label: 'Full Grossup',
    desc: 'BPJS & PPH ditanggung penuh',
    values: {
      gajiPokok: 9_150_000, benefit: 0, kendaraan: 0, pulsa: 0, operasional: 0, tunjLain: 0,
      statusPtkp: 'TK0', punyaNpwp: true, jkkRate: 0.0024,
      ikutJht: true, ikutJp: true, ikutJkp: true, ikutKes: true,
      tanggungJhtK: true, tanggungJpK: true, tanggungKesK: true,
      pphDitanggung: true, thrPct: 100, bonusBulan: 8, bonusPct: 50,
      kesEmployerInBruto: true,
    },
  },
];

const SEL_CLS = 'w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all';
const PCT_CLS = 'w-full px-2 py-2.5 pr-7 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg text-[13px] text-right outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all font-mono';
const MON_CLS = 'flex-1 px-2.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg text-[13px] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all';

export function PayrollSimulator({ initialValues, intro, showPresets }: {
  initialValues?: Partial<ProjParams>;
  intro?: React.ReactNode;
  showPresets?: boolean;
}) {
  const init = { ...DEFAULT_PROJ_PARAMS, ...initialValues };

  const [resetKey,    setResetKey]     = useState(0);
  const [activePreset,setActivePreset] = useState<string | null>(null);

  const [gajiPokok,    setGajiPokok]    = useState(init.gajiPokok);
  const [benefit,      setBenefit]      = useState(init.benefit);
  const [kendaraan,    setKendaraan]    = useState(init.kendaraan);
  const [pulsa,        setPulsa]        = useState(init.pulsa);
  const [operasional,  setOperasional]  = useState(init.operasional);
  const [tunjLain,     setTunjLain]     = useState(init.tunjLain);
  const [bpjsBasis,    setBpjsBasis]    = useState(init.bpjsBasis);
  const [kesEmployerInBruto, setKesEmployerInBruto] = useState<boolean | undefined>(init.kesEmployerInBruto);
  const [statusPtkp,   setStatusPtkp]   = useState(init.statusPtkp);
  const [punyaNpwp,    setPunyaNpwp]    = useState(init.punyaNpwp);
  const [jkkRate,      setJkkRate]      = useState(init.jkkRate);
  const [ikutJht,      setIkutJht]      = useState(init.ikutJht);
  const [ikutJp,       setIkutJp]       = useState(init.ikutJp);
  const [ikutJkp,      setIkutJkp]      = useState(init.ikutJkp);
  const [tanggungJhtK, setTanggungJhtK] = useState(init.tanggungJhtK);
  const [tanggungJpK,  setTanggungJpK]  = useState(init.tanggungJpK);
  const [ikutKes,      setIkutKes]      = useState(init.ikutKes);
  const [tanggungKesK, setTanggungKesK] = useState(init.tanggungKesK);
  const [pphDitanggung,setPphDitanggung]= useState(init.pphDitanggung);
  const [thrBulan,     setThrBulan]     = useState(init.thrBulan);
  const [thrPct,       setThrPct]       = useState(init.thrPct);
  const [bonusBulan,   setBonusBulan]   = useState(init.bonusBulan);
  const [bonusPct,     setBonusPct]     = useState(init.bonusPct);

  function loadPreset(preset: (typeof PRESETS)[0]) {
    const v = preset.values;
    if (v.gajiPokok   !== undefined) setGajiPokok(v.gajiPokok);
    if (v.benefit     !== undefined) setBenefit(v.benefit);
    if (v.kendaraan   !== undefined) setKendaraan(v.kendaraan);
    if (v.pulsa       !== undefined) setPulsa(v.pulsa);
    if (v.operasional !== undefined) setOperasional(v.operasional);
    if (v.tunjLain    !== undefined) setTunjLain(v.tunjLain);
    if (v.bpjsBasis   !== undefined) setBpjsBasis(v.bpjsBasis);
    if (v.kesEmployerInBruto !== undefined) setKesEmployerInBruto(v.kesEmployerInBruto);
    if (v.statusPtkp  !== undefined) setStatusPtkp(v.statusPtkp);
    if (v.punyaNpwp   !== undefined) setPunyaNpwp(v.punyaNpwp);
    if (v.jkkRate     !== undefined) setJkkRate(v.jkkRate);
    if (v.ikutJht     !== undefined) setIkutJht(v.ikutJht);
    if (v.ikutJp      !== undefined) setIkutJp(v.ikutJp);
    if (v.ikutJkp     !== undefined) setIkutJkp(v.ikutJkp);
    if (v.ikutKes     !== undefined) setIkutKes(v.ikutKes);
    if (v.tanggungJhtK !== undefined) setTanggungJhtK(v.tanggungJhtK);
    if (v.tanggungJpK  !== undefined) setTanggungJpK(v.tanggungJpK);
    if (v.tanggungKesK !== undefined) setTanggungKesK(v.tanggungKesK);
    if (v.pphDitanggung !== undefined) setPphDitanggung(v.pphDitanggung);
    if (v.thrPct      !== undefined) setThrPct(v.thrPct);
    if (v.bonusPct    !== undefined) setBonusPct(v.bonusPct);
    setActivePreset(preset.id);
    setResetKey(k => k + 1);
  }

  const projection = useMemo(() => runProjection({
    gajiPokok, benefit, kendaraan, pulsa, operasional, tunjLain,
    statusPtkp, punyaNpwp, jkkRate,
    ikutJht, ikutJp, ikutJkp,
    tanggungJhtK, tanggungJpK, ikutKes, tanggungKesK,
    pphDitanggung, bpjsBasis, kesEmployerInBruto,
    thrBulan, thrPct, bonusBulan, bonusPct,
  }), [
    gajiPokok, benefit, kendaraan, pulsa, operasional, tunjLain,
    statusPtkp, punyaNpwp, jkkRate,
    ikutJht, ikutJp, ikutJkp,
    tanggungJhtK, tanggungJpK, ikutKes, tanggungKesK,
    pphDitanggung, bpjsBasis, kesEmployerInBruto,
    thrBulan, thrPct, bonusBulan, bonusPct,
  ]);

  return (
    <div className="space-y-5">
      {intro}

      {showPresets && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => loadPreset(p)}
              className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                activePreset === p.id
                  ? 'border-[var(--brand)] bg-[var(--brand-soft)] shadow-sm'
                  : 'border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--border-strong)] hover:shadow-sm'
              }`}
            >
              <div className="text-xl mb-1.5">{p.emoji}</div>
              <div className="text-[12px] font-semibold text-[var(--text-primary)] leading-tight">{p.label}</div>
              <div className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-tight">{p.desc}</div>
            </button>
          ))}
        </div>
      )}

      {/* Form sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section num={1} title="Identitas Pajak">
          <div className="space-y-4">
            <Sel label="Status PTKP" value={statusPtkp} onChange={v => { setStatusPtkp(v); setActivePreset(null); }}>
              {['TK0','TK1','TK2','TK3','K0','K1','K2','K3'].map(s => <option key={s}>{s}</option>)}
            </Sel>
            <Sel label="NPWP" value={punyaNpwp ? 'true' : 'false'} onChange={v => { setPunyaNpwp(v === 'true'); setActivePreset(null); }}>
              <option value="true">Ya — NPWP Valid</option>
              <option value="false">Tidak — NIK = NPWP</option>
            </Sel>
          </div>
        </Section>

        <Section num={3} title="BPJS Ketenagakerjaan & Kesehatan">
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2.5">Kepesertaan</p>
              <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                <Chk label="JHT" checked={ikutJht} onChange={setIkutJht} />
                <Chk label="JP" checked={ikutJp} onChange={setIkutJp} />
                <Chk label="JKP" checked={ikutJkp} onChange={setIkutJkp} />
                <Chk label="Kesehatan" checked={ikutKes} onChange={setIkutKes} />
              </div>
            </div>
            <Sel label="Tarif JKK" value={String(jkkRate)} onChange={v => setJkkRate(Number(v))}>
              <option value="0.0024">0.24% – Sangat Rendah</option>
              <option value="0.0054">0.54% – Rendah</option>
              <option value="0.0089">0.89% – Sedang</option>
              <option value="0.0127">1.27% – Tinggi</option>
              <option value="0.0174">1.74% – Sangat Tinggi</option>
            </Sel>
            <div>
              <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2">Tunjangan Iuran Karyawan</p>
              <div className="space-y-2">
                <Chk label="Tunj. JHT (2%)" checked={tanggungJhtK} onChange={setTanggungJhtK} />
                <Chk label="Tunj. JP (1%)" checked={tanggungJpK} onChange={setTanggungJpK} />
                <Chk label="Tunj. Kes (1%)" checked={tanggungKesK} onChange={setTanggungKesK} />
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3">
              <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2">Skema PPh 21</p>
              <Chk label="Grossup — Ditanggung Perusahaan" checked={pphDitanggung} onChange={setPphDitanggung} />
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-relaxed">PPh 21 jadi tunj. pajak → THP = gaji bersih.</p>
            </div>
            {!punyaNpwp && (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2.5">
                <p className="text-[12px] text-[var(--text-muted)] font-medium">NIK valid sudah berfungsi sebagai NPWP (PENG-6/PJ.09/2024) — tidak ada tambahan PPh.</p>
              </div>
            )}
          </div>
        </Section>

        <Section num={2} title="Kompensasi">
          <div className="grid grid-cols-2 gap-3">
            <NominalInput key={`gp-${resetKey}`} label="Gaji Pokok" name="_gp" defaultValue={gajiPokok}
              onChange={v => { setGajiPokok(v); setActivePreset(null); }} />
            <NominalInput key={`bn-${resetKey}`} label="Benefit" name="_bn" defaultValue={benefit}
              onChange={v => { setBenefit(v); setActivePreset(null); }} />
            <NominalInput key={`kn-${resetKey}`} label="Kendaraan" name="_kn" defaultValue={kendaraan}
              onChange={v => { setKendaraan(v); setActivePreset(null); }} />
            <NominalInput key={`pl-${resetKey}`} label="Pulsa" name="_pl" defaultValue={pulsa}
              onChange={v => { setPulsa(v); setActivePreset(null); }} />
            <NominalInput key={`op-${resetKey}`} label="Operasional" name="_op" defaultValue={operasional}
              onChange={v => { setOperasional(v); setActivePreset(null); }} />
            <NominalInput key={`tl-${resetKey}`} label="Tunjangan Lain" name="_tl" defaultValue={tunjLain}
              onChange={v => { setTunjLain(v); setActivePreset(null); }} />
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[var(--border-subtle)]">
            <div className="sm:col-span-1">
              <NominalInput key={`bb-${resetKey}`} label="Dasar BPJS (opsional)" name="_bb" defaultValue={bpjsBasis}
                onChange={v => { setBpjsBasis(v); setActivePreset(null); }} />
              <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug">
                Gaji yang dilaporkan ke BPJS jika berbeda dari gaji pokok. Kosongkan = pakai gaji pokok.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-3">THR & Bonus</p>
            <div className="space-y-3">
              <div>
                <p className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">THR</p>
                <div className="flex gap-2">
                  <select value={thrBulan} onChange={e => setThrBulan(Number(e.target.value))} className={MON_CLS}>
                    {BULAN_FULL.map((b, i) => <option key={i + 1} value={i + 1}>{b}</option>)}
                  </select>
                  <div className="relative w-20">
                    <input type="number" min={0} max={500} step={10} value={thrPct}
                      onChange={e => setThrPct(Number(e.target.value))} className={PCT_CLS} />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--text-muted)] pointer-events-none">%</span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">Bonus</p>
                <div className="flex gap-2">
                  <select value={bonusBulan} onChange={e => setBonusBulan(Number(e.target.value))} className={MON_CLS}>
                    {BULAN_FULL.map((b, i) => <option key={i + 1} value={i + 1}>{b}</option>)}
                  </select>
                  <div className="relative w-20">
                    <input type="number" min={0} max={500} step={10} value={bonusPct}
                      onChange={e => setBonusPct(Number(e.target.value))} className={PCT_CLS} />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--text-muted)] pointer-events-none">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* Full-width projection below form */}
      <ProjectionTable
        projection={projection}
        gajiPokok={gajiPokok}
        thrBulan={thrBulan} thrPct={thrPct}
        bonusBulan={bonusBulan} bonusPct={bonusPct}
      />
    </div>
  );
}

function Section({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl overflow-hidden shadow-[var(--shadow-sm)]">
      <header className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center gap-3">
        <div className="w-6 h-6 rounded-full bg-[var(--brand-soft)] text-[var(--brand)] text-[11px] font-bold flex items-center justify-center shrink-0">
          {num}
        </div>
        <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h2>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Sel({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={SEL_CLS}>
        {children}
      </select>
    </div>
  );
}

function Chk({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-[var(--border-strong)] text-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] cursor-pointer accent-[var(--brand)]"
      />
      <span className="text-[13px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{label}</span>
    </label>
  );
}
