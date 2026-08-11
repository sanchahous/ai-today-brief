-- Covers production migration version 20260811183201.
do $test$
declare
  v_dispatch_result text;
begin
  if public.weekly_generation_backend('story_image') <> 'github_actions' then
    raise exception 'story_image must use the durable GitHub Actions backend';
  end if;
  if public.weekly_generation_backend('cover') <> 'vercel' then
    raise exception 'short deterministic derivatives must remain on Vercel';
  end if;

  select pg_get_function_result(
    'public.prepare_weekly_digest_github_dispatch(uuid)'::regprocedure
  ) into v_dispatch_result;
  if position('job_type text' in lower(v_dispatch_result)) = 0 then
    raise exception 'GitHub dispatch lease must expose job_type for concurrency routing';
  end if;

  if to_regclass('pg_temp.weekly_story_image_migration_candidates') is not null then
    raise exception 'migration candidate table must be transaction-scoped and dropped on commit';
  end if;
end;
$test$;
