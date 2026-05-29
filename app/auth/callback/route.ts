import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Reject any `next` value that could redirect off-domain. Only allow
// same-site relative paths starting with a single `/`. Without this guard
// a crafted `?next=//evil.com` or `?next=\\evil.com` could send the
// authenticated user to an attacker-controlled site after sign-in.
function safeNext(raw: string | null): string {
  if (!raw) return '/'
  if (!raw.startsWith('/')) return '/'
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/'
  return raw
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = safeNext(requestUrl.searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${requestUrl.origin}${next}`)
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}/login?error=Invalid+or+expired+confirmation+link`)
}
