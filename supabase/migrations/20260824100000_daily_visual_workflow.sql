begin;

-- Daily visual workflow: one frozen editorial snapshot may produce several
-- private candidates, while the public site sees only the deliberately chosen
-- projection. Prompt, QA and rejected pixels never share a table or a bucket
-- with the public page.

create table if not exists public.daily_visual_sets (
  id uuid primary key default gen_random_uuid(),
  editorial_date date not null,
  source_hash text not null check (length(source_hash) = 64),
  lead_brief_id uuid references public.briefs(id) on delete set null,
  source_snapshot jsonb not null check (jsonb_typeof(source_snapshot) in ('array', 'object')),
  direction jsonb,
  display_title_en text,
  display_title_uk text,
  visual_thesis_en text,
  visual_thesis_uk text,
  overlay_stat_en text,
  overlay_stat_uk text,
  status text not null default 'awaiting_publication'
    check (status in ('awaiting_publication', 'queued', 'rendering', 'needs_visual_choice', 'active', 'failed')),
  latest_ai_candidate_id uuid,
  fallback_candidate_id uuid,
  active_candidate_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A closed editorial date has one immutable source snapshot. A later
  -- re-run may resume that set, but it must never create a replacement cover
  -- from a changed source list.
  unique (editorial_date)
);

create table if not exists public.daily_visual_candidates (
  id uuid primary key default gen_random_uuid(),
  daily_visual_set_id uuid not null references public.daily_visual_sets(id) on delete restrict,
  candidate_kind text not null
    check (candidate_kind in ('ai_primary', 'ai_repair', 'manual_high', 'branded_fallback', 'official_source', 'editor_upload')),
  attempt_number smallint not null default 0 check (attempt_number >= 0 and attempt_number <= 9),
  parent_candidate_id uuid references public.daily_visual_candidates(id) on delete restrict,
  provider text,
  model text,
  prompt text,
  prompt_hash text,
  storage_bucket text not null,
  storage_path text not null,
  sha256 text not null check (length(sha256) = 64),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  source_url text,
  rights_note text,
  created_at timestamptz not null default now(),
  unique (daily_visual_set_id, candidate_kind, attempt_number),
  unique (storage_bucket, storage_path)
);

alter table public.daily_visual_sets
  add constraint daily_visual_sets_latest_ai_candidate_fkey
    foreign key (latest_ai_candidate_id) references public.daily_visual_candidates(id) on delete restrict,
  add constraint daily_visual_sets_fallback_candidate_fkey
    foreign key (fallback_candidate_id) references public.daily_visual_candidates(id) on delete restrict,
  add constraint daily_visual_sets_active_candidate_fkey
    foreign key (active_candidate_id) references public.daily_visual_candidates(id) on delete restrict;

create table if not exists public.daily_visual_candidate_qa (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.daily_visual_candidates(id) on delete restrict,
  stage text not null check (stage in ('deterministic', 'image_only', 'story_semantic')),
  outcome text not null check (outcome in ('passed', 'failed', 'error')),
  report jsonb not null check (jsonb_typeof(report) = 'object'),
  provider text,
  model text,
  created_at timestamptz not null default now(),
  unique (candidate_id, stage)
);

create table if not exists public.daily_visual_selection_events (
  id bigint generated always as identity primary key,
  daily_visual_set_id uuid not null references public.daily_visual_sets(id) on delete restrict,
  candidate_id uuid not null references public.daily_visual_candidates(id) on delete restrict,
  selection_kind text not null check (selection_kind in ('auto_qa_pass', 'manual_select', 'manual_replace')),
  reason text,
  actor_id uuid references auth.users(id) on delete set null,
  actor_kind text not null check (actor_kind in ('service', 'owner', 'editor')),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_visual_jobs (
  id uuid primary key default gen_random_uuid(),
  daily_visual_set_id uuid not null unique references public.daily_visual_sets(id) on delete restrict,
  source_hash text not null check (length(source_hash) = 64),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'needs_visual_choice', 'failed')),
  claim_token uuid,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (daily_visual_set_id, source_hash)
);

create table if not exists public.daily_visual_budget_months (
  month_start date primary key check (month_start = date_trunc('month', month_start)::date),
  -- Owner-approved production ceiling: $5.00/month. Keeping the value fixed
  -- in the schema prevents a caller from quietly treating this as a soft cap.
  cap_micro_usd bigint not null default 5000000 check (cap_micro_usd = 5000000),
  reserved_micro_usd bigint not null default 0 check (reserved_micro_usd >= 0),
  committed_micro_usd bigint not null default 0 check (committed_micro_usd >= 0),
  check (reserved_micro_usd + committed_micro_usd <= cap_micro_usd),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_visual_budget_reservations (
  id uuid primary key default gen_random_uuid(),
  month_start date not null references public.daily_visual_budget_months(month_start) on delete restrict,
  daily_visual_set_id uuid not null references public.daily_visual_sets(id) on delete restrict,
  -- `candidate_kind` is retained for compatibility with the first migration,
  -- but represents every chargeable external step, not just image renders.
  candidate_kind text not null check (
    candidate_kind in (
      'direction', 'ai_primary', 'ai_repair',
      'qa_image_only', 'qa_story_semantic', 'manual_high'
    )
  ),
  attempt_number smallint not null check (attempt_number >= 0 and attempt_number <= 9),
  max_cost_micro_usd bigint not null check (max_cost_micro_usd > 0),
  actual_cost_micro_usd bigint check (
    actual_cost_micro_usd is null
    or (actual_cost_micro_usd >= 0 and actual_cost_micro_usd <= max_cost_micro_usd)
  ),
  status text not null default 'reserved'
    check (status in ('reserved', 'committed', 'held_for_reconcile', 'released')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (daily_visual_set_id, candidate_kind, attempt_number)
);

create table if not exists public.daily_visual_publications (
  editorial_date date primary key,
  daily_visual_set_id uuid not null references public.daily_visual_sets(id) on delete restrict,
  candidate_id uuid not null references public.daily_visual_candidates(id) on delete restrict,
  public_url text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  alt_en text not null,
  alt_uk text not null,
  display_title_en text not null,
  display_title_uk text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_visual_sets_date_status_idx
  on public.daily_visual_sets (editorial_date desc, status);
create index if not exists daily_visual_candidates_set_created_idx
  on public.daily_visual_candidates (daily_visual_set_id, created_at desc);
create index if not exists daily_visual_jobs_status_lease_idx
  on public.daily_visual_jobs (status, lease_expires_at);
create index if not exists daily_visual_selection_events_set_created_idx
  on public.daily_visual_selection_events (daily_visual_set_id, created_at desc);

-- Candidate evidence is append-only. The mutable set pointer and public
-- projection are the only way a new visual becomes live.
create or replace function public.reject_daily_visual_immutable_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'daily visual evidence is append-only';
end;
$$;

drop trigger if exists daily_visual_candidates_immutable on public.daily_visual_candidates;
create trigger daily_visual_candidates_immutable
  before update or delete on public.daily_visual_candidates
  for each row execute function public.reject_daily_visual_immutable_write();

drop trigger if exists daily_visual_candidate_qa_immutable on public.daily_visual_candidate_qa;
create trigger daily_visual_candidate_qa_immutable
  before update or delete on public.daily_visual_candidate_qa
  for each row execute function public.reject_daily_visual_immutable_write();

drop trigger if exists daily_visual_selection_events_immutable on public.daily_visual_selection_events;
create trigger daily_visual_selection_events_immutable
  before update or delete on public.daily_visual_selection_events
  for each row execute function public.reject_daily_visual_immutable_write();

drop trigger if exists daily_visual_sets_set_updated_at on public.daily_visual_sets;
create trigger daily_visual_sets_set_updated_at
  before update on public.daily_visual_sets
  for each row execute function extensions.moddatetime(updated_at);

drop trigger if exists daily_visual_jobs_set_updated_at on public.daily_visual_jobs;
create trigger daily_visual_jobs_set_updated_at
  before update on public.daily_visual_jobs
  for each row execute function extensions.moddatetime(updated_at);

drop trigger if exists daily_visual_budget_months_set_updated_at on public.daily_visual_budget_months;
create trigger daily_visual_budget_months_set_updated_at
  before update on public.daily_visual_budget_months
  for each row execute function extensions.moddatetime(updated_at);

drop trigger if exists daily_visual_publications_set_updated_at on public.daily_visual_publications;
create trigger daily_visual_publications_set_updated_at
  before update on public.daily_visual_publications
  for each row execute function extensions.moddatetime(updated_at);

-- The finalizer may only claim a date after all of that date's packs are out
-- of draft state and at least one approved item exists. A retry sees the same
-- source hash and cannot start a second paid render while its lease is live.
create or replace function public.begin_daily_visual_finalization(
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
  reason text
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
      return query select v_set.id, v_job.id, null::uuid, false, 'source_snapshot_frozen';
      return;
    end if;
  end if;
  if exists (
    select 1 from public.briefs
    where date = p_editorial_date and status = 'draft'
  ) then
    return query select null::uuid, null::uuid, null::uuid, false, 'awaiting_publication';
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
    return query select null::uuid, null::uuid, null::uuid, false, 'no_final_approved_items';
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
    return query select v_set.id, v_job.id, null::uuid, false, 'source_snapshot_frozen';
    return;
  end if;

  if v_job.status = 'succeeded' then
    return query select v_set.id, v_job.id, null::uuid, false, 'already_succeeded';
    return;
  end if;
  if v_job.status = 'needs_visual_choice' then
    return query select v_set.id, v_job.id, null::uuid, false, 'needs_visual_choice';
    return;
  end if;
  if v_job.status = 'running' and v_job.lease_expires_at > clock_timestamp() then
    return query select v_set.id, v_job.id, null::uuid, false, 'already_running';
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

  return query select v_set.id, v_job.id, v_claim_token, true, 'claimed';
end;
$$;

-- This is a reservation, not reporting. The maximum charge of every external
-- daily-visual call is held in the month row before the API call; ambiguous
-- provider outcomes remain held rather than silently creating a retry path
-- that can exceed the $5 owner cap.
create or replace function public.reserve_daily_visual_budget(
  p_editorial_date date,
  p_daily_visual_set_id uuid,
  p_candidate_kind text,
  p_attempt_number smallint,
  p_max_cost_micro_usd bigint
)
returns table (
  reservation_id uuid,
  granted boolean,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date := date_trunc('month', p_editorial_date)::date;
  v_month public.daily_visual_budget_months%rowtype;
  v_set public.daily_visual_sets%rowtype;
  v_existing public.daily_visual_budget_reservations%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_editorial_date is null
    or p_daily_visual_set_id is null
    or p_candidate_kind not in (
      'direction', 'ai_primary', 'ai_repair',
      'qa_image_only', 'qa_story_semantic', 'manual_high'
    )
    or p_attempt_number < 0
    or p_max_cost_micro_usd <= 0
    -- The worker cannot lower a declared maximum just to make an otherwise
    -- expensive call fit under budget. These values are mirrored in the
    -- typed contract and give a 31-day automatic path a $4.898 ceiling.
    or (p_candidate_kind = 'direction' and p_max_cost_micro_usd <> 10000)
    or (p_candidate_kind in ('ai_primary', 'ai_repair') and p_max_cost_micro_usd <> 50000)
    or (p_candidate_kind in ('qa_image_only', 'qa_story_semantic') and p_max_cost_micro_usd <> 12000)
    or (p_candidate_kind = 'manual_high' and p_max_cost_micro_usd <> 180000) then
    raise exception 'invalid daily visual budget reservation';
  end if;

  -- The caller cannot move a charge into a different calendar month by
  -- supplying an arbitrary editorial date. The frozen set is authoritative.
  select * into v_set
  from public.daily_visual_sets
  where id = p_daily_visual_set_id
  for key share;
  if not found or v_set.editorial_date <> p_editorial_date then
    raise exception 'daily visual budget date does not match its frozen set';
  end if;

  select * into v_existing
  from public.daily_visual_budget_reservations
  where daily_visual_set_id = p_daily_visual_set_id
    and candidate_kind = p_candidate_kind
    and attempt_number = p_attempt_number;
  if found then
    return query select v_existing.id, false, 'reservation_exists';
    return;
  end if;

  insert into public.daily_visual_budget_months (month_start)
  values (v_month_start)
  on conflict (month_start) do nothing;
  select * into v_month
  from public.daily_visual_budget_months
  where month_start = v_month_start
  for update;

  if v_month.committed_micro_usd + v_month.reserved_micro_usd + p_max_cost_micro_usd > v_month.cap_micro_usd then
    return query select null::uuid, false, 'monthly_cap_exhausted';
    return;
  end if;

  insert into public.daily_visual_budget_reservations (
    month_start, daily_visual_set_id, candidate_kind, attempt_number, max_cost_micro_usd
  ) values (
    v_month_start, p_daily_visual_set_id, p_candidate_kind, p_attempt_number, p_max_cost_micro_usd
  ) returning id into reservation_id;
  update public.daily_visual_budget_months
  set reserved_micro_usd = reserved_micro_usd + p_max_cost_micro_usd
  where month_start = v_month_start;
  granted := true;
  reason := 'reserved';
  return next;
end;
$$;

create or replace function public.settle_daily_visual_budget(
  p_reservation_id uuid,
  p_status text,
  p_actual_cost_micro_usd bigint default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.daily_visual_budget_reservations%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_status not in ('committed', 'released', 'held_for_reconcile') then
    raise exception 'invalid daily visual budget settlement';
  end if;
  select * into v_reservation
  from public.daily_visual_budget_reservations
  where id = p_reservation_id
  for update;
  if not found then
    raise exception 'daily visual budget reservation not found';
  end if;
  if v_reservation.status <> 'reserved' then
    return false;
  end if;
  if p_status = 'committed' then
    if p_actual_cost_micro_usd is null
      or p_actual_cost_micro_usd < 0
      or p_actual_cost_micro_usd > v_reservation.max_cost_micro_usd then
      raise exception 'invalid committed daily visual cost';
    end if;
    update public.daily_visual_budget_reservations
    set status = 'committed', actual_cost_micro_usd = p_actual_cost_micro_usd, settled_at = now()
    where id = v_reservation.id;
    update public.daily_visual_budget_months
    set reserved_micro_usd = reserved_micro_usd - v_reservation.max_cost_micro_usd,
        committed_micro_usd = committed_micro_usd + p_actual_cost_micro_usd
    where month_start = v_reservation.month_start;
    return true;
  end if;
  if p_status = 'released' then
    update public.daily_visual_budget_reservations
    set status = 'released', settled_at = now()
    where id = v_reservation.id;
    update public.daily_visual_budget_months
    set reserved_micro_usd = reserved_micro_usd - v_reservation.max_cost_micro_usd
    where month_start = v_reservation.month_start;
    return true;
  end if;
  update public.daily_visual_budget_reservations
  set status = 'held_for_reconcile', settled_at = now()
  where id = v_reservation.id;
  return true;
end;
$$;

-- Ambiguous provider outcomes deliberately keep their cap reservation. This
-- is the only path that may resolve such a hold, and its row lock makes the
-- month-counter transition exactly-once even when an operator retries it.
create or replace function public.reconcile_held_daily_visual_budget(
  p_reservation_id uuid,
  p_status text,
  p_actual_cost_micro_usd bigint default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.daily_visual_budget_reservations%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_reservation_id is null
    or p_status is null
    or p_status not in ('committed', 'released') then
    raise exception 'invalid held daily visual budget reconciliation';
  end if;

  select * into v_reservation
  from public.daily_visual_budget_reservations
  where id = p_reservation_id
  for update;
  if not found then
    raise exception 'daily visual budget reservation not found';
  end if;
  if v_reservation.status <> 'held_for_reconcile' then
    return false;
  end if;

  if p_status = 'committed' then
    if p_actual_cost_micro_usd is null
      or p_actual_cost_micro_usd < 0
      or p_actual_cost_micro_usd > v_reservation.max_cost_micro_usd then
      raise exception 'invalid reconciled daily visual cost';
    end if;
    update public.daily_visual_budget_reservations
    set status = 'committed',
        actual_cost_micro_usd = p_actual_cost_micro_usd,
        settled_at = clock_timestamp()
    where id = v_reservation.id;
    update public.daily_visual_budget_months
    set reserved_micro_usd = reserved_micro_usd - v_reservation.max_cost_micro_usd,
        committed_micro_usd = committed_micro_usd + p_actual_cost_micro_usd
    where month_start = v_reservation.month_start;
    return true;
  end if;

  update public.daily_visual_budget_reservations
  set status = 'released', settled_at = clock_timestamp()
  where id = v_reservation.id;
  update public.daily_visual_budget_months
  set reserved_micro_usd = reserved_micro_usd - v_reservation.max_cost_micro_usd
  where month_start = v_reservation.month_start;
  return true;
end;
$$;

create or replace function public.write_daily_visual_worker_set_state(
  p_daily_visual_set_id uuid,
  p_job_id uuid,
  p_claim_token uuid,
  p_mutation text,
  p_direction jsonb default null,
  p_display_title_en text default null,
  p_display_title_uk text default null,
  p_visual_thesis_en text default null,
  p_visual_thesis_uk text default null,
  p_overlay_stat_en text default null,
  p_overlay_stat_uk text default null,
  p_candidate_id uuid default null
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
    or p_job_id is null
    or p_claim_token is null
    or p_mutation is null
    or p_mutation not in ('direction', 'latest_ai_candidate', 'fallback_candidate') then
    raise exception 'invalid daily visual worker set mutation';
  end if;

  select * into v_job
  from public.daily_visual_jobs
  where id = p_job_id
    and daily_visual_set_id = p_daily_visual_set_id
  for update;
  if not found
    or v_job.status <> 'running'
    or v_job.claim_token is distinct from p_claim_token
    or v_job.lease_expires_at is null
    or v_job.lease_expires_at <= clock_timestamp() then
    return false;
  end if;

  select * into v_set
  from public.daily_visual_sets
  where id = p_daily_visual_set_id
  for update;
  if not found then return false; end if;

  if p_mutation = 'direction' then
    if coalesce(jsonb_typeof(p_direction), '') <> 'object'
      or nullif(trim(p_display_title_en), '') is null
      or nullif(trim(p_display_title_uk), '') is null
      or nullif(trim(p_visual_thesis_en), '') is null
      or nullif(trim(p_visual_thesis_uk), '') is null then
      raise exception 'invalid daily visual direction';
    end if;
    update public.daily_visual_sets
    set direction = p_direction,
        display_title_en = trim(p_display_title_en),
        display_title_uk = trim(p_display_title_uk),
        visual_thesis_en = trim(p_visual_thesis_en),
        visual_thesis_uk = trim(p_visual_thesis_uk),
        overlay_stat_en = nullif(trim(p_overlay_stat_en), ''),
        overlay_stat_uk = nullif(trim(p_overlay_stat_uk), '')
    where id = v_set.id;
    return true;
  end if;

  if p_candidate_id is null then
    raise exception 'daily visual worker candidate is required';
  end if;
  select * into v_candidate
  from public.daily_visual_candidates
  where id = p_candidate_id;
  if not found or v_candidate.daily_visual_set_id <> v_set.id then
    raise exception 'candidate does not belong to daily visual set';
  end if;

  if p_mutation = 'latest_ai_candidate' then
    if v_candidate.candidate_kind not in ('ai_primary', 'ai_repair') then
      raise exception 'latest daily AI candidate must be generated by the automatic worker';
    end if;
    update public.daily_visual_sets
    set latest_ai_candidate_id = v_candidate.id
    where id = v_set.id;
    return true;
  end if;

  if v_candidate.candidate_kind <> 'branded_fallback' then
    raise exception 'daily visual fallback must be the branded fallback candidate';
  end if;
  update public.daily_visual_sets
  set fallback_candidate_id = v_candidate.id
  where id = v_set.id;
  return true;
end;
$$;

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

  -- Lock after the job, matching every other lease-protected transition.
  perform 1
  from public.daily_visual_sets
  where id = v_job.daily_visual_set_id
  for update;
  if not found then return false; end if;

  update public.daily_visual_jobs
  set status = p_status,
      claim_token = null,
      lease_expires_at = null,
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

-- Code promotes bytes to the public immutable bucket first, then this atomic
-- transition makes that candidate observable. Automatic promotion requires a
-- passing semantic QA record; an owner/editor may explicitly select another
-- private candidate without erasing either history.
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
  -- Lock the job first, so a manual selection and every fenced worker write
  -- serialize on the same row. A manual selection deliberately terminates an
  -- in-flight lease; automatic activation must present that live lease.
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
    -- Do not leave a gap between making an asset observable and finishing the
    -- lease. If the lease has changed, the function returned false above.
    update public.daily_visual_jobs
    set status = 'succeeded',
        claim_token = null,
        lease_expires_at = null,
        last_error = null
    where id = v_job.id;
  else
    -- A deliberate owner/editor choice resolves every unfinished automatic
    -- attempt and invalidates its token, so an older worker cannot overwrite
    -- the selected public visual after returning from a provider call.
    update public.daily_visual_jobs
    set status = 'succeeded',
        claim_token = null,
        lease_expires_at = null,
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

alter table public.daily_visual_sets enable row level security;
alter table public.daily_visual_candidates enable row level security;
alter table public.daily_visual_candidate_qa enable row level security;
alter table public.daily_visual_selection_events enable row level security;
alter table public.daily_visual_jobs enable row level security;
alter table public.daily_visual_budget_months enable row level security;
alter table public.daily_visual_budget_reservations enable row level security;
alter table public.daily_visual_publications enable row level security;

revoke all on table public.daily_visual_sets,
  public.daily_visual_candidates,
  public.daily_visual_candidate_qa,
  public.daily_visual_selection_events,
  public.daily_visual_jobs,
  public.daily_visual_budget_months,
  public.daily_visual_budget_reservations,
  public.daily_visual_publications
from public, anon, authenticated;

grant all on table public.daily_visual_sets,
  public.daily_visual_candidates,
  public.daily_visual_candidate_qa,
  public.daily_visual_selection_events,
  public.daily_visual_jobs,
  public.daily_visual_budget_months,
  public.daily_visual_budget_reservations,
  public.daily_visual_publications
to service_role;

-- The service worker may read the monthly ledger for the owner dashboard,
-- but it cannot bypass its fixed-cap RPCs with a direct table mutation. The
-- SECURITY DEFINER reservation/reconciliation functions own every ledger
-- counter transition and check the service-role claim themselves.
revoke all on table public.daily_visual_budget_months,
  public.daily_visual_budget_reservations
from service_role;
grant select on table public.daily_visual_budget_months,
  public.daily_visual_budget_reservations
to service_role;

grant select on table public.daily_visual_publications to anon, authenticated;

drop policy if exists "daily visual publications: published read" on public.daily_visual_publications;
create policy "daily visual publications: published read"
  on public.daily_visual_publications
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.briefs b
      where b.date = daily_visual_publications.editorial_date
        and b.status = 'published'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'daily-visual-private',
  'daily-visual-private',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "daily visual private: admin read" on storage.objects;
create policy "daily visual private: admin read"
  on storage.objects for select to authenticated
  using (bucket_id = 'daily-visual-private' and public.is_social_admin());

drop policy if exists "daily visual private: editor insert" on storage.objects;
create policy "daily visual private: editor insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'daily-visual-private'
    and public.has_social_role(array['owner', 'editor'])
  );

drop policy if exists "daily visual private: owner delete" on storage.objects;
create policy "daily visual private: owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'daily-visual-private'
    and public.social_admin_role() = 'owner'
    and public.has_social_aal2()
  );

revoke all on function public.begin_daily_visual_finalization(date, text, jsonb, uuid) from public, anon, authenticated, service_role;
revoke all on function public.reserve_daily_visual_budget(date, uuid, text, smallint, bigint) from public, anon, authenticated, service_role;
revoke all on function public.settle_daily_visual_budget(uuid, text, bigint) from public, anon, authenticated, service_role;
revoke all on function public.reconcile_held_daily_visual_budget(uuid, text, bigint) from public, anon, authenticated, service_role;
revoke all on function public.write_daily_visual_worker_set_state(uuid, uuid, uuid, text, jsonb, text, text, text, text, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.finish_daily_visual_job(uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.activate_daily_visual_candidate(uuid, uuid, text, integer, integer, text, text, text, text, uuid, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.begin_daily_visual_finalization(date, text, jsonb, uuid) to service_role;
grant execute on function public.reserve_daily_visual_budget(date, uuid, text, smallint, bigint) to service_role;
grant execute on function public.settle_daily_visual_budget(uuid, text, bigint) to service_role;
grant execute on function public.reconcile_held_daily_visual_budget(uuid, text, bigint) to service_role;
grant execute on function public.write_daily_visual_worker_set_state(uuid, uuid, uuid, text, jsonb, text, text, text, text, text, text, uuid) to service_role;
grant execute on function public.finish_daily_visual_job(uuid, uuid, text, text) to service_role;
grant execute on function public.activate_daily_visual_candidate(uuid, uuid, text, integer, integer, text, text, text, text, uuid, text, uuid) to service_role;

commit;
