'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Employee, EmployeeEvent } from '@/lib/types';
import {
  ArrowLeft, Edit2, Trash2, X, Plus, Save, PowerOff, Power,
  User, Wallet, Shield, FileText, CheckCircle2, Lock, Clock,
} from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { addEvent, deleteEvent, deleteEmployee, updateEmployee } from '@/lib/actions/employees';
import { NpwpInput, NikInput, NominalInput, DateInput } from '@/components/ui/FormattedInput';
import { PayrollSimulator } from '@/components/payroll/PayrollSimulator';
import { toast } from 'sonner';

const BULAN_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const RUN_STATUS_CHIP: Record<string, string> = {
  locked: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  calculated: 'bg-sky-50 text-sky-700 ring-sky-200',
  draft: 'bg-amber-50 text-amber-700 ring-amber-200',
};

const RUN_STATUS_ICON: Record<string, typeof Lock> = {
  locked: Lock,
  calculated: CheckCircle2,
  draft: Clock,
};

const EVENT_CHIP: Record<string, string> = {
  thr: 'bg-amber-50 text-amber-700 ring-amber-200',
  bonus: 'bg-amber-50 text-amber-700 ring-amber-200',
  benefit_extra: 'bg-sky-50 text-sky-700 ring-sky-200',
  alpha_telat: 'bg-red-50 text-red-700 ring-red-200',
  kasbon: 'bg-red-50 text-red-700 ring-red-200',
  pot_lain: 'bg-red-50 text-red-700 ring-red-200',
};

function Row({
  label, value, highlight,
}: {
  label: string;
  value: string;
  highlight?: 'green' | 'amber' | 'red' | 'default';
}) {
  const colors = {
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-600',
    default: 'text-[var(--text-primary)]',
  };
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--border-subtle)] last:border-0">
      <span className="text-[12px] text-[var(--text-muted)]">{label}</span>
      <span
        className={`text-[14px] font-semibold font-mono ${colors[highlight ?? 'default']}`}
      >
        {value}
      </span>
    </div>
  );
}

function SF({
  label, name, children, defaultValue,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  defaultValue?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
      >
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all"
      >
        {children}
      </select>
    </div>
  );
}

function TF({
  label, name, defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        defaultValue={defaultValue}
        className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[15px] text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all"
      />
    </div>
  );
}

function Chk({
  name, label, defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  const [checked, setChecked] = useState(!!defaultChecked);
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group select-none">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        className="w-4 h-4 rounded border-[var(--border-strong)] text-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] cursor-pointer"
      />
      <span className="text-[14px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
        {label}
      </span>
    </label>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: typeof User; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={15} className="text-[var(--text-muted)]" />
      <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
    </div>
  );
}

function EmployeeDetailPage() {
  const { companyId, empId } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const fromPayroll = searchParams.get('from') === 'payroll';
  const fromTahun   = searchParams.get('tahun');
  const fromBulan   = searchParams.get('bulan');

  const [employee, setEmployee]             = useState<Employee | null>(null);
  const [events, setEvents]                 = useState<EmployeeEvent[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [activeTab, setActiveTab]           = useState('profil');
  const [showEventModal, setShowEventModal] = useState(false);
  const [showEditModal, setShowEditModal]   = useState(false);
  const [isDeleting, setIsDeleting]         = useState(false);
  const [isSaving, setIsSaving]             = useState(false);
  const [isToggling, setIsToggling]         = useState(false);

  async function loadEvents() {
    const supabase = createClient();
    const { data } = await supabase
      .from('employee_events')
      .select('*')
      .eq('employee_id', empId)
      .order('tahun', { ascending: false })
      .order('bulan', { ascending: false });
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
      setEmployee((e) => (e ? { ...e, aktif: !e.aktif } : e));
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
    else {
      toast.success('Variasi ditambahkan');
      setShowEventModal(false);
      await loadEvents();
    }
  }

  async function handleDeleteEvent(id: string) {
    if (!confirm('Hapus event ini?')) return;
    const res = await deleteEvent(id, companyId as string, empId as string);
    if (res.error) toast.error(res.error);
    else {
      toast.success('Variasi dihapus');
      setEvents(events.filter((e) => e.id !== id));
    }
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

  if (loading) {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="h-24 bg-white border border-[var(--border-default)] rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-48 bg-white border border-[var(--border-default)] rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="bg-white border border-dashed border-[var(--border-default)] rounded-xl py-16 text-center">
        <User size={32} className="mx-auto text-[var(--text-faint)]" />
        <p className="mt-3 text-sm text-[var(--text-secondary)]">Karyawan tidak ditemukan.</p>
      </div>
    );
  }

  const tabs: { id: string; label: string }[] = [
    { id: 'profil',  label: 'Profil' },
    { id: 'events',  label: 'Variasi' },
    { id: 'riwayat', label: 'Riwayat Payroll' },
  ];
  if (employee.jenis_karyawan === 'tetap') {
    tabs.splice(1, 0, { id: 'proyeksi', label: 'Proyeksi' });
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] flex-wrap">
        <Link
          href={`/companies/${companyId}`}
          className="inline-flex items-center gap-1 hover:text-[var(--brand)] transition-colors"
        >
          <ArrowLeft size={14} />
          Perusahaan
        </Link>
        {fromPayroll && (
          <>
            <span>/</span>
            <Link
              href={`/companies/${companyId}/payroll/${fromTahun}/${fromBulan}`}
              className="hover:text-[var(--brand)] transition-colors"
            >
              Payroll {BULAN_NAMES[Number(fromBulan) - 1]} {fromTahun}
            </Link>
          </>
        )}
      </div>

      {/* Header card */}
      <header className="bg-white border border-[var(--border-default)] rounded-xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <EmployeeAvatar name={employee.nama} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] truncate">
                  {employee.nama}
                </h1>
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${
                    employee.aktif
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      : 'bg-slate-100 text-slate-600 ring-slate-200'
                  }`}
                >
                  {employee.aktif ? 'Aktif' : 'Non-Aktif'}
                </span>
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {employee.jabatan ?? '—'} · {employee.divisi ?? '—'} ·{' '}
                <span className="font-mono">NIK {employee.nik}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleToggleActive}
              disabled={isToggling}
              className={`inline-flex items-center gap-1.5 px-3 py-2 bg-white border rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer ${
                employee.aktif
                  ? 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-amber-300 hover:text-amber-700'
                  : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              {employee.aktif ? <PowerOff size={14} /> : <Power size={14} />}
              {employee.aktif ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
            <button
              onClick={handleDeleteEmployee}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-red-300 hover:text-red-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={14} />
              Hapus
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <Edit2 size={14} />
              Edit
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-[var(--border-default)] rounded-lg p-1 w-fit">
        {tabs.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* PROFIL */}
      {activeTab === 'profil' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-[var(--border-default)] rounded-xl p-5">
            <SectionTitle icon={User} label="Identitas" />
            <Row label="NIK" value={employee.nik} />
            <Row label="NPWP" value={employee.npwp ?? 'Belum Terdaftar'} />
            <Row label="Status PTKP" value={employee.status_ptkp} />
            <Row
              label="NPWP Valid"
              value={employee.punya_npwp ? 'Ya' : 'Tidak (+20%)'}
              highlight={employee.punya_npwp ? 'green' : 'red'}
            />
            <Row
              label="Tanggal Masuk"
              value={
                employee.tanggal_masuk
                  ? new Date(employee.tanggal_masuk).toLocaleDateString('id-ID')
                  : '—'
              }
            />
            {employee.tanggal_keluar && (
              <Row
                label="Tanggal Keluar"
                value={new Date(employee.tanggal_keluar).toLocaleDateString('id-ID')}
                highlight="amber"
              />
            )}
          </div>

          <div className="bg-white border border-[var(--border-default)] rounded-xl p-5">
            <SectionTitle icon={Wallet} label="Kompensasi" />
            <Row label="Gaji Pokok" value={formatRupiah(employee.gaji_pokok)} highlight="green" />
            {employee.benefit > 0 && <Row label="Benefit" value={formatRupiah(employee.benefit)} />}
            {employee.kendaraan > 0 && <Row label="Kendaraan" value={formatRupiah(employee.kendaraan)} />}
            {employee.pulsa > 0 && <Row label="Pulsa" value={formatRupiah(employee.pulsa)} />}
            {employee.operasional > 0 && <Row label="Operasional" value={formatRupiah(employee.operasional)} />}
            {employee.tunj_lain > 0 && <Row label="Tunjangan Lain" value={formatRupiah(employee.tunj_lain)} />}
            <div className="mt-4 pt-4 border-t border-[var(--border-default)] flex items-baseline justify-between">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Est. Total Bruto
              </span>
              <span className="text-xl font-bold text-[var(--brand)] font-mono">
                {formatRupiah(
                  employee.gaji_pokok +
                    (employee.benefit ?? 0) +
                    (employee.kendaraan ?? 0) +
                    (employee.pulsa ?? 0) +
                    (employee.operasional ?? 0) +
                    (employee.tunj_lain ?? 0),
                )}
              </span>
            </div>
          </div>

          <div className="bg-white border border-[var(--border-default)] rounded-xl p-5">
            <SectionTitle icon={Shield} label="BPJS" />
            <Row label="JHT" value={employee.ikut_jht ? 'Ikut' : 'Tidak'} highlight={employee.ikut_jht ? 'green' : 'default'} />
            <Row label="JP" value={employee.ikut_jp ? 'Ikut' : 'Tidak'} highlight={employee.ikut_jp ? 'green' : 'default'} />
            <Row label="JKP" value={employee.ikut_jkp ? 'Ikut' : 'Tidak'} highlight={employee.ikut_jkp ? 'green' : 'default'} />
            <Row label="JKK Rate" value={`${(employee.jkk_rate * 100).toFixed(2)}%`} />
            <Row label="Kesehatan" value={employee.ikut_kes ? 'Ikut' : 'Tidak'} highlight={employee.ikut_kes ? 'green' : 'default'} />
          </div>

          <div className="bg-white border border-[var(--border-default)] rounded-xl p-5">
            <SectionTitle icon={FileText} label="PPh 21" />
            <Row
              label="Skema"
              value={employee.pph_ditanggung ? 'Grossup' : 'Dipotong'}
              highlight={employee.pph_ditanggung ? 'amber' : 'default'}
            />
            <Row
              label="Tipe Karyawan"
              value={employee.jenis_karyawan.replace(/_/g, ' ')}
            />
            {employee.upah_harian && (
              <Row label="Upah Harian" value={formatRupiah(employee.upah_harian)} />
            )}
            {employee.hari_kerja_default && (
              <Row label="Hari Kerja Default" value={`${employee.hari_kerja_default} hari`} />
            )}
          </div>
        </div>
      )}

      {/* PROYEKSI */}
      {activeTab === 'proyeksi' && employee.jenis_karyawan === 'tetap' && (
        <PayrollSimulator
          intro={
            <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-[13px] text-sky-900">
              <span className="font-semibold">Simulasi:</span> ubah angka apa pun untuk melihat dampak ke proyeksi 12 bulan.
              Perubahan tidak disimpan ke profil karyawan — klik <span className="font-semibold">Edit</span> di atas untuk menyimpan.
            </div>
          }
          initialValues={{
            gajiPokok:    employee.gaji_pokok,
            benefit:      employee.benefit ?? 0,
            kendaraan:    employee.kendaraan ?? 0,
            pulsa:        employee.pulsa ?? 0,
            operasional:  employee.operasional ?? 0,
            tunjLain:     employee.tunj_lain ?? 0,
            statusPtkp:   employee.status_ptkp,
            punyaNpwp:    !!employee.punya_npwp,
            jkkRate:      employee.jkk_rate,
            ikutJht:      !!employee.ikut_jht,
            ikutJp:       !!employee.ikut_jp,
            ikutJkp:      !!employee.ikut_jkp,
            tanggungJhtK: !!employee.tanggung_jht_k,
            tanggungJpK:  !!employee.tanggung_jp_k,
            ikutKes:      !!employee.ikut_kes,
            tanggungKesK: !!employee.tanggung_kes_k,
            pphDitanggung:!!employee.pph_ditanggung,
          }}
        />
      )}

      {/* EVENTS */}
      {activeTab === 'events' && (
        <div className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
              Variasi Bulanan{' '}
              <span className="text-[var(--text-muted)] font-normal">({events.length})</span>
            </h2>
            <button
              onClick={() => setShowEventModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              Tambah
            </button>
          </div>
          {events.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <FileText size={28} className="mx-auto text-[var(--text-faint)]" />
              <p className="mt-3 text-sm text-[var(--text-secondary)]">Belum ada variasi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Periode</th>
                    <th>Tipe</th>
                    <th className="text-right">Nilai</th>
                    <th>Keterangan</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id}>
                      <td className="font-mono">
                        {BULAN_NAMES[ev.bulan - 1]} {ev.tahun}
                      </td>
                      <td>
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${
                            EVENT_CHIP[ev.tipe] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
                          }`}
                        >
                          {ev.tipe.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="text-right font-mono font-semibold text-[var(--text-primary)]">
                        {formatRupiah(ev.nilai)}
                      </td>
                      <td className="text-[var(--text-muted)]">{ev.keterangan ?? '—'}</td>
                      <td className="text-right">
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="p-1.5 rounded text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          aria-label="Hapus variasi"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* RIWAYAT */}
      {activeTab === 'riwayat' && (
        <div className="bg-white border border-[var(--border-default)] rounded-xl overflow-hidden">
          {payrollHistory.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <FileText size={28} className="mx-auto text-[var(--text-faint)]" />
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                Belum ada riwayat payroll.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {payrollHistory.map((h) => {
                const run = h.payroll_runs;
                const status = run?.status ?? '—';
                const StatusIcon = RUN_STATUS_ICON[status] ?? Clock;
                const chip = RUN_STATUS_CHIP[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200';
                return (
                  <li key={h.id}>
                    <Link
                      href={`/companies/${companyId}/payroll/${run?.tahun}/${run?.bulan}`}
                      className="block px-5 py-4 hover:bg-[var(--bg-subtle)] transition-colors group"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="text-[15px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors">
                          {run ? `${BULAN_NAMES[run.bulan - 1]} ${run.tahun}` : '—'}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${chip}`}
                        >
                          <StatusIcon size={11} />
                          {status}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Metric label="Bruto" value={formatRupiah(h.bruto ?? 0)} />
                        <Metric label="PPh 21" value={formatRupiah(h.pph ?? 0)} tone="amber" />
                        <Metric label="BPJS Karyawan" value={formatRupiah(h.bpjs_karyawan ?? 0)} />
                        <Metric label="THP" value={formatRupiah(h.thp ?? 0)} tone="emerald" strong />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div
          className="fixed inset-0 bg-[var(--bg-overlay)] z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEditModal(false);
          }}
        >
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-5 py-4 border-b border-[var(--border-default)] flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-[var(--text-primary)] truncate">
                  Edit Karyawan — {employee.nama}
                </h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>
            <form action={handleUpdateEmployee} className="p-5 space-y-6">
              <div>
                <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--border-subtle)]">
                  Identitas Diri
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TF label="Nama Lengkap" name="nama" defaultValue={employee.nama} />
                  <NikInput label="NIK" name="nik" defaultValue={employee.nik} />
                  <NpwpInput label="NPWP" name="npwp" defaultValue={employee.npwp ?? ''} />
                  <SF label="Punya NPWP?" name="punya_npwp" defaultValue={employee.punya_npwp ? 'true' : 'false'}>
                    <option value="true">Ya (NPWP Valid)</option>
                    <option value="false">Tidak (+20% PPh)</option>
                  </SF>
                  <SF label="Status PTKP" name="status_ptkp" defaultValue={employee.status_ptkp}>
                    {['TK0', 'TK1', 'TK2', 'TK3', 'K0', 'K1', 'K2', 'K3'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </SF>
                  <SF label="Jenis Kelamin" name="jenis_kelamin" defaultValue={employee.jenis_kelamin}>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </SF>
                  <DateInput label="Tanggal Masuk" name="tanggal_masuk" defaultValue={employee.tanggal_masuk ?? ''} />
                  <DateInput label="Tanggal Keluar (Opsional)" name="tanggal_keluar" defaultValue={employee.tanggal_keluar ?? ''} />
                  <TF label="Jabatan" name="jabatan" defaultValue={employee.jabatan ?? ''} />
                  <div className="sm:col-span-2">
                    <TF label="Divisi" name="divisi" defaultValue={employee.divisi ?? ''} />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--border-subtle)]">
                  Kompensasi
                </h4>
                {employee.jenis_karyawan === 'tetap' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <NominalInput label="Gaji Pokok" name="gaji_pokok" defaultValue={employee.gaji_pokok} />
                    <NominalInput label="Benefit" name="benefit" defaultValue={employee.benefit} />
                    <NominalInput label="Kendaraan" name="kendaraan" defaultValue={employee.kendaraan} />
                    <NominalInput label="Pulsa" name="pulsa" defaultValue={employee.pulsa} />
                    <NominalInput label="Operasional" name="operasional" defaultValue={employee.operasional} />
                    <NominalInput label="Tunjangan Lain" name="tunj_lain" defaultValue={employee.tunj_lain} />
                  </div>
                ) : employee.jenis_karyawan === 'tidak_tetap_harian' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <NominalInput label="Upah Harian *" name="upah_harian" defaultValue={employee.upah_harian ?? 0} />
                    <TF
                      label="Hari Kerja Default"
                      name="hari_kerja_default"
                      defaultValue={String(employee.hari_kerja_default ?? 22)}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <NominalInput label="Upah Bulanan TT" name="upah_bulanan_tt" defaultValue={employee.upah_bulanan_tt ?? 0} />
                    <NominalInput label="Tunjangan TT" name="tunjangan_tt" defaultValue={employee.tunjangan_tt ?? 0} />
                  </div>
                )}
                <input type="hidden" name="jenis_karyawan" value={employee.jenis_karyawan} />
              </div>

              <div>
                <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--border-subtle)]">
                  BPJS Ketenagakerjaan & Kesehatan
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Kepesertaan
                    </p>
                    <div className="space-y-2.5">
                      <Chk name="ikut_jht" label="JHT" defaultChecked={employee.ikut_jht} />
                      <Chk name="ikut_jp" label="JP" defaultChecked={employee.ikut_jp} />
                      <Chk name="ikut_jkp" label="JKP" defaultChecked={employee.ikut_jkp} />
                      <Chk name="ikut_kes" label="Kesehatan" defaultChecked={employee.ikut_kes} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Tunjangan Iuran Karyawan
                    </p>
                    <div className="space-y-2.5">
                      <Chk name="tanggung_jht_k" label="Tunj. JHT Karyawan" defaultChecked={employee.tanggung_jht_k} />
                      <Chk name="tanggung_jp_k" label="Tunj. JP Karyawan" defaultChecked={employee.tanggung_jp_k} />
                      <Chk name="tanggung_kes_k" label="Tunj. Kes Karyawan" defaultChecked={employee.tanggung_kes_k} />
                    </div>
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
                <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--border-subtle)]">
                  Skema PPh 21
                </h4>
                <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-lg p-4 max-w-md">
                  <Chk
                    name="pph_ditanggung"
                    label="Grossup (PPh Ditanggung Perusahaan)"
                    defaultChecked={employee.pph_ditanggung}
                  />
                  <p className="text-[12px] text-[var(--text-muted)] mt-3 leading-relaxed">
                    Jika dicentang: THP karyawan = nominal gaji di atas (PPh menjadi beban
                    perusahaan). Jika tidak: PPh dipotong dari gaji karyawan.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                >
                  <Save size={14} />
                  {isSaving ? 'Menyimpan…' : 'Simpan Semua Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD EVENT MODAL */}
      {showEventModal && (
        <div
          className="fixed inset-0 bg-[var(--bg-overlay)] z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEventModal(false);
          }}
        >
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="px-5 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Tambah Variasi Bulanan
              </h3>
              <button
                onClick={() => setShowEventModal(false)}
                className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>
            <form action={handleAddEvent} className="p-5 space-y-4">
              <input type="hidden" name="employee_id" value={empId} />
              <input type="hidden" name="company_id" value={companyId} />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="tahun"
                    className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
                  >
                    Tahun
                  </label>
                  <input
                    id="tahun"
                    name="tahun"
                    type="number"
                    defaultValue={new Date().getFullYear()}
                    className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[15px] text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all font-mono"
                  />
                </div>
                <div>
                  <label
                    htmlFor="bulan"
                    className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
                  >
                    Bulan
                  </label>
                  <select
                    id="bulan"
                    name="bulan"
                    defaultValue={new Date().getMonth() + 1}
                    className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all"
                  >
                    {BULAN_NAMES.map((b, i) => (
                      <option key={i} value={i + 1}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label
                  htmlFor="tipe"
                  className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
                >
                  Tipe Variasi
                </label>
                <select
                  id="tipe"
                  name="tipe"
                  className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all"
                >
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
                <label
                  htmlFor="keterangan"
                  className="block text-[12px] font-semibold text-[var(--text-secondary)] mb-1.5"
                >
                  Keterangan
                </label>
                <textarea
                  id="keterangan"
                  name="keterangan"
                  rows={2}
                  className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
              >
                Simpan Variasi
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeeAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return (
    <div
      className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white shadow-sm"
      style={{ background: `hsl(${hue} 55% 48%)` }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

function Metric({
  label, value, tone, strong,
}: {
  label: string;
  value: string;
  tone?: 'amber' | 'emerald';
  strong?: boolean;
}) {
  const toneClass =
    tone === 'amber'   ? 'text-amber-700' :
    tone === 'emerald' ? 'text-emerald-700' :
    'text-[var(--text-secondary)]';
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
      <p className={`mt-0.5 font-mono ${strong ? 'font-bold' : 'font-semibold'} ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

export default function EmployeeDetailPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="h-64 bg-white border border-[var(--border-default)] rounded-xl animate-pulse" />
      }
    >
      <EmployeeDetailPage />
    </Suspense>
  );
}
