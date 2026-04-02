import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveAuthUser } from '@/lib/api-auth';
import { z } from 'zod';
import type { Database } from '@/types/database';

const ebMemberSchema = z.object({
  role: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
});

const awardTierSchema = z.object({
  tier_name: z.string().trim().min(1).max(100),
  num_awards: z.number().int().positive(),
});

const delegateInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  country: z.string().trim().max(100).optional(),
  portfolio: z.string().trim().max(100).optional(),
});

const createCommitteeSchema = z.object({
  conference_name: z.string().trim().min(1).max(150),
  committee_name: z.string().trim().min(1).max(150),
  eb_members: z.array(ebMemberSchema).min(1).max(20),
  award_tiers: z.array(awardTierSchema).max(10),
  delegates: z.array(delegateInputSchema).max(500),
});

function getAdminClient() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(`create-committee:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const user = await resolveAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getAdminClient();

  // Ensure the profile row exists before inserting a conference.
  // conferences.created_by is a FK → profiles.id.
  await admin.from('profiles').upsert(
    {
      id: user.id,
      email: user.email,
      display_name: (user.user_metadata.display_name as string | undefined) ?? user.email ?? 'Unknown',
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );

  // Body size limit: 50KB
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 50_000) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = createCommitteeSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? 'Validation error' },
      { status: 400 }
    );
  }

  const { conference_name, committee_name, eb_members, award_tiers, delegates } = result.data;

  // 1. Create or find conference
  let conferenceId: string;
  const { data: existingConf } = await admin
    .from('conferences')
    .select('id')
    .eq('name', conference_name)
    .eq('created_by', user.id)
    .single();

  if (existingConf) {
    conferenceId = existingConf.id;
  } else {
    const { data: newConf, error: confError } = await admin
      .from('conferences')
      .insert({ name: conference_name, created_by: user.id })
      .select('id')
      .single();

    if (confError || !newConf) {
      console.error('[create-committee] conference insert error:', confError?.message);
      return NextResponse.json({ error: 'Failed to create conference' }, { status: 500 });
    }
    conferenceId = newConf.id;
  }

  // 2. Generate access code locally (HMAC-SHA256 + bcrypt)
  const { createHmac, randomBytes } = await import('crypto');
  const secret = process.env.ACCESS_CODE_SECRET!;
  const salt = randomBytes(16).toString('hex');
  const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const hmacHex = createHmac('sha256', secret).update(`committee:${salt}`).digest('hex');
  let accessCode = '';
  for (let i = 0; i < 8; i++) {
    const byte = parseInt(hmacHex.slice(i * 2, i * 2 + 2), 16);
    accessCode += CHARSET[byte % CHARSET.length];
  }
  const bcrypt = await import('bcryptjs');
  const accessCodeHash = await bcrypt.hash(accessCode, 12);

  // 3. Create committee
  const { data: committee, error: committeeError } = await admin
    .from('committees')
    .insert({
      conference_id: conferenceId,
      name: committee_name,
      access_code: accessCode,
      access_code_hash: accessCodeHash,
    })
    .select('id')
    .single();

  if (committeeError || !committee) {
    console.error('[create-committee] committee insert error:', committeeError?.message);
    return NextResponse.json({ error: 'Failed to create committee' }, { status: 500 });
  }

  const committeeId = committee.id;

  // 4. Add EB members (creator is owner)
  const ebInserts = eb_members.map((m, i) => ({
    committee_id: committeeId,
    user_id: i === 0 ? user.id : null, // creator takes first slot
    guest_name: i === 0 ? null : m.name,
    role: m.role,
    is_owner: i === 0,
  }));

  // Always ensure the creator is an eb_member (as owner)
  const ownerMember = {
    committee_id: committeeId,
    user_id: user.id,
    guest_name: null,
    role: eb_members[0].role,
    is_owner: true,
  };

  const otherMembers = eb_members.slice(1).map((m) => ({
    committee_id: committeeId,
    user_id: null,
    guest_name: m.name,
    role: m.role,
    is_owner: false,
  }));

  void ebInserts; // we use the split approach below
  const { error: ebError } = await admin
    .from('eb_members')
    .insert([ownerMember, ...otherMembers]);

  if (ebError) {
    console.error('[create-committee] eb_members insert error:', ebError.message);
    // Non-fatal — committee was created
  }

  // 5. Add award tiers with rank_from computed
  if (award_tiers.length > 0) {
    let rankFrom = 1;
    const tierInserts = award_tiers.map((t, i) => {
      const insert = {
        committee_id: committeeId,
        tier_name: t.tier_name,
        num_awards: t.num_awards,
        rank_from: rankFrom,
        sort_order: i,
      };
      rankFrom += t.num_awards;
      return insert;
    });

    const { error: tierError } = await admin.from('award_tiers').insert(tierInserts);
    if (tierError) {
      console.error('[create-committee] award_tiers insert error:', tierError.message);
    }
  }

  // 6. Add delegates
  if (delegates.length > 0) {
    const delegateInserts = delegates.map((d) => ({
      committee_id: committeeId,
      name: d.name,
      country: d.country ?? null,
      portfolio: d.portfolio ?? null,
    }));

    const { error: delegateError } = await admin.from('delegates').insert(delegateInserts);
    if (delegateError) {
      console.error('[create-committee] delegates insert error:', delegateError.message);
    }
  }

  return NextResponse.json(
    {
      success: true,
      committee_id: committeeId,
      access_code: accessCode, // shown once only
    },
    { status: 201 }
  );
}

// GET: list committees for the authenticated user
export async function GET(req: NextRequest) {
  const user = await resolveAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use admin client so RLS doesn't block the nested join
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('eb_members')
    .select(`
      committee_id,
      role,
      is_owner,
      committees (
        id,
        name,
        is_locked,
        created_at,
        conferences (
          id,
          name
        )
      )
    `)
    .eq('user_id', user.id);

  if (error) {
    console.error('[get-committees] error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch committees' }, { status: 500 });
  }

  return NextResponse.json({ committees: data ?? [] });
}
