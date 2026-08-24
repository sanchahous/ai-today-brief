begin;

-- A visual that stopped before it produced any AI candidate can receive one
-- owner-requested recovery pass. These columns deliberately distinguish that
-- bounded recovery from the normal worker attempt counter: they are an audit
-- of an editorial exception, not a way to reset a failed provider ledger.
alter table public.daily_visual_jobs
  add column if not exists retry_mode text
    check (retry_mode is null or retry_mode = 'direction_once'),
  add column if not exists retry_count smallint not null default 0
    check (retry_count between 0 and 1),
  add column if not exists retry_requested_at timestamptz,
  add column if not exists retry_requested_by uuid references auth.users(id) on delete set null,
  add column if not exists retry_source_direction jsonb
    check (retry_source_direction is null or jsonb_typeof(retry_source_direction) = 'object');

-- The original function returns a fixed record shape. Add the retry marker to
-- the service-worker claim rather than making the worker query mutable job
-- state after it has acquired a lease.
drop function public.begin_daily_visual_finalization(date, text, jsonb, uuid);

create function public.begin_daily_visual_finalization(
  p_editorial_date date,
  p_source_hash text,
  p_source_snapshot jsonb,
  p_lead_brief_id uuid
)
returns table (
  daily_visual_set_id uuid,
  daily_visual_job_id uuid,
  claim_token uuid,
  should_run boolean,
  reason text,
  retry_mode text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_set_id uuid;
  v_set public.daily_visual_sets%rowtype;
  v_job public.daily_visual_jobs%rowtype;
  v_claim_token uuid := gen_random_uuid();
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_editorial_date is null
    or p_source_hash is null
    or p_source_hash !~ '^[0-9a-f]{64}$'
    or p_lead_brief_id is null then
    raise exception 'invalid daily visual finalization input';
  end if;
  if coalesce(jsonb_typeof(p_source_snapshot), '') not in ('array', 'object') then
    raise exception 'daily visual source snapshot must be an array or object';
  end if;

  -- Once a date owns a visual set, its snapshot wins even if an upstream
  -- re-run now sees a different list of stories. Check this before the normal
  -- publication gate so an existing closed day is always returned as frozen.
  select id into v_set_id
  from public.daily_visual_sets
  where editorial_date = p_editorial_date;
  if v_set_id is not null then
    insert into public.daily_visual_jobs (daily_visual_set_id, source_hash)
    select id, source_hash
    from public.daily_visual_sets
    where id = v_set_id
    on conflict on constraint daily_visual_jobs_daily_visual_set_id_key do nothing;
    select * into v_job
    from public.daily_visual_jobs as job
    where job.daily_visual_set_id = v_set_id
    for update;
    select * into v_set
    from public.daily_visual_sets
    where id = v_set_id
    for update;
    if v_set.source_hash <> p_source_hash then
      return query select v_set.id, v_job.id, null::uuid, false, 'source_snapshot_frozen', null::text;
      return;
    end if;
  end if;
  if exists (
    select 1 from public.briefs
    where date = p_editorial_date and status = 'draft'
  ) then
    return query select null::uuid, null::uuid, null::uuid, false, 'awaiting_publication', null::text;
    return;
  end if;
  if not exists (
    select 1
    from public.briefs b
    join public.brief_items bi on bi.brief_id = b.id
    where b.date = p_editorial_date
      and b.status = 'published'
      and bi.review_status = 'approved'
  ) then
    return query select null::uuid, null::uuid, null::uuid, false, 'no_final_approved_items', null::text;
    return;
  end if;

  select id into v_set_id
  from public.daily_visual_sets
  where editorial_date = p_editorial_date;
  if v_set_id is null then
    insert into public.daily_visual_sets (
      editorial_date, source_hash, lead_brief_id, source_snapshot, status
    ) values (
      p_editorial_date, p_source_hash, p_lead_brief_id, p_source_snapshot, 'queued'
    )
    on conflict (editorial_date) do nothing
    returning id into v_set_id;
    if v_set_id is null then
      select id into v_set_id
      from public.daily_visual_sets
      where editorial_date = p_editorial_date;
    end if;
  end if;

  insert into public.daily_visual_jobs (daily_visual_set_id, source_hash)
  values (v_set_id, p_source_hash)
  on conflict on constraint daily_visual_jobs_daily_visual_set_id_key do nothing;

  select * into v_job
  from public.daily_visual_jobs as job
  where job.daily_visual_set_id = v_set_id
  for update;

  -- All mutable worker paths lock job before set. The job lock is the lease
  -- fence; locking in this order also avoids a deadlock with activation.
  select * into v_set
  from public.daily_visual_sets
  where id = v_set_id
  for update;

  if v_set.source_hash <> p_source_hash then
    return query select v_set.id, v_job.id, null::uuid, false, 'source_snapshot_frozen', null::text;
    return;
  end if;

  if v_job.status = 'succeeded' then
    return query select v_set.id, v_job.id, null::uuid, false, 'already_succeeded', null::text;
    return;
  end if;
  if v_job.status = 'needs_visual_choice' then
    return query select v_set.id, v_job.id, null::uuid, false, 'needs_visual_choice', null::text;
    return;
  end if;
  if v_job.status = 'running' and v_job.lease_expires_at > clock_timestamp() then
    return query select v_set.id, v_job.id, null::uuid, false, 'already_running', null::text;
    return;
  end if;

  update public.daily_visual_jobs
  set status = 'running',
      claim_token = v_claim_token,
      claimed_at = clock_timestamp(),
      lease_expires_at = clock_timestamp() + interval '25 minutes',
      attempt_count = attempt_count + 1,
      last_error = null
  where id = v_job.id;
  update public.daily_visual_sets
  set status = 'rendering'
  where id = v_set.id;

  return query select v_set.id, v_job.id, v_claim_token, true, 'claimed', v_job.retry_mode;
end;
$$;

-- Only this narrow failure shape can be retried: the regular run reached a
-- reviewable fallback but never reached an AI candidate or any non-direction
-- provider slot. The first direction ledger row is intentionally only read,
-- never released, reset, or rewritten here.
create function public.request_daily_visual_direction_retry(
  p_daily_visual_set_id uuid
)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.daily_visual_jobs%rowtype;
  v_set public.daily_visual_sets%rowtype;
  v_effective_existing_micro_usd bigint;
  -- direction + primary + image-only QA + semantic QA; no repair slot.
  v_retry_max_micro_usd constant bigint := 84000;
  -- normal automatic-day maximum: 10000 + 50000 + 50000 + 2 * (12000 + 12000)
  v_day_max_micro_usd constant bigint := 158000;
begin
  if not public.has_social_role(array['owner']) or not public.has_social_aal2() then
    raise exception 'An AAL2 owner session is required to request a daily visual retry'
      using errcode = '42501';
  end if;
  if p_daily_visual_set_id is null then
    raise exception 'A daily visual set is required';
  end if;

  -- Lock in the same order as worker completion/activation. A stale browser
  -- request or a parallel owner click cannot consume a second exception slot.
  select * into v_job
  from public.daily_visual_jobs
  where daily_visual_set_id = p_daily_visual_set_id
  for update;
  if not found then
    raise exception 'Daily visual job was not found';
  end if;
  select * into v_set
  from public.daily_visual_sets
  where id = v_job.daily_visual_set_id
  for update;
  if not found then
    raise exception 'Daily visual set was not found';
  end if;

  if v_job.status <> 'needs_visual_choice'
     or v_set.status <> 'needs_visual_choice'
     or v_job.retry_count <> 0
     or v_job.retry_mode is not null
     or v_set.active_candidate_id is not null
     or v_set.latest_ai_candidate_id is not null
     or v_set.fallback_candidate_id is null
     or coalesce(v_set.direction ->> 'daily_visual_direction_source', '') <> 'fallback' then
    raise exception 'This daily visual is not eligible for a bounded direction retry';
  end if;

  if exists (
    select 1
    from public.daily_visual_candidates candidate
    where candidate.daily_visual_set_id = v_set.id
      and candidate.candidate_kind <> 'branded_fallback'
  ) then
    raise exception 'A daily visual with an existing AI or editor candidate cannot retry direction';
  end if;
  if not exists (
    select 1
    from public.daily_visual_budget_reservations reservation
    where reservation.daily_visual_set_id = v_set.id
      and reservation.candidate_kind = 'direction'
      and reservation.attempt_number = 0
  ) or exists (
    select 1
    from public.daily_visual_budget_reservations reservation
    where reservation.daily_visual_set_id = v_set.id
      and reservation.candidate_kind <> 'direction'
  ) then
    raise exception 'A daily visual retry requires exactly the original direction ledger slot';
  end if;

  select coalesce(sum(
    case
      when reservation.status = 'committed'
        then coalesce(reservation.actual_cost_micro_usd, reservation.max_cost_micro_usd)
      when reservation.status in ('reserved', 'held_for_reconcile')
        then reservation.max_cost_micro_usd
      else 0
    end
  ), 0) into v_effective_existing_micro_usd
  from public.daily_visual_budget_reservations reservation
  where reservation.daily_visual_set_id = v_set.id;
  if v_effective_existing_micro_usd + v_retry_max_micro_usd > v_day_max_micro_usd then
    raise exception 'The bounded daily retry would exceed its automatic-day budget';
  end if;

  update public.daily_visual_jobs
  set status = 'queued',
      claim_token = null,
      lease_expires_at = null,
      retry_mode = 'direction_once',
      retry_count = 1,
      retry_requested_at = clock_timestamp(),
      retry_requested_by = auth.uid(),
      retry_source_direction = v_set.direction,
      last_error = 'Owner requested one bounded direction recovery pass.'
  where id = v_job.id;
  update public.daily_visual_sets
  set status = 'queued'
  where id = v_set.id;

  return v_set.editorial_date;
end;
$$;

-- Once the fenced worker has consumed the recovery pass, the mode must not
-- leak into later manual selection or terminal state. retry_count remains the
-- immutable one-shot guard.
create or replace function public.finish_daily_visual_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_status text,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.daily_visual_jobs%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_job_id is null
    or p_claim_token is null
    or p_status is null
    or p_status not in ('succeeded', 'needs_visual_choice', 'failed') then
    raise exception 'invalid daily visual job completion';
  end if;

  select * into v_job
  from public.daily_visual_jobs
  where id = p_job_id
  for update;
  if not found
    or v_job.status <> 'running'
    or v_job.claim_token is distinct from p_claim_token
    or v_job.lease_expires_at is null
    or v_job.lease_expires_at <= clock_timestamp() then
    return false;
  end if;

  perform 1
  from public.daily_visual_sets
  where id = v_job.daily_visual_set_id
  for update;
  if not found then return false; end if;

  update public.daily_visual_jobs
  set status = p_status,
      claim_token = null,
      lease_expires_at = null,
      retry_mode = null,
      last_error = nullif(trim(p_error), '')
  where id = v_job.id;
  update public.daily_visual_sets
  set status = case
    when p_status = 'succeeded' then 'active'
    when p_status = 'needs_visual_choice' then 'needs_visual_choice'
    else 'failed'
  end
  where id = v_job.daily_visual_set_id;
  return true;
end;
$$;

-- Keep the activation fence identical to the prior migration while clearing
-- the transient retry mode in both the automatic and explicit-editor path.
create or replace function public.activate_daily_visual_candidate(
  p_daily_visual_set_id uuid,
  p_candidate_id uuid,
  p_public_url text,
  p_width integer,
  p_height integer,
  p_alt_en text,
  p_alt_uk text,
  p_selection_kind text,
  p_reason text default null,
  p_actor_id uuid default null,
  p_actor_kind text default 'service',
  p_claim_token uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.daily_visual_jobs%rowtype;
  v_set public.daily_visual_sets%rowtype;
  v_candidate public.daily_visual_candidates%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_daily_visual_set_id is null
    or p_candidate_id is null
    or p_selection_kind is null
    or p_selection_kind not in ('auto_qa_pass', 'manual_select', 'manual_replace')
    or p_actor_kind is null
    or p_actor_kind not in ('service', 'owner', 'editor')
    or p_public_url is null
    or p_public_url !~ '^https://'
    or p_width is null
    or p_width <= 0
    or p_height is null
    or p_height <= 0
    or nullif(trim(p_alt_en), '') is null
    or nullif(trim(p_alt_uk), '') is null then
    raise exception 'invalid daily visual activation';
  end if;

  select * into v_job
  from public.daily_visual_jobs
  where daily_visual_set_id = p_daily_visual_set_id
  for update;
  if not found then raise exception 'daily visual job not found'; end if;
  if p_selection_kind = 'auto_qa_pass' and (
    p_claim_token is null
    or v_job.status <> 'running'
    or v_job.claim_token is distinct from p_claim_token
    or v_job.lease_expires_at is null
    or v_job.lease_expires_at <= clock_timestamp()
  ) then
    return false;
  end if;

  select * into v_set from public.daily_visual_sets where id = p_daily_visual_set_id for update;
  if not found then raise exception 'daily visual set not found'; end if;
  select * into v_candidate from public.daily_visual_candidates where id = p_candidate_id;
  if not found or v_candidate.daily_visual_set_id <> v_set.id then
    raise exception 'candidate does not belong to daily visual set';
  end if;
  if p_selection_kind = 'auto_qa_pass' and not exists (
    select 1 from public.daily_visual_candidate_qa
    where candidate_id = v_candidate.id
      and stage = 'story_semantic'
      and outcome = 'passed'
  ) then
    raise exception 'automatic activation requires a passing story-semantic QA';
  end if;
  if nullif(trim(v_set.display_title_en), '') is null
    or nullif(trim(v_set.display_title_uk), '') is null then
    raise exception 'daily visual direction is incomplete';
  end if;

  insert into public.daily_visual_publications (
    editorial_date, daily_visual_set_id, candidate_id, public_url, width, height,
    alt_en, alt_uk, display_title_en, display_title_uk
  ) values (
    v_set.editorial_date, v_set.id, v_candidate.id, p_public_url, p_width, p_height,
    trim(p_alt_en), trim(p_alt_uk), trim(v_set.display_title_en), trim(v_set.display_title_uk)
  ) on conflict (editorial_date) do update
    set daily_visual_set_id = excluded.daily_visual_set_id,
        candidate_id = excluded.candidate_id,
        public_url = excluded.public_url,
        width = excluded.width,
        height = excluded.height,
        alt_en = excluded.alt_en,
        alt_uk = excluded.alt_uk,
        display_title_en = excluded.display_title_en,
        display_title_uk = excluded.display_title_uk;
  update public.daily_visual_sets
  set active_candidate_id = v_candidate.id,
      status = 'active'
  where id = v_set.id;
  if p_selection_kind = 'auto_qa_pass' then
    update public.daily_visual_jobs
    set status = 'succeeded',
        claim_token = null,
        lease_expires_at = null,
        retry_mode = null,
        last_error = null
    where id = v_job.id;
  else
    update public.daily_visual_jobs
    set status = 'succeeded',
        claim_token = null,
        lease_expires_at = null,
        retry_mode = null,
        last_error = null
    where id = v_job.id
      and status <> 'succeeded';
  end if;
  insert into public.daily_visual_selection_events (
    daily_visual_set_id, candidate_id, selection_kind, reason, actor_id, actor_kind
  ) values (
    v_set.id, v_candidate.id, p_selection_kind, nullif(trim(p_reason), ''), p_actor_id, p_actor_kind
  );
  return true;
end;
$$;

revoke all on function public.begin_daily_visual_finalization(date, text, jsonb, uuid) from public, anon, authenticated, service_role;
revoke all on function public.request_daily_visual_direction_retry(uuid) from public, anon, authenticated, service_role;
revoke all on function public.finish_daily_visual_job(uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.activate_daily_visual_candidate(uuid, uuid, text, integer, integer, text, text, text, text, uuid, text, uuid) from public, anon, authenticated, service_role;

grant execute on function public.begin_daily_visual_finalization(date, text, jsonb, uuid) to service_role;
grant execute on function public.request_daily_visual_direction_retry(uuid) to authenticated;
grant execute on function public.finish_daily_visual_job(uuid, uuid, text, text) to service_role;
grant execute on function public.activate_daily_visual_candidate(uuid, uuid, text, integer, integer, text, text, text, text, uuid, text, uuid) to service_role;

commit;
