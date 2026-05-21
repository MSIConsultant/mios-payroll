'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import MiosLogo from '@/components/ui/MiosLogo';
import { toast } from 'sonner';
import { ArrowRight, Upload, UserPlus, Check, Loader2 } from 'lucide-react';

type Step = 'workspace' | 'company' | 'setup' | 'done';

function Progress({ step }: { step: Step }) {
  const steps: Step[] = ['workspace', 'company', 'setup', 'done'];
  const idx = steps.indexOf(step);
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((s, i) => {
        const reached = i <= idx;
        const completed = i < idx;
        return (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all ${
                reached
                  ? 'bg-[var(--brand)] text-white ring-2 ring-[var(--brand-ring)]'
                  : 'bg-white text-[var(--text-faint)] ring-1 ring-[var(--border-default)]'
              }`}
            >
              {completed ? <Check size={13} /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-px transition-colors ${
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

function TF({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-[var(--text-secondary)] mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 bg-white border border-[var(--border-default)] rounded-lg text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)] transition-all"
      />
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('workspace');
  const [loading, setLoading] = useState(false);
  const [wsName, setWsName] = useState('');
  const [coName, setCoName] = useState('');
  const [coNpwp, setCoNpwp] = useState('');
  const [coKota, setCoKota] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [companyId, setCompanyId] = useState('');

  async function handleCreateWorkspace() {
    if (!wsName.trim()) {
      toast.error('Nama workspace wajib diisi');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Sesi habis, silakan login ulang');
      return;
    }

    const { data: ws, error } = await supabase.rpc('create_workspace_for_user', {
      p_name: wsName.trim(),
      p_owner_id: user.id,
      p_owner_email: user.email,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    await supabase
      .from('user_profiles')
      .update({
        workspace_id: ws,
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .neq('role', 'dev');

    setWorkspaceId(ws);
    setLoading(false);
    setStep('company');
  }

  async function handleCreateCompany() {
    if (!coName.trim()) {
      toast.error('Nama perusahaan wajib diisi');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data: co, error } = await supabase
      .from('companies')
      .insert({
        workspace_id: workspaceId,
        name: coName.trim(),
        npwp_perusahaan: coNpwp || null,
        kota: coKota || null,
        aktif: true,
      })
      .select('id')
      .single();
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setCompanyId(co.id);
    setLoading(false);
    setStep('setup');
  }

  function handleSkipCompany() {
    setStep('setup');
  }

  function handleSetupChoice(choice: 'import' | 'manual' | 'skip') {
    if (choice === 'import') router.push('/import/new');
    else if (choice === 'manual' && companyId)
      router.push(`/companies/${companyId}/employees/new`);
    else setStep('done');
  }

  const setupOptions = [
    {
      key: 'import' as const,
      icon: Upload,
      title: 'Import dari Excel',
      desc: 'Upload file Grossup_PPh_21 yang sudah ada. Paling cepat untuk data histori.',
      recommended: true,
      tint: 'bg-blue-50 text-blue-700',
    },
    {
      key: 'manual' as const,
      icon: UserPlus,
      title: 'Input Manual',
      desc: 'Tambah karyawan satu per satu. Cocok untuk perusahaan baru.',
      recommended: false,
      tint: 'bg-violet-50 text-violet-700',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="flex justify-center mb-8">
          <MiosLogo size="md" showWordmark />
        </div>

        <div className="bg-white border border-[var(--border-default)] rounded-2xl shadow-sm overflow-hidden">
          <div className="px-7 pt-7 pb-2">
            <Progress step={step} />
          </div>

          {step === 'workspace' && (
            <div className="px-7 pb-7 space-y-5">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                  Buat Workspace
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Workspace adalah ruang kerja Anda. Berikan nama yang mencerminkan bisnis Anda.
                </p>
              </div>
              <TF
                label="Nama Workspace"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                placeholder="MSI Accounting, PT Pajak Jaya, dll."
              />
              <button
                onClick={handleCreateWorkspace}
                disabled={loading || !wsName.trim()}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm cursor-pointer"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    Buat Workspace
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          )}

          {step === 'company' && (
            <div className="px-7 pb-7 space-y-5">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                  Tambah Perusahaan Klien
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Tambah perusahaan klien pertama. Anda bisa tambah lebih banyak nanti.
                </p>
              </div>
              <TF
                label="Nama Perusahaan *"
                value={coName}
                onChange={(e) => setCoName(e.target.value)}
                placeholder="PT Grahaexcel Indonesia"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TF
                  label="NPWP Perusahaan"
                  value={coNpwp}
                  onChange={(e) => setCoNpwp(e.target.value)}
                  placeholder="00.000.000.0-000.000"
                />
                <TF
                  label="Kota"
                  value={coKota}
                  onChange={(e) => setCoKota(e.target.value)}
                  placeholder="Jakarta"
                />
              </div>
              <button
                onClick={handleCreateCompany}
                disabled={loading || !coName.trim()}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm cursor-pointer"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    Tambah Perusahaan
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
              <button
                onClick={handleSkipCompany}
                className="w-full py-2 text-[13px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                Lewati, tambah nanti →
              </button>
            </div>
          )}

          {step === 'setup' && (
            <div className="px-7 pb-7 space-y-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                  Setup Karyawan
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Bagaimana Anda ingin memasukkan data karyawan?
                </p>
              </div>
              {setupOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleSetupChoice(opt.key)}
                  disabled={opt.key === 'manual' && !companyId}
                  className="w-full p-4 rounded-xl text-left bg-white border border-[var(--border-default)] hover:border-[var(--border-strong)] hover:shadow-sm transition-all disabled:opacity-50 group cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${opt.tint}`}
                    >
                      <opt.icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[15px] text-[var(--text-primary)] group-hover:text-[var(--brand)] transition-colors">
                          {opt.title}
                        </p>
                        {opt.recommended && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
                            Direkomendasikan
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-[var(--text-muted)] mt-1 leading-relaxed">
                        {opt.desc}
                      </p>
                    </div>
                    <ArrowRight
                      size={16}
                      className="mt-1 text-[var(--text-faint)] group-hover:text-[var(--brand)] group-hover:translate-x-0.5 transition-all"
                    />
                  </div>
                </button>
              ))}
              <button
                onClick={() => handleSetupChoice('skip')}
                className="w-full py-2 text-[13px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                Lewati, setup nanti →
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="px-7 pb-7 text-center space-y-5">
              <div className="w-16 h-16 rounded-full mx-auto bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center">
                <Check size={28} className="text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                  Siap!
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Workspace <strong className="text-[var(--text-primary)]">{wsName}</strong>{' '}
                  berhasil dibuat.
                  {coName && (
                    <>
                      {' '}
                      Perusahaan{' '}
                      <strong className="text-[var(--text-primary)]">{coName}</strong> telah
                      ditambahkan.
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-2.5 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold transition-colors shadow-sm cursor-pointer"
              >
                Buka Dashboard →
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-[var(--text-muted)] mt-6 font-mono">
          PP 58/2023 · PMK 168/2023 · PPh 21 TER
        </p>
      </div>
    </div>
  );
}
