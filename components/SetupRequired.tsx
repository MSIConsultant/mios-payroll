export default function SetupRequired() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4 text-[#E4E4E7]">
      <div className="max-w-xl w-full bg-[#0A0A0B] rounded-none shadow-2xl p-8 border border-[#27272A]">
        <h2 className="text-2xl font-serif italic text-red-500 mb-2">MIOS Payroll Setup Required</h2>
        <p className="text-sm text-zinc-400 mb-6 font-mono">
          To enable full functionality for MIOS Payroll, you must configure your Supabase environment. 
          The redirection issue (localhost) occurs because your Supabase &quot;Site URL&quot; is not yet set to your Vercel URL.
        </p>

        <div className="bg-[#0E0E10] p-6 font-mono text-xs mb-6 overflow-x-auto border border-[#27272A] space-y-4">
          <div>
            <span className="text-zinc-500 block uppercase tracking-widest font-bold mb-1">Step 1: Environment Variables</span>
            <p className="text-zinc-400 mb-2">Add these in your AI Studio Settings or Vercel Environment Variables:</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-[#18181B] p-2 border border-[#27272A]">
                <code className="text-[#2563EB]">NEXT_PUBLIC_SUPABASE_URL</code>
                <span className="text-zinc-600">Your Project URL</span>
              </div>
              <div className="flex justify-between items-center bg-[#18181B] p-2 border border-[#27272A]">
                <code className="text-[#2563EB]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
                <span className="text-zinc-600">Publishable API Key</span>
              </div>
            </div>
          </div>

          <div>
            <span className="text-zinc-500 block uppercase tracking-widest font-bold mb-1">Step 2: URL Configuration (Crucial)</span>
            <p className="text-zinc-400 mb-2">In Supabase Dashboard (Auth -{">"} URL Configuration):</p>
            <ul className="list-disc pl-4 space-y-1 text-zinc-300">
              <li>Set <span className="text-white">Site URL</span> to your Vercel URL (e.g. <code className="bg-[#18181B] px-1 text-xs">https://mios-payroll.vercel.app</code>)</li>
              <li>Add <span className="text-white">Redirect URI</span>: <code className="bg-[#18181B] px-1 text-xs">https://.../auth/callback</code></li>
            </ul>
          </div>
        </div>

        <div className="bg-[#18181B] border border-red-900/30 p-4 text-xs text-zinc-300 mb-6 font-mono leading-relaxed">
          <p className="font-bold text-[#2563EB] mb-2 uppercase tracking-widest text-[10px]">Note on Authentication:</p>
          If you are seeing &quot;localhost&quot; when clicking verification links, it means Supabase is using the default development URL. Update the &quot;Site URL&quot; in Supabase Auth settings to fix this instantly.
        </div>
        
        <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 text-center">
          Refresh this page after applying the settings.
        </p>
      </div>
    </div>
  )
}
