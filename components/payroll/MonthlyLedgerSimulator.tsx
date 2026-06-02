'use client';
import { useState, useMemo } from 'react';
import { ChevronDown, RotateCcw, CornerDownRight } from 'lucide-react';
import { NominalInput } from '@/components/ui/FormattedInput';
import {
  runMonthlyProjection, DEFAULT_PROJ_PARAMS,
  type ProjParams, type MonthOverride,
} from '@/lib/engine/projection';
import { ProjectionTable } from './ProjectionTable';

const BULAN_FULL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const BULAN_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

// 4 schemes from the SALARY sheet of "Grossup PPh 21 RALO.xlsx".
// All use gaji Rp 9,150,000 · TK0 · NPWP · JKK 0.24%.
// Axes: BPJS (dipotong vs ditanggung) × PPH (dipotong vs grossup).
const PRESETS: {
  id: string; emoji: string; label: string; desc: string;
  values: Partial<ProjParams>;
}[] = [
  {
    id: 'skema1', emoji: '📋', label: 'PPH & BPJS Potong', desc: 'BPJS & PPH dipotong dari gaji',
    values: {
      gajiPokok: 9_150_000, benefit: 0, kendaraan: 0, pulsa: 0, operasional: 0, tunjLain: 0,
      statusPtkp: 'TK0', punyaNpwp: true, jkkRate: 0.0024,
      ikutJht: true, ikutJp: true, ikutJkp: true, ikutKes: true,
      tanggungJhtK: false, tanggungJpK: false, tanggungKesK: false,
      pphDitanggung: false, thrPct: 100, bonusPct: 0, kesEmployerInBruto: false,
    },
  },
  {
    id: 'skema2', emoji: '🏥', label: 'BPJS Ditanggung', desc: 'BPJS ditanggung · PPH dipotong',
    values: {
      gajiPokok: 9_150_000, benefit: 0, kendaraan: 0, pulsa: 0, operasional: 0, tunjLain: 0,
      statusPtkp: 'TK0', punyaNpwp: true, jkkRate: 0.0024,
      ikutJht: true, ikutJp: true, ikutJkp: true, ikutKes: true,
      tanggungJhtK: true, tanggungJpK: true, tanggungKesK: true,
      pphDitanggung: false, thrPct: 100, bonusPct: 0, kesEmployerInBruto: true,
    },
  },
  {
    id: 'skema3', emoji: '🧾', label: 'PPH Grossup', desc: 'BPJS dipotong · PPH grossup',
    values: {
      gajiPokok: 9_150_000, benefit: 0, kendaraan: 0, pulsa: 0, operasional: 0, tunjLain: 0,
      statusPtkp: 'TK0', punyaNpwp: true, jkkRate: 0.0024,
      ikutJht: true, ikutJp: true, ikutJkp: true, ikutKes: true,
      tanggungJhtK: false, tanggungJpK: false, tanggungKesK: false,
      pphDitanggung: true, thrPct: 100, bonusBulan: 8, bonusPct: 50, kesEmployerInBruto: false,
    },
  },
  {
    id: 'skema4', emoji: '✅', label: 'Full Grossup', desc: 'BPJS & PPH ditanggung penuh',
    values: {
      gajiPokok: 9_150_000, benefit: 0, kendaraan: 0, pulsa: 0, operasional: 0, tunjLain: 0,
      statusPtkp: 'TK0', punyaNpwp: true, jkkRate: 0.0024,
      ikutJht: true, ikutJp: true, ikutJkp: true, ikutKes: true,
      tanggungJhtK: true, tanggungJpK: true, tanggungKesK: true,
      pphDitanggung: true, thrPct: 100, bonusBulan: 8, bonusPct: 50, kesEmployerInBruto: true,
    },
  },
];

// Fields that describe an ongoing situation (salary, allowances, tax/BPJS
// status) — these are what "apply forward" copies into later months. THR,
// bonus and one-off deductions are intentionally excluded (they're per-event).
const PERSIST_FIELDS: (keyof ProjParams)[] = [
  'gajiPokok', 'benefit', 'kendaraan', 'pulsa', 'operasional', 'tunjLain',
  'bpjsBasis', 'kesEmployerInBruto', 'statusPtkp', 'punyaNpwp', 'jkkRate',
  'ikutJht', 'ikutJp', 'ikutJkp', 'tanggungJhtK', 'tanggungJpK',
  'ikutKes', 'tanggungKesK', 'pphDitanggung',
];

const SEL_CLS = 'w-full px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all';

function rpFull(n: number) { return 'Rp ' + n.toLocaleString('id-ID'); }
function rpShort(n: number) {
  if (n === 0) return '–';
  if (n >= 1_000_000) { const m = n / 1_000_000; return (m % 1 === 0 ? String(m) : m.toFixed(1)) + 'jt'; }
  return Math.round(n / 1_000) + 'rb';
}

export function MonthlyLedgerSimulator({ initialValues, intro }: {
  initialValues?: Partial<ProjParams>;
  intro?: React.ReactNode;
}) {
  const [annual, setAnnual] = useState<ProjParams>({ ...DEFAULT_PROJ_PARAMS, ...initialValues });
  const [overrides, setOverrides] = useState<Record<number, MonthOverride>>({});
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);

  // ---- mutation helpers -------------------------------------------------
  function patchAnnual(p: Partial<ProjParams>) {
    setAnnual(a => ({ ...a, ...p }));
    setActivePreset(null);
  }

  function patchMonth(b: number, p: MonthOverride) {
    setOverrides(o => ({ ...o, [b]: { ...o[b], ...p } }));
    setActivePreset(null);
  }

  // Set a month field, but clear the override when it equals the annual default
  // (or 0 for per-event fields) so the cell returns to its muted "inherited" state.
  function setMonthField(b: number, field: keyof ProjParams, value: number | string | boolean, isDefault: boolean) {
    setOverrides(o => {
      const cur: MonthOverride = { ...o[b] };
      if (isDefault) delete cur[field];
      else (cur as Record<string, unknown>)[field] = value;
      const next = { ...o };
      if (Object.keys(cur).length === 0) delete next[b]; else next[b] = cur;
      return next;
    });
    setActivePreset(null);
  }

  function setMonthEvent(b: number, field: 'thr' | 'bonus' | 'pot_lain', value: number) {
    setOverrides(o => {
      const cur: MonthOverride = { ...o[b] };
      if (value === 0) delete cur[field];
      else cur[field] = value;
      const next = { ...o };
      if (Object.keys(cur).length === 0) delete next[b]; else next[b] = cur;
      return next;
    });
    setActivePreset(null);
  }

  function setMonthAktif(b: number, aktif: boolean) {
    setOverrides(o => {
      const cur: MonthOverride = { ...o[b] };
      if (aktif) delete cur.aktif; else cur.aktif = false;
      const next = { ...o };
      if (Object.keys(cur).length === 0) delete next[b]; else next[b] = cur;
      return next;
    });
    setActivePreset(null);
  }

  function resetMonth(b: number) {
    setOverrides(o => { const n = { ...o }; delete n[b]; return n; });
    setResetKey(k => k + 1);
    setActivePreset(null);
  }

  function applyForward(b: number) {
    const rb = { ...annual, ...overrides[b] } as ProjParams;
    setOverrides(o => {
      const next = { ...o };
      for (let m = b + 1; m <= 12; m++) {
        const cur: MonthOverride = { ...next[m] };
        for (const f of PERSIST_FIELDS) {
          if (rb[f] !== annual[f]) (cur as Record<string, unknown>)[f] = rb[f];
          else delete cur[f];
        }
        if (Object.keys(cur).length === 0) delete next[m]; else next[m] = cur;
      }
      return next;
    });
    setResetKey(k => k + 1);
    setActivePreset(null);
  }

  function clearAll() {
    setOverrides({});
    setResetKey(k => k + 1);
    setActivePreset(null);
  }

  function loadPreset(preset: (typeof PRESETS)[number]) {
    const v = preset.values;
    setAnnual(a => ({ ...a, ...v }));
    const gaji = v.gajiPokok ?? annual.gajiPokok;
    const seeded: Record<number, MonthOverride> = {};
    const thrM = v.thrBulan ?? DEFAULT_PROJ_PARAMS.thrBulan;
    if ((v.thrPct ?? 0) > 0) seeded[thrM] = { thr: Math.round(gaji * (v.thrPct ?? 0) / 100) };
    const bonM = v.bonusBulan ?? DEFAULT_PROJ_PARAMS.bonusBulan;
    if ((v.bonusPct ?? 0) > 0) seeded[bonM] = { ...seeded[bonM], bonus: Math.round(gaji * (v.bonusPct ?? 0) / 100) };
    setOverrides(seeded);
    setActivePreset(preset.id);
    setResetKey(k => k + 1);
  }

  // ---- resolved values for display -------------------------------------
  const projection = useMemo(() => runMonthlyProjection(annual, overrides), [annual, overrides]);
  const rowsByMonth = useMemo(() => {
    const m: Record<number, NonNullable<typeof projection>['rows'][number]> = {};
    projection?.rows.forEach(r => { m[r.bulan] = r; });
    return m;
  }, [projection]);

  const num = (b: number, f: keyof ProjParams) => (overrides[b]?.[f] as number | undefined) ?? (annual[f] as number);
  const tunjTotal = (b: number) =>
    num(b, 'benefit') + num(b, 'kendaraan') + num(b, 'pulsa') + num(b, 'operasional') + num(b, 'tunjLain');
  const tunjOverridden = (b: number) =>
    ['benefit', 'kendaraan', 'pulsa', 'operasional', 'tunjLain'].some(f => overrides[b]?.[f as keyof ProjParams] !== undefined);
  const isOv = (b: number, f: keyof MonthOverride) => overrides[b]?.[f] !== undefined;
  const aktif = (b: number) => overrides[b]?.aktif !== false;

  return (
    <div className="space-y-5">
      {intro}

      {/* Presets */}
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

      {/* Annual defaults */}
      <section className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl overflow-hidden shadow-[var(--shadow-sm)]">
        <header className="px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Pengaturan Default</h2>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
            Nilai dasar yang berlaku untuk semua bulan. Ubah per bulan di tabel di bawah bila berbeda.
          </p>
        </header>
        <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Identitas pajak */}
          <div className="space-y-4">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">Identitas Pajak</p>
            <Sel label="Status PTKP" value={annual.statusPtkp} onChange={v => patchAnnual({ statusPtkp: v })}>
              {['TK0','TK1','TK2','TK3','K0','K1','K2','K3'].map(s => <option key={s}>{s}</option>)}
            </Sel>
            <Sel label="NPWP" value={annual.punyaNpwp ? 'true' : 'false'} onChange={v => patchAnnual({ punyaNpwp: v === 'true' })}>
              <option value="true">Ya — NPWP Valid</option>
              <option value="false">Tidak — NIK = NPWP</option>
            </Sel>
            <NominalInput key={`a-gp-${resetKey}`} label="Gaji Pokok" name="_agp" defaultValue={annual.gajiPokok}
              onChange={v => patchAnnual({ gajiPokok: v })} />
            <NominalInput key={`a-bb-${resetKey}`} label="Dasar BPJS (opsional)" name="_abb" defaultValue={annual.bpjsBasis ?? 0}
              onChange={v => patchAnnual({ bpjsBasis: v })} />
          </div>

          {/* Tunjangan */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">Tunjangan (default)</p>
            <div className="grid grid-cols-2 gap-3">
              <NominalInput key={`a-bn-${resetKey}`} label="Benefit" name="_abn" defaultValue={annual.benefit} onChange={v => patchAnnual({ benefit: v })} />
              <NominalInput key={`a-kn-${resetKey}`} label="Kendaraan" name="_akn" defaultValue={annual.kendaraan} onChange={v => patchAnnual({ kendaraan: v })} />
              <NominalInput key={`a-pl-${resetKey}`} label="Pulsa" name="_apl" defaultValue={annual.pulsa} onChange={v => patchAnnual({ pulsa: v })} />
              <NominalInput key={`a-op-${resetKey}`} label="Operasional" name="_aop" defaultValue={annual.operasional} onChange={v => patchAnnual({ operasional: v })} />
              <NominalInput key={`a-tl-${resetKey}`} label="Tunj. Lain" name="_atl" defaultValue={annual.tunjLain} onChange={v => patchAnnual({ tunjLain: v })} />
            </div>
          </div>

          {/* BPJS + PPh */}
          <div className="space-y-4">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">BPJS & PPh</p>
            <div className="grid grid-cols-2 gap-y-2 gap-x-3">
              <Chk label="JHT" checked={annual.ikutJht} onChange={v => patchAnnual({ ikutJht: v })} />
              <Chk label="JP" checked={annual.ikutJp} onChange={v => patchAnnual({ ikutJp: v })} />
              <Chk label="JKP" checked={annual.ikutJkp} onChange={v => patchAnnual({ ikutJkp: v })} />
              <Chk label="Kesehatan" checked={annual.ikutKes} onChange={v => patchAnnual({ ikutKes: v })} />
            </div>
            <Sel label="Tarif JKK" value={String(annual.jkkRate)} onChange={v => patchAnnual({ jkkRate: Number(v) })}>
              <option value="0.0024">0.24% – Sangat Rendah</option>
              <option value="0.0054">0.54% – Rendah</option>
              <option value="0.0089">0.89% – Sedang</option>
              <option value="0.0127">1.27% – Tinggi</option>
              <option value="0.0174">1.74% – Sangat Tinggi</option>
            </Sel>
            <div className="grid grid-cols-1 gap-1.5">
              <Chk label="Tunj. JHT Karyawan (2%)" checked={annual.tanggungJhtK} onChange={v => patchAnnual({ tanggungJhtK: v })} />
              <Chk label="Tunj. JP Karyawan (1%)" checked={annual.tanggungJpK} onChange={v => patchAnnual({ tanggungJpK: v })} />
              <Chk label="Tunj. Kes Karyawan (1%)" checked={annual.tanggungKesK} onChange={v => patchAnnual({ tanggungKesK: v })} />
              <Chk label="PPh 21 Grossup (ditanggung perusahaan)" checked={annual.pphDitanggung} onChange={v => patchAnnual({ pphDitanggung: v })} />
            </div>
          </div>
        </div>
      </section>

      {/* 12-month ledger */}
      <section className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-2xl overflow-hidden shadow-[var(--shadow-sm)]">
        <header className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">Buku Besar 12 Bulan</h2>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
              Setiap bulan dihitung dari angka bulan itu sendiri. Sel abu-abu = ikut default; sel biru = diubah khusus bulan ini.
            </p>
          </div>
          {Object.keys(overrides).length > 0 && (
            <button onClick={clearAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border-default)] text-[12px] font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0">
              <RotateCcw size={13} /> Reset semua
            </button>
          )}
        </header>

        {/* Column headers */}
        <div className="hidden sm:grid grid-cols-[2.5rem_1fr_1fr_1fr_1fr_1fr_4.5rem_1.25rem] items-center gap-2 px-4 py-2 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          <span>Bln</span>
          <span className="text-right">Gaji</span>
          <span className="text-right">Tunjangan</span>
          <span className="text-right">THR</span>
          <span className="text-right">Bonus</span>
          <span className="text-right">Potongan</span>
          <span className="text-right">THP</span>
          <span></span>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(b => {
            const active = aktif(b);
            const row = rowsByMonth[b];
            const isExp = expanded === b;
            return (
              <div key={b} className={isExp ? 'bg-[var(--brand-soft)]/40' : ''}>
                <div className={`grid grid-cols-[2.5rem_1fr_1fr_1fr_1fr_1fr_4.5rem_1.25rem] items-center gap-2 px-4 py-1.5 ${!active ? 'opacity-50' : ''}`}>
                  <span className="text-[12px] font-semibold text-[var(--text-secondary)]">{BULAN_SHORT[b - 1]}</span>

                  {active ? (
                    <>
                      <LedgerNum resolved={num(b, 'gajiPokok')} overridden={isOv(b, 'gajiPokok')}
                        onSet={n => setMonthField(b, 'gajiPokok', n, n === annual.gajiPokok)} />
                      <TunjCell total={tunjTotal(b)} overridden={tunjOverridden(b)} onClick={() => setExpanded(isExp ? null : b)} />
                      <LedgerNum value={overrides[b]?.thr ?? 0} overridden={isOv(b, 'thr')}
                        onSet={n => setMonthEvent(b, 'thr', n)} accentColor="amber" />
                      <LedgerNum value={overrides[b]?.bonus ?? 0} overridden={isOv(b, 'bonus')}
                        onSet={n => setMonthEvent(b, 'bonus', n)} accentColor="blue" />
                      <LedgerNum value={overrides[b]?.pot_lain ?? 0} overridden={isOv(b, 'pot_lain')}
                        onSet={n => setMonthEvent(b, 'pot_lain', n)} accentColor="red" />
                      <span className="text-right text-[12px] font-mono font-semibold text-[var(--green)]">
                        {row ? rpShort(row.thp) : '–'}
                      </span>
                    </>
                  ) : (
                    <div className="col-span-6 flex items-center">
                      <span className="text-[12px] text-[var(--text-faint)] italic">Tidak bekerja bulan ini</span>
                    </div>
                  )}

                  <button onClick={() => setExpanded(isExp ? null : b)}
                    className="flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                    <ChevronDown size={15} className={`transition-transform ${isExp ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {isExp && (
                  <MonthEditor
                    b={b} annual={annual} overrides={overrides} resetKey={resetKey}
                    active={active}
                    onSetField={setMonthField} onSetEvent={setMonthEvent}
                    onSetAktif={setMonthAktif} onReset={resetMonth} onApplyForward={applyForward}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Live results with full per-month breakdown */}
      <ProjectionTable
        projection={projection}
        gajiPokok={annual.gajiPokok}
        title="Hasil Perhitungan 12 Bulan"
        subtitle="angka aktual per bulan · klik baris untuk rincian"
        emptyMessage="Isi gaji pokok default untuk mulai menghitung"
      />
    </div>
  );
}

// ---------- Ledger cell (compact rupiah input) ----------
function LedgerNum({ resolved, value, overridden, onSet, accentColor = 'brand' }: {
  resolved?: number;
  value?: number;
  overridden: boolean;
  onSet: (n: number) => void;
  accentColor?: 'brand' | 'amber' | 'blue' | 'red';
}) {
  const shown = value ?? resolved ?? 0;
  const accent: Record<string, string> = {
    brand: 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--text-primary)]',
    amber: 'border-[var(--amber-border)] bg-[var(--amber-soft)] text-[var(--amber)]',
    blue:  'border-blue-300 bg-blue-50 text-blue-700',
    red:   'border-[var(--red-border)] bg-[var(--red-soft)] text-[var(--red)]',
  };
  return (
    <input
      inputMode="numeric"
      value={shown ? shown.toLocaleString('id-ID') : ''}
      placeholder="–"
      onChange={e => {
        const d = e.target.value.replace(/[^\d]/g, '');
        onSet(d ? parseInt(d, 10) : 0);
      }}
      className={`w-full text-right text-[12px] font-mono px-1.5 py-1 rounded border outline-none transition-colors placeholder:text-[var(--text-faint)] focus:ring-1 focus:ring-[var(--brand-ring)] focus:border-[var(--brand)] ${
        overridden ? `font-semibold ${accent[accentColor]}` : 'border-transparent text-[var(--text-muted)] hover:border-[var(--border-default)] bg-transparent'
      }`}
    />
  );
}

function TunjCell({ total, overridden, onClick }: { total: number; overridden: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full text-right text-[12px] font-mono px-1.5 py-1 rounded border transition-colors cursor-pointer ${
        overridden
          ? 'font-semibold border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--text-primary)]'
          : 'border-transparent text-[var(--text-muted)] hover:border-[var(--border-default)]'
      }`}
      title="Klik untuk ubah rincian tunjangan">
      {total ? total.toLocaleString('id-ID') : '–'}
    </button>
  );
}

// ---------- Per-month full editor ----------
function MonthEditor({
  b, annual, overrides, resetKey, active,
  onSetField, onSetEvent, onSetAktif, onReset, onApplyForward,
}: {
  b: number;
  annual: ProjParams;
  overrides: Record<number, MonthOverride>;
  resetKey: number;
  active: boolean;
  onSetField: (b: number, f: keyof ProjParams, v: number | string | boolean, isDefault: boolean) => void;
  onSetEvent: (b: number, f: 'thr' | 'bonus' | 'pot_lain', v: number) => void;
  onSetAktif: (b: number, aktif: boolean) => void;
  onReset: (b: number) => void;
  onApplyForward: (b: number) => void;
}) {
  const ov = overrides[b] ?? {};
  const get = (f: keyof ProjParams) => (ov[f] as number | undefined) ?? (annual[f] as number);
  const getStr = (f: keyof ProjParams) => (ov[f] as string | undefined) ?? (annual[f] as string);
  const getBool = (f: keyof ProjParams) => (ov[f] as boolean | undefined) ?? (annual[f] as boolean);
  const hasOverride = Object.keys(ov).length > 0;
  const k = `${b}-${resetKey}`;

  return (
    <div className="px-4 pb-4 pt-1 border-t border-[var(--border-subtle)] bg-[var(--bg-card)]">
      <div className="flex items-center justify-between gap-3 mb-3 pt-3">
        <p className="text-[12px] font-semibold text-[var(--text-primary)]">{BULAN_FULL[b - 1]} — semua nilai bisa diubah</p>
        <div className="flex items-center gap-2">
          {b < 12 && (
            <button onClick={() => onApplyForward(b)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border-default)] text-[12px] font-medium text-[var(--text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)] transition-colors cursor-pointer"
              title="Salin gaji, tunjangan & status ke bulan-bulan berikutnya (mis. kenaikan gaji)">
              <CornerDownRight size={13} /> Terapkan ke bulan berikutnya
            </button>
          )}
          {hasOverride && (
            <button onClick={() => onReset(b)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border-default)] text-[12px] font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
              <RotateCcw size={13} /> Kembalikan ke default
            </button>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer select-none mb-4">
        <input type="checkbox" checked={active} onChange={e => onSetAktif(b, e.target.checked)}
          className="w-4 h-4 rounded border-[var(--border-strong)] accent-[var(--brand)] cursor-pointer" />
        <span className="text-[13px] text-[var(--text-secondary)]">Karyawan bekerja bulan ini</span>
      </label>

      {active && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Penghasilan */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">Penghasilan</p>
            <div className="grid grid-cols-2 gap-3">
              <NominalInput key={`gp-${k}`} label="Gaji Pokok" name="_gp" defaultValue={get('gajiPokok')}
                onChange={v => onSetField(b, 'gajiPokok', v, v === annual.gajiPokok)} />
              <NominalInput key={`bb-${k}`} label="Dasar BPJS" name="_bb" defaultValue={get('bpjsBasis')}
                onChange={v => onSetField(b, 'bpjsBasis', v, v === (annual.bpjsBasis ?? 0))} />
              <NominalInput key={`bn-${k}`} label="Benefit" name="_bn" defaultValue={get('benefit')}
                onChange={v => onSetField(b, 'benefit', v, v === annual.benefit)} />
              <NominalInput key={`kn-${k}`} label="Kendaraan" name="_kn" defaultValue={get('kendaraan')}
                onChange={v => onSetField(b, 'kendaraan', v, v === annual.kendaraan)} />
              <NominalInput key={`pl-${k}`} label="Pulsa" name="_pl" defaultValue={get('pulsa')}
                onChange={v => onSetField(b, 'pulsa', v, v === annual.pulsa)} />
              <NominalInput key={`op-${k}`} label="Operasional" name="_op" defaultValue={get('operasional')}
                onChange={v => onSetField(b, 'operasional', v, v === annual.operasional)} />
              <NominalInput key={`tl-${k}`} label="Tunj. Lain" name="_tl" defaultValue={get('tunjLain')}
                onChange={v => onSetField(b, 'tunjLain', v, v === annual.tunjLain)} />
            </div>
          </div>

          {/* THR / Bonus / Potongan */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">THR · Bonus · Potongan</p>
            <NominalInput key={`thr-${k}`} label="THR" name="_thr" defaultValue={ov.thr ?? 0}
              onChange={v => onSetEvent(b, 'thr', v)} />
            <NominalInput key={`bon-${k}`} label="Bonus" name="_bon" defaultValue={ov.bonus ?? 0}
              onChange={v => onSetEvent(b, 'bonus', v)} />
            <NominalInput key={`pot-${k}`} label="Potongan (kasbon, dll.)" name="_pot" defaultValue={ov.pot_lain ?? 0}
              onChange={v => onSetEvent(b, 'pot_lain', v)} />
          </div>

          {/* Status pajak & BPJS bulan ini */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">Status Pajak & BPJS</p>
            <Sel label="Status PTKP" value={getStr('statusPtkp')} onChange={v => onSetField(b, 'statusPtkp', v, v === annual.statusPtkp)}>
              {['TK0','TK1','TK2','TK3','K0','K1','K2','K3'].map(s => <option key={s}>{s}</option>)}
            </Sel>
            <Sel label="NPWP" value={getBool('punyaNpwp') ? 'true' : 'false'}
              onChange={v => onSetField(b, 'punyaNpwp', v === 'true', (v === 'true') === annual.punyaNpwp)}>
              <option value="true">Ya — NPWP Valid</option>
              <option value="false">Tidak — NIK = NPWP</option>
            </Sel>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-3">
              <Chk label="JHT" checked={getBool('ikutJht')} onChange={v => onSetField(b, 'ikutJht', v, v === annual.ikutJht)} />
              <Chk label="JP" checked={getBool('ikutJp')} onChange={v => onSetField(b, 'ikutJp', v, v === annual.ikutJp)} />
              <Chk label="JKP" checked={getBool('ikutJkp')} onChange={v => onSetField(b, 'ikutJkp', v, v === annual.ikutJkp)} />
              <Chk label="Kesehatan" checked={getBool('ikutKes')} onChange={v => onSetField(b, 'ikutKes', v, v === annual.ikutKes)} />
            </div>
            <Chk label="PPh 21 Grossup" checked={getBool('pphDitanggung')} onChange={v => onSetField(b, 'pphDitanggung', v, v === annual.pphDitanggung)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- shared small inputs ----------
function Sel({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={SEL_CLS}>{children}</select>
    </div>
  );
}

function Chk({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-[var(--border-strong)] accent-[var(--brand)] cursor-pointer focus:ring-2 focus:ring-[var(--brand-ring)]" />
      <span className="text-[13px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{label}</span>
    </label>
  );
}
