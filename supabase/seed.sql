-- Markzo seed data for local development
-- Run after migrations: supabase db reset

-- Note: Real user creation goes through auth.users (Supabase handles this).
-- This seed file is intentionally minimal — use the app UI to create test data.

-- Verify RLS is enabled on all tables
do $$
declare
  tbl text;
  rls_enabled boolean;
begin
  for tbl in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename in (
        'profiles', 'conferences', 'committees', 'eb_members',
        'delegates', 'marking_schema', 'marks', 'mark_edits',
        'final_marksheets', 'award_tiers'
      )
  loop
    select relrowsecurity into rls_enabled
    from pg_class
    where relname = tbl and relnamespace = 'public'::regnamespace;

    if not rls_enabled then
      raise exception 'RLS not enabled on table: %', tbl;
    end if;
  end loop;
  raise notice 'All tables have RLS enabled. ✓';
end;
$$;
