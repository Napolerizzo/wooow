import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_DASHBOARD_ROUTES = ['/dashboard'];
const PROTECTED_COMMITTEE_ROUTES = ['/committee'];
const AUTH_ROUTES = ['/login', '/signup'];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // ─── Security Headers ────────────────────────────────────────────────────
  res.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // unsafe-eval required for Three.js / React Three Fiber shader compilation
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src https://fonts.gstatic.com data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "img-src 'self' data: blob:",
      "worker-src blob:",
    ].join('; ')
  );
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  const { pathname } = req.nextUrl;

  // ─── Supabase session refresh ─────────────────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          res.cookies.set(name, value, options as any);
        },
        remove(name: string, options: Record<string, unknown>) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          res.cookies.set(name, '', options as any);
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isDashboard = PROTECTED_DASHBOARD_ROUTES.some((r) =>
    pathname.startsWith(r)
  );
  // Committee routes allow guest access — validated per-route
  void PROTECTED_COMMITTEE_ROUTES;
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  // Redirect unauthenticated users from dashboard
  if (isDashboard && !session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Committee routes: allow guests through — guest cookie validated per-route
  // Authenticated users pass through normally

  // Redirect already-authenticated users from auth pages
  if (isAuthRoute && session) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
