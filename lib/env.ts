export function hasSupabaseEnv() {
  return (
    typeof process !== 'undefined' &&
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'YOUR_SUPABASE_URL'
  );
}

// Canonical app URL used for outbound links (invites, emails). Prefers the
// explicit NEXT_PUBLIC_APP_URL; falls back to Vercel's auto-injected VERCEL_URL
// (which is the per-deployment URL, fine for preview branches). Returns null
// when neither is set so callers can fail fast with a clear message instead of
// silently generating wrong-domain links.
export function getAppUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return null;
}
