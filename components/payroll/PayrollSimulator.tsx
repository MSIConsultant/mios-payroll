'use client';
import { useState, useMemo } from 'react';
import { NominalInput } from '@/components/ui/FormattedInput';
import { runProjection, DEFAULT_PROJ_PARAMS, type ProjParams } from '@/lib/engine/projection';
import { ProjectionTable } from './ProjectionTable';

const BULAN_FULL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const INPUT_CLS = 'w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all';
const PCT_INPUT = 'w-full px-2 py-2 pr-6 bg-white border border-[var(--border-default)] rounded-lg text-[13px] text-right outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]';
const MONTH_SEL = 'flex-1 px-2 py-2 bg-white border border-[var(--border-default)] rounded-lg text-[13px] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]';

export function PayrollSimulator({ initialValues, intro }: {
  initialValues?: Partial<ProjParams>;
  intro?: React.ReactNode;
}) {
  const init = { ...DEFAULT_PROJ_PARAMS, ...initialValues };

  const [gajiPokok,    setGajiPokok]    = useState(init.gajiPokok);
  const [benefit,      setBenefit]      = useState(init.benefit);
  const [kendaraan,    setKendaraan]    = useState(init.kendaraan);
  const [pulsa,        setPulsa]        = useState(init.pulsa);
  const [operasional,  setOperasional]  = useState(init.operasional);
  const [tunjLain,     setTunjLain]     = useState(init.tunjLain);
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
      <div className="space-y-4">
        {intro}

        <Section title="Identitas Pajak">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Sel label="Status PTKP" value={statusPtkp} onChange={setStatusPtkp}>
              {['TK0','TK1','TK2','TK3','K0','K1','K2','K3'].map((s) => <option key={s}>{s}</option>)}
            </Sel>
            <Sel label="Punya NPWP?" value={punyaNpwp ? 'true' : 'false'} onChange={(v) => setPunyaNpwp(v === 'true')}>
              <option value="true">Ya (NPWP Valid)</option>
              <option value="false">Tidak (+20% PPh)</option>
            </Sel>
          </div>
        </Section>

        <Section title="Kompensasi">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <NominalInput label="Gaji Pokok"      name="_gp"  defaultValue={gajiPokok}   onChange={setGajiPokok} />
            <NominalInput label="Benefit"         name="_bn"  defaultValue={benefit}     onChange={setBenefit} />
            <NominalInput label="Kendaraan"       name="_kn"  defaultValue={kendaraan}   onChange={setKendaraan} />
            <NominalInput label="Pulsa"           name="_pl"  defaultValue={pulsa}       onChange={setPulsa} />
            <NominalInput label="Operasional"     name="_op"  defaultValue={operasional} onChange={setOperasional} />
            <NominalInput label="Tunjangan Lain"  name="_tl"  defaultValue={tunjLain}    onChange={setTunjLain} />
          </div>

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
                      onChange={(e) => setThrPct(Number(e.target.value))} className={PCT_INPUT}
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
                      onChange={(e) => setBonusPct(Number(e.target.value))} className={PCT_INPUT}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-[var(--text-muted)] pointer-events-none">%</span>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">50% gaji — Bonus</p>
              </div>
            </div>
          </div>
        </Section>

        <Section title="BPJS & PPh 21">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <p className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Kepesertaan</p>
              <div className="space-y-2.5">
                <Chk label="JHT"        checked={ikutJht} onChange={setIkutJht} />
                <Chk label="JP"         checked={ikutJp}  onChange={setIkutJp} />
                <Chk label="JKP"        checked={ikutJkp} onChange={setIkutJkp} />
                <Chk label="Kesehatan"  checked={ikutKes} onChange={setIkutKes} />
              </div>
              <div className="pt-3 border-t border-[var(--border-subtle)]">
                <Sel label="Tarif JKK" value={String(jkkRate)} onChange={(v) => setJkkRate(Number(v))}>
                  <option value="0.0024">0.24% – Sangat Rendah</option>
                  <option value="0.0054">0.54% – Rendah</option>
                  <option value="0.0089">0.89% – Sedang</option>
                  <option value="0.0127">1.27% – Tinggi</option>
                  <option value="0.0174">1.74% – Sangat Tinggi</option>
                </Sel>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Tunjangan Iuran</p>
              <div className="space-y-2.5">
                <Chk label="Tunj. JHT Karyawan" checked={tanggungJhtK} onChange={setTanggungJhtK} />
                <Chk label="Tunj. JP Karyawan"  checked={tanggungJpK}  onChange={setTanggungJpK} />
                <Chk label="Tunj. Kes Karyawan" checked={tanggungKesK} onChange={setTanggungKesK} />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Skema PPh 21</p>
              <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-lg p-4">
                <Chk label="Grossup (Ditanggung Co.)" checked={pphDitanggung} onChange={setPphDitanggung} />
                <p className="text-[12px] text-[var(--text-muted)] mt-3 leading-relaxed">
                  Perusahaan menanggung PPh 21. THP = nominal gaji.
                </p>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <div className="lg:sticky lg:top-6">
        <ProjectionTable
          projection={projection}
          gajiPokok={gajiPokok}
          thrBulan={thrBulan} thrPct={thrPct}
          bonusBulan={bonusBulan} bonusPct={bonusPct}
        />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
      <header className="px-5 py-4 border-b border-[var(--border-subtle)]">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</h2>
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
      <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT_CLS}>
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
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-[var(--border-strong)] text-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] cursor-pointer"
      />
      <span className="text-[14px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{label}</span>
    </label>
  );
}
