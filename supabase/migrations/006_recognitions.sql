-- =============================================================================
-- RECOGNITION TRACKING
-- Configurable per-committee recognition types (POI, POO, etc.)
-- and per-delegate-per-type counts.
-- =============================================================================

create table if not exists public.recognition_types (
  id            uuid primary key default gen_random_uuid(),
  committee_id  uuid not null references public.committees(id) on delete cascade,
  name          text not null check (char_length(name) <= 50),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.recognition_entries (
  id                   uuid primary key default gen_random_uuid(),
  committee_id         uuid not null references public.committees(id) on delete cascade,
  delegate_id          uuid not null references public.delegates(id) on delete cascade,
  recognition_type_id  uuid not null references public.recognition_types(id) on delete cascade,
  count                integer not null default 0 check (count >= 0),
  updated_at           timestamptz not null default now(),
  constraint recognition_entries_unique unique (delegate_id, recognition_type_id)
);

-- Indexes
create index if not exists recognition_types_committee_idx on public.recognition_types(committee_id);
create index if not exists recognition_entries_committee_idx on public.recognition_entries(committee_id);
create index if not exists recognition_entries_delegate_idx on public.recognition_entries(delegate_id);

-- Enable RLS
alter table public.recognition_types   enable row level security;
alter table public.recognition_entries enable row level security;

-- Policies: EB members can read/write their committee's data
drop policy if exists "recognition_types: eb member read" on public.recognition_types;
create policy "recognition_types: eb member read"
  on public.recognition_types for select
  using (public.is_eb_member(committee_id));

drop policy if exists "recognition_types: eb member insert" on public.recognition_types;
create policy "recognition_types: eb member insert"
  on public.recognition_types for insert
  with check (public.is_eb_member(committee_id));

drop policy if exists "recognition_types: eb member update" on public.recognition_types;
create policy "recognition_types: eb member update"
  on public.recognition_types for update
  using (public.is_eb_member(committee_id));

drop policy if exists "recognition_types: eb member delete" on public.recognition_types;
create policy "recognition_types: eb member delete"
  on public.recognition_types for delete
  using (public.is_eb_member(committee_id));

drop policy if exists "recognition_entries: eb member read" on public.recognition_entries;
create policy "recognition_entries: eb member read"
  on public.recognition_entries for select
  using (public.is_eb_member(committee_id));

drop policy if exists "recognition_entries: eb member upsert" on public.recognition_entries;
create policy "recognition_entries: eb member upsert"
  on public.recognition_entries for insert
  with check (public.is_eb_member(committee_id));

drop policy if exists "recognition_entries: eb member update" on public.recognition_entries;
create policy "recognition_entries: eb member update"
  on public.recognition_entries for update
  using (public.is_eb_member(committee_id));

-- Add to realtime
alter publication supabase_realtime add table public.recognition_types;
alter publication supabase_realtime add table public.recognition_entries;

alter table public.recognition_types   replica identity full;
alter table public.recognition_entries replica identity full;
