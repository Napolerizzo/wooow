import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database';

// Browser-side Supabase client — uses anon key, relies on RLS
export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
