begin;

-- R3.3 / F15 (review of the illustration-plan PR stack): public_read_briefs
-- grants anon SELECT on every column of a published brief row (RLS is
-- row-level, not column-level) -- the comment added with cover_prompt
-- claimed "not selected on public pages" as the safety argument, which is
-- not a real guarantee: anon holds the API key and can select any column
-- directly, regardless of what the site's own pages happen to query.
-- cover_prompt is read/written only by pipeline (service_role, bypasses
-- grants) -- confirmed no src/ code touches it -- so it is safe to revoke
-- from both anon and authenticated with no functional impact.

revoke select (cover_prompt) on public.briefs from anon, authenticated;

comment on column public.briefs.cover_prompt is
  'Copy-ready ManualImagePrompt for the edition cover (weekly-illustration-plan P3). Written after the draft pack lands, null until then. Pipeline-only (service_role) -- select revoked from anon/authenticated (R3.3 / F15): not a secret, but not meant to be publicly queryable either, and RLS on briefs is row-level so it cannot gate this column on its own.';

commit;
