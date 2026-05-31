'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle,
  Loader2, Trash2, Play, Layers, RefreshCw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { saveImport, fetchExistingEmployeeDataByNik, type ImportRecord } from '@/lib/actions/import';
import {
  parseWorkbook, readWorkbook, reconcileEmployee, type ParsedEmp,
} from '@/lib/import/excel';

// ── Helpers ─────────────────────────────────────────────────────────────────

const BULAN_SHORT = ['', 'Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

/**
 * Accountant files are typically named "Grossup PPh 21 MM-YYYY.xlsx" but the
 * delimiter and order vary. We accept MM-YYYY, MM_YYYY, MM.YYYY, MM YYYY,
 * MMYYYY, YYYY-MM, etc. — anything with a 4-digit year and a 2-digit month.
 */
function detectFromFilename(name: string): { month: number | null; year: number | null } {
  // MM-YYYY style
  let m = name.match(/(\b\d{2})[-_. ]?(\d{4})\b/);
  if (m) {
    const mm = Number(m[1]);
    const yyyy = Number(m[2]);
    if (mm >= 1 && mm <= 12) return { month: mm, year: yyyy };
  }
  // YYYY-MM style
  m = name.match(/(\d{4})[-_. ]?(\d{2})\b/);
  if (m) {
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    if (mm >= 1 && mm <= 12) return { month: mm, year: yyyy };
  }
  return { month: null, year: null };
}

type FileStatus = 'pending' | 'parsing' | 'parsed' | 'saving' | 'done' | 'error';

interface QueueItem {
  id: string;
  file: File;
  status: FileStatus;
  month: number | null;
  year: number | null;
  parsedCount: number;
  validCount: number;
  rawRows: ParsedEmp[];
  saved: {
    created: number;
    skipped: number;
    diffs: number;
    sessionIds: string[];
  } | null;
  error: string | null;
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ImportBulkPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [dbEmployeeMap, setDbEmployeeMap] = useState<Record<string, { bpjs_basis: number | null }>>({});
  const [defaultYear, setDefaultYear] = useState(new Date().getFullYear());
  const [items, setItems] = useState<QueueItem[]>([]);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [archival, setArchival] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Keep a live ref to items so processAll can check for user-removals mid-run
  const itemsRef = useRef<QueueItem[]>([]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('workspace_id')
        .eq('id', user.id).single();
      if (!profile?.workspace_id) return;
      setWorkspaceId(profile.workspace_id);
      const { data: cos } = await supabase
        .from('companies').select('id, name, kota')
        .eq('workspace_id', profile.workspace_id).eq('aktif', true)
        .order('name');
      setCompanies(cos ?? []);
    }
    load();
  }, []);

  useEffect(() => {
    if (!companyId) { setDbEmployeeMap({}); return; }
    fetchExistingEmployeeDataByNik(companyId).then((map) => {
      const slim: Record<string, { bpjs_basis: number | null }> = {};
      for (const nik of Object.keys(map)) slim[nik] = { bpjs_basis: map[nik].bpjs_basis };
      setDbEmployeeMap(slim);
    }).catch(() => {});
  }, [companyId]);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(
      (f) => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'),
    );
    if (arr.length === 0) {
      toast.error('Pilih file Excel (.xlsx)');
      return;
    }
    const newItems: QueueItem[] = arr.map((f) => {
      const det = detectFromFilename(f.name);
      return {
        id: crypto.randomUUID(),
        file: f,
        status: 'pending',
        month: det.month,
        year: det.year ?? defaultYear,
        parsedCount: 0,
        validCount: 0,
        rawRows: [],
        saved: null,
        error: null,
      };
    });
    setItems((prev) => [...prev, ...newItems]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function clearDone() {
    setItems((prev) => prev.filter((i) => i.status !== 'done'));
  }

  function patch(id: string, partial: Partial<QueueItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...partial } : i)));
  }

  async function processOne(item: QueueItem) {
    patch(item.id, { status: 'parsing', error: null });
    try {
      const wb = await readWorkbook(item.file);
      const parsed = await parseWorkbook(wb);
      const effectiveMonthRaw = item.month ?? parsed.month;
      if (!effectiveMonthRaw) {
        patch(item.id, { status: 'error', error: 'Tidak bisa mendeteksi bulan' });
        return;
      }
      // Narrowed to number after the guard — captured as a const so nested
      // functions inherit the type without needing a non-null assertion.
      const effectiveMonth: number = effectiveMonthRaw;
      if (parsed.rows.length === 0) {
        patch(item.id, { status: 'error', error: 'Tidak ada data karyawan terbaca' });
        return;
      }

      const year = item.year ?? defaultYear;
      patch(item.id, {
        status: 'parsed',
        month: effectiveMonth,
        parsedCount: parsed.rows.length,
        validCount: parsed.rows.filter((r) => r._valid).length,
        rawRows: parsed.rows,
      });
      if (parsed.rows.filter((r) => r._valid).length === 0) {
        patch(item.id, { status: 'error', error: 'Semua baris invalid (NIK/PTKP/Gaji bermasalah)' });
        return;
      }

      patch(item.id, { status: 'saving' });

      // Build ImportRecord per jenis group. In archival mode skip the engine
      // reconcile and store Excel values as-is (faster + correct for pre-2024).
      function buildRecords(rows: typeof parsed.rows): ImportRecord[] {
        return rows.filter((r) => r._valid).map((emp) => {
          if (archival) {
            return {
              ...emp,
              engine_bruto: emp.excel_bruto,
              engine_pph:   emp.excel_pph,
              engine_thp:   emp.excel_thp,
              diff_pct:     0,
              has_diff:     false,
              full_result:  {},
            };
          }
          const bpjs_basis = dbEmployeeMap[emp.nik]?.bpjs_basis ?? null;
          const rec = reconcileEmployee(emp, effectiveMonth, year, { bpjs_basis });
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
      }

      // Save one run per jenis — tetap, harian, tidak_final are stored in
      // separate payroll_runs (slice-3 unique constraint).
      const groups: Array<{ jenis: 'tetap' | 'harian' | 'tidak_final'; rows: typeof parsed.rows }> = (
        [
          { jenis: 'tetap'       as const, rows: parsed.tetap },
          { jenis: 'harian'      as const, rows: parsed.harian },
          { jenis: 'tidak_final' as const, rows: parsed.tidak_final },
        ] satisfies Array<{ jenis: 'tetap' | 'harian' | 'tidak_final'; rows: typeof parsed.rows }>
      ).filter((g) => g.rows.length > 0);

      let totalCreated = 0, totalSkipped = 0, totalDiffs = 0;
      const sessionIds: string[] = [];

      for (const group of groups) {
        const records = buildRecords(group.rows);
        if (records.length === 0) continue;
        const res = await saveImport({
          workspaceId, companyId,
          bulan: effectiveMonth, tahun: year,
          fileName: item.file.name,
          mode: 'full', jenis: group.jenis, archival,
          update_existing: updateExisting,
          records,
        });
        if (res.error) {
          patch(item.id, { status: 'error', error: `[${group.jenis}] ${res.error}` });
          return;
        }
        totalCreated += res.created ?? 0;
        totalSkipped += res.skipped ?? 0;
        totalDiffs   += records.filter((r) => r.has_diff).length;
        if (res.sessionId) sessionIds.push(res.sessionId);
      }

      patch(item.id, {
        status: 'done',
        saved: { created: totalCreated, skipped: totalSkipped, diffs: totalDiffs, sessionIds },
      });
    } catch (err: any) {
      patch(item.id, { status: 'error', error: err?.message ?? 'Gagal memproses file' });
    }
  }

  async function processAll() {
    if (!companyId) {
      toast.error('Pilih perusahaan dulu');
      return;
    }
    if (!workspaceId) {
      toast.error('Workspace belum siap');
      return;
    }
    const queue = items.filter((i) => i.status === 'pending' || i.status === 'error');
    if (queue.length === 0) {
      toast.info('Tidak ada file yang perlu diproses');
      return;
    }
    setRunning(true);
    for (const i of queue) {
      // Use ref so we check the live state (in case user removed item mid-run)
      const current = itemsRef.current.find((x) => x.id === i.id);
      if (!current) continue;
      await processOne(current);
    }
    setRunning(false);
    toast.success('Selesai memproses');
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultYear]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const doneCount = items.filter((i) => i.status === 'done').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const totalCreated = items.reduce((s, i) => s + (i.saved?.created ?? 0), 0);
  const totalDiffs = items.reduce((s, i) => s + (i.saved?.diffs ?? 0), 0);
  const hasItems = items.length > 0;

  return (
    <div className="max-w-[1200px] mx-auto pb-12 animate-fade-in-up space-y-6">
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/import" className="inline-flex items-center gap-1 hover:text-[var(--brand)] transition-colors">
          <ArrowLeft size={14} />
          Import
        </Link>
      </div>

      <header className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center shrink-0">
          <Layers size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Import Bulk Excel
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Upload beberapa workbook bulanan sekaligus. Setiap file disimpan sebagai payroll run terpisah.
          </p>
        </div>
      </header>

      {/* Company + default year */}
      <section className="bg-white border border-[var(--border-default)] rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">
              Perusahaan *
            </label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[14px] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
            >
              <option value="">— pilih perusahaan —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Semua file di batch ini akan masuk ke perusahaan yang sama.
            </p>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5">
              Tahun default
            </label>
            <input
              type="number"
              value={defaultYear}
              onChange={(e) => setDefaultYear(Number(e.target.value))}
              min={2000}
              max={2100}
              className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[14px] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] font-mono"
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Dipakai jika tahun tidak terdeteksi dari nama file.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setArchival((v) => !v)}
            className={`flex items-center gap-3 flex-1 p-3 rounded-lg text-left transition-all cursor-pointer ${
              archival
                ? 'bg-sky-50 border border-sky-300'
                : 'bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--border-strong)]'
            }`}
          >
            <FileSpreadsheet size={14} className={archival ? 'text-sky-700 shrink-0' : 'text-[var(--text-muted)] shrink-0'} />
            <div className="flex-1 min-w-0">
              <span className={`text-[13px] font-semibold ${archival ? 'text-sky-900' : 'text-[var(--text-secondary)]'}`}>
                Mode arsip historis
              </span>
              <span className="ml-2 text-[12px] text-[var(--text-muted)]">
                {archival ? '— aktif: simpan angka Excel apa adanya, tanpa hitung ulang' : '— nonaktif: verifikasi engine (cocok untuk data baru)'}
              </span>
            </div>
            <div className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              archival ? 'bg-sky-600 border-sky-600' : 'border-[var(--border-strong)]'
            }`}>
              {archival && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
            </div>
          </button>

          <button
            onClick={() => setUpdateExisting((v) => !v)}
            className={`flex items-center gap-3 flex-1 p-3 rounded-lg text-left transition-all cursor-pointer ${
              updateExisting
                ? 'bg-amber-50 border border-amber-300'
                : 'bg-[var(--bg-subtle)] border border-[var(--border-default)] hover:border-[var(--border-strong)]'
            }`}
          >
            <RefreshCw size={14} className={updateExisting ? 'text-amber-700 shrink-0' : 'text-[var(--text-muted)] shrink-0'} />
            <div className="flex-1 min-w-0">
              <span className={`text-[13px] font-semibold ${updateExisting ? 'text-amber-900' : 'text-[var(--text-secondary)]'}`}>
                Perbarui karyawan yang sudah ada
              </span>
              <span className="ml-2 text-[12px] text-[var(--text-muted)]">
                {updateExisting ? '— aktif: gaji/PTKP ditimpa dari Excel' : '— nonaktif: karyawan lama dilewati'}
              </span>
            </div>
            <div className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              updateExisting ? 'bg-amber-600 border-amber-600' : 'border-[var(--border-strong)]'
            }`}>
              {updateExisting && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
            </div>
          </button>
        </div>
      </section>

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`bg-white border-2 border-dashed rounded-xl py-10 px-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-[var(--brand)] bg-[var(--brand-soft)]'
            : 'border-[var(--border-default)] hover:border-[var(--brand)]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
        />
        <Upload size={32} className="mx-auto text-[var(--text-muted)] mb-3" />
        <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
          Drag &amp; drop file .xlsx atau klik untuk pilih
        </p>
        <p className="text-[13px] text-[var(--text-muted)]">
          Pilih banyak file sekaligus. Bulan akan dideteksi otomatis dari nama sheet atau nama file.
        </p>
      </div>

      {/* Summary banner */}
      {hasItems && (
        <section className="bg-white border border-[var(--border-default)] rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <SummaryItem label="Total" value={items.length} />
            <SummaryItem label="Pending" value={pendingCount} tone="muted" />
            <SummaryItem label="Selesai" value={doneCount} tone="emerald" />
            <SummaryItem label="Error" value={errorCount} tone={errorCount > 0 ? 'red' : 'muted'} />
            <SummaryItem label="Karyawan baru" value={totalCreated} tone="sky" />
            <SummaryItem label="Selisih engine" value={totalDiffs} tone={totalDiffs > 0 ? 'amber' : 'muted'} />
          </div>
          <div className="flex gap-2">
            {doneCount > 0 && (
              <button
                onClick={clearDone}
                disabled={running}
                className="text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3 py-2 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors disabled:opacity-50"
              >
                Bersihkan selesai
              </button>
            )}
            <button
              onClick={processAll}
              disabled={running || !companyId || (pendingCount + errorCount === 0)}
              className="inline-flex items-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors shadow-sm cursor-pointer"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {running ? 'Memproses…' : 'Proses Semua'}
            </button>
          </div>
        </section>
      )}

      {/* Queue */}
      {hasItems && (
        <section className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
          <ul className="divide-y divide-[var(--border-subtle)]">
            {items.map((item) => (
              <QueueRow
                key={item.id}
                item={item}
                onRemove={() => removeItem(item.id)}
                onMonthChange={(m) => patch(item.id, { month: m })}
                onYearChange={(y) => patch(item.id, { year: y })}
                running={running}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ── Bits ────────────────────────────────────────────────────────────────────

function SummaryItem({ label, value, tone }: {
  label: string; value: number; tone?: 'muted' | 'emerald' | 'red' | 'sky' | 'amber';
}) {
  const colorMap = {
    muted:   'text-[var(--text-muted)]',
    emerald: 'text-emerald-700',
    red:     'text-red-700',
    sky:     'text-sky-700',
    amber:   'text-amber-700',
  };
  const valueCls = tone ? colorMap[tone] : 'text-[var(--text-primary)]';
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">{label}</span>
      <span className={`ml-1.5 text-[14px] font-bold font-mono ${valueCls}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: FileStatus }) {
  const cfg: Record<FileStatus, { label: string; cls: string; icon?: React.ReactNode }> = {
    pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
    parsing: { label: 'Membaca', cls: 'bg-sky-50 text-sky-700 ring-sky-200', icon: <Loader2 size={11} className="animate-spin" /> },
    parsed:  { label: 'Terbaca', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
    saving:  { label: 'Menyimpan', cls: 'bg-amber-50 text-amber-700 ring-amber-200', icon: <Loader2 size={11} className="animate-spin" /> },
    done:    { label: 'Selesai', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: <CheckCircle2 size={11} /> },
    error:   { label: 'Error',   cls: 'bg-red-50 text-red-700 ring-red-200', icon: <AlertTriangle size={11} /> },
  };
  const c = cfg[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${c.cls}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

function QueueRow({ item, onRemove, onMonthChange, onYearChange, running }: {
  item: QueueItem;
  onRemove: () => void;
  onMonthChange: (m: number | null) => void;
  onYearChange: (y: number) => void;
  running: boolean;
}) {
  const editable = item.status === 'pending' || item.status === 'error';
  return (
    <li className="px-5 py-3 flex items-center gap-3 flex-wrap">
      <FileSpreadsheet size={16} className="text-[var(--text-muted)] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{item.file.name}</p>
        <div className="flex flex-wrap items-center gap-3 mt-0.5 text-[12px] text-[var(--text-muted)]">
          {item.status === 'done' && item.saved ? (
            <>
              <span>{BULAN_SHORT[item.month ?? 0] ?? '?'} {item.year}</span>
              <span>·</span>
              <span><span className="font-semibold text-emerald-700">{item.saved.created}</span> karyawan baru</span>
              {item.saved.skipped > 0 && (
                <>
                  <span>·</span>
                  <span>{item.saved.skipped} sudah ada</span>
                </>
              )}
              {item.saved.diffs > 0 && (
                <>
                  <span>·</span>
                  <span className="text-amber-700">{item.saved.diffs} selisih engine</span>
                </>
              )}
            </>
          ) : item.status === 'error' ? (
            <span className="text-red-700">{item.error}</span>
          ) : (
            <>
              <select
                value={item.month ?? ''}
                onChange={(e) => onMonthChange(e.target.value ? Number(e.target.value) : null)}
                disabled={!editable}
                className="px-2 py-0.5 bg-white border border-[var(--border-default)] rounded text-[12px] disabled:opacity-60"
              >
                <option value="">bulan?</option>
                {BULAN_SHORT.slice(1).map((b, i) => (
                  <option key={i + 1} value={i + 1}>{b}</option>
                ))}
              </select>
              <input
                type="number"
                value={item.year ?? ''}
                onChange={(e) => onYearChange(Number(e.target.value))}
                min={2000}
                max={2100}
                disabled={!editable}
                className="w-20 px-2 py-0.5 bg-white border border-[var(--border-default)] rounded text-[12px] font-mono disabled:opacity-60"
              />
              {item.status === 'parsed' && (
                <>
                  <span>·</span>
                  <span>{item.validCount}/{item.parsedCount} valid</span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <StatusBadge status={item.status} />

      {item.status === 'done' && item.saved && item.saved.sessionIds.length > 0 && (
        <div className="flex flex-col items-end gap-1 shrink-0">
          {item.saved.sessionIds.map((sid, i) => (
            <Link
              key={sid}
              href={`/import/${sid}`}
              className="text-[12px] font-semibold text-[var(--brand)] hover:underline"
            >
              {item.saved!.sessionIds.length > 1 ? `Lihat detail ${i + 1} →` : 'Lihat detail →'}
            </Link>
          ))}
        </div>
      )}

      {!running && (item.status === 'pending' || item.status === 'error' || item.status === 'done') && (
        <button
          onClick={onRemove}
          className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
          aria-label="Hapus dari queue"
        >
          <Trash2 size={14} />
        </button>
      )}
    </li>
  );
}
