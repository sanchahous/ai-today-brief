-- Gate the 5-minute pg_cron → Vercel polls on actual due work.
--
-- `social_publish_due`, `weekly_digest_generate` and `weekly_digest_release_due`
-- POSTed to Vercel every 5 minutes whether or not anything was due: ~860 idle
-- function invocations a day, each a Node cold start that bills Fluid Active
-- CPU. On Hobby (4 h CPU / month) that alone is a measurable share of the
-- quota (source: Vercel request log sample 2026-10-26, 36 internal POSTs/hour
-- from pg_net).
--
-- `public.internal_poll_has_work(job)` is a cheap superset of each worker's
-- claim predicate. A false positive costs one idle call (today's behaviour); a
-- false negative would strand work, so every predicate here is deliberately
-- looser than the RPC the route runs:
--   social_publish_due        → claim_due_social_posts + reconcile_stale_social_posts
--   weekly_digest_generate    → claim_weekly_digest_generation_jobs_v2 (vercel)
--                               + prepare_weekly_digest_github_dispatch
--   weekly_digest_release_due → run_due_weekly_digest_preflights + claim_due_weekly_digests
-- The generation reaper (`weekly_digest_generation_reaper`, every minute) runs
-- in the database already, so dropping the idle Vercel call does not delay it.
--
-- `social_compose_review` (every 30 min) is left unchanged: composing depends on
-- recent published items and LLM state that has no single due column.

create or replace function public.internal_poll_has_work(p_job text)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select case p_job
    -- Channel/account/kill-switch checks matter: with every channel disabled
    -- (production 2026-10-26) due `scheduled` rows exist that the claim never
    -- takes, so a status-only gate would still fire every 5 minutes.
    when 'social_publish_due' then exists (
      select 1
      from public.social_posts post
      cross join public.social_settings settings
      left join public.social_accounts account on account.channel = post.channel
      where settings.id = true
        and (
          (
            post.publish_enabled
            and not settings.global_kill_switch
            and coalesce((settings.channel_enabled ->> post.channel)::boolean, false)
            and coalesce(account.enabled, false)
            and (
              post.channel <> 'x'
              or settings.x_monthly_spend_eur < settings.x_monthly_budget_eur
            )
            and post.status in ('approved', 'scheduled', 'failed')
            and (post.status <> 'failed' or post.retry_after is not null)
            and post.approval_version = post.content_version
            and post.content_hash is not null
            and post.attempts < 4
            and coalesce(post.retry_after, post.scheduled_for) <= now()
          )
          or (
            post.status = 'publishing'
            and post.publishing_started_at < now() - interval '15 minutes'
          )
        )
    )
    when 'weekly_digest_generate' then exists (
      select 1
      from public.weekly_digest_generation_jobs job
      where job.status in ('queued', 'retry_scheduled')
        and job.attempts < job.max_attempts
        and coalesce(job.next_attempt_at, '-infinity'::timestamptz) <= now()
    )
    when 'weekly_digest_release_due' then exists (
      select 1
      from public.weekly_digests digest
      where (
          digest.status = 'scheduled'
          and digest.preflight_at <= now()
          and digest.release_at > now()
          and coalesce(digest.preflight_checked_at, '-infinity'::timestamptz)
                < digest.preflight_at
        )
        or (
          not digest.is_test
          and (
            (digest.status = 'scheduled' and digest.release_at <= now())
            or (
              digest.status = 'publishing'
              and digest.publishing_started_at < now() - interval '15 minutes'
            )
          )
        )
    )
    -- Unknown job names keep polling: never silently stop a worker.
    else true
  end
$function$;

revoke all on function public.internal_poll_has_work(text) from public, anon, authenticated;

-- Rewrite only jobs that exist. They were created by hand in production with
-- vault secrets; staging and local databases may not have them, and scheduling
-- a POST to a missing vault URL would just fail every 5 minutes.
do $migration$
declare
  v_job record;
  v_command text;
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron not installed; skipping poll gating';
    return;
  end if;

  for v_job in
    select job.jobid, job.jobname, secret.url_secret
    from cron.job job
    join (
      values
        ('social_publish_due', 'social_publish_due_url'),
        ('weekly_digest_generate', 'weekly_generate_url'),
        ('weekly_digest_release_due', 'weekly_release_due_url')
    ) as secret(jobname, url_secret) on secret.jobname = job.jobname
  loop
    v_command := format(
      $cmd$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = %L),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'social_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  )
  where public.internal_poll_has_work(%L);
  $cmd$,
      v_job.url_secret,
      v_job.jobname
    );
    perform cron.alter_job(job_id := v_job.jobid, command := v_command);
  end loop;
end
$migration$;
