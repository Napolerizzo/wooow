import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyGuestSession, GUEST_COOKIE_NAME } from '@/lib/guest-session';
import { z } from 'zod';
import type { Database } from '@/types/database';

function getClients(req: NextRequest) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(n: string) { return req.cookies.get(n)?.value; }, set() {}, remove() {} } }
  );
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return { supabase, admin };
}

async function resolveIdentity(req: NextRequest, committeeId: string) {
  const { supabase, admin } = getClients(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: member } = await admin.from('eb_members').select('id').eq('committee_id', committeeId).eq('user_id', user.id).single();
    if (member) return { ok: true };
  }
  const guestCookie = req.cookies.get(GUEST_COOKIE_NAME)?.value;
  if (guestCookie) {
    const session = verifyGuestSession(guestCookie);
    if (session?.committee_id === committeeId) return { ok: true };
  }
  return null;
}

// GET: fetch recognition types + entries for committee
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const committeeId = params.id;
  const { admin } = getClients(req);
  const identity = await resolveIdentity(req, committeeId);
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [typesRes, entriesRes] = await Promise.all([
    admin.from('recognition_types').select('*').eq('committee_id', committeeId).order('sort_order'),
    admin.from('recognition_entries').select('*').eq('committee_id', committeeId),
  ]);

  return NextResponse.json({
    types: typesRes.data ?? [],
    entries: entriesRes.data ?? [],
  });
}

const upsertTypeSchema = z.object({
  action: z.literal('upsert_type'),
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(50),
  sort_order: z.number().int().min(0).optional(),
});
const deleteTypeSchema = z.object({
  action: z.literal('delete_type'),
  id: z.string().uuid(),
});
const upsertEntrySchema = z.object({
  action: z.literal('upsert_entry'),
  delegate_id: z.string().uuid(),
  recognition_type_id: z.string().uuid(),
  count: z.number().int().min(0),
});

// POST: upsert type / delete type / upsert entry
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(`recog:${ip}`, 120, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const committeeId = params.id;
  const { admin } = getClients(req);
  const identity = await resolveIdentity(req, committeeId);
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const actionField = (body as { action?: string }).action;

  if (actionField === 'upsert_type') {
    const r = upsertTypeSchema.safeParse(body);
    if (!r.success) return NextResponse.json({ error: r.error.issues[0]?.message }, { status: 400 });
    const { id, name, sort_order } = r.data;
    if (id) {
      const { error } = await admin.from('recognition_types').update({ name, sort_order: sort_order ?? 0 }).eq('id', id).eq('committee_id', committeeId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await admin.from('recognition_types').insert({ committee_id: committeeId, name, sort_order: sort_order ?? 0 });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (actionField === 'delete_type') {
    const r = deleteTypeSchema.safeParse(body);
    if (!r.success) return NextResponse.json({ error: r.error.issues[0]?.message }, { status: 400 });
    const { error } = await admin.from('recognition_types').delete().eq('id', r.data.id).eq('committee_id', committeeId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (actionField === 'upsert_entry') {
    const r = upsertEntrySchema.safeParse(body);
    if (!r.success) return NextResponse.json({ error: r.error.issues[0]?.message }, { status: 400 });
    const { delegate_id, recognition_type_id, count } = r.data;
    const { error } = await admin.from('recognition_entries').upsert(
      { committee_id: committeeId, delegate_id, recognition_type_id, count, updated_at: new Date().toISOString() },
      { onConflict: 'delegate_id,recognition_type_id' }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
