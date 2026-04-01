import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { signUpSchema } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';
import type { Database } from '@/types/database';

// Use service role for signup so we can insert the profile after auth creation
function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  // Rate limit: 10 requests per IP per minute
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(`signup:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = signUpSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? 'Validation error' },
      { status: 400 }
    );
  }

  const { email, password, display_name } = result.data;
  const admin = getAdminClient();

  // Create the auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    user_metadata: { display_name },
    email_confirm: true, // skip email confirmation for now
  });

  if (authError || !authData.user) {
    // Never reveal whether the email already exists
    console.error('[signup] auth error:', authError?.message);
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 400 });
  }

  // Profile is auto-created by the handle_new_user trigger.
  // But if the trigger fails, ensure the profile exists.
  const { error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: authData.user.id,
      email,
      display_name,
    });

  if (profileError) {
    console.error('[signup] profile upsert error:', profileError.message);
    // Non-fatal — trigger should have handled it
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
