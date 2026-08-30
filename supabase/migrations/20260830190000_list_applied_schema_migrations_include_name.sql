-- ============================================================================
-- 20260830190000 — list_applied_schema_migrations also returns `name`
--
-- `schema_migrations.version` is often the apply clock, not the filename
-- prefix (`20260824100000_daily_visual_workflow.sql` landed as
-- `20260824100143`). Comparing origin/main prefixes to those versions made
-- every historical file look missing. The original filename slug is in
-- `schema_migrations.name`.
-- ============================================================================

begin;

drop function if exists public.list_applied_schema_migrations();

create function public.list_applied_schema_migrations()
returns table (version text, name text)
language sql
stable
security definer
set search_path = public, supabase_migrations
as $function$
  select migrations.version, migrations.name
  from supabase_migrations.schema_migrations as migrations
  order by migrations.version;
$function$;

revoke all on function public.list_applied_schema_migrations()
  from public, anon, authenticated;
grant execute on function public.list_applied_schema_migrations() to service_role;

commit;
