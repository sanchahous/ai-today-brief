-- Run with `supabase test db` after the LinkedIn compact comment URL migration.

begin;

do $test$
declare
  v_rewrite text;
begin
  select pg_get_functiondef(
    'public.rewrite_weekly_digest_social_urls(uuid, text, text)'::regprocedure
  ) into v_rewrite;
  if position('channel in (''x'', ''linkedin'')' in v_rewrite) = 0
     or position('v_copy_tracked' in v_rewrite) = 0 then
    raise exception 'X and LinkedIn copy rewrite must use page + s= instead of the full UTM URL';
  end if;
end;
$test$;

rollback;
