'use client';
import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { createEmployee } from '@/lib/actions/employees';
import { toast } from 'sonner';
import { ArrowLeft, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet, Loader2 } from 'lucide-react';

interface ParsedEmployee {
  nama: string;
  nik: string;
  npwp: string;
  punya_npwp: boolean;
  divisi: string;
  jenis_kelamin: string;
  status_ptkp: string;
  gaji_pokok: number;
  benefit: number;
  kendaraan: number;
  pulsa: number;
  operasional: number;
  tunj_lain: number;
  ikut_jht: boolean;
  ikut_jp: boolean;
  ikut_kes: boolean;
  jkk_rate: number;
  // errors
  _errors: string[];
  _valid: boolean;
}

const PTKP_VALID = ['TK0','TK1','TK2','TK3','K0','K1','K2','K3'];
const JKK_RATES = [0.0024, 0.0054, 0.0089, 0.0127, 0.0174];

function closestJKK(rate: number): number {
  return JKK_RATES.reduce((prev, curr) =>
    Math.abs(curr - rate) < Math.abs(prev - rate) ? curr : prev
  );
}

function parseSalarySheet(sheet: any): ParsedEmployee[] {
  // Data starts at row 6 (index 5), columns are 1-based
  // A=1,B=2,C=3,D=4,E=5,H=8,L=12,O=15,P=16,R=18,S=19,T=20,W=23,X=24,Y=25,Z=26,AK=37
  const results: ParsedEmployee[] = [];
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1');

  for (let r = 5; r <= range.e.r; r++) {
    const get = (col: number) => {
      const cell = sheet[XLSX.utils.encode_cell({ r, c: col })];
      return cell?.v ?? null;
    };

    const nama = String(get(3) ?? '').trim(); // D
    if (!nama || nama === 'NAMA') continue; // skip empty/header

    const nikRaw   = String(get(2) ?? '').trim(); // C
    const npwpFlag = String(get(0) ?? '').trim(); // A — "NPWP" or blank
    const npwpRaw  = String(get(7) ?? '').trim(); // H
    const divisi   = String(get(4) ?? '').trim(); // E
    const ptkp     = String(get(11) ?? '').trim().toUpperCase(); // L
    const gaji     = Number(get(14)) || 0; // O
    const jkk_val  = Number(get(15)) || 0; // P — JKK amount
    const jht_val  = Number(get(17)) || 0; // R — JHT employer amount
    const jp_val   = Number(get(18)) || 0; // S — JP employer amount
    const kes_val  = Number(get(19)) || 0; // T — Kesehatan employer amount
    const tunj_pph = Number(get(21)) || 0; // V — PPH 21 allowance (grossup indicator)
    const benefit  = Number(get(22)) || 0; // W
    const kendaraan = Number(get(23)) || 0; // X
    const pulsa    = Number(get(24)) || 0; // Y
    const operasional = Number(get(25)) || 0; // Z
    const genVal   = String(get(36) ?? '').trim().toUpperCase(); // AK

    const errors: string[] = [];

    // NIK validation
    const nik = nikRaw.replace(/\D/g, '');
    if (nik.length !== 16) errors.push(`NIK harus 16 digit (dapat: ${nik.length})`);

    // PTKP validation
    if (!PTKP_VALID.includes(ptkp)) errors.push(`Status PTKP tidak valid: ${ptkp}`);

    // Gaji validation
    if (gaji <= 0) errors.push('Gaji pokok harus > 0');

    // Derive JKK rate from amount
    const jkk_rate = gaji > 0 ? closestJKK(jkk_val / gaji) : 0.0024;

    // Derive flags
    const ikut_jht = jht_val > 0;
    const ikut_jp  = jp_val  > 0;
    const ikut_kes = kes_val > 0;
    const punya_npwp = npwpFlag.toUpperCase() === 'NPWP';
    const pph_ditanggung = tunj_pph > 0;
    const jenis_kelamin = genVal === 'P' ? 'P' : 'L';

    results.push({
      nama,
      nik: nik.slice(0, 16),
      npwp: npwpRaw !== '000' ? npwpRaw : '',
      punya_npwp,
      divisi,
      jenis_kelamin,
      status_ptkp: PTKP_VALID.includes(ptkp) ? ptkp : 'TK0',
      gaji_pokok: gaji,
      benefit,
      kendaraan,
      pulsa,
      operasional,
      tunj_lain: 0,
      ikut_jht,
      ikut_jp,
      ikut_kes,
      jkk_rate,
      _errors: errors,
      _valid: errors.length === 0,
    });
  }

  return results;
}

export default function ImportEmployeesPage() {
  const { companyId } = useParams();
  const router = useRouter();
  const [employees, setEmployees] = useState<ParsedEmployee[]>([]);
  const [fileName, setFileName]   = useState('');
  const [importing, setImporting] = useState(false);
  const [imported, setImported]   = useState(0);
  const [dragOver, setDragOver]   = useState(false);

  function processFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: 'array' });
        const ws   = wb.Sheets['SALARY'];
        if (!ws) {
          toast.error('Sheet "SALARY" tidak ditemukan dalam file ini.');
          return;
        }
        const parsed = parseSalarySheet(ws);
        if (parsed.length === 0) {
          toast.error('Tidak ada data karyawan yang ditemukan di sheet SALARY.');
          return;
        }
        setEmployees(parsed);
        toast.success(`${parsed.length} karyawan berhasil dibaca`);
      } catch {
        toast.error('Gagal membaca file. Pastikan format Excel benar.');
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
    if (valid.length === 0) { toast.error('Tidak ada data valid untuk diimpor.'); return; }
    setImporting(true);
    let count = 0;
    for (const emp of valid) {
      const fd = new FormData();
      fd.append('company_id',   companyId as string);
      fd.append('nama',         emp.nama);
      fd.append('nik',          emp.nik);
      fd.append('npwp',         emp.npwp);
      fd.append('punya_npwp',   String(emp.punya_npwp));
      fd.append('divisi',       emp.divisi);
      fd.append('jabatan',      '');
      fd.append('jenis_kelamin', emp.jenis_kelamin);
      fd.append('status_ptkp',  emp.status_ptkp);
      fd.append('jenis_karyawan', 'tetap');
      fd.append('gaji_pokok',   String(emp.gaji_pokok));
      fd.append('benefit',      String(emp.benefit));
      fd.append('kendaraan',    String(emp.kendaraan));
      fd.append('pulsa',        String(emp.pulsa));
      fd.append('operasional',  String(emp.operasional));
      fd.append('tunj_lain',    String(emp.tunj_lain));
      fd.append('jkk_rate',     String(emp.jkk_rate));
      if (emp.ikut_jht) fd.append('ikut_jht', 'on');
      if (emp.ikut_jp)  fd.append('ikut_jp',  'on');
      if (emp.ikut_kes) fd.append('ikut_kes', 'on');
      // default other BPJS flags based on presence
      if (emp.ikut_jht) fd.append('tanggung_jht_k', 'on');
      if (emp.ikut_jp)  fd.append('tanggung_jp_k',  'on');
      if (emp.ikut_kes) fd.append('tanggung_kes_k', 'on');
      fd.append('pph_ditanggung', 'on');
      const res = await createEmployee(fd);
      if (!res.error) count++;
      setImported(count);
    }
    setImporting(false);
    toast.success(`${count} karyawan berhasil diimpor`);
    setTimeout(() => router.push(`/companies/${companyId}`), 1200);
  }

  const validCount   = employees.filter(e => e._valid).length;
  const invalidCount = employees.filter(e => !e._valid).length;

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/companies/${companyId}`}
          className="w-9 h-9 bg-[#111113] border border-[#1A1A1C] rounded-lg flex items-center justify-center text-zinc-600 hover:text-zinc-200 transition-colors">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Import Karyawan</h1>
          <p className="text-[11px] text-zinc-600 font-mono mt-0.5">Upload file Excel — sheet SALARY akan dibaca otomatis</p>
        </div>
      </div>

      {/* Drop zone */}
      {employees.length === 0 && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-lg p-16 text-center transition-all ${
            dragOver ? 'border-[#2563EB]/60 bg-[#2563EB]/5' : 'border-[#1A1A1C] bg-[#0A0A0B]'
          }`}>
          <FileSpreadsheet size={32} className="mx-auto text-zinc-700 mb-4" />
          <p className="text-sm font-bold text-zinc-400 mb-2 font-mono">Drag & drop file Excel Anda di sini</p>
          <p className="text-[11px] text-zinc-700 font-mono mb-6">Format: Grossup_PPh_21_*.xlsx · Sheet: SALARY</p>
          <label className="inline-flex items-center gap-2 bg-[#2563EB] text-[#0A0A0B] px-6 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-[#1D4ED8] transition-colors cursor-pointer">
            <Upload size={13} />
            Pilih File
            <input type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
          </label>
        </div>
      )}

      {/* Preview */}
      {employees.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0A0A0B] border border-[#1A1A1C] rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700 mb-2 font-mono">Total Dibaca</p>
              <p className="text-3xl font-black font-mono text-zinc-100">{employees.length}</p>
            </div>
            <div className={`border rounded-lg p-4 ${validCount > 0 ? 'bg-green-900/10 border-green-900/30' : 'bg-[#0A0A0B] border-[#1A1A1C]'}`}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700 mb-2 font-mono">Siap Diimpor</p>
              <p className="text-3xl font-black font-mono text-green-400">{validCount}</p>
            </div>
            <div className={`border rounded-lg p-4 ${invalidCount > 0 ? 'bg-red-900/10 border-red-900/30' : 'bg-[#0A0A0B] border-[#1A1A1C]'}`}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700 mb-2 font-mono">Perlu Diperbaiki</p>
              <p className="text-3xl font-black font-mono text-red-400">{invalidCount}</p>
            </div>
          </div>

          {/* File info + actions */}
          <div className="flex items-center justify-between bg-[#0A0A0B] border border-[#1A1A1C] rounded-lg px-5 py-3">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={14} className="text-[#2563EB]" />
              <p className="text-[11px] text-zinc-400 font-mono">{fileName}</p>
            </div>
            <div className="flex gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#111113] border border-[#1A1A1C] text-zinc-500 hover:text-zinc-200 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer">
                <Upload size={12} />
                Ganti File
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setEmployees([]); setTimeout(() => processFile(f), 50); } }} />
              </label>
              <button onClick={handleImport} disabled={importing || validCount === 0}
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#2563EB] text-[#0A0A0B] rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors">
                {importing ? (
                  <><Loader2 size={12} className="animate-spin" />{imported}/{validCount}</>
                ) : (
                  <>Import {validCount} Karyawan</>
                )}
              </button>
            </div>
          </div>

          {/* Table preview */}
          <div className="bg-[#080809] border border-[#1A1A1C] rounded-lg overflow-hidden font-mono">
            <div className="px-4 py-2.5 bg-[#0A0A0B] border-b border-[#1A1A1C] flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500/40" />
              <div className="w-2 h-2 rounded-full bg-yellow-500/40" />
              <div className="w-2 h-2 rounded-full bg-green-500/40" />
              <span className="ml-3 text-[10px] text-zinc-700 uppercase tracking-widest">preview.import</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[#111113] text-zinc-700 text-[9px] uppercase tracking-widest">
                    <th className="px-4 py-2.5 text-left w-8"></th>
                    <th className="px-4 py-2.5 text-left">Nama</th>
                    <th className="px-4 py-2.5 text-left">NIK</th>
                    <th className="px-4 py-2.5 text-left">PTKP</th>
                    <th className="px-4 py-2.5 text-left">Divisi</th>
                    <th className="px-4 py-2.5 text-right">Gaji Pokok</th>
                    <th className="px-4 py-2.5 text-left">BPJS</th>
                    <th className="px-4 py-2.5 text-left">JKK</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, i) => (
                    <tr key={i}
                      className={`border-b border-[#0F0F11] transition-colors ${
                        emp._valid ? 'hover:bg-[#0A0A0B]' : 'bg-red-900/5'
                      }`}>
                      <td className="px-4 py-2.5 text-center">
                        {emp._valid
                          ? <CheckCircle2 size={12} className="text-green-500 inline" />
                          : <AlertTriangle size={12} className="text-red-400 inline" />
                        }
                      </td>
                      <td className="px-4 py-2.5 text-zinc-300 font-bold uppercase">{emp.nama}</td>
                      <td className="px-4 py-2.5 text-zinc-500">{emp.nik || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[9px] px-2 py-0.5 rounded bg-sky-900/25 text-sky-400">{emp.status_ptkp}</span>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600">{emp.divisi || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-300">
                        {'Rp ' + emp.gaji_pokok.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          {emp.ikut_jht && <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">JHT</span>}
                          {emp.ikut_jp  && <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">JP</span>}
                          {emp.ikut_kes && <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">KES</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600">{(emp.jkk_rate * 100).toFixed(2)}%</td>
                      <td className="px-4 py-2.5">
                        {emp._valid ? (
                          <span className="text-[9px] text-green-400">✓ valid</span>
                        ) : (
                          <span className="text-[9px] text-red-400">{emp._errors[0]}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
