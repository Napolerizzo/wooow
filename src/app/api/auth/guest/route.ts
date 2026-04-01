import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guestAccessSchema } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildGuestCookie, type GuestSession } from '@/lib/guest-session';
import type { Database } from '@/types/database';
import bcrypt from 'bcryptjs';

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(`guest:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = guestAccessSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? 'Validation error' },
      { status: 400 }
    );
  }

  const { access_code, guest_name } = result.data;
  const admin = getAdminClient();

  // Look up committee by access_code (plaintext, for initial lookup)
  // Never expose access_code_hash to client
  const { data: committee, error: lookupError } = await admin
    .from('committees')
    .select('id, name, access_code_hash, is_locked')
    .eq('access_code', access_code)
    .single();

  if (lookupError || !committee) {
    // Generic error — never reveal whether code exists or not
    return NextResponse.json({ error: 'Invalid access code.' }, { status: 401 });
  }

  // Verify the access code against the stored bcrypt hash
  const isValid = await bcrypt.compare(access_code, committee.access_code_hash);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid access code.' }, { status: 401 });
  }

  // Build signed guest session cookie
  const session: GuestSession = {
    committee_id: committee.id,
    guest_name,
    expires_at: Date.now() + 24 * 60 * 60 * 1000,
  };

  const cookieHeader = buildGuestCookie(session);

  const response = NextResponse.json(
    {
      success: true,
      committee_id: committee.id,
      committee_name: committee.name,
    },
    { status: 200 }
  );

  response.headers.append('Set-Cookie', cookieHeader);
  return response;
}
