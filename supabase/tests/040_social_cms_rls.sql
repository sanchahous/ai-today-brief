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
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000099","aal":"aal2"}';

do $$
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
end $$;

rollback;
