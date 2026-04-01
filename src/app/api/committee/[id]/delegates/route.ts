import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { verifyGuestSession, GUEST_COOKIE_NAME } from '@/lib/guest-session';
import { z } from 'zod';
import type { Database } from '@/types/database';

const updateDelegateSchema = z.object({
  delegate_id: z.string().uuid(),
  roll_call_status: z.enum(['present', 'present_and_voting', 'absent']).optional(),
  verbatim: z.string().max(20000).optional(),
  eb_remarks: z.string().max(2000).optional(),
});

function getClients(req: NextRequest) {
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
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return { supabase, admin };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, admin } = getClients(req);
  const committeeId = params.id;

  // Auth: user or guest
  const { data: { user } } = await supabase.auth.getUser();
  let authorized = false;

  if (user) {
    const { data: member } = await admin
      .from('eb_members')
      .select('id')
      .eq('committee_id', committeeId)
      .eq('user_id', user.id)
      .single();
    authorized = !!member;
  } else {
    const guestCookie = req.cookies.get(GUEST_COOKIE_NAME)?.value;
    if (guestCookie) {
      const session = verifyGuestSession(guestCookie);
      authorized = session?.committee_id === committeeId;
    }
  }

  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('delegates')
    .select('*')
    .eq('committee_id', committeeId)
    .order('name');

  if (error) return NextResponse.json({ error: 'Failed to fetch delegates' }, { status: 500 });

  return NextResponse.json({ delegates: data ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, admin } = getClients(req);
  const committeeId = params.id;

  const { data: { user } } = await supabase.auth.getUser();
  let authorized = false;

  if (user) {
    const { data: member } = await admin
      .from('eb_members')
      .select('id')
      .eq('committee_id', committeeId)
      .eq('user_id', user.id)
      .single();
    authorized = !!member;
  } else {
    const guestCookie = req.cookies.get(GUEST_COOKIE_NAME)?.value;
    if (guestCookie) {
      const session = verifyGuestSession(guestCookie);
      authorized = session?.committee_id === committeeId;
    }
  }

  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = updateDelegateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
  }

  const { delegate_id, ...updates } = result.data;

  // Verify delegate belongs to this committee
  const { data: delegate } = await admin
    .from('delegates')
    .select('id, committee_id')
    .eq('id', delegate_id)
    .single();

  if (!delegate || delegate.committee_id !== committeeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updatePayload: Partial<Database['public']['Tables']['delegates']['Update']> = {};
  if (updates.roll_call_status !== undefined) updatePayload.roll_call_status = updates.roll_call_status;
  if (updates.verbatim !== undefined) updatePayload.verbatim = updates.verbatim;
  if (updates.eb_remarks !== undefined) updatePayload.eb_remarks = updates.eb_remarks;

  const { error } = await admin
    .from('delegates')
    .update(updatePayload)
    .eq('id', delegate_id);

  if (error) return NextResponse.json({ error: 'Failed to update delegate' }, { status: 500 });

  return NextResponse.json({ success: true });
}
