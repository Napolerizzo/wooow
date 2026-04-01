import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyGuestSession, GUEST_COOKIE_NAME } from '@/lib/guest-session';
import { z } from 'zod';
import type { Database } from '@/types/database';

const upsertMarkSchema = z.object({
  delegate_id: z.string().uuid(),
  schema_field_id: z.string().uuid(),
  committee_id: z.string().uuid(),
  item_index: z.number().int().min(1).default(1),
  sub_criterion: z.string().trim().max(100).nullable().optional(),
  score: z.number().min(0),
  counts_toward_final: z.boolean().default(true),
  post_lock_note: z.string().trim().max(500).optional(), // only used post-lock
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function resolveIdentity(req: NextRequest, _admin: unknown) {
  const { supabase } = getClients(req);
  const { data: { user } } = await supabase.auth.getUser();

  if (user) return { userId: user.id, guestName: null };

  // Check guest cookie
  const guestCookie = req.cookies.get(GUEST_COOKIE_NAME)?.value;
  if (guestCookie) {
    const session = verifyGuestSession(guestCookie);
    if (session) return { userId: null, guestName: session.guest_name, guestCommitteeId: session.committee_id };
  }

  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(`marks:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { admin } = getClients(req);
  const committeeId = params.id;

  const identity = await resolveIdentity(req, admin);
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Guest: verify their committee matches
  if (identity.guestName && (identity as { guestCommitteeId?: string }).guestCommitteeId !== committeeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Authenticated user: verify EB membership
  if (identity.userId) {
    const { data: member } = await admin
      .from('eb_members')
      .select('id')
      .eq('committee_id', committeeId)
      .eq('user_id', identity.userId)
      .single();
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = upsertMarkSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? 'Validation error' },
      { status: 400 }
    );
  }

  const { delegate_id, schema_field_id, item_index, sub_criterion, score, counts_toward_final, post_lock_note } = result.data;

  // Verify delegate belongs to this committee (prevent cross-committee writes)
  const { data: delegate } = await admin
    .from('delegates')
    .select('id, committee_id')
    .eq('id', delegate_id)
    .single();

  if (!delegate || delegate.committee_id !== committeeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verify schema field belongs to this committee
  const { data: schemaField } = await admin
    .from('marking_schema')
    .select('id, committee_id, max_score')
    .eq('id', schema_field_id)
    .single();

  if (!schemaField || schemaField.committee_id !== committeeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Validate score doesn't exceed max
  if (score > schemaField.max_score) {
    return NextResponse.json(
      { error: `Score exceeds maximum of ${schemaField.max_score}` },
      { status: 400 }
    );
  }

  // Check if committee is locked
  const { data: committee } = await admin
    .from('committees')
    .select('is_locked')
    .eq('id', committeeId)
    .single();

  if (!committee) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (committee.is_locked) {
    // Post-lock edit: find existing mark and append to mark_edits
    const subCriterionValue = sub_criterion ?? null;
    let postLockQuery = admin
      .from('marks')
      .select('id, score')
      .eq('delegate_id', delegate_id)
      .eq('schema_field_id', schema_field_id)
      .eq('committee_id', committeeId)
      .eq('item_index', item_index);
    if (subCriterionValue === null) {
      postLockQuery = postLockQuery.is('sub_criterion', null);
    } else {
      postLockQuery = postLockQuery.eq('sub_criterion', subCriterionValue);
    }
    const { data: existingMark } = await postLockQuery.maybeSingle();

    if (existingMark && existingMark.score !== score) {
      // Log audit entry
      const { error: editError } = await admin.from('mark_edits').insert({
        mark_id: existingMark.id,
        committee_id: committeeId,
        edited_by: identity.userId,
        edited_by_guest_name: identity.guestName,
        old_score: existingMark.score,
        new_score: score,
        note: post_lock_note ?? null,
      });

      if (editError) {
        console.error('[marks] mark_edits insert error:', editError.message);
        return NextResponse.json({ error: 'Failed to log edit' }, { status: 500 });
      }

      // Update the mark itself (last-write-wins)
      await admin
        .from('marks')
        .update({
          score,
          marked_by: identity.userId,
          marked_by_guest_name: identity.guestName,
        })
        .eq('id', existingMark.id);
    }

    // Also update final_marksheet is_edited_after_lock
    await admin
      .from('final_marksheets')
      .update({
        is_edited_after_lock: true,
        last_edited_at: new Date().toISOString(),
        last_edited_by_name: identity.guestName ?? 'authenticated user',
      })
      .eq('committee_id', committeeId);

    return NextResponse.json({ success: true, post_lock: true });
  }

  // Pre-lock: upsert mark
  const { data: existingMark } = await admin
    .from('marks')
    .select('id')
    .eq('delegate_id', delegate_id)
    .eq('schema_field_id', schema_field_id)
    .eq('committee_id', committeeId)
    .eq('item_index', item_index)
    .maybeSingle();

  if (existingMark) {
    const { error } = await admin
      .from('marks')
      .update({
        score,
        counts_toward_final,
        sub_criterion: sub_criterion ?? null,
        marked_by: identity.userId,
        marked_by_guest_name: identity.guestName,
      })
      .eq('id', existingMark.id);

    if (error) {
      console.error('[marks] update error:', error.message);
      return NextResponse.json({ error: 'Failed to save mark' }, { status: 500 });
    }
    return NextResponse.json({ success: true, id: existingMark.id });
  } else {
    const { data: newMark, error } = await admin
      .from('marks')
      .insert({
        delegate_id,
        schema_field_id,
        committee_id: committeeId,
        item_index,
        sub_criterion: sub_criterion ?? null,
        score,
        counts_toward_final,
        marked_by: identity.userId,
        marked_by_guest_name: identity.guestName,
      })
      .select('id')
      .single();

    if (error || !newMark) {
      console.error('[marks] insert error:', error?.message);
      return NextResponse.json({ error: 'Failed to save mark' }, { status: 500 });
    }
    return NextResponse.json({ success: true, id: newMark.id });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, admin } = getClients(req);
  const committeeId = params.id;

  const identity = await resolveIdentity(req, admin);
  if (!identity) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (identity.guestName && (identity as { guestCommitteeId?: string }).guestCommitteeId !== committeeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('marks')
    .select('*')
    .eq('committee_id', committeeId);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch marks' }, { status: 500 });
  }

  return NextResponse.json({ marks: data ?? [] });
}
