import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_DASHBOARD_ROUTES = ['/dashboard'];
const AUTH_ROUTES = ['/login', '/signup'];
const GUEST_COOKIE_NAME = 'markzo_guest';

/**
 * Decode the guest cookie payload WITHOUT verifying the HMAC signature.
 * This is intentional — we only need the expiry timestamp for the redirect UX.
 * The actual HMAC verification always happens server-side in API routes.
 */
function peekGuestExpiry(cookieValue: string): number | null {
  try {
    const [b64] = cookieValue.split('.');
    if (!b64) return null;
    // base64url → standard base64
    const standard = b64.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(standard, 'base64').toString('utf8');
    const parsed = JSON.parse(json) as { expires_at?: number };
    return typeof parsed.expires_at === 'number' ? parsed.expires_at : null;
  } catch {
    return null;
  }
}

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
  const isCommitteeRoute = pathname.startsWith('/committee/');
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  // Redirect unauthenticated users from dashboard
  if (isDashboard && !session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Committee routes: check guest session expiry for non-authenticated visitors
  if (isCommitteeRoute && !session) {
    const guestCookie = req.cookies.get(GUEST_COOKIE_NAME)?.value;
    if (guestCookie) {
      const expiresAt = peekGuestExpiry(guestCookie);
      if (expiresAt === null || Date.now() > expiresAt) {
        // Expired — redirect to login with expired flag
        const url = req.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('expired', '1');
        url.searchParams.set('redirect', pathname);
        return NextResponse.redirect(url);
      }
    }
    // No guest cookie: let API routes handle the 401 per-endpoint
  }

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
