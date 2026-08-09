begin;

do $test$
declare
  v_dispatch_def text;
begin
  select pg_get_functiondef(
    'public.prepare_weekly_digest_github_dispatch(uuid)'::regprocedure
  ) into v_dispatch_def;

  if position('v_dispatch_token := gen_random_uuid()' in v_dispatch_def) = 0
     or position('dispatch_token = v_dispatch_token' in v_dispatch_def) = 0
     or position('returning dispatch_token' in lower(v_dispatch_def)) > 0 then
    raise exception 'GitHub dispatcher must persist a fenced local token without RETURNING shadowing';
  end if;
end;
$test$;

rollback;
