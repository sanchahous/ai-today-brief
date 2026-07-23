-- Run with `supabase test db` after migrations. This test is intentionally
-- read-only and works against an empty or populated local database.

begin;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$
begin
  if exists (select 1 from public.social_posts) then
    raise exception 'anon can read social_posts';
  end if;
  if exists (select 1 from public.social_packages) then
    raise exception 'anon can read social_packages';
  end if;
  if exists (select 1 from public.social_accounts) then
    raise exception 'anon can read social_accounts';
  end if;
  if exists (select 1 from public.social_delivery_attempts) then
    raise exception 'anon can read delivery attempts';
  end if;
  if exists (select 1 from public.weekly_digest_selection_runs) then
    raise exception 'anon can read weekly selection rationale';
  end if;
  if exists (select 1 from public.weekly_digest_reviews) then
    raise exception 'anon can read weekly editorial reviews';
  end if;
  if exists (select 1 from public.weekly_digest_review_items) then
    raise exception 'anon can read weekly story feedback';
  end if;
  if has_function_privilege(
    'anon',
    'public.request_weekly_digest_changes(uuid,text[],text,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'anon can execute weekly digest change requests';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000099","aal":"aal2"}';

do $$
declare
  weekly_change_blocked boolean := false;
begin
  if public.is_social_admin() then
    raise exception 'unknown authenticated user was recognized as an admin';
  end if;
  if exists (select 1 from public.social_posts) then
    raise exception 'authenticated non-owner can read social_posts';
  end if;
  if exists (select 1 from public.social_post_metrics) then
    raise exception 'authenticated non-owner can read social metrics';
  end if;
  if exists (select 1 from public.social_accounts) then
    raise exception 'authenticated non-owner can read account metadata';
  end if;
  if exists (select 1 from public.weekly_digest_selection_runs) then
    raise exception 'authenticated non-owner can read weekly selection rationale';
  end if;
  if exists (select 1 from public.weekly_digest_reviews) then
    raise exception 'authenticated non-owner can read weekly editorial reviews';
  end if;
  if exists (select 1 from public.weekly_digest_review_items) then
    raise exception 'authenticated non-owner can read weekly story feedback';
  end if;
  begin
    perform public.request_weekly_digest_changes(
      '00000000-0000-0000-0000-000000000001',
      array['other']::text[],
      'Non-admin requests must always be blocked.',
      '[]'::jsonb
    );
  exception
    when sqlstate '42501' then weekly_change_blocked := true;
  end;
  if not weekly_change_blocked then
    raise exception 'authenticated non-owner can request weekly digest changes';
  end if;
end $$;

rollback;
