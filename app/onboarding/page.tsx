'use client';
import { useState } from 'react';
import { createWorkspace } from '@/lib/actions/workspace';
import { MiosLogoAuth } from '@/components/ui/MiosLogo';


export default function OnboardingPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true); setError(null);
    const result = await createWorkspace(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      // Manually redirect since createWorkspace no longer does it
      window.location.href = '/dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-[#080809] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="animate-scanline absolute inset-0 w-full h-8 bg-white/[0.02] pointer-events-none z-0" />
      <div className="absolute inset-0 z-0" style={{
        backgroundImage: 'linear-gradient(rgba(37,99,235,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8 animate-fade-in-up stagger-1">
          <MiosLogoAuth />
          <p className="text-sm font-bold text-zinc-300 mt-5">Buat Workspace Pertama Anda</p>
        </div>

        <div className="bg-[#0A0A0B] border border-[#1A1A1C] rounded-lg overflow-hidden animate-fade-in-up stagger-2"
          style={{ boxShadow: '0 0 60px rgba(0,0,0,0.8)' }}>
          <div className="px-4 py-2.5 bg-[#0F0F11] border-b border-[#1A1A1C] flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            <span className="ml-3 text-[10px] text-zinc-700 font-mono uppercase tracking-widest">workspace.init</span>
            <span className="ml-1 text-[#2563EB] animate-blink font-mono text-xs">_</span>
          </div>

          <form action={handleSubmit} className="p-6 space-y-5 font-mono">
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-800/30 rounded text-xs text-red-400 animate-fade-in">
                <span className="text-red-500">ERR </span>{error}
              </div>
            )}

            <div className="animate-fade-in-up stagger-3">
              <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">
                <span className="text-[#2563EB]">→</span> Nama Workspace
              </label>
              <input name="name" type="text" required
                placeholder="Contoh: KAP MSI & Rekan"
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                className="w-full px-3 py-2.5 bg-[#0D0D0F] border rounded-lg text-sm text-zinc-200 placeholder:text-zinc-800 outline-none transition-all duration-300"
                style={{ borderColor: focused ? 'rgba(37,99,235,0.5)' : '#1A1A1C' }} />
              <p className="mt-2 text-[10px] text-zinc-700 leading-relaxed">
                Workspace adalah ruang kerja bersama. Anda bisa mengundang rekan akuntan setelah ini.
              </p>
            </div>

            <div className="animate-fade-in-up stagger-4">
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-lg font-bold text-xs uppercase tracking-widest transition-all duration-300 relative overflow-hidden group disabled:opacity-50"
                style={{ background: loading ? '#1A1A1C' : '#2563EB', color: loading ? '#666' : '#0A0A0B' }}>
                <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }} />
                <span className="relative">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3 h-3 border border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
                      Membuat workspace...
                    </span>
                  ) : '$ buat workspace →'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
