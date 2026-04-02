/**
 * Server-side auth resolution for API routes.
 *
 * Priority:
 *   1. Bearer token in Authorization header (reliable across all environments)
 *   2. Cookie-based session (standard Next.js SSR flow)
 *
 * Using the admin client to verify JWT tokens avoids any cookie-reading
 * issues that can occur in production environments.
 */
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import type { Database } from '@/types/database';

export interface AuthUser {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
}

function getAdminClient() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function resolveAuthUser(req: NextRequest): Promise<AuthUser | null> {
  // 1. Try Bearer token from Authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const admin = getAdminClient();
    const { data } = await admin.auth.getUser(token);
    if (data.user) {
      return {
        id: data.user.id,
        email: data.user.email ?? '',
        user_metadata: (data.user.user_metadata as Record<string, unknown>) ?? {},
      };
    }
  }

  // 2. Fall back to cookie-based session
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return req.cookies.get(name)?.value; },
        set() {},
        remove() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    return {
      id: user.id,
      email: user.email ?? '',
      user_metadata: (user.user_metadata as Record<string, unknown>) ?? {},
    };
  }

  return null;
}

/**
 * Build auth headers to include on client-side fetch calls.
 * Call this from any client component that needs to hit a protected API route.
 */
export function buildAuthHeaders(accessToken: string | null | undefined): HeadersInit {
  if (!accessToken) return {};
  return { Authorization: `Bearer ${accessToken}` };
}
