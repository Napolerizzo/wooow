import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import type { Database } from '@/types/database';

const subCriterionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  max: z.number().min(0),
});

const schemaFieldSchema = z.object({
  id: z.string().uuid().optional(),
  field_name: z.string().trim().min(1).max(100),
  field_type: z.enum(['speech', 'chit', 'poi', 'poi_reply', 'documentation', 'roll_call', 'custom']),
  max_score: z.number().min(0),
  scoring_mode: z.enum(['absolute', 'average']),
  max_items_total: z.number().int().positive().nullable(),
  max_items_count: z.number().int().positive().nullable(),
  sub_criteria: z.array(subCriterionSchema).nullable(),
  sort_order: z.number().int().min(0),
});

const putSchemaSchema = z.object({
  fields: z.array(schemaFieldSchema).max(50),
});

function getSupabaseClients(req: NextRequest) {
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

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!checkRateLimit(`schema:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { supabase, admin } = getSupabaseClients(req);

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const committeeId = params.id;

  // Verify user is EB member of this committee
  const { data: member } = await admin
    .from('eb_members')
    .select('id')
    .eq('committee_id', committeeId)
    .eq('user_id', user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check committee is not locked
  const { data: committee } = await admin
    .from('committees')
    .select('is_locked')
    .eq('id', committeeId)
    .single();

  if (!committee) {
    return NextResponse.json({ error: 'Committee not found' }, { status: 404 });
  }
  if (committee.is_locked) {
    return NextResponse.json({ error: 'Committee is locked' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = putSchemaSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? 'Validation error' },
      { status: 400 }
    );
  }

  const { fields } = result.data;

  // Delete existing schema rows for this committee, then re-insert
  // This is simpler than upsert and handles reordering cleanly
  const { error: deleteError } = await admin
    .from('marking_schema')
    .delete()
    .eq('committee_id', committeeId);

  if (deleteError) {
    console.error('[schema] delete error:', deleteError.message);
    return NextResponse.json({ error: 'Failed to update schema' }, { status: 500 });
  }

  if (fields.length > 0) {
    const inserts = fields.map((f) => ({
      committee_id: committeeId,
      field_name: f.field_name,
      field_type: f.field_type,
      max_score: f.max_score,
      scoring_mode: f.scoring_mode,
      max_items_total: f.max_items_total,
      max_items_count: f.max_items_count,
      sub_criteria: f.sub_criteria && f.sub_criteria.length > 0 ? f.sub_criteria : null,
      sort_order: f.sort_order,
    }));

    const { error: insertError } = await admin
      .from('marking_schema')
      .insert(inserts);

    if (insertError) {
      console.error('[schema] insert error:', insertError.message);
      return NextResponse.json({ error: 'Failed to save schema' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase } = getSupabaseClients(req);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('marking_schema')
    .select('*')
    .eq('committee_id', params.id)
    .order('sort_order');

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch schema' }, { status: 500 });
  }

  return NextResponse.json({ schema: data ?? [] });
}
