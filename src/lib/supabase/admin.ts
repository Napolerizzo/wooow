import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Service role client — SERVER SIDE ONLY. Never import from client components.
// Used for admin operations that bypass RLS (e.g., access code verification).
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const adminClient = getAdminClient();
