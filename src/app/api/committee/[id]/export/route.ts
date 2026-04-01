import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyGuestSession, GUEST_COOKIE_NAME } from '@/lib/guest-session';
import type { Database } from '@/types/database';

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

// GET: Return all data needed for PDF generation (client renders PDF)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(`export:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { supabase, admin } = getClients(req);
  const committeeId = params.id;

  // Auth check
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

  // Load all data — admin client to access access_code_hash is NOT included
  const [
    committeeRes,
    delegatesRes,
    schemaRes,
    marksRes,
    ebMembersRes,
    marksheetRes,
    auditRes,
    tiersRes,
  ] = await Promise.all([
    admin.from('committees')
      .select('id, name, is_locked, locked_at, conference_id')
      .eq('id', committeeId)
      .single(),
    admin.from('delegates').select('*').eq('committee_id', committeeId).order('name'),
    admin.from('marking_schema').select('*').eq('committee_id', committeeId).order('sort_order'),
    admin.from('marks').select('*').eq('committee_id', committeeId),
    admin.from('eb_members').select('role, user_id, guest_name').eq('committee_id', committeeId),
    admin.from('final_marksheets').select('*').eq('committee_id', committeeId).order('computed_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('mark_edits').select('id, edited_at, edited_by_guest_name, old_score, new_score, note').eq('committee_id', committeeId).order('edited_at'),
    admin.from('award_tiers').select('*').eq('committee_id', committeeId).order('sort_order'),
  ]);

  // Get conference name
  let conferenceName = 'Unknown Conference';
  if (committeeRes.data?.conference_id) {
    const { data: conf } = await admin
      .from('conferences')
      .select('name')
      .eq('id', committeeRes.data.conference_id)
      .single();
    if (conf) conferenceName = conf.name;
  }

  // Resolve EB member names
  const ebMembersRaw = ebMembersRes.data ?? [];
  const ebMemberNames: { role: string; name: string }[] = [];
  for (const m of ebMembersRaw) {
    if (m.guest_name) {
      ebMemberNames.push({ role: m.role, name: m.guest_name });
    } else if (m.user_id) {
      const { data: profile } = await admin
        .from('profiles')
        .select('display_name')
        .eq('id', m.user_id)
        .single();
      if (profile) ebMemberNames.push({ role: m.role, name: profile.display_name });
    }
  }

  const committee = committeeRes.data;
  const delegates = delegatesRes.data ?? [];
  const schema = schemaRes.data ?? [];
  const marks = marksRes.data ?? [];
  const marksheet = marksheetRes.data;
  const auditLog = auditRes.data ?? [];
  const tiers = tiersRes.data ?? [];
  const computedAt = marksheet?.computed_at ?? new Date().toISOString();

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

    const breakdown = schema.map((field) => {
      const fieldMarks = marks.filter(
        (m) => m.delegate_id === d.id && m.schema_field_id === field.id && m.counts_toward_final
      );
      const fieldScore = fieldMarks.length === 0
        ? 0
        : field.scoring_mode === 'average'
          ? fieldMarks.reduce((s, m) => s + m.score, 0) / fieldMarks.length
          : fieldMarks.reduce((s, m) => s + m.score, 0);

      return {
        field_id: field.id,
        field_name: field.field_name,
        field_type: field.field_type,
        max_score: field.max_score,
        scoring_mode: field.scoring_mode,
        score: fieldScore,
        item_count: fieldMarks.length,
      };
    });

    return { delegate: d, total, breakdown };
  });

  totals.sort((a, b) => b.total - a.total);

  const sheets = totals.map(({ delegate, total, breakdown }, i) => {
    const rank = i + 1;
    const tier = tiers.find(
      (t) => rank >= t.rank_from && rank < t.rank_from + t.num_awards
    );
    return {
      conference_name: conferenceName,
      committee_name: committee?.name ?? '',
      computed_at: computedAt,
      locked: committee?.is_locked ?? false,
      is_edited_after_lock: marksheet?.is_edited_after_lock ?? false,
      last_edited_at: marksheet?.last_edited_at,
      last_edited_by_name: marksheet?.last_edited_by_name,
      delegate_name: delegate.name,
      country: delegate.country,
      portfolio: delegate.portfolio,
      total_score: total,
      rank,
      award_tier: tier?.tier_name ?? null,
      fields: breakdown,
      verbatim: delegate.verbatim,
      eb_remarks: delegate.eb_remarks,
      eb_members: ebMemberNames,
    };
  });

  // Build award groupings for full marksheet
  const awardGroups = tiers.map((t) => ({
    award_tier: t.tier_name,
    delegates: totals
      .slice(t.rank_from - 1, t.rank_from - 1 + t.num_awards)
      .map((r) => r.delegate.name),
  }));

  return NextResponse.json({
    sheets,
    full_marksheet: {
      conference_name: conferenceName,
      committee_name: committee?.name ?? '',
      computed_at: computedAt,
      is_edited_after_lock: marksheet?.is_edited_after_lock ?? false,
      last_edited_at: marksheet?.last_edited_at,
      last_edited_by_name: marksheet?.last_edited_by_name,
      eb_members: ebMemberNames,
      rankings: totals.map(({ delegate, total, breakdown }, i) => ({
        rank: i + 1,
        name: delegate.name,
        country: delegate.country,
        total_score: total,
        award_tier: tiers.find((t) =>
          i + 1 >= t.rank_from && i + 1 < t.rank_from + t.num_awards
        )?.tier_name ?? null,
        breakdown: breakdown.map((b) => ({ field_name: b.field_name, score: b.score })),
      })),
      schema_fields: schema.map((f) => ({ id: f.id, field_name: f.field_name })),
      award_assignments: awardGroups,
    },
    audit_log: auditLog,
  });
}
