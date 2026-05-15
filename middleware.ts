import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const DEV_EMAIL   = 'msiconsultant.international@gmail.com';
const PUBLIC_PATHS = [
  '/login', '/register', '/invite', '/auth', '/oauth',
  '/forgot-password', '/reset-password', '/share', '/pending-approval',
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
            || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cs) => {
        cs.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cs.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));
  const isDevPath = pathname.startsWith('/dev');

  // Not logged in → login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Logged in → check approval status
  if (user && !isPublic) {
    const { data: profile } = await supabase
      .from('user_profiles').select('status, role').eq('id', user.id).single();

    // No profile yet (race condition after register) → pending
    if (!profile) {
      if (pathname !== '/pending-approval') {
        const u = request.nextUrl.clone();
        u.pathname = '/pending-approval';
        return NextResponse.redirect(u);
      }
      return response;
    }

    // Rejected or suspended
    if (profile.status === 'rejected' || profile.status === 'suspended') {
      if (pathname !== '/pending-approval') {
        const u = request.nextUrl.clone();
        u.pathname = '/pending-approval';
        return NextResponse.redirect(u);
      }
      return response;
    }

    // Pending approval
    if (profile.status === 'pending_approval') {
      if (pathname !== '/pending-approval') {
        const u = request.nextUrl.clone();
        u.pathname = '/pending-approval';
        return NextResponse.redirect(u);
      }
      return response;
    }

    // After the approval check, before the end of the function:
    // Dev with no workspace → skip onboarding, go to dashboard
    if (
      user.email?.toLowerCase() === DEV_EMAIL.toLowerCase() &&
      pathname === '/onboarding'
    ) {
      const u = request.nextUrl.clone();
      u.pathname = '/dev/admin';
      return NextResponse.redirect(u);
    }

    // Staff trying to access accountant-only paths
    if (profile.role === 'staff') {
      const staffBlocked = ['/settings', '/dev', '/logs', '/staff'];
      if (staffBlocked.some(p => pathname.startsWith(p))) {
        const u = request.nextUrl.clone();
        u.pathname = '/dashboard';
        return NextResponse.redirect(u);
      }
    }
  }

  // Logged in, on login/register → redirect to dashboard
  if (user && (pathname === '/login' || pathname === '/register')) {
    const u = request.nextUrl.clone();
    u.pathname = '/';
    u.search = '';
    return NextResponse.redirect(u);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
