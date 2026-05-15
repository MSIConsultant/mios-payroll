'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';
import { calculateMonthlySalary, calculateFreelance } from '@/lib/engine/payroll';
import { saveImport, type ImportRecord } from '@/lib/actions/import';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft, Upload, FileSpreadsheet, CheckCircle2,
  AlertTriangle, XCircle, ChevronRight, Loader2,
  Users, Lock, RefreshCw
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────
interface ParsedEmp {
  nik: string; nama: string; divisi: string; npwp: string;
  punya_npwp: boolean; status_ptkp: string; jenis_kelamin: string;
  gaji_pokok: number; benefit: number; kendaraan: number;
  pulsa: number; operasional: number; jkk_rate: number;
  ikut_jht: boolean; ikut_jp: boolean; ikut_kes: boolean;
  jenis_karyawan: 'tetap' | 'tidak_tetap_harian';
  upah_harian: number; tunj_pph: number;
  excel_bruto: number; excel_pph: number; excel_thp: number;
  _valid: boolean; _errors: string[];
}

type Step = 'upload' | 'reconcile' | 'confirm' | 'saving' | 'done';

const PTKP_VALID  = ['TK0','TK1','TK2','TK3','K0','K1','K2','K3'];
const JKK_RATES   = [0.0024, 0.0054, 0.0089, 0.0127, 0.0174];
const BULAN_NAMES = ['','Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'];
const fmt  = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const pct  = (n: number) => `${(n * 100).toFixed(2)}%`;

function closestJKK(rate: number) {
  if (rate <= 0) return 0.0024;
  return JKK_RATES.reduce((p, c) => Math.abs(c - rate) < Math.abs(p - rate) ? c : p);
}

// ── Excel Parsers ─────────────────────────────────────────────────
function parseTetap(ws: any): ParsedEmp[] {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  const out: ParsedEmp[] = [];
  for (let r = 4; r <= range.e.r; r++) {
    const g = (c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v ?? null;
    const nama = String(g(3) ?? '').trim();
    if (!nama || nama.length < 2) continue;
    const nik        = String(g(2) ?? '').trim().replace(/\D/g, '');
    const punya_npwp = String(g(0) ?? '').toUpperCase() === 'NPWP';
    const ptkp       = String(g(11) ?? '').trim().toUpperCase();
    const gaji       = Number(g(14)) || 0;
    const jkk_amt    = Number(g(15)) || 0;
    const jkk_rate   = gaji > 0 ? closestJKK(jkk_amt / gaji) : 0.0024;
    const errs: string[] = [];
    if (nik.length < 8) errs.push('NIK tidak valid');
    if (!PTKP_VALID.includes(ptkp)) errs.push(`PTKP tidak dikenal: ${ptkp}`);
    if (gaji <= 0) errs.push('Gaji tidak terbaca');
    out.push({
      nik, nama,
      divisi:        String(g(4) ?? '').trim(),
      npwp:          String(g(7) ?? '').trim(),
      punya_npwp,
      status_ptkp:   PTKP_VALID.includes(ptkp) ? ptkp : 'TK0',
      jenis_kelamin: String(g(52) ?? '').trim().toUpperCase() === 'P' ? 'P' : 'L',
      gaji_pokok:    gaji,
      benefit:       Number(g(21)) || 0,
      kendaraan:     Number(g(22)) || 0,
      pulsa:         Number(g(23)) || 0,
      operasional:   Number(g(24)) || 0,
      jkk_rate,
      ikut_jht:      (Number(g(17)) || 0) > 0,
      ikut_jp:       (Number(g(18)) || 0) > 0,
      ikut_kes:      (Number(g(19)) || 0) > 0,
      jenis_karyawan: 'tetap',
      upah_harian:   0,
      tunj_pph:      Number(g(20)) || 0,
      excel_thp:     Number(g(8))  || 0,
      excel_bruto:   Number(g(9))  || 0,
      excel_pph:     Number(g(10)) || 0,
      _valid: errs.length === 0, _errors: errs,
    });
  }
  return out;
}

function parseHarian(ws: any): ParsedEmp[] {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  const out: ParsedEmp[] = [];
  for (let r = 1; r <= range.e.r; r++) {
    const g = (c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v ?? null;
    if (!g(2) || isNaN(Number(g(2)))) continue;
    const nama = String(g(5) ?? '').trim();
    if (!nama || nama.length < 2) continue;
    const nik  = String(g(4) ?? '').trim().replace(/\D/g, '');
    const ptkp = String(g(6) ?? '').trim().toUpperCase();
    const errs: string[] = [];
    if (nik.length < 8) errs.push('NIK tidak valid');
    const bruto = Number(g(10)) || 0;
    out.push({
      nik, nama, divisi: '', npwp: '', punya_npwp: false,
      status_ptkp: PTKP_VALID.includes(ptkp) ? ptkp : 'TK0',
      jenis_kelamin: 'L', gaji_pokok: 0, benefit: 0, kendaraan: 0,
      pulsa: 0, operasional: 0, jkk_rate: 0.0024,
      ikut_jht: false, ikut_jp: false, ikut_kes: false,
      jenis_karyawan: 'tidak_tetap_harian',
      upah_harian: bruto > 0 ? Math.round(bruto / 22) : 0,
      tunj_pph: 0,
      excel_bruto: bruto, excel_pph: Number(g(11)) || 0, excel_thp: Number(g(12)) || 0,
      _valid: errs.length === 0, _errors: errs,
    });
  }
  return out;
}

// ── Reconcile one employee against engine ─────────────────────────
function reconcileEmployee(emp: ParsedEmp, bulan: number, tahun: number): {
  engine_bruto: number; engine_pph: number; engine_thp: number;
  diff_pct: number; has_diff: boolean; full_result: Record<string, any>;
} {
  try {
    let result: any = {};
    if (emp.jenis_karyawan === 'tetap') {
      result = calculateMonthlySalary({
        ...emp, bulan, tahun,
        tunj_lain:   0, kasbon: 0, alpha_telat: 0, pot_lain: 0,
        thr: 0, bonus: 0, pph_jan_nov: 0, akum_bruto: 0,
      });
    } else {
      result = calculateMonthlySalary({
        ...emp, bulan, tahun,
        tunj_lain:      0,
        kasbon:         0,
        alpha_telat:    0,
        pot_lain:       0,
        thr:            0,
        bonus:          0,
        pph_jan_nov:    0,
        akum_bruto:     0,
        // ← These were missing:
        ikut_jkp:         false,
        tanggung_jht_k:   emp.ikut_jht,
        tanggung_jp_k:    emp.ikut_jp,
        tanggung_kes_k:   emp.ikut_kes,
        pph_ditanggung:   emp.tunj_pph > 0,
      });
    }
    const engine_bruto = result.bruto ?? result.total_upah ?? 0;
    const engine_pph   = result.pph   ?? result.total_pph  ?? 0;
    const engine_thp   = result.thp   ?? 0;
    const base         = emp.excel_bruto || 1;
    const diff_pct     = Math.abs(engine_bruto - emp.excel_bruto) / base * 100;
    return { engine_bruto, engine_pph, engine_thp, diff_pct, has_diff: diff_pct > 0.5, full_result: result };
  } catch {
    return { engine_bruto: 0, engine_pph: 0, engine_thp: 0, diff_pct: 100, has_diff: true, full_result: {} };
  }
}

// ── Step indicator ────────────────────────────────────────────────
function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { key: 'upload',    label: 'Upload'        },
    { key: 'reconcile', label: 'Rekonsiliasi'  },
    { key: 'confirm',   label: 'Konfirmasi'    },
    { key: 'done',      label: 'Selesai'       },
  ];
  const idx = steps.findIndex(s => s.key === step);
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-black transition-all"
              style={{
                background: i < idx ? '#2563EB' : i === idx ? '#2563EB' : 'var(--bg-card)',
                border:     `2px solid ${i <= idx ? '#2563EB' : 'var(--border-default)'}`,
                color:      i <= idx ? '#fff' : 'var(--text-muted)',
              }}>
              {i < idx ? '✓' : i + 1}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest mt-1 whitespace-nowrap"
              style={{ color: i === idx ? '#3B82F6' : 'var(--text-ghost)' }}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="w-16 h-px mb-4 mx-1 transition-all"
              style={{ background: i < idx ? '#2563EB' : 'var(--border-default)' }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Diff badge ────────────────────────────────────────────────────
function DiffBadge({ pct }: { pct: number }) {
  if (pct < 0.5)  return <span className="text-[11px] font-bold text-green-400">✓ Match</span>;
  if (pct < 5)    return <span className="text-[11px] font-bold text-amber-400">⚠ {pct.toFixed(1)}%</span>;
  return              <span className="text-[11px] font-bold text-red-400">✗ {pct.toFixed(1)}%</span>;
}

// ── Main component ────────────────────────────────────────────────
export default function ImportNewPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');

  // Step 1 state
  const [companies, setCompanies]   = useState<any[]>([]);
  const [companyId, setCompanyId]   = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [bulan, setBulan]           = useState(new Date().getMonth() + 1);
  const [tahun, setTahun]           = useState(new Date().getFullYear());
  const [fileName, setFileName]     = useState('');
  const [dragOver, setDragOver]     = useState(false);
  const [parsed, setParsed]         = useState<ParsedEmp[]>([]);
  const [reconciled, setReconciled] = useState<ImportRecord[]>([]);
  const [mode, setMode]             = useState<'employees_only' | 'full'>('full');
  const [saveProgress, setSaveProgress] = useState(0);
  const [doneResult, setDoneResult] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('user_profiles').select('workspace_id').eq('id', user.id).single();
      if (!profile?.workspace_id) return;
      setWorkspaceId(profile.workspace_id);
      const { data: cos } = await supabase
        .from('companies').select('id, name, kota')
        .eq('workspace_id', profile.workspace_id).eq('aktif', true).order('name');
      if (cos) { setCompanies(cos); if (cos.length === 1) setCompanyId(cos[0].id); }
    }
    load();
  }, []);

  function processFile(file: File) {
    setFileName(file.name);
    // Auto-detect month from filename e.g. "02" in "Grossup_PPh_21_02-2026.xlsx"
    const monthMatch = file.name.match(/_(\d{2})-(\d{4})/);
    if (monthMatch) {
      setBulan(parseInt(monthMatch[1], 10));
      setTahun(parseInt(monthMatch[2], 10));
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' });
        let all: ParsedEmp[] = [];
        let detectedMonth = bulan;
        for (const name of wb.SheetNames) {
          const num = parseInt(name.trim(), 10);
          if (!isNaN(num) && num >= 1 && num <= 12) {
            detectedMonth = num;
            all = [...all, ...parseTetap(wb.Sheets[name])];
          }
          if (name.toUpperCase().includes('HARIAN')) {
            all = [...all, ...parseHarian(wb.Sheets[name])];
          }
        }
        setBulan(detectedMonth);
        setParsed(all);
        if (all.length === 0) toast.error('Tidak ada data terbaca. Periksa format sheet.');
        else toast.success(`${all.length} karyawan terbaca dari ${file.name}`);
      } catch (err) {
        toast.error('Gagal membaca file Excel.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, [bulan]);

  function handleRunReconcile() {
    if (!companyId) { toast.error('Pilih perusahaan terlebih dahulu'); return; }
    if (parsed.length === 0) { toast.error('Upload file terlebih dahulu'); return; }
    const valid = parsed.filter(e => e._valid);
    if (valid.length === 0) { toast.error('Tidak ada data valid untuk diproses'); return; }

    const recs: ImportRecord[] = valid.map(emp => {
      const rec = reconcileEmployee(emp, bulan, tahun);
      return {
        ...emp,
        engine_bruto: rec.engine_bruto,
        engine_pph:   rec.engine_pph,
        engine_thp:   rec.engine_thp,
        diff_pct:     rec.diff_pct,
        has_diff:     rec.has_diff,
        full_result:  rec.full_result,
      };
    });
    setReconciled(recs);
    setStep('reconcile');
  }

  async function handleSave() {
    setStep('saving');
    setSaveProgress(0);
    const total = reconciled.length;
    let prog = 0;
    const interval = setInterval(() => {
      prog = Math.min(prog + Math.random() * 15, 90);
      setSaveProgress(prog);
    }, 200);

    const res = await saveImport({
      workspaceId, companyId, bulan, tahun, fileName, mode, records: reconciled,
    });

    clearInterval(interval);
    setSaveProgress(100);

    if (res.error) { toast.error(res.error); setStep('confirm'); return; }
    setDoneResult(res);
    setStep('done');
  }

  const validCount   = parsed.filter(e => e._valid).length;
  const invalidCount = parsed.filter(e => !e._valid).length;
  const diffCount    = reconciled.filter(r => r.has_diff).length;
  const matchCount   = reconciled.length - diffCount;
  const selectedCo   = companies.find(c => c.id === companyId);

  // ── UPLOAD STEP ──────────────────────────────────────────────────
  if (step === 'upload') return (
    <div className="max-w-3xl space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-4 border-b pb-6" style={{ borderColor: 'var(--border-default)' }}>
        <Link href="/import"
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
          <ArrowLeft size={15} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Import Baru</h1>
        </div>
        <StepIndicator step={step} />
      </div>

      {/* Company + date */}
      <div className="rounded-2xl p-6 space-y-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-3 md:col-span-1">
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-2"
              style={{ color: 'var(--text-muted)' }}>Perusahaan *</label>
            <select value={companyId} onChange={e => setCompanyId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
              <option value="">Pilih perusahaan...</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-2"
              style={{ color: 'var(--text-muted)' }}>Bulan</label>
            <select value={bulan} onChange={e => setBulan(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
              {BULAN_NAMES.slice(1).map((b, i) => <option key={i+1} value={i+1}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-2"
              style={{ color: 'var(--text-muted)' }}>Tahun</label>
            <select value={tahun} onChange={e => setTahun(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl text-[14px] outline-none"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
              {[2023,2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)} onDrop={onDrop}
        className="rounded-2xl border-2 border-dashed p-12 text-center transition-all"
        style={{
          borderColor: dragOver ? '#2563EB' : parsed.length > 0 ? 'rgba(34,197,94,0.4)' : 'var(--border-strong)',
          background:  dragOver ? 'rgba(37,99,235,0.04)' : parsed.length > 0 ? 'rgba(34,197,94,0.03)' : 'var(--bg-card)',
        }}>
        {parsed.length > 0 ? (
          <>
            <CheckCircle2 size={36} className="mx-auto mb-3 text-green-400" />
            <p className="text-[16px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {fileName}
            </p>
            <p className="text-[14px] mb-2" style={{ color: 'var(--text-muted)' }}>
              {validCount} karyawan valid{invalidCount > 0 ? `, ${invalidCount} error` : ''}
            </p>
            <label className="text-[13px] cursor-pointer transition-colors" style={{ color: '#3B82F6' }}>
              Ganti file
              <input type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { setParsed([]); setTimeout(() => processFile(f), 50); } }} />
            </label>
          </>
        ) : (
          <>
            <FileSpreadsheet size={40} className="mx-auto mb-4" style={{ color: 'var(--text-ghost)' }} />
            <p className="text-[16px] font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
              Drop file Excel di sini
            </p>
            <p className="text-[13px] mb-5" style={{ color: 'var(--text-muted)' }}>
              Format: Grossup_PPh_21_02-2026.xlsx · Sheet: "02", "HARIAN 02"
            </p>
            <label className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-[14px] text-white cursor-pointer"
              style={{ background: '#2563EB' }}>
              <Upload size={15} />Pilih File
              <input type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
            </label>
          </>
        )}
      </div>

      {/* Errors */}
      {invalidCount > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(251,176,64,0.06)', border: '1px solid rgba(251,176,64,0.2)' }}>
          <p className="text-[12px] font-bold text-amber-400 uppercase tracking-widest mb-2">
            {invalidCount} Baris Bermasalah (tidak akan diimpor)
          </p>
          {parsed.filter(e => !e._valid).slice(0, 5).map((e, i) => (
            <p key={i} className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              · {e.nama || 'Baris tidak dikenal'} — {e._errors.join(', ')}
            </p>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleRunReconcile}
          disabled={!companyId || validCount === 0}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-[15px] text-white disabled:opacity-40 transition-colors"
          style={{ background: '#2563EB' }}>
          Lanjut ke Rekonsiliasi
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  // ── RECONCILE STEP ───────────────────────────────────────────────
  if (step === 'reconcile') return (
    <div className="max-w-5xl space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-4 border-b pb-6" style={{ borderColor: 'var(--border-default)' }}>
        <button onClick={() => setStep('upload')}
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
          <ArrowLeft size={15} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Rekonsiliasi — {selectedCo?.name} · {BULAN_NAMES[bulan]} {tahun}
          </h1>
        </div>
        <StepIndicator step={step} />
      </div>

      {/* Summary badges */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: reconciled.length, color: 'var(--text-primary)' },
          { label: 'Match', value: matchCount, color: '#4ADE80' },
          { label: 'Beda', value: diffCount, color: diffCount > 0 ? '#FBB040' : '#4ADE80' },
          { label: 'Total Bruto Excel', value: fmt(reconciled.reduce((a,r) => a + r.excel_bruto, 0)), color: '#3B82F6' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-[22px] font-black font-mono" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {diffCount > 0 && (
        <div className="rounded-xl px-5 py-3 flex items-center gap-3"
          style={{ background: 'rgba(251,176,64,0.06)', border: '1px solid rgba(251,176,64,0.2)' }}>
          <AlertTriangle size={15} className="text-amber-400 shrink-0" />
          <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            {diffCount} karyawan memiliki perbedaan antara nilai Excel dan kalkulasi engine.
            Ini bisa disebabkan perbedaan rounding, tarif JKK, atau akumulasi bulan sebelumnya.
            <strong className="ml-1 text-amber-300">Nilai Excel yang dipakai sebagai data final.</strong>
          </p>
        </div>
      )}

      {/* Reconciliation table */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-default)' }}>
        <div className="px-5 py-3 grid grid-cols-7 gap-2 text-[10px] font-bold uppercase tracking-widest"
          style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
          <div className="col-span-2">Nama</div>
          <div>PTKP</div>
          <div className="text-right">Bruto (Excel)</div>
          <div className="text-right">Bruto (Engine)</div>
          <div className="text-right">THP</div>
          <div className="text-center">Status</div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {reconciled.map((r, i) => (
            <div key={i}
              className="px-5 py-3 grid grid-cols-7 gap-2 items-center text-[13px]"
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                background: r.has_diff ? 'rgba(251,176,64,0.02)' : 'transparent',
              }}>
              <div className="col-span-2">
                <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{r.nama}</p>
                <p className="text-[11px] font-mono" style={{ color: 'var(--text-ghost)' }}>{r.divisi || r.nik}</p>
              </div>
              <div>
                <span className="text-[11px] px-2 py-0.5 rounded font-bold"
                  style={{ background: 'rgba(56,189,248,0.1)', color: '#38BDF8' }}>
                  {r.status_ptkp}
                </span>
              </div>
              <div className="text-right font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                {fmt(r.excel_bruto)}
              </div>
              <div className="text-right font-mono" style={{ color: r.has_diff ? '#FBB040' : 'var(--text-muted)' }}>
                {fmt(r.engine_bruto)}
              </div>
              <div className="text-right font-mono text-green-400 font-bold">
                {fmt(r.excel_thp)}
              </div>
              <div className="flex justify-center">
                <DiffBadge pct={r.diff_pct} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={() => setStep('upload')}
          className="px-6 py-3 rounded-xl font-bold text-[14px] transition-colors"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
          ← Kembali
        </button>
        <button onClick={() => setStep('confirm')}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-[15px] text-white"
          style={{ background: '#2563EB' }}>
          Lanjut ke Konfirmasi
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  // ── CONFIRM STEP ─────────────────────────────────────────────────
  if (step === 'confirm') return (
    <div className="max-w-2xl space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-4 border-b pb-6" style={{ borderColor: 'var(--border-default)' }}>
        <button onClick={() => setStep('reconcile')}
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
          <ArrowLeft size={15} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Konfirmasi Import</h1>
        </div>
        <StepIndicator step={step} />
      </div>

      {/* Summary */}
      <div className="rounded-2xl p-6 space-y-3"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <p className="font-bold text-[16px]" style={{ color: 'var(--text-primary)' }}>Ringkasan Import</p>
        {[
          { label: 'File',        value: fileName },
          { label: 'Perusahaan', value: selectedCo?.name ?? '—' },
          { label: 'Periode',    value: `${BULAN_NAMES[bulan]} ${tahun}` },
          { label: 'Karyawan',   value: `${reconciled.length} (${reconciled.filter(r => !r.has_diff).length} match, ${diffCount} beda)` },
        ].map(s => (
          <div key={s.label} className="flex items-center justify-between py-2"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
            <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Mode selection */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: 'full', icon: Lock, title: 'Karyawan + Payroll', desc: `Buat karyawan baru dan simpan hasil payroll ${BULAN_NAMES[bulan]} ${tahun} (dikunci). Direkomendasikan.` },
          { key: 'employees_only', icon: Users, title: 'Karyawan Saja', desc: 'Hanya buat profil karyawan. Tidak menyimpan hasil payroll.' },
        ].map(m => (
          <button key={m.key} onClick={() => setMode(m.key as any)}
            className="p-5 rounded-2xl text-left transition-all"
            style={{
              background: mode === m.key ? 'rgba(37,99,235,0.07)' : 'var(--bg-card)',
              border:     `1px solid ${mode === m.key ? 'rgba(37,99,235,0.4)' : 'var(--border-default)'}`,
            }}>
            <div className="flex items-center gap-2 mb-2">
              <m.icon size={15} style={{ color: mode === m.key ? '#3B82F6' : 'var(--text-muted)' }} />
              <p className="font-bold text-[14px]" style={{ color: 'var(--text-primary)' }}>{m.title}</p>
              {mode === m.key && (
                <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{ background: 'rgba(37,99,235,0.15)', color: '#3B82F6' }}>✓</span>
              )}
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{m.desc}</p>
          </button>
        ))}
      </div>

      <button onClick={handleSave}
        className="w-full py-4 rounded-2xl font-black text-[16px] text-white transition-colors"
        style={{ background: '#2563EB' }}>
        {mode === 'full' ? `Import ${reconciled.length} Karyawan + Payroll` : `Import ${reconciled.length} Karyawan`}
      </button>
    </div>
  );

  // ── SAVING STEP ──────────────────────────────────────────────────
  if (step === 'saving') return (
    <div className="max-w-sm mx-auto py-20 text-center animate-fade-in-up">
      <Loader2 size={40} className="mx-auto mb-6 animate-spin" style={{ color: '#2563EB' }} />
      <p className="text-[18px] font-black mb-3" style={{ color: 'var(--text-primary)' }}>
        Menyimpan data...
      </p>
      <div className="w-full h-2 rounded-full overflow-hidden mb-2"
        style={{ background: 'var(--border-default)' }}>
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${saveProgress}%`, background: '#2563EB' }} />
      </div>
      <p className="text-[13px] font-mono" style={{ color: 'var(--text-muted)' }}>
        {Math.round(saveProgress)}%
      </p>
    </div>
  );

  // ── DONE STEP ────────────────────────────────────────────────────
  if (step === 'done' && doneResult) return (
    <div className="max-w-md mx-auto py-12 space-y-6 animate-fade-in-up text-center">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
        style={{ background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)' }}>
        <CheckCircle2 size={36} className="text-green-400" />
      </div>
      <div>
        <h1 className="text-3xl font-black mb-2" style={{ color: 'var(--text-primary)' }}>Import Selesai!</h1>
        <div className="space-y-1 mt-4">
          {doneResult.created > 0 && (
            <p className="text-[15px]" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-black text-green-400">{doneResult.created}</span> karyawan baru dibuat
            </p>
          )}
          {doneResult.skipped > 0 && (
            <p className="text-[15px]" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-black" style={{ color: 'var(--text-muted)' }}>{doneResult.skipped}</span> karyawan sudah ada
            </p>
          )}
          {doneResult.payroll && (
            <p className="text-[15px]" style={{ color: 'var(--text-secondary)' }}>
              Payroll <span className="font-black text-sky-400">{BULAN_NAMES[bulan]} {tahun}</span> tersimpan &amp; dikunci
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-3 justify-center">
        <Link href={`/companies/${companyId}`}
          className="px-6 py-3 rounded-xl font-bold text-[14px] text-white"
          style={{ background: '#2563EB' }}>
          Lihat Karyawan
        </Link>
        {doneResult.payroll && (
          <Link href={`/companies/${companyId}/payroll/${tahun}/${bulan}`}
            className="px-6 py-3 rounded-xl font-bold text-[14px] transition-colors"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
            Lihat Payroll
          </Link>
        )}
        <Link href="/import/new"
          className="px-6 py-3 rounded-xl font-bold text-[14px] transition-colors"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
          Import Lagi
        </Link>
      </div>
    </div>
  );

  return null;
}
