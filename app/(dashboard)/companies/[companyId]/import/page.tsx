'use client';
import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';
import { createEmployee } from '@/lib/actions/employees';
import { savePayrollRun, lockPayrollRun } from '@/lib/actions/payroll';
import { toast } from 'sonner';
import {
  ArrowLeft, Upload, CheckCircle2, AlertTriangle,
  FileSpreadsheet, Loader2, Users, Calculator, Lock
} from 'lucide-react';

// ─── Types ───────────────────────────────────────
interface ParsedEmployee {
  nik: string;
  nama: string;
  divisi: string;
  npwp: string;
  punya_npwp: boolean;
  status_ptkp: string;
  jenis_kelamin: string;
  gaji_pokok: number;
  benefit: number;
  kendaraan: number;
  pulsa: number;
  operasional: number;
  jkk_rate: number;
  ikut_jht: boolean;
  ikut_jp: boolean;
  ikut_kes: boolean;
  jenis_karyawan: 'tetap' | 'tidak_tetap_harian' | 'tidak_tetap_bulanan';
  upah_harian?: number;
  // Payroll result fields
  thp: number;
  bruto: number;
  pph: number;
  ter_rate: number;
  tunj_pph: number;
  allowance_total: number;
  // Validation
  _errors: string[];
  _valid: boolean;
  _type: 'tetap' | 'harian';
}

const JKK_RATES = [0.0024, 0.0054, 0.0089, 0.0127, 0.0174];
const PTKP_VALID = ['TK0','TK1','TK2','TK3','K0','K1','K2','K3'];
const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

function closestJKK(rate: number): number {
  if (rate <= 0) return 0.0024;
  return JKK_RATES.reduce((p, c) => Math.abs(c - rate) < Math.abs(p - rate) ? c : p);
}

// ─── Sheet Parsers ────────────────────────────────

/**
 * Parses the monthly salary sheet (e.g. "02", "01", "12")
 * Column mapping (0-based):
 * 0=npwp_flag, 2=nik, 3=nama, 4=divisi, 7=npwp, 8=thp,
 * 9=bruto, 10=pph, 11=ptkp, 13=ter_rate, 14=gaji_pokok,
 * 15=jkk_amt, 16=jkm_amt, 17=jht_amt, 18=jp_amt,
 * 19=kes_amt, 20=tunj_pph, 21=benefit, 22=kendaraan,
 * 23=pulsa, 24=operasional, 52=jenis_kelamin
 */
function parseTetapSheet(ws: any): ParsedEmployee[] {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1');
  const results: ParsedEmployee[] = [];

  for (let r = 4; r <= range.e.r; r++) {
    const get = (c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v ?? null;

    const nik  = String(get(2) ?? '').trim().replace(/\D/g, '');
    const nama = String(get(3) ?? '').trim();
    if (!nama || nama.length < 2) continue;

    const punya_npwp = String(get(0) ?? '').toUpperCase() === 'NPWP';
    const npwp_raw   = String(get(7) ?? '').trim();
    const ptkp       = String(get(11) ?? '').trim().toUpperCase();
    const ter_rate   = Number(get(13)) || 0;
    const gaji       = Number(get(14)) || 0;
    const jkk_amt    = Number(get(15)) || 0;
    const jht_amt    = Number(get(17)) || 0;
    const jp_amt     = Number(get(18)) || 0;
    const kes_amt    = Number(get(19)) || 0;
    const tunj_pph   = Number(get(20)) || 0;
    const benefit    = Number(get(21)) || 0;
    const kendaraan  = Number(get(22)) || 0;
    const pulsa      = Number(get(23)) || 0;
    const operasional = Number(get(24)) || 0;
    const thp        = Number(get(8))  || 0;
    const bruto      = Number(get(9))  || 0;
    const pph        = Number(get(10)) || 0;
    const gk         = String(get(52) ?? '').trim().toUpperCase();

    // Derive JKK rate from amount
    const basisForJKK = gaji || bruto;
    const jkk_rate = basisForJKK > 0 ? closestJKK(jkk_amt / basisForJKK) : 0.0024;

    const errors: string[] = [];
    if (!nik || nik.length < 8)    errors.push('NIK tidak valid');
    if (!PTKP_VALID.includes(ptkp)) errors.push(`PTKP tidak valid: ${ptkp || '—'}`);
    if (gaji <= 0)                  errors.push('Gaji tidak terbaca');

    const allowance_total = benefit + kendaraan + pulsa + operasional;

    results.push({
      nik, nama,
      divisi:        String(get(4) ?? '').trim(),
      npwp:          npwp_raw,
      punya_npwp,
      status_ptkp:   PTKP_VALID.includes(ptkp) ? ptkp : 'TK0',
      jenis_kelamin: gk === 'P' ? 'P' : 'L',
      gaji_pokok:    gaji,
      benefit, kendaraan, pulsa, operasional,
      jkk_rate,
      ikut_jht:      jht_amt > 0,
      ikut_jp:       jp_amt  > 0,
      ikut_kes:      kes_amt > 0,
      jenis_karyawan: 'tetap',
      thp, bruto, pph, ter_rate, tunj_pph, allowance_total,
      _errors: errors,
      _valid:  errors.length === 0,
      _type:   'tetap',
    });
  }
  return results;
}

/**
 * Parses the HARIAN sheet (tidak tetap harian)
 * Col: 2=no, 4=nik, 5=nama, 6=ptkp, 8=ter_rate,
 *      10=bruto, 11=pph, 12=thp
 */
function parseHarianSheet(ws: any): ParsedEmployee[] {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1');
  const results: ParsedEmployee[] = [];

  for (let r = 1; r <= range.e.r; r++) {
    const get = (c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v ?? null;

    const no = get(2);
    if (!no || isNaN(Number(no))) continue;

    const nik  = String(get(4) ?? '').trim().replace(/\D/g, '');
    const nama = String(get(5) ?? '').trim();
    if (!nama || nama.length < 2) continue;

    const ptkp     = String(get(6) ?? '').trim().toUpperCase();
    const ter_rate = Number(get(8))  || 0;
    const bruto    = Number(get(10)) || 0;
    const pph      = Number(get(11)) || 0;
    const thp      = Number(get(12)) || 0;

    const errors: string[] = [];
    if (!nik || nik.length < 8) errors.push('NIK tidak valid');

    results.push({
      nik, nama,
      divisi:        '',
      npwp:          '',
      punya_npwp:    false,
      status_ptkp:   PTKP_VALID.includes(ptkp) ? ptkp : 'TK0',
      jenis_kelamin: 'L',
      gaji_pokok:    0,
      benefit: 0, kendaraan: 0, pulsa: 0, operasional: 0,
      jkk_rate:      0.0024,
      ikut_jht:      false,
      ikut_jp:       false,
      ikut_kes:      false,
      jenis_karyawan: 'tidak_tetap_harian',
      upah_harian:   bruto > 0 ? Math.round(bruto / 22) : 0,
      thp, bruto, pph, ter_rate, tunj_pph: 0,
      allowance_total: 0,
      _errors: errors,
      _valid:  errors.length === 0,
      _type:   'harian',
    });
  }
  return results;
}

// ─── Main Component ───────────────────────────────
export default function ImportPage() {
  const { companyId } = useParams();
  const router = useRouter();

  const [fileName, setFileName]     = useState('');
  const [employees, setEmployees]   = useState<ParsedEmployee[]>([]);
  const [detectedBulan, setDetectedBulan] = useState(new Date().getMonth() + 1);
  const [tahun, setTahun]           = useState(new Date().getFullYear());
  const [mode, setMode]             = useState<'employees' | 'full'>('full');
  const [dragOver, setDragOver]     = useState(false);
  const [importing, setImporting]   = useState(false);
  const [progress, setProgress]     = useState({ step: '', current: 0, total: 0 });
  const [done, setDone]             = useState<{ created: number; payroll: boolean } | null>(null);

  function processFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: 'array' });

        let allEmployees: ParsedEmployee[] = [];
        let detectedMonth = new Date().getMonth() + 1;

        // Find monthly sheet (named like "02", "01", "12")
        for (const name of wb.SheetNames) {
          const num = parseInt(name, 10);
          if (!isNaN(num) && num >= 1 && num <= 12) {
            detectedMonth = num;
            const ws = wb.Sheets[name];
            allEmployees = [...allEmployees, ...parseTetapSheet(ws)];
          }
        }

        // Find harian sheet
        for (const name of wb.SheetNames) {
          if (name.toUpperCase().includes('HARIAN')) {
            const ws = wb.Sheets[name];
            allEmployees = [...allEmployees, ...parseHarianSheet(ws)];
          }
        }

        if (allEmployees.length === 0) {
          toast.error('Tidak ada data karyawan yang terbaca. Pastikan format sheet benar.');
          return;
        }

        setDetectedBulan(detectedMonth);
        setEmployees(allEmployees);
        toast.success(`${allEmployees.length} karyawan terbaca — Bulan ${detectedMonth}`);
      } catch (err) {
        toast.error('Gagal membaca file. Pastikan format .xlsx benar.');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  async function handleImport() {
    const valid = employees.filter(e => e._valid);
    if (valid.length === 0) { toast.error('Tidak ada data valid.'); return; }

    setImporting(true);
    const supabase = createClient();
    let created = 0;

    // ── Step 1: Create/update employees ──────────────────
    setProgress({ step: 'Membuat karyawan...', current: 0, total: valid.length });

    // Get existing employees by NIK
    const { data: existing } = await supabase
      .from('employees').select('id, nik').eq('company_id', companyId);
    const existingByNIK = Object.fromEntries((existing ?? []).map(e => [e.nik, e.id]));

    const empIdMap: Record<string, string> = {}; // nik → employee_id

    for (let i = 0; i < valid.length; i++) {
      const emp = valid[i];
      setProgress({ step: 'Membuat karyawan...', current: i + 1, total: valid.length });

      if (existingByNIK[emp.nik]) {
        // Already exists — use existing ID
        empIdMap[emp.nik] = existingByNIK[emp.nik];
      } else {
        // Create new
        const fd = new FormData();
        const fields: Record<string, string> = {
          company_id:      companyId as string,
          nama:            emp.nama,
          nik:             emp.nik,
          npwp:            emp.npwp,
          punya_npwp:      String(emp.punya_npwp),
          status_ptkp:     emp.status_ptkp,
          jenis_kelamin:   emp.jenis_kelamin,
          divisi:          emp.divisi,
          jabatan:         '',
          jenis_karyawan:  emp.jenis_karyawan,
          gaji_pokok:      String(emp.gaji_pokok),
          benefit:         String(emp.benefit),
          kendaraan:       String(emp.kendaraan),
          pulsa:           String(emp.pulsa),
          operasional:     String(emp.operasional),
          tunj_lain:       '0',
          jkk_rate:        String(emp.jkk_rate),
          upah_harian:     String(emp.upah_harian ?? 0),
          hari_kerja_default: '22',
        };
        for (const [k, v] of Object.entries(fields)) fd.append(k, v);
        if (emp.ikut_jht) fd.append('ikut_jht', 'on');
        if (emp.ikut_jp)  fd.append('ikut_jp',  'on');
        if (emp.ikut_kes) fd.append('ikut_kes', 'on');
        fd.append('tanggung_jht_k', emp.ikut_jht ? 'on' : '');
        fd.append('tanggung_jp_k',  emp.ikut_jp  ? 'on' : '');
        fd.append('tanggung_kes_k', emp.ikut_kes ? 'on' : '');
        if (emp.tunj_pph > 0) fd.append('pph_ditanggung', 'on');

        const res = await createEmployee(fd);
        if (!res.error) {
          // Get the newly created employee's ID
          const { data: newEmp } = await supabase
            .from('employees').select('id').eq('company_id', companyId)
            .eq('nik', emp.nik).single();
          if (newEmp) { empIdMap[emp.nik] = newEmp.id; created++; }
        }
      }
    }

    if (mode === 'employees') {
      setImporting(false);
      setDone({ created, payroll: false });
      return;
    }

    // ── Step 2: Create payroll run ────────────────────────
    setProgress({ step: `Menyimpan payroll ${detectedBulan}/${tahun}...`, current: 0, total: valid.length });

    // Build synthetic results
    const payrollResults = valid
      .filter(emp => empIdMap[emp.nik])
      .map((emp, i) => {
        setProgress(p => ({ ...p, current: i + 1 }));
        return {
          employee_id:    empIdMap[emp.nik],
          employee_name:  emp.nama,
          gaji_pokok:     emp.gaji_pokok,
          allowance_total: emp.allowance_total,
          bruto:          emp.bruto,
          ter:            emp.ter_rate,
          pph:            emp.pph,
          tunj_pph:       emp.tunj_pph,
          thp:            emp.thp,
          total_upah:     emp.jenis_karyawan !== 'tetap' ? emp.bruto : 0,
          total_pph:      emp.jenis_karyawan !== 'tetap' ? emp.pph   : 0,
          mode:           emp.jenis_karyawan === 'tetap' ? undefined : 'harian',
          status_ptkp:    emp.status_ptkp,
          punya_npwp:     emp.punya_npwp,
          pph_ditanggung: emp.tunj_pph > 0,
          bpjs:           { employer_offslip: 0, karyawan_potong: 0, employer_total: 0 },
        };
      });

    const saveRes = await savePayrollRun(
      companyId as string, tahun, detectedBulan, payrollResults, 'calculated'
    );

    if (saveRes.error) {
      toast.error(`Payroll error: ${saveRes.error}`);
      setImporting(false);
      setDone({ created, payroll: false });
      return;
    }

    // Lock it — this is historical imported data
    if (saveRes.runId) {
      await lockPayrollRun(saveRes.runId, companyId as string, tahun, detectedBulan);
    }

    setImporting(false);
    setDone({ created, payroll: true });
  }

  // ── Counts ──────────────────────────────────────
  const validCount   = employees.filter(e => e._valid).length;
  const invalidCount = employees.filter(e => !e._valid).length;
  const tetapCount   = employees.filter(e => e._type === 'tetap').length;
  const harianCount  = employees.filter(e => e._type === 'harian').length;
  const BULAN_NAMES  = ['','Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'];

  // ── Done screen ──────────────────────────────────
  if (done) {
    return (
      <div className="max-w-2xl space-y-6 animate-fade-in-up">
        <div className="rounded-xl p-10 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
            <CheckCircle2 size={28} className="text-green-400" />
          </div>
          <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--text-primary)' }}>
            Import Selesai
          </h2>
          <div className="space-y-2 mt-6 mb-8">
            <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-black text-green-400">{done.created}</span> karyawan baru dibuat
            </p>
            <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>
              {validCount - done.created} karyawan sudah ada (dilewati)
            </p>
            {done.payroll && (
              <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>
                Payroll <span className="font-black text-sky-400">
                  {BULAN_NAMES[detectedBulan]} {tahun}
                </span> diimpor &amp; dikunci
              </p>
            )}
          </div>
          <div className="flex gap-3 justify-center">
            <Link href={`/companies/${companyId}`}
              className="px-6 py-3 rounded-xl font-bold text-[14px] text-white transition-colors"
              style={{ background: '#2563EB' }}>
              Lihat Karyawan →
            </Link>
            {done.payroll && (
              <Link href={`/companies/${companyId}/payroll/${tahun}/${detectedBulan}`}
                className="px-6 py-3 rounded-xl font-bold text-[14px] transition-colors"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                Lihat Payroll
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in-up">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/companies/${companyId}`}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Import dari Excel
          </h1>
          <p className="text-[12px] mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
            Format: Grossup_PPh_21_XX-YYYY.xlsx · Sheet "02" + "HARIAN 02"
          </p>
        </div>
      </div>

      {/* Drop zone */}
      {employees.length === 0 && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className="border-2 border-dashed rounded-xl p-16 text-center transition-all"
          style={{
            borderColor:  dragOver ? '#2563EB' : 'var(--border-strong)',
            background:   dragOver ? 'rgba(37,99,235,0.05)' : 'var(--bg-card)',
          }}>
          <FileSpreadsheet size={36} className="mx-auto mb-4" style={{ color: 'var(--text-ghost)' }} />
          <p className="text-[15px] font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>
            Drop file Excel akuntan di sini
          </p>
          <p className="text-[13px] mb-6" style={{ color: 'var(--text-muted)' }}>
            Grossup_PPh_21_02-2026.xlsx · Sheet yang dibaca: bulan (02, 01, dst) + HARIAN
          </p>
          <label
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[14px] text-white cursor-pointer transition-colors"
            style={{ background: '#2563EB' }}>
            <Upload size={15} />
            Pilih File
            <input type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
          </label>
        </div>
      )}

      {/* Preview */}
      {employees.length > 0 && !importing && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Terbaca',     value: employees.length, color: 'var(--text-primary)' },
              { label: 'Tetap',             value: tetapCount,       color: '#38BDF8' },
              { label: 'Harian',            value: harianCount,      color: '#A78BFA' },
              { label: 'Siap Diimpor',      value: validCount,       color: '#4ADE80' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-4"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                <p className="text-3xl font-black font-mono" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Config */}
          <div className="rounded-xl p-5 space-y-5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

            <div className="grid grid-cols-2 gap-4">
              {/* Month detected */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-muted)' }}>
                  Bulan Terdeteksi
                </label>
                <div className="px-4 py-3 rounded-lg font-bold text-[15px]"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                  {BULAN_NAMES[detectedBulan]}
                  <span className="text-[12px] ml-2" style={{ color: 'var(--text-muted)' }}>
                    (dari sheet "{String(detectedBulan).padStart(2,'0')}")
                  </span>
                </div>
              </div>
              {/* Year */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-muted)' }}>
                  Tahun
                </label>
                <select value={tahun} onChange={e => setTahun(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-lg font-bold text-[15px] outline-none"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Mode selection */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-3"
                style={{ color: 'var(--text-muted)' }}>
                Mode Import
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    key:   'employees',
                    icon:  Users,
                    title: 'Karyawan Saja',
                    desc:  'Buat profil karyawan. Cocok untuk setup awal sebelum ada data payroll.',
                  },
                  {
                    key:   'full',
                    icon:  Lock,
                    title: 'Karyawan + Payroll',
                    desc:  `Buat karyawan DAN impor hasil payroll ${BULAN_NAMES[detectedBulan]} ${tahun} langsung dikunci. Direkomendasikan untuk migrasi data historis.`,
                  },
                ].map(m => (
                  <button key={m.key} onClick={() => setMode(m.key as any)}
                    className="text-left p-4 rounded-xl transition-all"
                    style={{
                      background:   mode === m.key ? 'rgba(37,99,235,0.08)' : 'var(--bg-input)',
                      border:       `1px solid ${mode === m.key ? 'rgba(37,99,235,0.4)' : 'var(--border-default)'}`,
                    }}>
                    <div className="flex items-center gap-2 mb-2">
                      <m.icon size={14} className={mode === m.key ? 'text-[#3B82F6]' : ''} style={mode !== m.key ? { color: 'var(--text-muted)' } : {}} />
                      <p className="font-bold text-[13px]" style={{ color: 'var(--text-primary)' }}>
                        {m.title}
                      </p>
                      {mode === m.key && (
                        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{ background: 'rgba(37,99,235,0.15)', color: '#3B82F6' }}>
                          Dipilih
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {m.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2"
              style={{ borderTop: '1px solid var(--border-default)' }}>
              <label className="inline-flex items-center gap-2 text-[13px] cursor-pointer transition-colors"
                style={{ color: 'var(--text-muted)' }}>
                <Upload size={13} />
                Ganti File
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setEmployees([]); setTimeout(() => processFile(f), 50); } }} />
              </label>
              <button onClick={handleImport} disabled={validCount === 0}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[14px] text-white disabled:opacity-50 transition-colors"
                style={{ background: '#2563EB' }}>
                {mode === 'full'
                  ? <><Lock size={14} />Import {validCount} Karyawan + Payroll</>
                  : <><Users size={14} />Import {validCount} Karyawan</>
                }
              </button>
            </div>
          </div>

          {/* Preview table */}
          <div className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-default)' }}>
            <div className="px-5 py-3 flex items-center gap-2"
              style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-default)' }}>
              <FileSpreadsheet size={13} style={{ color: 'var(--text-muted)' }} />
              <span className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--text-secondary)' }}>
                Preview — {fileName}
              </span>
              {invalidCount > 0 && (
                <span className="ml-auto text-[11px] font-bold text-amber-400">
                  ⚠ {invalidCount} baris bermasalah
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['', 'Nama', 'NIK', 'PTKP', 'Tipe', 'Divisi', 'Gaji Pokok', 'Bruto', 'PPh', 'THP'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-bold uppercase tracking-widest"
                        style={{ color: 'var(--text-muted)', fontSize: 10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, i) => (
                    <tr key={i}
                      className="transition-colors"
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background:   !emp._valid ? 'rgba(239,68,68,0.04)' : 'transparent',
                      }}>
                      <td className="px-4 py-3 text-center">
                        {emp._valid
                          ? <CheckCircle2 size={13} className="text-green-500 inline" />
                          : <AlertTriangle size={13} className="text-amber-400 inline" />}
                      </td>
                      <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>
                        {emp.nama}
                        {!emp._valid && (
                          <p className="text-[11px] text-amber-400 font-normal">{emp._errors[0]}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-muted)' }}>
                        {emp.nik || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold"
                          style={{ background: 'rgba(56,189,248,0.1)', color: '#38BDF8' }}>
                          {emp.status_ptkp}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold"
                          style={{
                            background: emp._type === 'tetap' ? 'rgba(37,99,235,0.1)' : 'rgba(167,139,250,0.1)',
                            color:      emp._type === 'tetap' ? '#3B82F6' : '#A78BFA',
                          }}>
                          {emp._type === 'tetap' ? 'Tetap' : 'Harian'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-muted)' }}>
                        {emp.divisi || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {emp.gaji_pokok > 0 ? fmt(emp.gaji_pokok) : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-primary)' }}>
                        {fmt(emp.bruto)}
                      </td>
                      <td className="px-4 py-3 font-mono text-amber-400">
                        {fmt(emp.pph)}
                      </td>
                      <td className="px-4 py-3 font-mono text-green-400 font-bold">
                        {fmt(emp.thp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Importing progress */}
      {importing && (
        <div className="rounded-xl p-10 text-center animate-fade-in"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <Loader2 size={32} className="mx-auto mb-4 animate-spin" style={{ color: '#2563EB' }} />
          <p className="text-[15px] font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {progress.step}
          </p>
          {progress.total > 0 && (
            <>
              <div className="w-48 h-2 rounded-full overflow-hidden mx-auto mb-2"
                style={{ background: 'var(--border-default)' }}>
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${(progress.current / progress.total) * 100}%`,
                    background: '#2563EB',
                  }} />
              </div>
              <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                {progress.current} / {progress.total}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
