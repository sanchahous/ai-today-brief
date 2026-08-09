begin;

do $test$
declare
  v_dispatch_def text;
begin
  select pg_get_functiondef(
    'public.prepare_weekly_digest_github_dispatch(uuid)'::regprocedure
  ) into v_dispatch_def;

  if position('github_dispatch_requested' in v_dispatch_def) = 0
     or (
       position('returning dispatch_token into v_dispatch_token' in lower(v_dispatch_def)) = 0
       and position('v_dispatch_token := gen_random_uuid()' in v_dispatch_def) = 0
     ) then
    raise exception 'GitHub dispatcher must persist and return its generated dispatch token';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.prepare_weekly_digest_github_dispatch(uuid)',
    'EXECUTE'
  ) then
    raise exception 'service_role must be able to reserve a GitHub dispatch';
  end if;

  if has_function_privilege(
    'anon',
    'public.prepare_weekly_digest_github_dispatch(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Anonymous callers must not reserve a GitHub dispatch';
  end if;
end;
$test$;

rollback;
