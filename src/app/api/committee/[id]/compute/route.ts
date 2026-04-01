import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import type { Database } from '@/types/database';
import type { Json } from '@/types/database';

const lockSchema = z.object({
  action: z.enum(['compute', 'lock']),
  award_assignments: z.array(z.object({
    delegate_id: z.string().uuid(),
    award_tier: z.string().max(100),
    rank: z.number().int().positive(),
  })).optional(),
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

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(`compute:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { supabase, admin } = getClients(req);
  const committeeId = params.id;

  // Verify auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify user is owner of this committee
  const { data: member } = await admin
    .from('eb_members')
    .select('is_owner')
    .eq('committee_id', committeeId)
    .eq('user_id', user.id)
    .single();

  if (!member?.is_owner) {
    return NextResponse.json({ error: 'Only the committee owner can compute and lock' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = lockSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
  }

  const { action } = result.data;

  // Load all data needed for computation
  const [delegatesRes, schemaRes, marksRes, tiersRes] = await Promise.all([
    admin.from('delegates').select('*').eq('committee_id', committeeId),
    admin.from('marking_schema').select('*').eq('committee_id', committeeId).order('sort_order'),
    admin.from('marks').select('*').eq('committee_id', committeeId),
    admin.from('award_tiers').select('*').eq('committee_id', committeeId).order('sort_order'),
  ]);

  if (delegatesRes.error || schemaRes.error || marksRes.error || tiersRes.error) {
    return NextResponse.json({ error: 'Failed to load committee data' }, { status: 500 });
  }

  const delegates = delegatesRes.data ?? [];
  const schema = schemaRes.data ?? [];
  const marks = marksRes.data ?? [];
  const tiers = tiersRes.data ?? [];

  // Compute rankings
  const totals = delegates.map((d) => {
    const total = schema.reduce((sum, field) => {
      const fieldMarks = marks.filter(
        (m) => m.delegate_id === d.id && m.schema_field_id === field.id && m.counts_toward_final
      );
      if (fieldMarks.length === 0) return sum;
      if (field.scoring_mode === 'average') {
        const scores = fieldMarks.map((m) => m.score);
        return sum + scores.reduce((a, b) => a + b, 0) / scores.length;
      }
      return sum + fieldMarks.reduce((s, m) => s + m.score, 0);
    }, 0);

    // Per-field breakdown for snapshot
    const breakdown = schema.map((field) => {
      const fieldMarks = marks.filter(
        (m) => m.delegate_id === d.id && m.schema_field_id === field.id
      );
      return {
        field_id: field.id,
        field_name: field.field_name,
        score: fieldMarks.reduce((s, m) => s + (m.counts_toward_final ? m.score : 0), 0),
        item_count: fieldMarks.length,
      };
    });

    return { delegate: d, total, breakdown };
  });

  totals.sort((a, b) => b.total - a.total);

  const rankings = totals.map(({ delegate, total, breakdown }, i) => {
    const rank = i + 1;
    const tier = tiers.find(
      (t) => rank >= t.rank_from && rank < t.rank_from + t.num_awards
    );
    return {
      rank,
      delegate_id: delegate.id,
      name: delegate.name,
      country: delegate.country,
      total_score: total,
      award_tier: tier?.tier_name ?? null,
      breakdown,
    };
  });

  const awardAssignments = rankings
    .filter((r) => r.award_tier)
    .map((r) => ({
      delegate_id: r.delegate_id,
      award_tier: r.award_tier!,
      rank: r.rank,
    }));

  if (action === 'compute') {
    // Return computed results without locking
    return NextResponse.json({
      success: true,
      rankings,
      award_assignments: awardAssignments,
    });
  }

  // action === 'lock': save marksheet and lock committee
  const { error: marksheetError } = await admin.from('final_marksheets').insert({
    committee_id: committeeId,
    computed_by: user.id,
    delegate_rankings: rankings as unknown as Json,
    award_assignments: awardAssignments as unknown as Json,
  });

  if (marksheetError) {
    console.error('[compute] marksheet insert error:', marksheetError.message);
    return NextResponse.json({ error: 'Failed to save marksheet' }, { status: 500 });
  }

  // Lock the committee
  const { error: lockError } = await admin
    .from('committees')
    .update({
      is_locked: true,
      locked_at: new Date().toISOString(),
      locked_by: user.id,
    })
    .eq('id', committeeId);

  if (lockError) {
    console.error('[compute] lock error:', lockError.message);
    return NextResponse.json({ error: 'Failed to lock committee' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    locked: true,
    rankings,
    award_assignments: awardAssignments,
  });
}
