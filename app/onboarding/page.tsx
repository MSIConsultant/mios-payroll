'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import MiosLogo from '@/components/ui/MiosLogo';
import { toast } from 'sonner';
import { Building2, ArrowRight, Upload, UserPlus, Check } from 'lucide-react';

type Step = 'workspace' | 'company' | 'setup' | 'done';

function Progress({ step }: { step: Step }) {
  const steps: Step[] = ['workspace', 'company', 'setup', 'done'];
  const idx = steps.indexOf(step);
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black transition-all"
            style={{
              background: i <= idx ? '#2563EB' : 'var(--bg-card)',
              border:     `2px solid ${i <= idx ? '#2563EB' : 'var(--border-default)'}`,
              color:      i <= idx ? '#fff' : 'var(--text-ghost)',
            }}>
            {i < idx ? <Check size={11} /> : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className="w-8 h-px" style={{ background: i < idx ? '#2563EB' : 'var(--border-default)' }} />
          )}
        </div>
      ))}
    </div>
  );
}

function TF({ label, name, value, onChange, placeholder, type = 'text' }: any) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-widest mb-2"
        style={{ color: 'var(--text-muted)' }}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        className="w-full px-4 py-3 rounded-xl text-[15px] outline-none transition-colors"
        style={{
          background:  'var(--bg-input)',
          border:      `1px solid ${focused ? 'rgba(37,99,235,0.5)' : 'var(--border-default)'}`,
          color:       'var(--text-primary)',
        }} />
    </div>
  );
}

export default function OnboardingPage() {
  const router  = useRouter();
  const [step, setStep]           = useState<Step>('workspace');
  const [loading, setLoading]     = useState(false);
  const [wsName, setWsName]       = useState('');
  const [coName, setCoName]       = useState('');
  const [coNpwp, setCoNpwp]       = useState('');
  const [coKota, setCoKota]       = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [companyId, setCompanyId]   = useState('');

  async function handleCreateWorkspace() {
    if (!wsName.trim()) { toast.error('Nama workspace wajib diisi'); return; }
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Sesi habis, silakan login ulang'); return; }

    const { data: ws, error } = await supabase.rpc('create_workspace_for_user', {
      p_name: wsName.trim(), p_owner_id: user.id, p_owner_email: user.email,
    });

    if (error) { toast.error(error.message); setLoading(false); return; }

    // Update user profile with workspace
    await supabase.from('user_profiles')
      .update({ workspace_id: ws, role: 'accountant', status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', user.id);

    setWorkspaceId(ws);
    setLoading(false);
    setStep('company');
  }

  async function handleCreateCompany() {
    if (!coName.trim()) { toast.error('Nama perusahaan wajib diisi'); return; }
    setLoading(true);
    const supabase = createClient();
    const { data: co, error } = await supabase
      .from('companies')
      .insert({ workspace_id: workspaceId, name: coName.trim(), npwp_perusahaan: coNpwp || null, kota: coKota || null, aktif: true })
      .select('id').single();
    if (error) { toast.error(error.message); setLoading(false); return; }
    setCompanyId(co.id);
    setLoading(false);
    setStep('setup');
  }

  async function handleSkipCompany() {
    setStep('setup');
  }

  function handleSetupChoice(choice: 'import' | 'manual' | 'skip') {
    if (choice === 'import') router.push('/import/new');
    else if (choice === 'manual' && companyId) router.push(`/companies/${companyId}/employees/new`);
    else { setStep('done'); }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0" style={{
        backgroundImage: 'linear-gradient(rgba(37,99,235,0.008) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.008) 1px, transparent 1px)',
        backgroundSize: '52px 52px',
      }} />
      <div className="relative z-10 w-full max-w-md animate-fade-in-up">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <MiosLogo size="md" showWordmark />
        </div>

        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
          <div className="px-8 pt-8 pb-4">
            <Progress step={step} />
          </div>

          {/* ── STEP 1: Workspace ── */}
          {step === 'workspace' && (
            <div className="px-8 pb-8 space-y-5">
              <div>
                <h2 className="text-[22px] font-black" style={{ color: 'var(--text-primary)' }}>
                  Buat Workspace
                </h2>
                <p className="text-[14px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Workspace adalah ruang kerja Anda. Berikan nama yang mencerminkan bisnis Anda.
                </p>
              </div>
              <TF
                label="Nama Workspace"
                value={wsName}
                onChange={(e: any) => setWsName(e.target.value)}
                placeholder="MSI Accounting, PT Pajak Jaya, dll."
              />
              <button onClick={handleCreateWorkspace} disabled={loading || !wsName.trim()}
                className="w-full py-3.5 rounded-xl font-black text-[15px] text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                style={{ background: '#2563EB' }}>
                {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Buat Workspace <ArrowRight size={16} /></>}
              </button>
            </div>
          )}

          {/* ── STEP 2: Company ── */}
          {step === 'company' && (
            <div className="px-8 pb-8 space-y-5">
              <div>
                <h2 className="text-[22px] font-black" style={{ color: 'var(--text-primary)' }}>
                  Tambah Perusahaan Klien
                </h2>
                <p className="text-[14px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Tambah perusahaan klien pertama. Anda bisa tambah lebih banyak nanti.
                </p>
              </div>
              <TF label="Nama Perusahaan *" value={coName} onChange={(e: any) => setCoName(e.target.value)} placeholder="PT Grahaexcel Indonesia" />
              <div className="grid grid-cols-2 gap-3">
                <TF label="NPWP Perusahaan" value={coNpwp} onChange={(e: any) => setCoNpwp(e.target.value)} placeholder="00.000.000.0-000.000" />
                <TF label="Kota" value={coKota} onChange={(e: any) => setCoKota(e.target.value)} placeholder="Jakarta" />
              </div>
              <button onClick={handleCreateCompany} disabled={loading || !coName.trim()}
                className="w-full py-3.5 rounded-xl font-black text-[15px] text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: '#2563EB' }}>
                {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Tambah Perusahaan <ArrowRight size={16} /></>}
              </button>
              <button onClick={handleSkipCompany}
                className="w-full py-2 text-[13px] transition-colors" style={{ color: 'var(--text-ghost)' }}>
                Lewati, tambah nanti →
              </button>
            </div>
          )}

          {/* ── STEP 3: Setup method ── */}
          {step === 'setup' && (
            <div className="px-8 pb-8 space-y-4">
              <div>
                <h2 className="text-[22px] font-black" style={{ color: 'var(--text-primary)' }}>
                  Setup Karyawan
                </h2>
                <p className="text-[14px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Bagaimana Anda ingin memasukkan data karyawan?
                </p>
              </div>
              {[
                {
                  key:   'import',
                  icon:  Upload,
                  title: 'Import dari Excel',
                  desc:  'Upload file Grossup_PPh_21 yang sudah ada. Paling cepat untuk data histori.',
                  recommended: true,
                  color: '#3B82F6',
                },
                {
                  key:   'manual',
                  icon:  UserPlus,
                  title: 'Input Manual',
                  desc:  'Tambah karyawan satu per satu. Cocok untuk perusahaan baru.',
                  recommended: false,
                  color: '#A78BFA',
                },
              ].map(opt => (
                <button key={opt.key}
                  onClick={() => handleSetupChoice(opt.key as any)}
                  disabled={opt.key === 'manual' && !companyId}
                  className="w-full p-5 rounded-xl text-left transition-all disabled:opacity-40 group"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${opt.color}18`, border: `1px solid ${opt.color}30` }}>
                      <opt.icon size={16} style={{ color: opt.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-[15px]" style={{ color: 'var(--text-primary)' }}>{opt.title}</p>
                        {opt.recommended && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                            style={{ background: 'rgba(37,99,235,0.15)', color: '#3B82F6' }}>
                            Direkomendasikan
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                    </div>
                    <ArrowRight size={16} style={{ color: 'var(--text-ghost)' }} className="mt-1 group-hover:text-[#3B82F6] transition-colors" />
                  </div>
                </button>
              ))}
              <button onClick={() => handleSetupChoice('skip')}
                className="w-full py-2 text-[13px] transition-colors" style={{ color: 'var(--text-ghost)' }}>
                Lewati, setup nanti →
              </button>
            </div>
          )}

          {/* ── STEP 4: Done ── */}
          {step === 'done' && (
            <div className="px-8 pb-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)' }}>
                <Check size={28} className="text-green-400" />
              </div>
              <div>
                <h2 className="text-[22px] font-black" style={{ color: 'var(--text-primary)' }}>Siap!</h2>
                <p className="text-[14px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Workspace <strong>{wsName}</strong> berhasil dibuat.
                  {coName && <> Perusahaan <strong>{coName}</strong> telah ditambahkan.</>}
                </p>
              </div>
              <button onClick={() => router.push('/dashboard')}
                className="w-full py-3.5 rounded-xl font-black text-[15px] text-white"
                style={{ background: '#2563EB' }}>
                Buka Dashboard →
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] mt-6 font-mono" style={{ color: 'var(--text-ghost)' }}>
          PP 58/2023 · PMK 168/2023 · PPh 21 TER
        </p>
      </div>
    </div>
  );
}
