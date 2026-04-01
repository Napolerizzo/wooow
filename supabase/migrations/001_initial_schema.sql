-- =============================================================================
-- Markzo — Initial Schema Migration
-- Run this in your Supabase SQL editor or via supabase db push
-- =============================================================================

-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- =============================================================================
-- TABLE: profiles
-- =============================================================================
create table if not exists public.profiles (
  id          uuid          not null references auth.users(id) on delete cascade,
  email       text          not null,
  display_name text         not null,
  created_at  timestamptz   not null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_email_check check (char_length(email) <= 255),
  constraint profiles_display_name_check check (char_length(display_name) <= 100)
);

comment on table public.profiles is 'Public profile data for authenticated users.';

-- =============================================================================
-- TABLE: conferences
-- =============================================================================
create table if not exists public.conferences (
  id          uuid          not null default gen_random_uuid(),
  name        text          not null,
  created_by  uuid          references public.profiles(id) on delete set null,
  created_at  timestamptz   not null default now(),
  constraint conferences_pkey primary key (id),
  constraint conferences_name_check check (char_length(name) <= 150)
);

comment on table public.conferences is 'Top-level conference entities (e.g. "MRMUN XI").';

-- =============================================================================
-- TABLE: committees
-- =============================================================================
create table if not exists public.committees (
  id                uuid        not null default gen_random_uuid(),
  conference_id     uuid        not null references public.conferences(id) on delete cascade,
  name              text        not null,
  access_code       text        not null,
  access_code_hash  text        not null,
  is_locked         boolean     not null default false,
  locked_at         timestamptz,
  locked_by         uuid        references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint committees_pkey primary key (id),
  constraint committees_access_code_unique unique (access_code),
  constraint committees_name_check check (char_length(name) <= 150),
  constraint committees_access_code_format check (access_code ~ '^[A-Z0-9]{8}$')
);

comment on table public.committees is 'Individual committees within a conference (e.g. "DISEC").';
comment on column public.committees.access_code is 'Plaintext 8-char alphanumeric code shown to EB on creation only. Stored only for lookup uniqueness — primary verification uses access_code_hash.';
comment on column public.committees.access_code_hash is 'bcrypt hash of the access code. Used for server-side verification.';

-- =============================================================================
-- TABLE: eb_members
-- =============================================================================
create table if not exists public.eb_members (
  id            uuid        not null default gen_random_uuid(),
  committee_id  uuid        not null references public.committees(id) on delete cascade,
  user_id       uuid        references public.profiles(id) on delete set null,
  guest_name    text,
  role          text        not null,
  is_owner      boolean     not null default false,
  joined_at     timestamptz not null default now(),
  constraint eb_members_pkey primary key (id),
  constraint eb_members_role_check check (char_length(role) <= 100),
  constraint eb_members_guest_name_check check (guest_name is null or char_length(guest_name) <= 100),
  -- At least one of user_id or guest_name must be set
  constraint eb_members_identity_check check (user_id is not null or guest_name is not null)
);

comment on table public.eb_members is 'EB members of a committee — authenticated users or guests.';

-- =============================================================================
-- TABLE: delegates
-- =============================================================================
create table if not exists public.delegates (
  id                uuid        not null default gen_random_uuid(),
  committee_id      uuid        not null references public.committees(id) on delete cascade,
  name              text        not null,
  country           text,
  portfolio         text,
  roll_call_status  text,
  verbatim          text,
  eb_remarks        text,
  created_at        timestamptz not null default now(),
  constraint delegates_pkey primary key (id),
  constraint delegates_name_check check (char_length(name) <= 100),
  constraint delegates_country_check check (country is null or char_length(country) <= 100),
  constraint delegates_portfolio_check check (portfolio is null or char_length(portfolio) <= 100),
  constraint delegates_roll_call_status_check check (
    roll_call_status is null or
    roll_call_status in ('present', 'present_and_voting', 'absent')
  ),
  constraint delegates_verbatim_check check (verbatim is null or char_length(verbatim) <= 20000),
  constraint delegates_eb_remarks_check check (eb_remarks is null or char_length(eb_remarks) <= 2000)
);

comment on table public.delegates is 'Delegates participating in a committee.';

-- =============================================================================
-- TABLE: marking_schema
-- =============================================================================
create table if not exists public.marking_schema (
  id              uuid        not null default gen_random_uuid(),
  committee_id    uuid        not null references public.committees(id) on delete cascade,
  field_name      text        not null,
  field_type      text        not null,
  max_score       numeric     not null,
  scoring_mode    text        not null default 'absolute',
  max_items_total integer,
  max_items_count integer,
  sub_criteria    jsonb,
  sort_order      integer     not null default 0,
  created_at      timestamptz not null default now(),
  constraint marking_schema_pkey primary key (id),
  constraint marking_schema_field_name_check check (char_length(field_name) <= 100),
  constraint marking_schema_field_type_check check (
    field_type in ('speech', 'chit', 'poi', 'poi_reply', 'documentation', 'roll_call', 'custom')
  ),
  constraint marking_schema_scoring_mode_check check (
    scoring_mode in ('absolute', 'average')
  ),
  constraint marking_schema_max_score_check check (max_score >= 0),
  constraint marking_schema_max_items_total_check check (max_items_total is null or max_items_total > 0),
  constraint marking_schema_max_items_count_check check (max_items_count is null or max_items_count > 0)
);

comment on table public.marking_schema is 'Custom marking fields defined per committee.';
comment on column public.marking_schema.sub_criteria is 'JSON array: [{name: "Research", max: 10}, ...] for speech sub-criteria.';

-- =============================================================================
-- TABLE: marks
-- =============================================================================
create table if not exists public.marks (
  id                    uuid        not null default gen_random_uuid(),
  delegate_id           uuid        not null references public.delegates(id) on delete cascade,
  schema_field_id       uuid        not null references public.marking_schema(id) on delete cascade,
  committee_id          uuid        not null references public.committees(id) on delete cascade,
  item_index            integer     not null default 1,
  sub_criterion         text,
  score                 numeric     not null,
  counts_toward_final   boolean     not null default true,
  marked_by             uuid        references public.profiles(id) on delete set null,
  marked_by_guest_name  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint marks_pkey primary key (id),
  constraint marks_item_index_check check (item_index >= 1),
  constraint marks_score_non_negative check (score >= 0),
  constraint marks_sub_criterion_check check (sub_criterion is null or char_length(sub_criterion) <= 100)
);

comment on table public.marks is 'Individual score entries per delegate per field.';

-- Index for fast lookups during marking
create index if not exists marks_committee_id_idx on public.marks(committee_id);
create index if not exists marks_delegate_id_idx on public.marks(delegate_id);
create index if not exists marks_schema_field_id_idx on public.marks(schema_field_id);

-- =============================================================================
-- TABLE: mark_edits  (AUDIT LOG — append only, no updates/deletes)
-- =============================================================================
create table if not exists public.mark_edits (
  id                    uuid        not null default gen_random_uuid(),
  mark_id               uuid        not null references public.marks(id) on delete cascade,
  committee_id          uuid        not null references public.committees(id) on delete cascade,
  edited_by             uuid        references public.profiles(id) on delete set null,
  edited_by_guest_name  text,
  old_score             numeric     not null,
  new_score             numeric     not null,
  edited_at             timestamptz not null default now(),
  note                  text,
  constraint mark_edits_pkey primary key (id),
  constraint mark_edits_note_check check (note is null or char_length(note) <= 500)
);

comment on table public.mark_edits is 'Append-only audit log of all mark changes post-lock.';

create index if not exists mark_edits_committee_id_idx on public.mark_edits(committee_id);
create index if not exists mark_edits_mark_id_idx on public.mark_edits(mark_id);

-- =============================================================================
-- TABLE: final_marksheets
-- =============================================================================
create table if not exists public.final_marksheets (
  id                    uuid        not null default gen_random_uuid(),
  committee_id          uuid        not null references public.committees(id) on delete cascade,
  computed_at           timestamptz not null default now(),
  computed_by           uuid        references public.profiles(id) on delete set null,
  computed_by_guest_name text,
  delegate_rankings     jsonb       not null,
  award_assignments     jsonb       not null,
  is_edited_after_lock  boolean     not null default false,
  last_edited_at        timestamptz,
  last_edited_by_name   text,
  constraint final_marksheets_pkey primary key (id)
);

comment on table public.final_marksheets is 'Computed and locked final marksheet snapshots.';

-- =============================================================================
-- TABLE: award_tiers
-- =============================================================================
create table if not exists public.award_tiers (
  id            uuid    not null default gen_random_uuid(),
  committee_id  uuid    not null references public.committees(id) on delete cascade,
  tier_name     text    not null,
  num_awards    integer not null,
  rank_from     integer not null,
  sort_order    integer not null default 0,
  constraint award_tiers_pkey primary key (id),
  constraint award_tiers_tier_name_check check (char_length(tier_name) <= 100),
  constraint award_tiers_num_awards_check check (num_awards > 0),
  constraint award_tiers_rank_from_check check (rank_from >= 1)
);

comment on table public.award_tiers is 'Award tier definitions per committee (e.g. Best Delegate, High Commendation).';

-- =============================================================================
-- UPDATED_AT TRIGGER for marks
-- =============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marks_updated_at on public.marks;
create trigger marks_updated_at
  before update on public.marks
  for each row execute function public.set_updated_at();

-- =============================================================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
alter table public.profiles          enable row level security;
alter table public.conferences       enable row level security;
alter table public.committees        enable row level security;
alter table public.eb_members        enable row level security;
alter table public.delegates         enable row level security;
alter table public.marking_schema    enable row level security;
alter table public.marks             enable row level security;
alter table public.mark_edits        enable row level security;
alter table public.final_marksheets  enable row level security;
alter table public.award_tiers       enable row level security;

-- ─── Helper function: check if user is EB member of a committee ───────────
create or replace function public.is_eb_member(p_committee_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.eb_members
    where committee_id = p_committee_id
      and user_id = auth.uid()
  );
$$;

-- ─── Helper function: check if user is committee owner ────────────────────
create or replace function public.is_committee_owner(p_committee_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.eb_members
    where committee_id = p_committee_id
      and user_id = auth.uid()
      and is_owner = true
  );
$$;

-- ─── profiles ─────────────────────────────────────────────────────────────
-- Users can only read/write their own profile
drop policy if exists "profiles: own read" on public.profiles;
create policy "profiles: own read"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles: own update" on public.profiles;
create policy "profiles: own update"
  on public.profiles for update
  using (id = auth.uid());

-- ─── conferences ──────────────────────────────────────────────────────────
-- Users can see conferences they created or have committees in
drop policy if exists "conferences: member read" on public.conferences;
create policy "conferences: member read"
  on public.conferences for select
  using (
    created_by = auth.uid() or
    exists (
      select 1 from public.committees c
      join public.eb_members e on e.committee_id = c.id
      where c.conference_id = conferences.id
        and e.user_id = auth.uid()
    )
  );

drop policy if exists "conferences: owner insert" on public.conferences;
create policy "conferences: owner insert"
  on public.conferences for insert
  with check (created_by = auth.uid());

drop policy if exists "conferences: owner update" on public.conferences;
create policy "conferences: owner update"
  on public.conferences for update
  using (created_by = auth.uid());

-- ─── committees ───────────────────────────────────────────────────────────
-- Never expose access_code_hash to clients
drop policy if exists "committees: eb member read" on public.committees;
create policy "committees: eb member read"
  on public.committees for select
  using (public.is_eb_member(id));

drop policy if exists "committees: owner insert" on public.committees;
create policy "committees: owner insert"
  on public.committees for insert
  with check (
    exists (
      select 1 from public.conferences
      where id = conference_id and created_by = auth.uid()
    )
  );

drop policy if exists "committees: owner update" on public.committees;
create policy "committees: owner update"
  on public.committees for update
  using (public.is_committee_owner(id));

-- ─── eb_members ───────────────────────────────────────────────────────────
drop policy if exists "eb_members: committee member read" on public.eb_members;
create policy "eb_members: committee member read"
  on public.eb_members for select
  using (public.is_eb_member(committee_id));

drop policy if exists "eb_members: owner insert" on public.eb_members;
create policy "eb_members: owner insert"
  on public.eb_members for insert
  with check (public.is_committee_owner(committee_id));

drop policy if exists "eb_members: own insert" on public.eb_members;
-- Allow users to add themselves via access code flow (handled server-side with service role)

-- ─── delegates ────────────────────────────────────────────────────────────
drop policy if exists "delegates: eb member read" on public.delegates;
create policy "delegates: eb member read"
  on public.delegates for select
  using (public.is_eb_member(committee_id));

drop policy if exists "delegates: eb member insert" on public.delegates;
create policy "delegates: eb member insert"
  on public.delegates for insert
  with check (public.is_eb_member(committee_id));

drop policy if exists "delegates: eb member update" on public.delegates;
create policy "delegates: eb member update"
  on public.delegates for update
  using (public.is_eb_member(committee_id));

-- ─── marking_schema ───────────────────────────────────────────────────────
drop policy if exists "marking_schema: eb member read" on public.marking_schema;
create policy "marking_schema: eb member read"
  on public.marking_schema for select
  using (public.is_eb_member(committee_id));

drop policy if exists "marking_schema: eb member insert" on public.marking_schema;
create policy "marking_schema: eb member insert"
  on public.marking_schema for insert
  with check (public.is_eb_member(committee_id));

drop policy if exists "marking_schema: eb member update" on public.marking_schema;
create policy "marking_schema: eb member update"
  on public.marking_schema for update
  using (public.is_eb_member(committee_id));

-- ─── marks ────────────────────────────────────────────────────────────────
-- Pre-lock: full read/write. Post-lock: read-only (edits go through mark_edits)
drop policy if exists "marks: eb member read" on public.marks;
create policy "marks: eb member read"
  on public.marks for select
  using (public.is_eb_member(committee_id));

drop policy if exists "marks: eb member insert" on public.marks;
create policy "marks: eb member insert"
  on public.marks for insert
  with check (
    public.is_eb_member(committee_id) and
    not exists (
      select 1 from public.committees
      where id = committee_id and is_locked = true
    )
  );

drop policy if exists "marks: eb member update unlocked" on public.marks;
create policy "marks: eb member update unlocked"
  on public.marks for update
  using (
    public.is_eb_member(committee_id) and
    not exists (
      select 1 from public.committees
      where id = committee_id and is_locked = true
    )
  );

-- ─── mark_edits — APPEND ONLY, no updates, no deletes ────────────────────
drop policy if exists "mark_edits: eb member read" on public.mark_edits;
create policy "mark_edits: eb member read"
  on public.mark_edits for select
  using (public.is_eb_member(committee_id));

drop policy if exists "mark_edits: eb member insert" on public.mark_edits;
create policy "mark_edits: eb member insert"
  on public.mark_edits for insert
  with check (
    public.is_eb_member(committee_id) and
    exists (
      select 1 from public.committees
      where id = committee_id and is_locked = true
    )
  );

-- Explicitly NO update/delete policies on mark_edits (deny by default)

-- ─── final_marksheets — only owner can compute/lock ──────────────────────
drop policy if exists "final_marksheets: eb member read" on public.final_marksheets;
create policy "final_marksheets: eb member read"
  on public.final_marksheets for select
  using (public.is_eb_member(committee_id));

drop policy if exists "final_marksheets: owner insert" on public.final_marksheets;
create policy "final_marksheets: owner insert"
  on public.final_marksheets for insert
  with check (public.is_committee_owner(committee_id));

drop policy if exists "final_marksheets: owner update" on public.final_marksheets;
create policy "final_marksheets: owner update"
  on public.final_marksheets for update
  using (public.is_committee_owner(committee_id));

-- ─── award_tiers ──────────────────────────────────────────────────────────
drop policy if exists "award_tiers: eb member read" on public.award_tiers;
create policy "award_tiers: eb member read"
  on public.award_tiers for select
  using (public.is_eb_member(committee_id));

drop policy if exists "award_tiers: owner write" on public.award_tiers;
create policy "award_tiers: owner write"
  on public.award_tiers for insert
  with check (public.is_committee_owner(committee_id));

drop policy if exists "award_tiers: owner update" on public.award_tiers;
create policy "award_tiers: owner update"
  on public.award_tiers for update
  using (public.is_committee_owner(committee_id));

-- =============================================================================
-- REALTIME PUBLICATIONS
-- Enable realtime on the tables that need live sync
-- =============================================================================
-- Run these in the Supabase dashboard under Database > Replication,
-- or uncomment if using supabase CLI:
--
-- alter publication supabase_realtime add table public.marks;
-- alter publication supabase_realtime add table public.delegates;
-- alter publication supabase_realtime add table public.final_marksheets;
--
-- Note: The publication must already exist (created by Supabase automatically).
-- These commands are idempotent via the dashboard toggle.
