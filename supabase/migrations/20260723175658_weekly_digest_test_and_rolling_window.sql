begin;

-- A test digest exercises the same revision, artifact, social and preflight
-- pipeline as production, but it can never reach public web or social delivery.
alter table public.weekly_digests
  add column if not exists is_test boolean not null default false;

alter table public.weekly_digests
  drop constraint if exists weekly_digests_week_start_key,
  add constraint weekly_digests_week_start_is_test_key unique (week_start, is_test),
  drop constraint if exists weekly_digests_period_model_check,
  add constraint weekly_digests_period_model_check
    check (period_model in ('legacy_mon_sun', 'sun_sat', 'rolling_7d')),
  drop constraint if exists weekly_digests_sunday_start_check,
  add constraint weekly_digests_sunday_start_check check (
    period_model <> 'sun_sat'
    or extract(dow from week_start) = 0
  ),
  drop constraint if exists weekly_digests_test_never_published_check,
  add constraint weekly_digests_test_never_published_check check (
    not is_test or status not in ('publishing', 'published')
  );

-- A rolling window ends on the local creation date. Its gates are always the
-- next Monday, so a Sunday-morning production compose naturally reaches the
-- following Monday while an ad-hoc test can still exercise the same cadence.
create or replace function public.weekly_preflight_at_for_week_end(p_week_end date)
returns timestamptz
language sql
immutable
set search_path = ''
as $function$
  select ((p_week_end + (8 - extract(isodow from p_week_end)::integer)) + time '15:45')
    at time zone 'Europe/Kyiv'
$function$;

create or replace function public.weekly_release_at_for_week_end(p_week_end date)
returns timestamptz
language sql
immutable
set search_path = ''
as $function$
  select ((p_week_end + (8 - extract(isodow from p_week_end)::integer)) + time '16:00')
    at time zone 'Europe/Kyiv'
$function$;

create or replace function public.set_weekly_digest_calendar_defaults()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.period_model in ('sun_sat', 'rolling_7d') then
    if new.preflight_at is null then
      new.preflight_at := public.weekly_preflight_at_for_week_end(new.week_end);
    end if;
    if new.release_at is null then
      new.release_at := public.weekly_release_at_for_week_end(new.week_end);
    end if;
  end if;
  return new;
end;
$function$;

-- Keep test rows out of the release worker even if a test is intentionally
-- approved and scheduled to exercise Monday preflight behaviour.
create or replace function public.claim_due_weekly_digests(p_limit integer default 5)
returns setof public.weekly_digests
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_digest public.weekly_digests;
  v_claimed public.weekly_digests;
  v_preflight jsonb;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;

  for v_digest in
    select digest.*
    from public.weekly_digests digest
    where not digest.is_test
      and (
        (digest.status = 'scheduled' and digest.release_at <= now())
        or (
          digest.status = 'publishing'
          and digest.publishing_started_at < now() - interval '15 minutes'
        )
      )
    order by digest.release_at, digest.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 5), 20))
  loop
    v_preflight := public.weekly_digest_preflight(v_digest.id);
    if coalesce((v_preflight ->> 'ready')::boolean, false) then
      update public.weekly_digests
      set status = 'publishing',
          publishing_started_at = now(),
          preflight_checked_at = now(),
          last_error = null
      where id = v_digest.id
        and status = v_digest.status
      returning * into v_claimed;

      if v_claimed.id is not null then
        insert into public.weekly_digest_release_events (
          weekly_digest_id, revision_id, event_type, payload
        ) values (
          v_claimed.id,
          v_claimed.active_revision_id,
          case
            when v_digest.status = 'publishing' then 'publishing_retried'
            else 'publishing_started'
          end,
          jsonb_build_object(
            'preflight', v_preflight,
            'reclaimed_stale_lease', v_digest.status = 'publishing',
            'previous_publishing_started_at', v_digest.publishing_started_at
          )
        );
        return next v_claimed;
      end if;
    else
      update public.weekly_digests
      set status = 'failed',
          publishing_started_at = null,
          preflight_checked_at = now(),
          last_error = left((v_preflight -> 'blockers')::text, 2000)
      where id = v_digest.id;
      insert into public.weekly_digest_release_events (
        weekly_digest_id, revision_id, event_type, payload
      ) values (
        v_digest.id,
        v_digest.active_revision_id,
        'preflight_failed',
        jsonb_build_object('preflight', v_preflight)
      );
    end if;
  end loop;
end;
$function$;

-- Defence in depth: a test can never be exposed through public RLS, even if a
-- future worker accidentally tries to transition it to published.
drop policy if exists "weekly digests: public published" on public.weekly_digests;
create policy "weekly digests: public published"
  on public.weekly_digests for select to anon, authenticated
  using (status = 'published' and not is_test);

drop policy if exists "weekly items: public published" on public.weekly_digest_items;
create policy "weekly items: public published"
  on public.weekly_digest_items for select to anon, authenticated
  using (exists (
    select 1
    from public.weekly_digests digest
    where digest.id = weekly_digest_id
      and digest.status = 'published'
      and not digest.is_test
  ));

commit;
