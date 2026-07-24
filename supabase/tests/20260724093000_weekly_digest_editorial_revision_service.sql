-- Run with `supabase test db` after the service editorial revision migration.

begin;

do $test$
declare
  v_definition text;
begin
  if not has_function_privilege(
    'service_role',
    'public.create_service_weekly_digest_revision(uuid,text,text,text,text,text,text,jsonb,jsonb,jsonb,text)',
    'EXECUTE'
  ) then
    raise exception 'The composer service role cannot freeze an editorial revision';
  end if;
  if has_function_privilege(
    'anon',
    'public.create_service_weekly_digest_revision(uuid,text,text,text,text,text,text,jsonb,jsonb,jsonb,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.create_service_weekly_digest_revision(uuid,text,text,text,text,text,text,jsonb,jsonb,jsonb,text)',
    'EXECUTE'
  ) then
    raise exception 'Only the trusted service role may create composer revisions';
  end if;

  select pg_get_functiondef(
    'public.create_service_weekly_digest_revision(uuid,text,text,text,text,text,text,jsonb,jsonb,jsonb,text)'::regprocedure
  ) into v_definition;
  if position('service_role required' in v_definition) = 0
     or position('insert into public.weekly_digest_revisions' in v_definition) = 0
     or position('insert into public.weekly_digest_revision_items' in v_definition) = 0
     or position('revision_created' in v_definition) = 0
     or position('update public.weekly_digest_revisions' in v_definition) > 0
     or position('update public.weekly_digest_revision_items' in v_definition) > 0 then
    raise exception 'The composer revision RPC is not immutable-safe';
  end if;
end;
$test$;

rollback;
