-- Run with `supabase test db` after the social URL rewrite-on-publish migration.

begin;

do $test$
declare
  v_guard text;
  v_finish text;
  v_rewrite text;
begin
  select pg_get_functiondef('public.guard_social_content_approval()'::regprocedure)
    into v_guard;
  if position('weekly_digest_social_url_rewrite' in v_guard) = 0
     or position('weekly_digest_social_asset_relink' in v_guard) = 0 then
    raise exception 'social approval guard must skip URL rewrite and asset relink';
  end if;

  select pg_get_functiondef(
    'public.finish_weekly_digest_release(uuid, boolean, text)'::regprocedure
  ) into v_finish;
  if position('rewrite_weekly_digest_social_urls' in v_finish) = 0
     or position('v_claimed_slug' in v_finish) = 0 then
    raise exception 'finish_weekly_digest_release must rewrite social URLs after publish';
  end if;

  select pg_get_functiondef(
    'public.rewrite_weekly_digest_social_urls(uuid, text, text)'::regprocedure
  ) into v_rewrite;
  if position('app.weekly_digest_social_url_rewrite' in v_rewrite) = 0 then
    raise exception 'rewrite RPC must set the URL-rewrite GUC';
  end if;

  if has_function_privilege(
    'anon',
    'public.rewrite_weekly_digest_social_urls(uuid, text, text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.rewrite_weekly_digest_social_urls(uuid, text, text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.rewrite_weekly_digest_social_urls(uuid, text, text)',
    'EXECUTE'
  ) then
    raise exception 'rewrite_weekly_digest_social_urls must be service_role only';
  end if;
end;
$test$;

rollback;
