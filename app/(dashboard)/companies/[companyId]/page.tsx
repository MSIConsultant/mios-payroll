'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Company, Employee } from '@/lib/types';
import { Users, Plus, Search, ArrowLeft, ChevronRight, Calendar, Edit2, X, Save, Download } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { updateCompany } from '@/lib/actions/companies';
import { NpwpCompanyInput } from '@/components/ui/FormattedInput';
import { toast } from 'sonner';
import { Download } from 'lucide-react'; // add to existing lucide import

const BULAN = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function TF({ label, name, defaultValue, placeholder }: { label: string; name: string; defaultValue?: string; placeholder?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">{label}</label>
      <input name={name} type="text" defaultValue={defaultValue} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className="w-full px-3 py-2.5 bg-[#0D0D0F] border rounded-lg text-sm text-zinc-200 placeholder:text-zinc-700 outline-none transition-colors font-mono"
        style={{ borderColor: focused ? 'rgba(37,99,235,0.4)' : '#1A1A1C' }} />
    </div>
  );
}

export default function CompanyDetailPage() {
  const { companyId } = useParams();
  const router = useRouter();
  const [company, setCompany]       = useState<Company | null>(null);
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [lastRun, setLastRun]       = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [showEdit, setShowEdit]     = useState(false);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const [{ data: co }, { data: emps }, { data: run }] = await Promise.all([
        supabase.from('companies').select('*').eq('id', companyId).single(),
        supabase.from('employees').select('*').eq('company_id', companyId).eq('aktif', true).order('nama'),
        supabase.from('payroll_runs').select('*').eq('company_id', companyId)
          .order('tahun', { ascending: false }).order('bulan', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (co) setCompany(co);
      if (emps) setEmployees(emps);
      if (run) setLastRun(run);
      setLoading(false);
    }
    if (companyId) fetchData();
  }, [companyId]);

  async function handleEditCompany(formData: FormData) {
    setSaving(true);
    const res = await updateCompany(companyId as string, formData);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('Data perusahaan diperbarui');
      setShowEdit(false);
      // Refresh company data
      const supabase = createClient();
      const { data } = await supabase.from('companies').select('*').eq('id', companyId).single();
      if (data) setCompany(data);
    }
    setSaving(false);
  }

  async function handleArchive() {
    if (!company) return;
    const action = company.aktif ? 'mengarsipkan' : 'mengaktifkan';
    if (!confirm(`Yakin ingin ${action} perusahaan ini?`)) return;
    const { archiveCompany } = await import('@/lib/actions/companies');
    const res = await archiveCompany(company.id, !company.aktif);
    if (res.error) toast.error(res.error);
    else {
      toast.success(company.aktif ? 'Perusahaan diarsipkan' : 'Perusahaan diaktifkan');
      setCompany(c => c ? { ...c, aktif: !c.aktif } : c);
    }
  }

  const filtered = employees.filter(e =>
    e.nama.toLowerCase().includes(search.toLowerCase()) ||
    e.nik.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3,4].map(i => <div key={i} className="h-14 bg-[#111113] border border-[#1A1A1C] rounded-lg animate-pulse" />)}
    </div>
  );
  if (!company) return <div className="text-zinc-600 text-sm">Perusahaan tidak ditemukan.</div>;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/companies"
            className="w-9 h-9 bg-[#111113] border border-[#1A1A1C] rounded-lg flex items-center justify-center text-zinc-600 hover:text-zinc-200 transition-colors">
            <ArrowLeft size={15} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-zinc-100">{company.name}</h1>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border ${
                company.aktif
                  ? 'bg-green-900/25 text-green-400 border-green-900/40'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700'
              }`}>{company.aktif ? 'Aktif' : 'Arsip'}</span>
            </div>
            <p className="text-[11px] text-zinc-600 mt-0.5">{company.industri ?? '—'} · {company.kota ?? '—'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#111113] border border-[#1A1A1C] text-zinc-500 rounded-lg text-xs font-bold uppercase tracking-widest hover:text-zinc-200 hover:border-zinc-600 transition-colors">
            <Edit2 size={13} />
            Edit
          </button>
          <button onClick={handleArchive}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#111113] border border-[#1A1A1C] text-zinc-500 rounded-lg text-xs font-bold uppercase tracking-widest hover:text-zinc-200 transition-colors">
            {company.aktif ? 'Archive' : 'Restore'}
          </button>
          <Link href={`/companies/${companyId}/payroll`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#111113] border border-[#1A1A1C] text-zinc-400 rounded-lg text-xs font-bold uppercase tracking-widest hover:border-[#2563EB]/30 hover:text-zinc-200 transition-colors">
            <Calendar size={13} />
            Payroll
          </Link>
          
          <Link href={`/companies/${companyId}/import`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#111113] border border-[#1A1A1C] text-zinc-500 rounded-lg text-xs font-bold uppercase tracking-widest hover:text-zinc-200 hover:border-zinc-600 transition-colors">
            <Download size={13} />
            Import Excel
          </Link>

          <Link href={`/companies/${companyId}/employees/new`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-[#0A0A0B] rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#1D4ED8] transition-colors">
            <Plus size={13} />
            Karyawan
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">Karyawan Aktif</p>
          <p className="text-4xl font-bold text-zinc-100 font-mono">{employees.length}</p>
        </div>
        <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">Payroll Terakhir</p>
          <p className="text-xl font-bold text-zinc-100">{lastRun ? `${BULAN[lastRun.bulan]} ${lastRun.tahun}` : '—'}</p>
          {lastRun && <p className="text-[10px] text-zinc-600 uppercase tracking-widest mt-1">{lastRun.status}</p>}
        </div>
        <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">Est. Bruto Bulanan</p>
          <p className="text-xl font-bold text-zinc-100 font-mono">
            {formatRupiah(employees.reduce((a, e) => a + (e.gaji_pokok ?? 0) + (e.benefit ?? 0), 0))}
          </p>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#1A1A1C] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={13} className="text-zinc-600" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">KaryHere is the fully integrated file. I have replaced the old "Import" button with Claude's exact "Import Excel" button right before the "Karyawan" button as requested.

```tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Company, Employee } from '@/lib/types';
import { Users, Plus, Search, ArrowLeft, ChevronRight, Calendar, Edit2, X, Save } from 'lucide-react';
import { formatRupiah } from '@/lib/format';
import { updateCompany } from '@/lib/actions/companies';
import { NpwpCompanyInput } from '@/components/ui/FormattedInput';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { Download } from 'lucide-react';

const BULAN = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function TF({ label, name, defaultValue, placeholder }: { label: string; name: string; defaultValue?: string; placeholder?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">{label}</label>
      <input name={name} type="text" defaultValue={defaultValue} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className="w-full px-3 py-2.5 bg-[#0D0D0F] border rounded-lg text-sm text-zinc-200 placeholder:text-zinc-700 outline-none transition-colors font-mono"
        style={{ borderColor: focused ? 'rgba(37,99,235,0.4)' : '#1A1A1C' }} />
    </div>
  );
}

export default function CompanyDetailPage() {
  const { companyId } = useParams();
  const router = useRouter();
  const [company, setCompany]       = useState<Company null |>(null);
  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [lastRun, setLastRun]       = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [showEdit, setShowEdit]     = useState(false);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const [{ data: co }, { data: emps }, { data: run }] = await Promise.all([
        supabase.from('companies').select('*').eq('id', companyId).single(),
        supabase.from('employees').select('*').eq('company_id', companyId).eq('aktif', true).order('nama'),
        supabase.from('payroll_runs').select('*').eq('company_id', companyId)
          .order('tahun', { ascending: false }).order('bulan', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (co) setCompany(co);
      if (emps) setEmployees(emps);
      if (run) setLastRun(run);
      setLoading(false);
    }
    if (companyId) fetchData();
  }, [companyId]);

  async function handleEditCompany(formData: FormData) {
    setSaving(true);
    const res = await updateCompany(companyId as string, formData);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('Data perusahaan diperbarui');
      setShowEdit(false);
      // Refresh company data
      const supabase = createClient();
      const { data } = await supabase.from('companies').select('*').eq('id', companyId).single();
      if (data) setCompany(data);
    }
    setSaving(false);
  }

  async function handleArchive() {
    if (!company) return;
    const action = company.aktif ? 'mengarsipkan' : 'mengaktifkan';
    if (!confirm(`Yakin ingin ${action} perusahaan ini?`)) return;
    const { archiveCompany } = await import('@/lib/actions/companies');
    const res = await archiveCompany(company.id, !company.aktif);
    if (res.error) toast.error(res.error);
    else {
      toast.success(company.aktif ? 'Perusahaan diarsipkan' : 'Perusahaan diaktifkan');
      setCompany(c => c ? { ...c, aktif: !c.aktif } : c);
    }
  }

  const filtered = employees.filter(e =>
    e.nama.toLowerCase().includes(search.toLowerCase()) ||
    e.nik.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3,4].map(i => <div key={i} className="h-14 bg-[#111113] border border-[#1A1A1C] rounded-lg animate-pulse" />)}
    </div>
  );
  if (!company) return <div className="text-zinc-600 text-sm">Perusahaan tidak ditemukan.</div>;

  return (
    <div className="max-w-4xl space-y-6">
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link className="w-9 h-9 bg-[#111113] border border-[#1A1A1C] rounded-lg flex items-center justify-center text-zinc-600 hover:text-zinc-200 transition-colors" href="/companies">
            <ArrowLeft size="{15}"/>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-zinc-100">{company.name}</h1>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border ${
                company.aktif
                  ? 'bg-green-900/25 text-green-400 border-green-900/40'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700'
              }`}>{company.aktif ? 'Aktif' : 'Arsip'}</span>
            </div>
            <p className="text-[11px] text-zinc-600 mt-0.5">{company.industri ?? '—'} · {company.kota ?? '—'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#111113] border border-[#1A1A1C] text-zinc-500 rounded-lg text-xs font-bold uppercase tracking-widest hover:text-zinc-200 hover:border-zinc-600 transition-colors">
            <Edit2 size="{13}"/>
            Edit
          </button>
          <button onClick={handleArchive}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#111113] border border-[#1A1A1C] text-zinc-500 rounded-lg text-xs font-bold uppercase tracking-widest hover:text-zinc-200 transition-colors">
            {company.aktif ? 'Archive' : 'Restore'}
          </button>
          <Link className="inline-flex items-center gap-2 px-4 py-2 bg-[#111113] border border-[#1A1A1C] text-zinc-400 rounded-lg text-xs font-bold uppercase tracking-widest hover:border-[#2563EB]/30 hover:text-zinc-200 transition-colors" href="{`/companies/${companyId}/payroll`}">
            <Calendar size="{13}"/>
            Payroll
          </Link>
          <Link '1px 'var(--bg-card)', 'var(--text-muted)' background: border: className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors" color: href="{`/companies/${companyId}/import`}" solid style="{{" var(--border-default)', }}>
            <Download size="{13}"/>
            Import Excel
          </Link>
          <Link className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-[#0A0A0B] rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#1D4ED8] transition-colors" href="{`/companies/${companyId}/employees/new`}">
            <Plus size="{13}"/>
            Karyawan
          </Link>
        </div>
      </div>

      
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">Karyawan Aktif</p>
          <p className="text-4xl font-bold text-zinc-100 font-mono">{employees.length}</p>
        </div>
        <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">Payroll Terakhir</p>
          <p className="text-xl font-bold text-zinc-100">{lastRun ? `${BULAN[lastRun.bulan]} ${lastRun.tahun}` : '—'}</p>
          {lastRun && <p className="text-[10px] text-zinc-600 uppercase tracking-widest mt-1">{lastRun.status}</p>}
        </div>
        <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">Est. Bruto Bulanan</p>
          <p className="text-xl font-bold text-zinc-100 font-mono">
            {formatRupiah(employees.reduce((a, e) => a + (e.gaji_pokok ?? 0) + (e.benefit ?? 0), 0))}
          </p>
        </div>
      </div>

      
      <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#1A1A1C] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="text-zinc-600" size="{13}"/>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Karyawan</span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-700" size="{11}"/>
            <input type="text" placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-7 pr-3 py-1.5 bg-[#0D0D0F] border border-[#1A1A1C] rounded text-xs text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-[#2563EB]/30 transition-colors w-40" />
          </div>
        </div>

        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="border-b border-[#1A1A1C] text-[10px] uppercase tracking-widest text-zinc-700">
              <th className="px-5 py-3 text-left">Nama</th>
              <th className="px-5 py-3 text-left">Tipe</th>
              <th className="px-5 py-3 text-left">PTKP / NPWP</th>
              <th className="px-5 py-3 text-right">Gaji Pokok</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-zinc-700">
                {search ? 'Tidak ditemukan' : 'Belum ada karyawan — tambah di atas'}
              </td></tr>
            ) : filtered.map(emp => (
              <tr key={emp.id} onClick={() => router.push(`/companies/${companyId}/employees/${emp.id}`)}
                className="border-b border-[#131315] hover:bg-[#131315] cursor-pointer transition-colors group">
                <td className="px-5 py-3.5">
                  <p className="text-zinc-200 font-bold text-xs uppercase group-hover:text-[#2563EB] transition-colors">{emp.nama}</p>
                  <p className="text-zinc-700 text-[10px]">#{emp.nik}</p>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${
                    emp.jenis_karyawan === 'tetap' ? 'bg-sky-900/25 text-sky-400' : 'bg-zinc-800 text-zinc-500'
                  }`}>{emp.jenis_karyawan === 'tetap' ? 'Tetap' : 'TT'}</span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">{emp.status_ptkp}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                      emp.punya_npwp ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20'
                    }`}>{emp.punya_npwp ? 'NPWP ✓' : 'NO NPWP'}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span className="text-base font-bold text-zinc-300">{formatRupiah(emp.gaji_pokok)}</span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <ChevronRight className="text-zinc-700 group-hover:text-zinc-400 inline transition-colors" size="{13}"/>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      
      {showEdit && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111113] border border-[#1A1A1C] rounded-lg w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1A1A1C] flex items-center justify-between bg-[#0F0F11]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 font-mono">Edit Perusahaan</p>
              <button onClick={() => setShowEdit(false)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                <X size="{16}"/>
              </button>
            </div>
            <form action={async (fd) => { await handleEditCompany(fd); }} className="p-5 space-y-4">
              <TF defaultValue="{company.name}" label="Nama Perusahaan *" name="name" placeholder="PT Bangun Jaya Abadi"/>
              <NpwpCompanyInput ''} ?? defaultValue="{company.npwp_perusahaan" label="NPWP Perusahaan" name="npwp_perusahaan"/>
              <div className="grid grid-cols-2 gap-4">
                <TF ''} ?? defaultValue="{company.industri" label="Industri" name="industri" placeholder="Manufaktur"/>
                <TF ''} ?? defaultValue="{company.kota" label="Kota" name="kota" placeholder="Jakarta"/>
              </div>
              <TF ''} ?? defaultValue="{company.alamat" label="Alamat" name="alamat" placeholder="Alamat lengkap"/>
              <div className="flex justify-end gap-3 pt-2 border-t border-[#1A1A1C]">
                <button type="button" onClick={() => setShowEdit(false)}
                  className="px-4 py-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Batal</button>
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-2 bg-[#2563EB] text-[#0A0A0B] px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors">
                  <Save size="{13}"/>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
