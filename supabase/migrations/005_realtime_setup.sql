-- =============================================================================
-- REALTIME SETUP
-- Enable Supabase Realtime publication for live sync tables
-- and set REPLICA IDENTITY FULL so UPDATE events include all columns.
-- =============================================================================

-- Add tables to supabase_realtime publication
-- (safe to run multiple times — Supabase ignores if already added)
alter publication supabase_realtime add table public.marks;
alter publication supabase_realtime add table public.delegates;
alter publication supabase_realtime add table public.committees;

-- REPLICA IDENTITY FULL: ensures UPDATE and DELETE events carry the full old row
-- so Supabase Realtime can include complete payloads (needed for reliable filtering
-- and for clients to match rows without refetching).
alter table public.marks      replica identity full;
alter table public.delegates  replica identity full;
alter table public.committees replica identity full;

-- Unique constraint on marks for reliable upserts
-- sub_criterion is nullable so we use COALESCE to treat NULL as empty string
create unique index if not exists marks_unique_per_cell
  on public.marks (delegate_id, schema_field_id, committee_id, item_index, coalesce(sub_criterion, ''));
