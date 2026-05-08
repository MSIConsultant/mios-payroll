'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Employee, EmployeeEvent } from '@/lib/types';
import { ArrowLeft, Edit2, Trash2, X, Plus, Save, PowerOff, Power } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { addEvent, deleteEvent, deleteEmployee, updateEmployee } from '@/lib/actions/employees';
import { NpwpInput, NikInput, NominalInput, DateInput } from '@/components/ui/FormattedInput';
import { toast } from 'sonner';

const BULAN_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// --- UI Components ---
function Row({ label, value, highlight }: { label: string; value: string; highlight?: 'green' | 'amber' | 'red' | 'default' }) {
  const colors = { green: 'text-green-400', amber: 'text-amber-400', red: 'text-red-400', default: 'text-zinc-300' };
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#131315] last:border-0">
      <span className="text-[11px] text-zinc-600 font-mono">{label}</span>
      <span className={`text-sm font-bold font-mono ${colors[highlight ?? 'default']}`}>{value}</span>
    </div>
  );
}

function SF({ label, name, children, defaultValue }: { label: string; name: string; children: React.ReactNode; defaultValue?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">{label}</label>
      <select name={name} defaultValue={defaultValue}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className="w-full px-3 py-2.5 bg-[#0D0D0F] border rounded-lg text-sm text-zinc-200 outline-none transition-colors"
        style={{ borderColor: focused ? 'rgba(37,99,235,0.4)' : '#1A1A1C' }}>
        {children}
      </select>
    </div>
  );
}

function TF({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">{label}</label>
      <input name={name} type="text" defaultValue={defaultValue}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className="w-full px-3 py-2.5 bg-[#0D0D0F] border rounded-lg text-sm text-zinc-200 outline-none transition-colors font-mono"
        style={{ borderColor: focused ? 'rgba(37,99,235,0.4)' : '#1A1A1C' }} />
    </div>
  );
}

function Chk({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(!!defaultChecked);
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <input type="checkbox" name={name} checked={checked} onChange={e => setChecked(e.target.checked)}
        className="w-4 h-4 rounded border-zinc-700 bg-[#0D0D0F] text-[#2563EB] focus:ring-0 cursor-pointer" />
      <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors uppercase tracking-widest font-bold">{label}</span>
    </label>
  );
}

// --- Main Page Logic ---
function EmployeeDetailPage() {
  const { companyId, empId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const fromPayroll = searchParams.get('from') === 'payroll';
  const fromTahun = searchParams.get('tahun');
  const fromBulan = searchParams.get('bulan');

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [events, setEvents] = useState<EmployeeEvent[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profil');
  const [showEventModal, setShowEventModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  async function loadEvents() {
    const supabase = createClient();
    const { data } = await supabase.from('employee_events').select('*')
      .eq('employee_id', empId).order('tahun', { ascending: false }).order('bulan', { ascending: false });
    if (data) setEvents(data);
  }

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const [{ data: emp }, { data: evts }, { data: hist }] = await Promise.all([
        supabase.from('employees').select('*').eq('id', empId).single(),
        supabase.from('employee_events').select('*').eq('employee_id', empId)
          .order('tahun', { ascending: false }).order('bulan', { ascending: false }),
        supabase.from('payroll_results')
          .select('*, payroll_runs(tahun, bulan, status)')
          .eq('employee_id', empId).order('calculated_at', { ascending: false }).limit(24),
      ]);
      if (emp) setEmployee(emp);
      if (evts) setEvents(evts);
      if (hist) setPayrollHistory(hist);
      setLoading(false);
    }
    if (empId) fetchData();
  }, [empId]);

  async function handleToggleActive() {
    if (!employee) return;
    const action = employee.aktif ? 'menonaktifkan' : 'mengaktifkan';
    if (!confirm(`Yakin ingin ${action} karyawan ini?`)) return;
    setIsToggling(true);
    const supabase = createClient();
    const { error } = await supabase.from('employees')
      .update({ aktif: !employee.aktif }).eq('id', empId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(employee.aktif ? 'Karyawan dinonaktifkan' : 'Karyawan diaktifkan');
      setEmployee(e => e ? { ...e, aktif: !e.aktif } : e);
    }
    setIsToggling(false);
  }

  async function handleDeleteEmployee() {
    if (!confirm('Hapus karyawan ini? Semua riwayat akan hilang.')) return;
    setIsDeleting(true);
    const res = await deleteEmployee(empId as string, companyId as string);
    if (res.error) {
      toast.error(res.error);
      setIsDeleting(false);
    } else {
      toast.success('Karyawan dihapus');
      router.push(`/companies/${companyId}`);
    }
  }

  async function handleAddEvent(formData: FormData) {
    const res = await addEvent(formData);
    if (res.error) toast.error(res.error);
    else { toast.success('Variasi ditambahkan'); setShowEventModal(false); await loadEvents(); }
  }

  async function handleDeleteEvent(id: string) {
    if (!confirm('Hapus event ini?')) return;
    const res = await deleteEvent(id, companyId as string, empId as string);
    if (res.error) toast.error(res.error);
    else { toast.success('Variasi dihapus'); setEvents(events.filter(e => e.id !== id)); }
  }

  async function handleUpdateEmployee(formData: FormData) {
    setIsSaving(true);
    const res = await updateEmployee(empId as string, companyId as string, formData);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('Profil karyawan diperbarui');
      setShowEditModal(false);
      const supabase = createClient();
      const { data } = await supabase.from('employees').select('*').eq('id', empId).single();
      if (data) setEmployee(data);
    }
    setIsSaving(false);
  }

  if (loading) return <div className="h-64 bg-[#111113] border border-[#1A1A1C] rounded-lg animate-pulse" />;
  if (!employee) return <div className="text-zinc-600 text-sm">Karyawan tidak ditemukan.</div>;

  const tabs = [
    { id: 'profil', label: 'Profil' },
    { id: 'events', label: 'Variasi' },
    { id: 'riwayat', label: 'Riwayat Payroll' },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={
                fromPayroll
                  ? `/companies/${companyId}/payroll/${fromTahun}/${fromBulan}`
                  : `/companies/${companyId}`
              }
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: '#111113', border: '1px solid #1A1A1C', color: '#52525B' }}
            >
              <ArrowLeft size={15} />
            </Link>

            {fromPayroll && (
              <div className="flex items-center gap-2">
                <Link
                  href={`/companies/${companyId}/payroll/${fromTahun}/${fromBulan}`}
                  className="text-[11px] font-mono transition-colors hover:text-[#3B82F6] text-zinc-500"
                >
                  ← Payroll {BULAN_NAMES[Number(fromBulan) - 1]} {fromTahun}
                </Link>
                <span className="text-zinc-800">/</span>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-zinc-100">{employee.nama}</h1>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border ${employee.aktif
                  ? 'bg-green-900/25 text-green-400 border-green-900/40'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                }`}>{employee.aktif ? 'Aktif' : 'Non-Aktif'}</span>
            </div>
            <p className="text-[11px] text-zinc-600 mt-0.5">{employee.jabatan ?? '—'} · {employee.divisi ?? '—'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleToggleActive} disabled={isToggling}
            className={`inline-flex items-center gap-2 px-4 py-2 bg-[#111113] border rounded-lg text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 ${employee.aktif
                ? 'border-amber-900/40 text-amber-500/70 hover:text-amber-400 hover:border-amber-800/60'
                : 'border-green-900/40 text-green-500/70 hover:text-green-400 hover:border-green-800/60'
              }`}>
            {employee.aktif ? <PowerOff size={13} /> : <Power size={13} />}
            {employee.aktif ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
          <button onClick={handleDeleteEmployee} disabled={isDeleting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#111113] border border-red-900/30 text-red-500/70 hover:text-red-400 hover:border-red-800/50 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50">
            <Trash2 size={13} />
            Hapus
          </button>
          <button onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-[#0A0A0B] rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#1D4ED8] transition-colors">
            <Edit2 size={13} />
            Edit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 bg-[#111113] border border-[#1A1A1C] rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-5 py-2 rounded text-xs font-bold uppercase tracking-widest transition-all ${activeTab === t.id ? 'bg-[#1A1A1C] text-zinc-100' : 'text-zinc-600 hover:text-zinc-400'
              }`}>{t.label}</button>
        ))}
      </div>

      {/* PROFIL TAB */}
      {activeTab === 'profil' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-4">Identitas</p>
            <Row label="NIK" value={employee.nik} />
            <Row label="NPWP" value={employee.npwp ?? 'Belum Terdaftar'} />
            <Row label="Status PTKP" value={employee.status_ptkp} />
            <Row label="NPWP Valid" value={employee.punya_npwp ? 'Ya' : 'Tidak (+20%)'}
              highlight={employee.punya_npwp ? 'green' : 'red'} />
            <Row label="Tanggal Masuk"
              value={employee.tanggal_masuk ? new Date(employee.tanggal_masuk).toLocaleDateString('id-ID') : '—'} />
          </div>

          <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-4">Kompensasi</p>
            <Row label="gaji_pokok" value={formatRupiah(employee.gaji_pokok)} highlight="green" />
            {employee.benefit > 0 && <Row label="benefit" value={formatRupiah(employee.benefit)} />}
            {employee.kendaraan > 0 && <Row label="kendaraan" value={formatRupiah(employee.kendaraan)} />}
            {employee.pulsa > 0 && <Row label="pulsa" value={formatRupiah(employee.pulsa)} />}
            {employee.operasional > 0 && <Row label="operasional" value={formatRupiah(employee.operasional)} />}
            {employee.tunj_lain > 0 && <Row label="tunj_lain" value={formatRupiah(employee.tunj_lain)} />}
            <div className="mt-3 pt-3 border-t border-[#1A1A1C]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">Est. Total Bruto</span>
                <span className="text-xl font-bold text-[#2563EB] font-mono">
                  {formatRupiah(
                    employee.gaji_pokok + (employee.benefit ?? 0) + (employee.kendaraan ?? 0) +
                    (employee.pulsa ?? 0) + (employee.operasional ?? 0) + (employee.tunj_lain ?? 0)
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-4">BPJS</p>
            <Row label="JHT" value={employee.ikut_jht ? 'Ikut' : 'Tidak'} highlight={employee.ikut_jht ? 'green' : 'default'} />
            <Row label="JP" value={employee.ikut_jp ? 'Ikut' : 'Tidak'} highlight={employee.ikut_jp ? 'green' : 'default'} />
            <Row label="JKP" value={employee.ikut_jkp ? 'Ikut' : 'Tidak'} highlight={employee.ikut_jkp ? 'green' : 'default'} />
            <Row label="JKK Rate" value={`${(employee.jkk_rate * 100).toFixed(2)}%`} />
            <Row label="Kesehatan" value={employee.ikut_kes ? 'Ikut' : 'Tidak'} highlight={employee.ikut_kes ? 'green' : 'default'} />
          </div>

          <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-4">PPh 21</p>
            <Row label="Skema" value={employee.pph_ditanggung ? 'GROSSUP' : 'DIPOTONG'}
              highlight={employee.pph_ditanggung ? 'amber' : 'default'} />
            <Row label="Tipe Karyawan" value={employee.jenis_karyawan.replace(/_/g, ' ').toUpperCase()} />
            {employee.upah_harian && <Row label="Upah Harian" value={formatRupiah(employee.upah_harian)} />}
            {employee.hari_kerja_default && <Row label="Hari Kerja Default" value={`${employee.hari_kerja_default} hari`} />}
          </div>
        </div>
      )}

      {/* EVENTS TAB */}
      {activeTab === 'events' && (
        <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#1A1A1C] flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">THR · Bonus · Potongan</span>
            <button onClick={() => setShowEventModal(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#2563EB] text-[#0A0A0B] rounded text-[10px] font-bold uppercase tracking-widest hover:bg-[#1D4ED8] transition-colors">
              <Plus size={11} />
              Tambah
            </button>
          </div>
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-[#1A1A1C] text-[10px] uppercase tracking-widest text-zinc-700">
                <th className="px-5 py-3 text-left">Periode</th>
                <th className="px-5 py-3 text-left">Tipe</th>
                <th className="px-5 py-3 text-right">Nilai</th>
                <th className="px-5 py-3 text-left">Keterangan</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-zinc-700">Belum ada variasi</td></tr>
              ) : events.map(ev => (
                <tr key={ev.id} className="border-b border-[#131315] hover:bg-[#131315] transition-colors">
                  <td className="px-5 py-3 text-zinc-400">{BULAN_NAMES[ev.bulan - 1]} {ev.tahun}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${['thr', 'bonus'].includes(ev.tipe) ? 'bg-amber-900/25 text-amber-400' :
                        ['alpha_telat', 'kasbon', 'pot_lain'].includes(ev.tipe) ? 'bg-red-900/25 text-red-400' :
                          'bg-sky-900/25 text-sky-400'
                      }`}>{ev.tipe.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-base font-bold text-zinc-300">{formatRupiah(ev.nilai)}</span>
                  </td>
                  <td className="px-5 py-3 text-zinc-600">{ev.keterangan ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDeleteEvent(ev.id)}
                      className="text-zinc-700 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* RIWAYAT TAB */}
      {activeTab === 'riwayat' && (
        <div className="bg-[#080809] border border-[#1A1A1C] rounded-lg overflow-hidden font-mono">
          <div className="px-4 py-2 bg-[#0F0F11] border-b border-[#1A1A1C] flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500/40" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/40" />
            <div className="w-2 h-2 rounded-full bg-green-500/40" />
            <span className="ml-3 text-[10px] text-zinc-700 uppercase tracking-widest">{employee.nama.toLowerCase()}.payroll.log</span>
          </div>
          {payrollHistory.length === 0 ? (
            <div className="px-5 py-10 text-xs text-zinc-700">$ Belum ada riwayat payroll.</div>
          ) : payrollHistory.map((h, i) => {
            const run = h.payroll_runs;
            return (
              <Link key={h.id}
                href={`/companies/${companyId}/payroll/${run?.tahun}/${run?.bulan}`}
                className={`block px-5 py-4 hover:bg-[#0F0F11] transition-colors ${i < payrollHistory.length - 1 ? 'border-b border-[#131315]' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-300">
                    <span className="text-[#2563EB]">$</span>{' '}
                    <span className="font-bold">{run ? `${BULAN_NAMES[run.bulan - 1]} ${run.tahun}` : '—'}</span>
                  </span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${run?.status === 'locked' ? 'bg-green-900/30 text-green-500' :
                      run?.status === 'calculated' ? 'bg-sky-900/30 text-sky-400' : 'bg-zinc-800 text-zinc-600'
                    }`}>{run?.status ?? '—'}</span>
                </div>
                <div className="pl-3 grid grid-cols-4 gap-x-4 text-[11px]">
                  <span><span className="text-zinc-700">bruto     </span><span className="text-zinc-400">{formatRupiah(h.bruto ?? 0)}</span></span>
                  <span><span className="text-zinc-700">pph21     </span><span className="text-amber-400">{formatRupiah(h.pph ?? 0)}</span></span>
                  <span><span className="text-zinc-700">bpjs_k    </span><span className="text-zinc-400">{formatRupiah(h.bpjs_karyawan ?? 0)}</span></span>
                  <span><span className="text-zinc-700">thp       </span>
                    <span className="text-green-400 font-bold text-sm">{formatRupiah(h.thp ?? 0)}</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-[#1A1A1C] flex items-center justify-between sticky top-0 bg-[#111113] z-10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 font-mono">Edit Lengkap — {employee.nama}</p>
              <button onClick={() => setShowEditModal(false)} className="text-zinc-600 hover:text-zinc-300 transition-colors"><X size={16} /></button>
            </div>
            <form action={handleUpdateEmployee} className="p-5 space-y-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-4 border-b border-[#1A1A1C] pb-2">Identitas Diri</p>
                <div className="grid grid-cols-2 gap-4">
                  <TF label="Nama Lengkap" name="nama" defaultValue={employee.nama} />
                  <NikInput label="NIK" name="nik" defaultValue={employee.nik} />
                  <NpwpInput label="NPWP" name="npwp" defaultValue={employee.npwp ?? ''} />
                  <SF label="Punya NPWP?" name="punya_npwp" defaultValue={employee.punya_npwp ? 'true' : 'false'}>
                    <option value="true">Ya (NPWP Valid)</option>
                    <option value="false">Tidak (+20% PPh)</option>
                  </SF>
                  <SF label="Status PTKP" name="status_ptkp" defaultValue={employee.status_ptkp}>
                    {['TK0', 'TK1', 'TK2', 'TK3', 'K0', 'K1', 'K2', 'K3'].map(s => <option key={s}>{s}</option>)}
                  </SF>
                  <SF label="Jenis Kelamin" name="jenis_kelamin" defaultValue={employee.jenis_kelamin}>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </SF>
                  <DateInput label="Tanggal Masuk" name="tanggal_masuk" defaultValue={employee.tanggal_masuk ?? ''} />
                  <TF label="Jabatan" name="jabatan" defaultValue={employee.jabatan ?? ''} />
                  <div className="col-span-2">
                    <TF label="Divisi" name="divisi" defaultValue={employee.divisi ?? ''} />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-4 border-b border-[#1A1A1C] pb-2">Kompensasi</p>
                {employee.jenis_karyawan === 'tetap' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <NominalInput label="Gaji Pokok" name="gaji_pokok" defaultValue={employee.gaji_pokok} />
                    <NominalInput label="Benefit" name="benefit" defaultValue={employee.benefit} />
                    <NominalInput label="Kendaraan" name="kendaraan" defaultValue={employee.kendaraan} />
                    <NominalInput label="Pulsa" name="pulsa" defaultValue={employee.pulsa} />
                    <NominalInput label="Operasional" name="operasional" defaultValue={employee.operasional} />
                    <NominalInput label="Tunjangan Lain" name="tunj_lain" defaultValue={employee.tunj_lain} />
                  </div>
                ) : employee.jenis_karyawan === 'tidak_tetap_harian' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <NominalInput label="Upah Harian *" name="upah_harian" defaultValue={employee.upah_harian ?? 0} />
                    <TF label="Hari Kerja Default" name="hari_kerja_default" defaultValue={String(employee.hari_kerja_default ?? 22)} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <NominalInput label="Upah Bulanan TT" name="upah_bulanan_tt" defaultValue={employee.upah_bulanan_tt ?? 0} />
                    <NominalInput label="Tunjangan TT" name="tunjangan_tt" defaultValue={employee.tunjangan_tt ?? 0} />
                  </div>
                )}
                <input type="hidden" name="jenis_karyawan" value={employee.jenis_karyawan} />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-4 border-b border-[#1A1A1C] pb-2">BPJS Ketenagakerjaan & Kesehatan</p>
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-2">Kepesertaan</p>
                    <Chk name="ikut_jht" label="JHT" defaultChecked={employee.ikut_jht} />
                    <Chk name="ikut_jp" label="JP" defaultChecked={employee.ikut_jp} />
                    <Chk name="ikut_jkp" label="JKP" defaultChecked={employee.ikut_jkp} />
                    <Chk name="ikut_kes" label="Kesehatan" defaultChecked={employee.ikut_kes} />
                  </div>
                  <div className="space-y-3">
                    <p className="text-[10px] text-zinc-700 uppercase tracking-widest mb-2">Tunjangan Iuran Karyawan</p>
                    <Chk name="tanggung_jht_k" label="Tunj. JHT Karyawan" defaultChecked={employee.tanggung_jht_k} />
                    <Chk name="tanggung_jp_k" label="Tunj. JP Karyawan" defaultChecked={employee.tanggung_jp_k} />
                    <Chk name="tanggung_kes_k" label="Tunj. Kes Karyawan" defaultChecked={employee.tanggung_kes_k} />
                  </div>
                  <div className="space-y-3">
                    <SF label="Tarif JKK Perusahaan" name="jkk_rate" defaultValue={String(employee.jkk_rate)}>
                      <option value="0.0024">0.24% – Sangat Rendah</option>
                      <option value="0.0054">0.54% – Rendah</option>
                      <option value="0.0089">0.89% – Sedang</option>
                      <option value="0.0127">1.27% – Tinggi</option>
                      <option value="0.0174">1.74% – Sangat Tinggi</option>
                    </SF>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-4 border-b border-[#1A1A1C] pb-2">Skema PPh 21</p>
                <div className="bg-[#0D0D0F] border border-[#1A1A1C] rounded-lg p-4 max-w-sm">
                  <Chk name="pph_ditanggung" label="Grossup (PPh Ditanggung Perusahaan)" defaultChecked={employee.pph_ditanggung} />
                  <p className="text-[10px] text-zinc-700 mt-3 leading-relaxed font-mono">
                    Jika dicentang: THP karyawan = nominal gaji di atas (PPh menjadi beban perusahaan).
                    Jika tidak: PPh dipotong dari gaji karyawan.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-[#1A1A1C]">
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Batal</button>
                <button type="submit" disabled={isSaving}
                  className="inline-flex items-center gap-2 bg-[#2563EB] text-[#0A0A0B] px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors">
                  <Save size={13} />
                  {isSaving ? 'Menyimpan...' : 'Simpan Semua Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD EVENT MODAL */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg w-full max-w-md">
            <div className="px-5 py-4 border-b border-[#1A1A1C] flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Tambah Variasi Bulanan</p>
              <button onClick={() => setShowEventModal(false)} className="text-zinc-600 hover:text-zinc-300 transition-colors"><X size={16} /></button>
            </div>
            <form action={handleAddEvent} className="p-5 space-y-4">
              <input type="hidden" name="employee_id" value={empId} />
              <input type="hidden" name="company_id" value={companyId} />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">Tahun</label>
                  <input name="tahun" type="number" defaultValue={new Date().getFullYear()}
                    className="w-full px-3 py-2.5 bg-[#0D0D0F] border border-[#1A1A1C] rounded-lg text-sm text-zinc-200 outline-none focus:border-[#2563EB]/40 font-mono" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">Bulan</label>
                  <select name="bulan" defaultValue={new Date().getMonth() + 1}
                    className="w-full px-3 py-2.5 bg-[#0D0D0F] border border-[#1A1A1C] rounded-lg text-sm text-zinc-200 outline-none focus:border-[#2563EB]/40">
                    {BULAN_NAMES.map((b, i) => <option key={i} value={i + 1}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">Tipe Variasi</label>
                <select name="tipe"
                  className="w-full px-3 py-2.5 bg-[#0D0D0F] border border-[#1A1A1C] rounded-lg text-sm text-zinc-200 outline-none focus:border-[#2563EB]/40">
                  <option value="thr">THR</option>
                  <option value="bonus">Bonus</option>
                  <option value="benefit_extra">Extra Benefit (Taxable)</option>
                  <option value="alpha_telat">Potongan Alpha/Telat</option>
                  <option value="kasbon">Kasbon / Pinjaman</option>
                  <option value="pot_lain">Potongan Lain</option>
                </select>
              </div>
              <NominalInput label="Nilai (Rp)" name="nilai" required />
              <div>
                <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">Keterangan</label>
                <textarea name="keterangan" rows={2}
                  className="w-full px-3 py-2.5 bg-[#0D0D0F] border border-[#1A1A1C] rounded-lg text-sm text-zinc-200 outline-none focus:border-[#2563EB]/40 resize-none" />
              </div>
              <button type="submit"
                className="w-full bg-[#2563EB] text-[#0A0A0B] py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-[#1D4ED8] transition-colors">
                Simpan Variasi
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Wrapper to satisfy Suspense requirement for useSearchParams ---
export default function EmployeeDetailPageWrapper() {
  return (
    <Suspense fallback={<div className="h-64 bg-[#111113] border border-[#1A1A1C] rounded-lg animate-pulse" />}>
      <EmployeeDetailPage />
    </Suspense>
  );
}
