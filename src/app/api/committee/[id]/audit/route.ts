import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createAdminClient } from '@supabase/supabase-js';
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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

  // Load committee details
  const [committeeRes, ebMembersRes, delegatesRes, marksheetRes, auditRes, marksCountRes] = await Promise.all([
    admin.from('committees').select('id, name, created_at, is_locked, locked_at, conference_id').eq('id', committeeId).single(),
    admin.from('eb_members').select('role, user_id, guest_name, is_owner, joined_at').eq('committee_id', committeeId),
    admin.from('delegates').select('id, name, created_at').eq('committee_id', committeeId).order('created_at'),
    admin.from('final_marksheets').select('computed_at, computed_by, computed_by_guest_name, is_edited_after_lock').eq('committee_id', committeeId).order('computed_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('mark_edits').select('id, edited_at, edited_by_guest_name, old_score, new_score, note, mark_id').eq('committee_id', committeeId).order('edited_at'),
    admin.from('marks').select('id', { count: 'exact' }).eq('committee_id', committeeId),
  ]);

  // Get conference name
  let conferenceName = '';
  if (committeeRes.data?.conference_id) {
    const { data: conf } = await admin
      .from('conferences')
      .select('name, created_at')
      .eq('id', committeeRes.data.conference_id)
      .single();
    if (conf) conferenceName = conf.name;
  }

  // Resolve EB member names
  const ebMembersRaw = ebMembersRes.data ?? [];
  const ebMembers: { role: string; name: string; is_owner: boolean; joined_at: string }[] = [];
  for (const m of ebMembersRaw) {
    if (m.guest_name) {
      ebMembers.push({ role: m.role, name: m.guest_name, is_owner: m.is_owner, joined_at: m.joined_at });
    } else if (m.user_id) {
      const { data: profile } = await admin
        .from('profiles')
        .select('display_name')
        .eq('id', m.user_id)
        .single();
      if (profile) {
        ebMembers.push({ role: m.role, name: profile.display_name, is_owner: m.is_owner, joined_at: m.joined_at });
      }
    }
  }

  const committee = committeeRes.data;
  const delegates = delegatesRes.data ?? [];
  const marksheet = marksheetRes.data;
  const auditLog = auditRes.data ?? [];
  const marksCount = marksCountRes.count ?? 0;

  // Build timeline events
  const timeline: {
    id: string;
    type: string;
    timestamp: string;
    description: string;
    actor?: string;
  }[] = [];

  if (committee?.created_at) {
    timeline.push({
      id: 'committee-created',
      type: 'created',
      timestamp: committee.created_at,
      description: `Committee "${committee.name}" created`,
      actor: ebMembers.find((m) => m.is_owner)?.name,
    });
  }

  // EB members joined
  for (const m of ebMembers) {
    timeline.push({
      id: `eb-${m.role}-${m.name}`,
      type: 'eb_joined',
      timestamp: m.joined_at,
      description: `${m.name} joined as ${m.role}`,
    });
  }

  // Delegates added (grouped)
  if (delegates.length > 0) {
    timeline.push({
      id: 'delegates-added',
      type: 'delegates',
      timestamp: delegates[0].created_at,
      description: `${delegates.length} delegate${delegates.length !== 1 ? 's' : ''} added`,
    });
  }

  // Marks summary
  if (marksCount > 0) {
    timeline.push({
      id: 'marks-entered',
      type: 'marks',
      timestamp: committee?.created_at ?? '',
      description: `${marksCount} mark entr${marksCount !== 1 ? 'ies' : 'y'} recorded`,
    });
  }

  // Compute
  if (marksheet?.computed_at) {
    timeline.push({
      id: 'computed',
      type: 'computed',
      timestamp: marksheet.computed_at,
      description: 'Final marksheet computed',
      actor: marksheet.computed_by_guest_name ?? 'Authenticated user',
    });
  }

  // Lock
  if (committee?.is_locked && committee.locked_at) {
    timeline.push({
      id: 'locked',
      type: 'locked',
      timestamp: committee.locked_at,
      description: 'Committee locked',
    });
  }

  // Post-lock edits
  for (const edit of auditLog) {
    timeline.push({
      id: `edit-${edit.id}`,
      type: 'post_lock_edit',
      timestamp: edit.edited_at,
      description: `Mark edited: ${edit.old_score} → ${edit.new_score}${edit.note ? ` (${edit.note})` : ''}`,
      actor: edit.edited_by_guest_name ?? 'Authenticated user',
    });
  }

  // Sort timeline chronologically
  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return NextResponse.json({
    conference_name: conferenceName,
    committee_name: committee?.name ?? '',
    is_locked: committee?.is_locked ?? false,
    eb_members: ebMembers,
    delegates: delegates.map((d) => ({ id: d.id, name: d.name })),
    timeline,
    audit_log: auditLog,
    marks_count: marksCount,
  });
}
