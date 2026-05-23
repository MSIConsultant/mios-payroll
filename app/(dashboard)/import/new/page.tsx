'use client';
import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';
import { saveImport, fetchEmployeeAccumDataByNik, type ImportRecord } from '@/lib/actions/import';
import {
  parseTetap, parseHarian, reconcileEmployee,
  PTKP_VALID, type ParsedEmp,
} from '@/lib/import/excel';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft, Upload, FileSpreadsheet, CheckCircle2,
  AlertTriangle, ChevronRight, Loader2,
  Users, Lock, Check, Download, RefreshCw,
} from 'lucide-react';

type Step = 'upload' | 'reconcile' | 'confirm' | 'saving' | 'done';

const BULAN_NAMES = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: 'Upload' },
    { key: 'reconcile', label: 'Rekonsiliasi' },
    { key: 'confirm', label: 'Konfirmasi' },
    { key: 'done', label: 'Selesai' },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center">
      {steps.map((s, i) => {
        const reached = i <= idx;
        const completed = i < idx;
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all ${
                  reached
                    ? 'bg-[var(--brand)] text-white ring-2 ring-[var(--brand-ring)]'
                    : 'bg-white text-[var(--text-faint)] ring-1 ring-[var(--border-default)]'
                }`}
              >
                {completed ? <Check size={13} /> : i + 1}
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider mt-1 whitespace-nowrap ${
                  i === idx ? 'text-[var(--brand)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-12 h-px mb-4 mx-1 transition-colors ${
                  completed ? 'bg-[var(--brand)]' : 'bg-[var(--border-default)]'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DiffBadge({ pct }: { pct: number }) {
  if (pct < 0.5)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 size={11} /> Match
      </span>
    );
  if (pct < 5)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
        <AlertTriangle size={11} /> {pct.toFixed(1)}%
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
      <AlertTriangle size={11} /> {pct.toFixed(1)}%
    </span>
  );
}

export default function ImportNewPage() {
  const [step, setStep] = useState<Step>('upload');
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [bulan, setBulan] = useState(new Date().getMonth() + 1);
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [parsed, setParsed] = useState<ParsedEmp[]>([]);
  const [reconciled, setReconciled] = useState<ImportRecord[]>([]);
  const [mode, setMode] = useState<'employees_only' | 'full'>('full');
  const [updateExisting, setUpdateExisting] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [doneResult, setDoneResult] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .single();
      if (!profile?.workspace_id) return;
      setWorkspaceId(profile.workspace_id);
      const { data: cos } = await supabase
        .from('companies')
        .select('id, name, kota')
        .eq('workspace_id', profile.workspace_id)
        .eq('aktif', true)
        .order('name');
      if (cos) {
        setCompanies(cos);
        if (cos.length === 1) setCompanyId(cos[0].id);
      }
    }
    load();
  }, []);

  function processFile(file: File) {
    setFileName(file.name);
    const monthMatch = file.name.match(/_(\d{2})-(\d{4})/);
    if (monthMatch) {
      setBulan(parseInt(monthMatch[1], 10));
      setTahun(parseInt(monthMatch[2], 10));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), {
          type: 'array',
        });
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
      } catch {
        toast.error('Gagal membaca file Excel.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) processFile(f);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bulan],
  );

  async function handleRunReconcile() {
    if (!companyId) {
      toast.error('Pilih perusahaan terlebih dahulu');
      return;
    }
    if (parsed.length === 0) {
      toast.error('Upload file terlebih dahulu');
      return;
    }
    const valid = parsed.filter((e) => e._valid);
    if (valid.length === 0) {
      toast.error('Tidak ada data valid untuk diproses');
      return;
    }

    setReconciling(true);

    // For months > 1, fetch accumulated bruto/pph from prior saved runs so the
    // engine comparison is accurate (especially for December equalization).
    let accumData: Record<string, { akum_bruto: number; pph_jan_nov: number }> = {};
    if (bulan > 1) {
      try {
        accumData = await fetchEmployeeAccumDataByNik(companyId, tahun, bulan);
      } catch {
        // Non-fatal — fall back to zero accumulation
      }
    }

    const recs: ImportRecord[] = valid.map((emp) => {
      const options = accumData[emp.nik];
      const rec = reconcileEmployee(emp, bulan, tahun, options);
      return {
        ...emp,
        engine_bruto: rec.engine_bruto,
        engine_pph: rec.engine_pph,
        engine_thp: rec.engine_thp,
        diff_pct: rec.diff_pct,
        has_diff: rec.has_diff,
        full_result: rec.full_result,
      };
    });
    setReconciled(recs);
    setReconciling(false);
    setStep('reconcile');
  }

  function exportReconcileCsv() {
    const header = [
      'NIK', 'Nama', 'Divisi', 'PTKP',
      'Bruto Excel', 'Bruto Engine',
      'PPh Excel', 'PPh Engine',
      'THP Excel', 'Delta %', 'Status',
    ];
    const rows = reconciled.map((r) => [
      r.nik, r.nama, r.divisi, r.status_ptkp,
      r.excel_bruto, r.engine_bruto,
      r.excel_pph, r.engine_pph,
      r.excel_thp, r.diff_pct.toFixed(2),
      r.has_diff ? 'BEDA' : 'MATCH',
    ]);
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `rekonsiliasi-${String(bulan).padStart(2, '0')}-${tahun}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSave() {
    setStep('saving');
    setSaveProgress(0);
    let prog = 0;
    const interval = setInterval(() => {
      prog = Math.min(prog + Math.random() * 15, 90);
      setSaveProgress(prog);
    }, 200);

    const res = await saveImport({
      workspaceId, companyId, bulan, tahun, fileName, mode,
      update_existing: updateExisting,
      records: reconciled,
    });

    clearInterval(interval);
    setSaveProgress(100);

    if (res.error) {
      toast.error(res.error);
      setStep('confirm');
      return;
    }
    setDoneResult(res);
    setStep('done');
  }

  const validCount = parsed.filter((e) => e._valid).length;
  const invalidCount = parsed.filter((e) => !e._valid).length;
  const diffCount = reconciled.filter((r) => r.has_diff).length;
  const matchCount = reconciled.length - diffCount;
  const selectedCo = companies.find((c) => c.id === companyId);

  // ── UPLOAD ──
  if (step === 'upload') {
    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in-up">
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Link
            href="/import"
            className="inline-flex items-center gap-1 hover:text-[var(--brand)] transition-colors"
          >
            <ArrowLeft size={14} />
            Import
          </Link>
        </div>

        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-5 border-b border-[var(--border-default)]">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Import Baru
          </h1>
          <StepIndicator step={step} />
        </header>

        <div className="bg-white border border-[var(--border-default)] rounded-xl p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label
                htmlFor="ic-company"
                className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Perusahaan *
              </label>
              <select
                id="ic-company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[14px] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              >
                <option value="">Pilih perusahaan…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="ic-bulan"
                className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Bulan
              </label>
              <select
                id="ic-bulan"
                value={bulan}
                onChange={(e) => setBulan(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[14px] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              >
                {BULAN_NAMES.slice(1).map((b, i) => (
                  <option key={i + 1} value={i + 1}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="ic-tahun"
                className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
              >
                Tahun
              </label>
              <select
                id="ic-tahun"
                value={tahun}
                onChange={(e) => setTahun(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[14px] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
              >
                {[2023, 2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-xl border-2 border-dashed p-10 text-center transition-all ${
            dragOver
              ? 'border-[var(--brand)] bg-[var(--brand-soft)]'
              : parsed.length > 0
              ? 'border-emerald-300 bg-emerald-50/40'
              : 'border-[var(--border-strong)] bg-white'
          }`}
        >
          {parsed.length > 0 ? (
            <>
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center">
                <CheckCircle2 size={22} className="text-emerald-600" />
              </div>
              <p className="text-base font-semibold text-[var(--text-primary)] break-all">
                {fileName}
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {validCount} karyawan valid
                {invalidCount > 0 ? `, ${invalidCount} error` : ''}
              </p>
              <label className="mt-3 inline-block text-sm font-semibold text-[var(--brand)] hover:underline cursor-pointer">
                Ganti file
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setParsed([]);
                      setTimeout(() => processFile(f), 50);
                    }
                  }}
                />
              </label>
            </>
          ) : (
            <>
              <FileSpreadsheet size={36} className="mx-auto text-[var(--text-faint)]" />
              <p className="mt-4 text-base font-semibold text-[var(--text-secondary)]">
                Drop file Excel di sini
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Format: Grossup_PPh_21_02-2026.xlsx · Sheet: &quot;02&quot;, &quot;HARIAN 02&quot;
              </p>
              <label className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-white bg-[var(--brand)] hover:bg-[var(--brand-hover)] cursor-pointer transition-colors shadow-sm">
                <Upload size={15} />
                Pilih File
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) processFile(f);
                  }}
                />
              </label>
            </>
          )}
        </div>

        {invalidCount > 0 && (
          <div className="rounded-xl p-4 bg-amber-50 border border-amber-200">
            <p className="text-[12px] font-semibold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle size={13} />
              {invalidCount} Baris Bermasalah (tidak akan diimpor)
            </p>
            {parsed
              .filter((e) => !e._valid)
              .slice(0, 5)
              .map((e, i) => (
                <p key={i} className="text-[13px] text-amber-700">
                  · {e.nama || 'Baris tidak dikenal'} — {e._errors.join(', ')}
                </p>
              ))}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleRunReconcile}
            disabled={!companyId || validCount === 0 || reconciling}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
          >
            {reconciling ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Mengambil data akumulasi…
              </>
            ) : (
              <>
                Lanjut ke Rekonsiliasi
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── RECONCILE ──
  if (step === 'reconcile') {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-5 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setStep('upload')}
              className="shrink-0 w-9 h-9 bg-white border border-[var(--border-default)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] rounded-lg flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Kembali"
            >
              <ArrowLeft size={15} />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--text-primary)] truncate">
                Rekonsiliasi
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                {selectedCo?.name} · {BULAN_NAMES[bulan]} {tahun}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportReconcileCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg text-[13px] font-semibold transition-colors cursor-pointer"
            >
              <Download size={14} />
              Ekspor CSV
            </button>
            <StepIndicator step={step} />
          </div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Total" value={reconciled.length} />
          <Stat label="Match" value={matchCount} accent="emerald" />
          <Stat
            label="Beda"
            value={diffCount}
            accent={diffCount > 0 ? 'amber' : 'emerald'}
          />
          <Stat
            label="Total Bruto Excel"
            value={fmt(reconciled.reduce((a, r) => a + r.excel_bruto, 0))}
            accent="brand"
          />
        </div>

        {diffCount > 0 && (
          <div className="rounded-xl p-4 flex items-start gap-3 bg-amber-50 border border-amber-200">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[13px] text-amber-800 leading-relaxed">
              {diffCount} karyawan memiliki perbedaan antara nilai Excel dan kalkulasi engine. Ini
              bisa disebabkan perbedaan rounding, tarif JKK, atau akumulasi bulan sebelumnya.{' '}
              <strong>Nilai Excel yang dipakai sebagai data final.</strong>
            </p>
          </div>
        )}

        <section className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
            <table>
              <thead className="sticky top-0 z-10">
                <tr>
                  <th>Nama</th>
                  <th>PTKP</th>
                  <th className="text-right">Bruto (Excel)</th>
                  <th className="text-right">Bruto (Engine)</th>
                  <th className="text-right">THP</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {reconciled.map((r, i) => (
                  <tr key={i} className={r.has_diff ? 'bg-amber-50/40' : ''}>
                    <td>
                      <p className="font-semibold text-[var(--text-primary)] truncate">
                        {r.nama}
                      </p>
                      <p className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">
                        {r.divisi || r.nik}
                      </p>
                    </td>
                    <td>
                      <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset bg-sky-50 text-sky-700 ring-sky-200">
                        {r.status_ptkp}
                      </span>
                    </td>
                    <td className="text-right font-mono font-semibold">
                      {fmt(r.excel_bruto)}
                    </td>
                    <td
                      className={`text-right font-mono ${
                        r.has_diff ? 'text-amber-700 font-semibold' : ''
                      }`}
                    >
                      {fmt(r.engine_bruto)}
                    </td>
                    <td className="text-right font-mono font-bold text-emerald-700">
                      {fmt(r.excel_thp)}
                    </td>
                    <td className="text-center">
                      <DiffBadge pct={r.diff_pct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex justify-between">
          <button
            onClick={() => setStep('upload')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            Kembali
          </button>
          <button
            onClick={() => setStep('confirm')}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            Lanjut ke Konfirmasi
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── CONFIRM ──
  if (step === 'confirm') {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-5 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep('reconcile')}
              className="w-9 h-9 bg-white border border-[var(--border-default)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] rounded-lg flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Kembali"
            >
              <ArrowLeft size={15} />
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Konfirmasi Import
            </h1>
          </div>
          <StepIndicator step={step} />
        </header>

        <section className="bg-white border border-[var(--border-default)] rounded-xl p-5">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-3">
            Ringkasan Import
          </h2>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {[
              { label: 'File', value: fileName },
              { label: 'Perusahaan', value: selectedCo?.name ?? '—' },
              { label: 'Periode', value: `${BULAN_NAMES[bulan]} ${tahun}` },
              {
                label: 'Karyawan',
                value: `${reconciled.length} (${reconciled.filter((r) => !r.has_diff).length} match, ${diffCount} beda)`,
              },
            ].map((s) => (
              <li key={s.label} className="flex items-center justify-between py-2.5 gap-3">
                <span className="text-[13px] text-[var(--text-muted)]">{s.label}</span>
                <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                  {s.value}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              key: 'full' as const,
              icon: Lock,
              title: 'Karyawan + Payroll',
              desc: `Buat karyawan baru dan simpan hasil payroll ${BULAN_NAMES[bulan]} ${tahun} (dikunci). Direkomendasikan.`,
            },
            {
              key: 'employees_only' as const,
              icon: Users,
              title: 'Karyawan Saja',
              desc: 'Hanya buat profil karyawan. Tidak menyimpan hasil payroll.',
            },
          ].map((m) => {
            const active = mode === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`p-4 rounded-xl text-left transition-all cursor-pointer ${
                  active
                    ? 'bg-[var(--brand-soft)] border border-[var(--brand)]'
                    : 'bg-white border border-[var(--border-default)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <m.icon
                    size={16}
                    className={active ? 'text-[var(--brand)]' : 'text-[var(--text-muted)]'}
                  />
                  <p className="font-semibold text-[14px] text-[var(--text-primary)]">
                    {m.title}
                  </p>
                  {active && (
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--brand)] text-white">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">{m.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Update existing employees toggle */}
        <button
          onClick={() => setUpdateExisting((v) => !v)}
          className={`w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all cursor-pointer ${
            updateExisting
              ? 'bg-amber-50 border border-amber-300'
              : 'bg-white border border-[var(--border-default)] hover:border-[var(--border-strong)]'
          }`}
        >
          <RefreshCw
            size={16}
            className={updateExisting ? 'text-amber-700 shrink-0' : 'text-[var(--text-muted)] shrink-0'}
          />
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-[14px] ${updateExisting ? 'text-amber-900' : 'text-[var(--text-primary)]'}`}>
              Perbarui data karyawan yang sudah ada
            </p>
            <p className="text-[12px] text-[var(--text-muted)] leading-relaxed mt-0.5">
              Jika NIK sudah terdaftar, timpa gaji pokok, PTKP, dan tunjangan dari Excel.{' '}
              {!updateExisting && <span className="font-semibold">Nonaktif — karyawan lama dilewati.</span>}
              {updateExisting && <span className="font-semibold text-amber-700">Aktif — data karyawan lama akan diperbarui.</span>}
            </p>
          </div>
          <div
            className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              updateExisting ? 'bg-amber-600 border-amber-600' : 'border-[var(--border-strong)]'
            }`}
          >
            {updateExisting && <Check size={12} className="text-white" />}
          </div>
        </button>

        <button
          onClick={handleSave}
          className="w-full py-3 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold transition-colors shadow-sm cursor-pointer"
        >
          {mode === 'full'
            ? `Import ${reconciled.length} Karyawan + Payroll`
            : `Import ${reconciled.length} Karyawan`}
        </button>
      </div>
    );
  }

  // ── SAVING ──
  if (step === 'saving') {
    return (
      <div className="max-w-sm mx-auto py-20 text-center animate-fade-in-up">
        <Loader2 size={36} className="mx-auto mb-5 text-[var(--brand)] animate-spin" />
        <p className="text-base font-semibold text-[var(--text-primary)] mb-3">
          Menyimpan data…
        </p>
        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mb-2">
          <div
            className="h-full rounded-full bg-[var(--brand)] transition-all duration-300"
            style={{ width: `${saveProgress}%` }}
          />
        </div>
        <p className="text-[13px] font-mono text-[var(--text-muted)]">
          {Math.round(saveProgress)}%
        </p>
      </div>
    );
  }

  // ── DONE ──
  if (step === 'done' && doneResult) {
    return (
      <div className="max-w-md mx-auto py-12 space-y-6 animate-fade-in-up text-center">
        <div className="w-16 h-16 rounded-full mx-auto bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center">
          <CheckCircle2 size={28} className="text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Import Selesai!
          </h1>
          <div className="space-y-1.5 mt-4">
            {doneResult.created > 0 && (
              <p className="text-[15px] text-[var(--text-secondary)]">
                <span className="font-bold text-emerald-700">{doneResult.created}</span> karyawan
                baru dibuat
              </p>
            )}
            {doneResult.updated > 0 && (
              <p className="text-[15px] text-[var(--text-secondary)]">
                <span className="font-bold text-amber-700">{doneResult.updated}</span> karyawan
                diperbarui
              </p>
            )}
            {doneResult.skipped > 0 && (
              <p className="text-[15px] text-[var(--text-secondary)]">
                <span className="font-bold text-[var(--text-muted)]">{doneResult.skipped}</span>{' '}
                karyawan dilewati
              </p>
            )}
            {doneResult.payroll && (
              <p className="text-[15px] text-[var(--text-secondary)]">
                Payroll{' '}
                <span className="font-bold text-sky-700">
                  {BULAN_NAMES[bulan]} {tahun}
                </span>{' '}
                tersimpan & dikunci
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          <Link
            href={`/companies/${companyId}`}
            className="px-4 py-2 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold transition-colors shadow-sm"
          >
            Lihat Karyawan
          </Link>
          {doneResult.payroll && (
            <Link
              href={`/companies/${companyId}/payroll/${tahun}/${bulan}`}
              className="px-4 py-2 rounded-lg bg-white border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] text-sm font-semibold transition-colors"
            >
              Lihat Payroll
            </Link>
          )}
          <Link
            href="/import/new"
            className="px-4 py-2 rounded-lg bg-white border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] text-sm font-semibold transition-colors"
          >
            Import Lagi
          </Link>
        </div>
      </div>
    );
  }

  return null;
}

function Stat({
  label, value, accent,
}: {
  label: string;
  value: string | number;
  accent?: 'brand' | 'emerald' | 'amber';
}) {
  const accentMap = {
    brand: 'text-[var(--brand)]',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
  } as const;
  const text = accent ? accentMap[accent] : 'text-[var(--text-primary)]';
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
      <p className={`mt-2 text-xl font-bold font-mono ${text}`}>{value}</p>
    </div>
  );
}
