begin;

-- R3.3 / F15 (review of the illustration-plan PR stack): public_read_briefs
-- grants anon SELECT on every column of a published brief row (RLS is
-- row-level, not column-level) -- the comment added with cover_prompt
-- claimed "not selected on public pages" as the safety argument, which is
-- not a real guarantee: anon holds the API key and can select any column
-- directly, regardless of what the site's own pages happen to query.
--
-- The first version of this migration was `revoke select (cover_prompt) ...`,
-- which is a NO-OP in PostgreSQL: anon/authenticated hold TABLE-level SELECT
-- on public.briefs, and a column-level REVOKE cannot subtract from a
-- table-level grant (it warns "no privileges could be revoked" and leaves the
-- column readable). Verified directly against the production database before
-- rewriting this file. The only way to gate one column is to drop the
-- table-level grant and re-issue SELECT column by column.
--
-- Safe because no code path selects `*` from briefs: every read in src/ and
-- pipeline/ enumerates columns (PACK_COLUMNS, 'id, date, edition', ...), there
-- is no view over briefs, and no PostgREST embed pulls it in. The columns
-- below are exactly the pre-cover_prompt column set. cover_prompt itself stays
-- readable by service_role/postgres, whose table-level grants are untouched --
-- the pipeline writes and reads it, nothing client-side does.
--
-- NOTE for future migrations: a column added to public.briefs after this point
-- is NOT anon-readable until it is added to a grant. That is the intended
-- default (opt in, not opt out), but it must be a conscious step.

revoke select on public.briefs from anon, authenticated;

grant select (
  id,
  date,
  title_en,
  title_uk,
  intro_en,
  intro_uk,
  status,
  published_at,
  generated_by,
  created_at,
  slug,
  edition
) on public.briefs to anon, authenticated;

comment on column public.briefs.cover_prompt is
  'Copy-ready ManualImagePrompt for the edition cover (weekly-illustration-plan P3). Written after the draft pack lands, null until then. Pipeline-only (service_role) -- anon/authenticated hold column-level SELECT on every OTHER column instead of a table-level grant (R3.3 / F15), because RLS on briefs is row-level and cannot gate a single column on its own.';

-- Self-verifying: the previous version of this fix looked applied while doing
-- nothing, and no CI job runs supabase/tests/*.sql. Assert both directions in
-- the migration itself so a silent no-op can never ship again.
do $$
begin
  if has_column_privilege('anon', 'public.briefs', 'cover_prompt', 'SELECT') then
    raise exception 'briefs.cover_prompt is still anon-readable after the revoke (R3.3 / F15)';
  end if;
  if has_column_privilege('authenticated', 'public.briefs', 'cover_prompt', 'SELECT') then
    raise exception 'briefs.cover_prompt is still authenticated-readable after the revoke (R3.3 / F15)';
  end if;
  if not has_column_privilege('anon', 'public.briefs', 'slug', 'SELECT') then
    raise exception 'public brief columns lost anon SELECT -- the site would 42501';
  end if;
  if not has_column_privilege('anon', 'public.briefs', 'status', 'SELECT') then
    raise exception 'briefs.status lost anon SELECT -- every published-status filter would 42501';
  end if;
  if not has_column_privilege('service_role', 'public.briefs', 'cover_prompt', 'SELECT') then
    raise exception 'service_role (pipeline) lost read access to briefs.cover_prompt';
  end if;
end $$;

commit;
