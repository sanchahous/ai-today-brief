-- Owner request 2026-08-20: after a long bugfix stretch the owner finished
-- review outside the Monday 15:45/16:00 window and had no way to schedule the
-- release at all. `schedule_weekly_digest` hard-required release_at to land on
-- Monday 16:00 Europe/Kyiv; every other RPC in the release path
-- (`run_due_weekly_digest_preflights`, `claim_due_weekly_digests`) is already
-- day-agnostic and only compares `preflight_at`/`release_at` against `now()`,
-- so relaxing this one check is sufficient -- the five-minute release cron
-- picks up any future timestamp. `preflight_at` stays pinned to exactly 15
-- minutes before `release_at`, and release must still be in the future and
-- the digest must still be `approved` with a passing preflight.
create or replace function public.schedule_weekly_digest(
  p_weekly_digest_id uuid,
  p_release_at timestamptz
)
returns public.weekly_digests
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_preflight jsonb;
begin
  if public.social_admin_role() <> 'owner' or not public.has_social_aal2() then
    raise exception 'AAL2 owner session required' using errcode = '42501';
  end if;
  perform set_config('app.weekly_digest_release_action', 'allowed', true);
  perform set_config('app.weekly_digest_social_action', 'allowed', true);
  if p_release_at is null then
    raise exception 'Release time is required';
  end if;

  select digest.*
    into v_digest
  from public.weekly_digests digest
  where digest.id = p_weekly_digest_id
  for update;
  if v_digest.id is null or v_digest.status <> 'approved' then
    raise exception 'An approved weekly digest is required';
  end if;
  if p_release_at <= now() then
    raise exception 'Release time must be in the future';
  end if;

  v_preflight := public.weekly_digest_preflight(p_weekly_digest_id);
  if not coalesce((v_preflight ->> 'ready')::boolean, false) then
    raise exception 'Weekly digest preflight failed: %', v_preflight -> 'blockers';
  end if;

  update public.weekly_digests
  set status = 'scheduled',
      release_at = p_release_at,
      preflight_at = p_release_at - interval '15 minutes',
      scheduled_at = now(),
      preflight_checked_at = now(),
      publishing_started_at = null,
      last_error = null
  where id = p_weekly_digest_id
  returning * into v_digest;

  update public.social_posts post
  set status = 'scheduled'
  where post.publish_enabled
    and post.status = 'approved'
    and exists (
      select 1
      from public.social_packages package
      where package.id = post.package_id
        and package.weekly_digest_id = p_weekly_digest_id
        and package.weekly_digest_revision_id = v_digest.active_revision_id
    );
  update public.social_packages
  set status = 'scheduled',
      updated_at = now()
  where weekly_digest_id = p_weekly_digest_id
    and weekly_digest_revision_id = v_digest.active_revision_id
    and status = 'approved';

  insert into public.weekly_digest_release_events (
    weekly_digest_id, revision_id, actor_id, event_type, payload
  ) values (
    v_digest.id,
    v_digest.active_revision_id,
    auth.uid(),
    'scheduled',
    jsonb_build_object(
      'release_at', p_release_at,
      'preflight_at', v_digest.preflight_at,
      'preflight', v_preflight
    )
  );
  return v_digest;
end;
$function$;
