-- =============================================================================
-- Migration 002: handle_new_user trigger + profile auto-creation
-- Run this in your Supabase SQL editor if not already applied.
-- =============================================================================

-- Function: auto-create a profile row when a new auth user is created.
-- This ensures conferences.created_by FK constraint is always satisfiable.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Drop existing trigger if present (idempotent)
drop trigger if exists on_auth_user_created on auth.users;

-- Trigger fires after every new user insert in auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
