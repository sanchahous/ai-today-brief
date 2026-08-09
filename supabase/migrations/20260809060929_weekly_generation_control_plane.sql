begin;

-- Durable control-plane for Weekly Digest generation. The existing jobs table
-- remains the logical unit of work; every worker lease is recorded separately
-- so an evicted serverless invocation can never overwrite a later retry.
alter table public.weekly_digest_generation_jobs
  drop constraint if exists weekly_digest_generation_jobs_status_check,
  add column if not exists execution_backend text not null default 'vercel'
    check (execution_backend in ('vercel', 'github_actions')),
  add column if not exists max_attempts smallint not null default 3
    check (max_attempts between 1 and 10),
  add column if not exists retry_of_job_id uuid
    references public.weekly_digest_generation_jobs(id) on delete set null,
  add column if not exists current_attempt_id uuid,
  add column if not exists current_step text,
  add column if not exists current_provider text,
  add column if not exists current_model text,
  add column if not exists progress_current integer not null default 0
    check (progress_current >= 0),
  add column if not exists progress_total integer not null default 100
    check (progress_total > 0),
  add column if not exists progress_unit text not null default 'percent'
    check (progress_unit in ('percent', 'chars', 'items')),
  add column if not exists heartbeat_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists failure_code text,
  add column if not exists status_reason text,
  add column if not exists dispatch_token uuid;

alter table public.weekly_digest_generation_jobs
  add constraint weekly_digest_generation_jobs_status_check
  check (status in (
    'waiting', 'queued', 'dispatching', 'running', 'retry_scheduled',
    'succeeded', 'failed', 'cancelled'
  ));

create index if not exists weekly_digest_generation_jobs_backend_claim_idx
  on public.weekly_digest_generation_jobs
    (execution_backend, status, next_attempt_at, created_at)
  where status in ('queued', 'dispatching', 'retry_scheduled');

create index if not exists weekly_digest_generation_jobs_heartbeat_idx
  on public.weekly_digest_generation_jobs (heartbeat_at)
  where status = 'running';

create index if not exists weekly_digest_generation_jobs_retry_of_idx
  on public.weekly_digest_generation_jobs (retry_of_job_id)
  where retry_of_job_id is not null;

create table if not exists public.weekly_digest_generation_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.weekly_digest_generation_jobs(id) on delete cascade,
  attempt_number smallint not null check (attempt_number > 0),
  backend text not null check (backend in ('vercel', 'github_actions')),
  lease_token uuid not null default gen_random_uuid(),
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed', 'timed_out', 'cancelled')),
  github_run_id text,
  external_run_url text,
  started_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  deadline_at timestamptz,
  finished_at timestamptz,
  current_step text,
  progress_current integer not null default 0 check (progress_current >= 0),
  progress_total integer not null default 100 check (progress_total > 0),
  provider text,
  model text,
  error_code text,
  error_message text,
  outcome jsonb not null default '{}'::jsonb
    check (jsonb_typeof(outcome) = 'object'),
  unique (job_id, attempt_number)
);

create unique index if not exists weekly_digest_generation_attempts_one_active_idx
  on public.weekly_digest_generation_attempts (job_id)
  where status = 'running';

create index if not exists weekly_digest_generation_attempts_job_created_idx
  on public.weekly_digest_generation_attempts (job_id, started_at desc);

create index if not exists weekly_digest_generation_attempts_stale_idx
  on public.weekly_digest_generation_attempts (heartbeat_at)
  where status = 'running';

alter table public.weekly_digest_generation_jobs
  drop constraint if exists weekly_digest_generation_jobs_current_attempt_id_fkey,
  add constraint weekly_digest_generation_jobs_current_attempt_id_fkey
    foreign key (current_attempt_id)
    references public.weekly_digest_generation_attempts(id)
    on delete set null;

create table if not exists public.weekly_digest_generation_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.weekly_digest_generation_jobs(id) on delete cascade,
  attempt_id uuid references public.weekly_digest_generation_attempts(id) on delete set null,
  created_at timestamptz not null default now(),
  event_type text not null,
  level text not null default 'info' check (level in ('debug', 'info', 'warning', 'error')),
  step text,
  provider text,
  model text,
  progress_current integer check (progress_current is null or progress_current >= 0),
  progress_total integer check (progress_total is null or progress_total > 0),
  message text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists weekly_digest_generation_events_job_cursor_idx
  on public.weekly_digest_generation_events (job_id, id desc);

create index if not exists weekly_digest_generation_events_attempt_created_idx
  on public.weekly_digest_generation_events (attempt_id, created_at desc)
  where attempt_id is not null;

alter table public.weekly_digest_generation_attempts enable row level security;
alter table public.weekly_digest_generation_events enable row level security;

revoke all on table public.weekly_digest_generation_attempts from public, anon, authenticated;
revoke all on table public.weekly_digest_generation_events from public, anon, authenticated;
grant all on table public.weekly_digest_generation_attempts to service_role;
grant all on table public.weekly_digest_generation_events to service_role;

alter table public.generation_cost_events
  add column if not exists attempt_id uuid
    references public.weekly_digest_generation_attempts(id) on delete set null,
  add column if not exists step_key text;

create index if not exists generation_cost_events_attempt_created_idx
  on public.generation_cost_events (attempt_id, created_at desc)
  where attempt_id is not null;

create or replace function public.weekly_generation_backend(p_job_type text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case
    when p_job_type in ('editorial_master', 'social_copy', 'video_script') then 'github_actions'
    else 'vercel'
  end
$function$;

create or replace function public.weekly_generation_retry_delay(p_attempt_number integer)
returns interval
language sql
immutable
set search_path = ''
as $function$
  select case p_attempt_number
    when 1 then interval '1 minute'
    when 2 then interval '5 minutes'
    else interval '15 minutes'
  end
$function$;

create or replace function public.weekly_generation_waiting_reason(
  p_job public.weekly_digest_generation_jobs
)
returns text
language plpgsql
stable
set search_path = public
as $function$
declare
  v_count integer;
begin
  if p_job.job_type = 'research_pack' then return null; end if;
  if p_job.job_type = 'editorial_master' then
    select count(*) into v_count
    from public.weekly_digest_artifacts artifact
    join public.weekly_digest_revision_items item on item.id = artifact.revision_item_id
    where artifact.revision_id = p_job.revision_id
      and item.rank <= 3
      and artifact.artifact_type = 'research_pack'
      and artifact.is_current
      and artifact.generation_status = 'ready'
      and artifact.review_status = 'approved';
    return case when v_count = 3 then null else format('Waiting for approved research packs: %s/3', v_count) end;
  end if;
  if p_job.job_type = 'social_copy' then
    if not exists (
      select 1 from public.weekly_digest_artifacts artifact
      where artifact.revision_id = p_job.revision_id
        and artifact.artifact_type = 'cover'
        and artifact.is_current
        and artifact.generation_status = 'ready'
    ) then return 'Waiting for the current cover artifact'; end if;
    select count(*) into v_count
    from public.weekly_digest_artifacts artifact
    where artifact.revision_id = p_job.revision_id
      and artifact.artifact_type = 'article'
      and artifact.is_current
      and artifact.review_status = 'approved';
    return case when v_count = 2 then null else format('Waiting for approved bilingual articles: %s/2', v_count) end;
  end if;
  if p_job.job_type = 'video_script' then
    return case when exists (
      select 1 from public.weekly_digest_artifacts artifact
      where artifact.revision_id = p_job.revision_id
        and artifact.artifact_type = 'article'
        and artifact.locale = 'en'
        and artifact.is_current
        and artifact.review_status = 'approved'
    ) then null else 'Waiting for the approved English article' end;
  end if;
  if p_job.job_type = 'story_image' then
    select count(*) into v_count
    from public.weekly_digest_artifacts artifact
    where artifact.revision_id = p_job.revision_id
      and artifact.is_current
      and artifact.review_status = 'approved'
      and artifact.artifact_type = 'article'
      and artifact.slot_key in ('article:en', 'article:uk');
    return case
      when v_count = 2 then null
      else format('Waiting for approved bilingual articles: %s/2', v_count)
    end;
  end if;
  if p_job.job_type = 'cover' then
    return case when not exists (
      select 1 from public.weekly_digest_revision_items item
      where item.revision_id = p_job.revision_id
        and not exists (
          select 1 from public.weekly_digest_artifacts artifact
          where artifact.revision_item_id = item.id
            and artifact.artifact_type = 'story_image'
            and artifact.is_current
            and artifact.generation_status = 'ready'
        )
    ) then null else 'Waiting for all story images' end;
  end if;
  if p_job.job_type = 'pdf' then
    return case when exists (
      select 1 from public.weekly_digest_artifacts cover
      where cover.revision_id = p_job.revision_id
        and cover.artifact_type = 'cover'
        and cover.is_current
        and cover.generation_status = 'ready'
    ) and exists (
      select 1 from public.weekly_digest_artifacts article
      where article.revision_id = p_job.revision_id
        and article.artifact_type = 'article'
        and article.locale = coalesce(nullif(p_job.input ->> 'locale', ''), 'en')
        and article.is_current
        and article.generation_status = 'ready'
    ) then null else 'Waiting for ready cover and matching article' end;
  end if;
  if p_job.job_type = 'social_asset' then
    return case when exists (
      select 1 from public.weekly_digest_artifacts cover
      where cover.revision_id = p_job.revision_id
        and cover.artifact_type = 'cover'
        and cover.is_current
        and cover.generation_status = 'ready'
    ) then null else 'Waiting for the current cover artifact' end;
  end if;
  if p_job.job_type = 'video_manifest' then
    if not exists (
      select 1 from public.weekly_digest_artifacts artifact
      where artifact.revision_id = p_job.revision_id
        and artifact.artifact_type = 'video_script'
        and artifact.is_current
        and artifact.review_status = 'approved'
    ) then return 'Waiting for an approved video script'; end if;
    select count(*) into v_count
    from public.weekly_digest_artifacts artifact
    join public.weekly_digest_revision_items item on item.id = artifact.revision_item_id
    where artifact.revision_id = p_job.revision_id
      and item.rank <= 3
      and artifact.artifact_type = 'story_image'
      and artifact.is_current
      and artifact.generation_status = 'ready'
      and artifact.review_status = 'approved';
    if v_count <> 3 then
      return format('Waiting for approved Top 3 story images: %s/3', v_count);
    end if;
    return case when exists (
      select 1 from public.weekly_digest_artifacts cover
      where cover.revision_id = p_job.revision_id
        and cover.artifact_type = 'cover'
        and cover.is_current
        and cover.generation_status = 'ready'
    ) then null else 'Waiting for the current cover artifact' end;
  end if;
  return null;
end;
$function$;

create or replace function public.weekly_generation_job_ready(
  p_job public.weekly_digest_generation_jobs
)
returns boolean
language sql
stable
set search_path = public
as $function$
  select public.weekly_generation_waiting_reason(p_job) is null
$function$;

create or replace function public.refresh_weekly_digest_generation_waiting_states()
returns table (waiting integer, queued integer)
language plpgsql
security definer
set search_path = public
as $function$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  with moved as (
    update public.weekly_digest_generation_jobs job
    set status = 'waiting',
        status_reason = public.weekly_generation_waiting_reason(job),
        next_attempt_at = null
    where job.status = 'queued'
      and not public.weekly_generation_job_ready(job)
    returning job.id, job.status_reason
  )
  insert into public.weekly_digest_generation_events (job_id, event_type, step, message, metadata)
  select id, 'dependency_waiting', 'prepare', status_reason, jsonb_build_object('state', 'waiting')
  from moved;
  get diagnostics waiting = row_count;

  with moved as (
    update public.weekly_digest_generation_jobs job
    set status = 'queued',
        status_reason = 'Dependency gate satisfied; queued for worker',
        next_attempt_at = now()
    where job.status = 'waiting'
      and public.weekly_generation_job_ready(job)
    returning job.id
  )
  insert into public.weekly_digest_generation_events (job_id, event_type, step, message, metadata)
  select id, 'dependency_satisfied', 'prepare', 'Dependency gate satisfied; queued for worker',
    jsonb_build_object('state', 'queued')
  from moved;
  get diagnostics queued = row_count;
end;
$function$;

create or replace function public.set_weekly_generation_backend()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.execution_backend := public.weekly_generation_backend(new.job_type);
  return new;
end;
$function$;

drop trigger if exists weekly_digest_generation_jobs_backend on public.weekly_digest_generation_jobs;
create trigger weekly_digest_generation_jobs_backend
  before insert or update of job_type
  on public.weekly_digest_generation_jobs
  for each row execute function public.set_weekly_generation_backend();

-- Existing queued long jobs were created before the routing column existed.
-- Move only unfinished work; completed records retain their historical backend.
update public.weekly_digest_generation_jobs
set execution_backend = public.weekly_generation_backend(job_type)
where job_type in ('editorial_master', 'social_copy', 'video_script')
  and status in ('waiting', 'queued', 'dispatching', 'retry_scheduled');

-- Pre-control-plane jobs recorded only a counter. Materialize that counter as
-- immutable historical attempts so the admin UI does not rewrite five legacy
-- retries as a fictional single attempt.
insert into public.weekly_digest_generation_attempts (
  job_id, attempt_number, backend, status, started_at, heartbeat_at, finished_at,
  error_code, error_message
)
select
  job.id,
  attempt_number.value::smallint,
  case when job.job_type in ('editorial_master', 'social_copy', 'video_script') then 'github_actions' else 'vercel' end,
  'failed',
  coalesce(job.started_at, job.created_at),
  coalesce(job.locked_at, job.started_at, job.created_at),
  coalesce(job.finished_at, job.locked_at, job.updated_at),
  'legacy_attempt_uninstrumented',
  'Historical attempt imported from the pre-ledger counter.'
from public.weekly_digest_generation_jobs job
cross join lateral generate_series(1, job.attempts) as attempt_number(value)
where job.attempts > 0
  and not exists (
    select 1
    from public.weekly_digest_generation_attempts attempt
    where attempt.job_id = job.id
  );

create or replace function public.claim_weekly_digest_generation_jobs_v2(
  p_backend text,
  p_job_types text[] default null,
  p_limit integer default 1,
  p_job_id uuid default null,
  p_dispatch_token uuid default null,
  p_external_run_id text default null,
  p_external_run_url text default null,
  p_deadline_seconds integer default null
)
returns table (
  id uuid,
  weekly_digest_id uuid,
  revision_id uuid,
  job_type text,
  attempts integer,
  input jsonb,
  execution_backend text,
  attempt_id uuid,
  lease_token uuid
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_job public.weekly_digest_generation_jobs;
  v_attempt public.weekly_digest_generation_attempts;
  v_deadline_seconds integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_backend not in ('vercel', 'github_actions') then
    raise exception 'Unsupported generation backend';
  end if;
  if p_job_types is not null and cardinality(p_job_types) = 0 then
    raise exception 'Job type filter cannot be empty';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 20 then
    raise exception 'Claim limit must be between 1 and 20';
  end if;
  if p_dispatch_token is not null and p_backend <> 'github_actions' then
    raise exception 'Dispatch token is only valid for GitHub Actions';
  end if;
  v_deadline_seconds := case
    when p_deadline_seconds is null then case when p_backend = 'vercel' then 240 else 7200 end
    else p_deadline_seconds
  end;
  if v_deadline_seconds < 15 or v_deadline_seconds > 43200 then
    raise exception 'Deadline must be between 15 seconds and 12 hours';
  end if;

  for v_job in
    select job.*
    from public.weekly_digest_generation_jobs job
    join public.weekly_digests digest on digest.id = job.weekly_digest_id
    where job.execution_backend = p_backend
      and job.attempts < job.max_attempts
      and digest.active_revision_id = job.revision_id
      and digest.status not in ('publishing', 'published', 'cancelled')
      and public.weekly_generation_job_ready(job)
      and (p_job_types is null or job.job_type = any(p_job_types))
      and (p_job_id is null or job.id = p_job_id)
      and (
        (p_backend = 'github_actions' and job.status = 'dispatching'
          and job.dispatch_token is not distinct from p_dispatch_token)
        or (p_backend = 'vercel' and job.status in ('queued', 'retry_scheduled')
          and coalesce(job.next_attempt_at, '-infinity'::timestamptz) <= now())
      )
    order by job.created_at
    for update of job skip locked
    limit p_limit
  loop
    insert into public.weekly_digest_generation_attempts (
      job_id, attempt_number, backend, github_run_id, external_run_url, deadline_at
    ) values (
      v_job.id,
      v_job.attempts + 1,
      p_backend,
      nullif(btrim(coalesce(p_external_run_id, '')), ''),
      nullif(btrim(coalesce(p_external_run_url, '')), ''),
      now() + make_interval(secs => v_deadline_seconds)
    ) returning * into v_attempt;

    update public.weekly_digest_generation_jobs
    set status = 'running',
        attempts = attempts + 1,
        current_attempt_id = v_attempt.id,
        current_step = 'prepare',
        progress_current = 0,
        progress_total = 100,
        progress_unit = 'percent',
        heartbeat_at = now(),
        locked_at = now(),
        started_at = coalesce(started_at, now()),
        finished_at = null,
        next_attempt_at = null,
        failure_code = null,
        status_reason = case when p_backend = 'github_actions' then 'GitHub Actions worker started' else 'Vercel worker started' end,
        last_error = null
    where id = v_job.id
    returning * into v_job;

    insert into public.weekly_digest_generation_events (
      job_id, attempt_id, event_type, step, progress_current, progress_total, metadata
    ) values (
      v_job.id, v_attempt.id, 'attempt_started', 'prepare', 0, 100,
      jsonb_build_object(
        'attempt', v_job.attempts,
        'max_attempts', v_job.max_attempts,
        'backend', p_backend,
        'deadline_at', v_attempt.deadline_at,
        'external_run_url', v_attempt.external_run_url
      )
    );

    id := v_job.id;
    weekly_digest_id := v_job.weekly_digest_id;
    revision_id := v_job.revision_id;
    job_type := v_job.job_type;
    attempts := v_job.attempts;
    input := v_job.input;
    execution_backend := v_job.execution_backend;
    attempt_id := v_attempt.id;
    lease_token := v_attempt.lease_token;
    return next;
  end loop;
end;
$function$;

create or replace function public.heartbeat_weekly_digest_generation_attempt(
  p_attempt_id uuid,
  p_lease_token uuid,
  p_step text default null,
  p_progress_current integer default null,
  p_progress_total integer default null,
  p_provider text default null,
  p_model text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_attempt public.weekly_digest_generation_attempts;
  v_progress_current integer;
  v_progress_total integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  select attempt.* into v_attempt
  from public.weekly_digest_generation_attempts attempt
  join public.weekly_digest_generation_jobs job on job.id = attempt.job_id
  where attempt.id = p_attempt_id
    and attempt.lease_token = p_lease_token
    and attempt.status = 'running'
    and job.current_attempt_id = attempt.id
    and job.status = 'running'
  for update of attempt, job;
  if v_attempt.id is null then return false; end if;
  v_progress_total := greatest(coalesce(p_progress_total, v_attempt.progress_total), 1);
  v_progress_current := greatest(v_attempt.progress_current, coalesce(p_progress_current, 0));

  update public.weekly_digest_generation_attempts
  set heartbeat_at = now(),
      current_step = coalesce(nullif(btrim(p_step), ''), current_step),
      progress_current = v_progress_current,
      progress_total = v_progress_total,
      provider = coalesce(nullif(btrim(p_provider), ''), provider),
      model = coalesce(nullif(btrim(p_model), ''), model)
  where id = v_attempt.id;

  update public.weekly_digest_generation_jobs job
  set heartbeat_at = now(),
      locked_at = now(),
      current_step = coalesce(nullif(btrim(p_step), ''), current_step),
      current_provider = coalesce(nullif(btrim(p_provider), ''), current_provider),
      current_model = coalesce(nullif(btrim(p_model), ''), current_model),
      progress_current = greatest(progress_current, v_progress_current),
      progress_total = greatest(progress_total, v_progress_total)
  where id = v_attempt.job_id
    and current_attempt_id = v_attempt.id;
  return true;
end;
$function$;

create or replace function public.record_weekly_digest_generation_event(
  p_attempt_id uuid,
  p_lease_token uuid,
  p_event_type text,
  p_level text default 'info',
  p_step text default null,
  p_provider text default null,
  p_model text default null,
  p_progress_current integer default null,
  p_progress_total integer default null,
  p_message text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_attempt public.weekly_digest_generation_attempts;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if nullif(btrim(p_event_type), '') is null then
    raise exception 'Event type is required';
  end if;
  if p_level not in ('debug', 'info', 'warning', 'error') then
    raise exception 'Invalid event level';
  end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Event metadata must be an object';
  end if;
  select attempt.* into v_attempt
  from public.weekly_digest_generation_attempts attempt
  join public.weekly_digest_generation_jobs job on job.id = attempt.job_id
  where attempt.id = p_attempt_id
    and attempt.lease_token = p_lease_token
    and attempt.status = 'running'
    and job.current_attempt_id = attempt.id
    and job.status = 'running'
  for update of attempt, job;
  if v_attempt.id is null then return false; end if;

  perform public.heartbeat_weekly_digest_generation_attempt(
    p_attempt_id, p_lease_token, p_step, p_progress_current, p_progress_total, p_provider, p_model
  );
  insert into public.weekly_digest_generation_events (
    job_id, attempt_id, event_type, level, step, provider, model,
    progress_current, progress_total, message, metadata
  ) values (
    v_attempt.job_id, v_attempt.id, btrim(p_event_type), p_level,
    nullif(btrim(p_step), ''), nullif(btrim(p_provider), ''), nullif(btrim(p_model), ''),
    p_progress_current, p_progress_total, left(nullif(btrim(p_message), ''), 2000), p_metadata
  );
  return true;
end;
$function$;

create or replace function public.finish_weekly_digest_generation_attempt(
  p_attempt_id uuid,
  p_lease_token uuid,
  p_succeeded boolean,
  p_output jsonb default '{}'::jsonb,
  p_error text default null,
  p_failure_code text default null,
  p_retryable boolean default false,
  p_artifact_id uuid default null
)
returns public.weekly_digest_generation_jobs
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_attempt public.weekly_digest_generation_attempts;
  v_job public.weekly_digest_generation_jobs;
  v_artifact_id uuid;
  v_status text;
  v_next_attempt_at timestamptz;
  v_error text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_output is null or jsonb_typeof(p_output) <> 'object' then
    raise exception 'Generation output must be a JSON object';
  end if;
  select attempt.* into v_attempt
  from public.weekly_digest_generation_attempts attempt
  join public.weekly_digest_generation_jobs job on job.id = attempt.job_id
  where attempt.id = p_attempt_id
    and attempt.lease_token = p_lease_token
    and attempt.status = 'running'
    and job.current_attempt_id = attempt.id
    and job.status = 'running'
  for update of attempt, job;
  if v_attempt.id is null then
    raise exception 'Generation attempt lease is no longer current' using errcode = 'P0002';
  end if;
  select * into v_job from public.weekly_digest_generation_jobs where id = v_attempt.job_id for update;
  v_artifact_id := coalesce(p_artifact_id, v_job.artifact_id);
  if v_artifact_id is not null and not exists (
    select 1 from public.weekly_digest_artifacts artifact
    where artifact.id = v_artifact_id
      and artifact.weekly_digest_id = v_job.weekly_digest_id
      and artifact.revision_id = v_job.revision_id
  ) then
    raise exception 'Artifact does not belong to the generation job revision';
  end if;
  v_error := left(coalesce(nullif(btrim(p_error), ''), 'Generation worker failed.'), 2000);
  if p_succeeded then
    v_status := 'succeeded';
    v_next_attempt_at := null;
  elsif p_retryable and v_job.attempts < v_job.max_attempts then
    v_status := 'retry_scheduled';
    v_next_attempt_at := now() + public.weekly_generation_retry_delay(v_job.attempts);
  else
    v_status := 'failed';
    v_next_attempt_at := null;
  end if;

  update public.weekly_digest_generation_attempts
  set status = case when p_succeeded then 'succeeded' else 'failed' end,
      heartbeat_at = now(),
      finished_at = now(),
      progress_current = case when p_succeeded then progress_total else progress_current end,
      error_code = case when p_succeeded then null else nullif(btrim(p_failure_code), '') end,
      error_message = case when p_succeeded then null else v_error end,
      outcome = p_output
  where id = v_attempt.id
    and lease_token = p_lease_token;

  update public.weekly_digest_generation_jobs
  set artifact_id = v_artifact_id,
      status = v_status,
      output = coalesce(output, '{}'::jsonb) || p_output,
      last_error = case when p_succeeded then null else v_error end,
      failure_code = case when p_succeeded then null else nullif(btrim(p_failure_code), '') end,
      status_reason = case
        when p_succeeded then 'Completed successfully'
        when v_status = 'retry_scheduled' then 'Retry scheduled after a retryable failure'
        else 'Terminal failure: manual retry creates a linked job'
      end,
      heartbeat_at = now(),
      locked_at = null,
      progress_current = case when p_succeeded then progress_total else progress_current end,
      next_attempt_at = v_next_attempt_at,
      finished_at = case when v_status in ('succeeded', 'failed') then now() else null end
  where id = v_job.id
    and current_attempt_id = v_attempt.id
  returning * into v_job;

  if v_artifact_id is not null and v_status in ('succeeded', 'failed') then
    update public.weekly_digest_artifacts
    set generation_status = case when p_succeeded then 'ready' else 'failed' end
    where id = v_artifact_id
      and is_current;
  end if;

  insert into public.weekly_digest_generation_events (
    job_id, attempt_id, event_type, level, step, provider, model,
    progress_current, progress_total, message, metadata
  ) values (
    v_job.id, v_attempt.id,
    case when p_succeeded then 'attempt_succeeded' when v_status = 'retry_scheduled' then 'retry_scheduled' else 'attempt_failed' end,
    case when p_succeeded then 'info' else 'error' end,
    v_job.current_step, v_attempt.provider, v_attempt.model,
    case when p_succeeded then 100 else v_attempt.progress_current end,
    v_attempt.progress_total,
    case when p_succeeded then 'Generation completed' else v_error end,
    jsonb_build_object(
      'attempt', v_job.attempts,
      'max_attempts', v_job.max_attempts,
      'failure_code', nullif(btrim(p_failure_code), ''),
      'retryable', p_retryable,
      'next_attempt_at', v_next_attempt_at
    )
  );
  return v_job;
end;
$function$;

create or replace function public.reap_stale_weekly_digest_generation_attempts(
  p_stale_after interval default interval '90 seconds'
)
returns table (timed_out integer, terminal_failed integer, dispatches_requeued integer)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_attempt public.weekly_digest_generation_attempts;
  v_job public.weekly_digest_generation_jobs;
  v_status text;
  v_next_attempt_at timestamptz;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_stale_after < interval '30 seconds' or p_stale_after > interval '1 hour' then
    raise exception 'Stale timeout must be between 30 seconds and one hour';
  end if;
  perform public.refresh_weekly_digest_generation_waiting_states();
  timed_out := 0;
  terminal_failed := 0;
  dispatches_requeued := 0;

  for v_attempt in
    select attempt.*
    from public.weekly_digest_generation_attempts attempt
    where attempt.status = 'running'
      and attempt.heartbeat_at < now() - p_stale_after
    for update skip locked
  loop
    select * into v_job from public.weekly_digest_generation_jobs
    where id = v_attempt.job_id
      and current_attempt_id = v_attempt.id
      and status = 'running'
    for update;
    if v_job.id is null then continue; end if;
    v_status := case when v_job.attempts < v_job.max_attempts then 'retry_scheduled' else 'failed' end;
    v_next_attempt_at := case
      when v_status = 'retry_scheduled' then now() + public.weekly_generation_retry_delay(v_job.attempts)
      else null
    end;
    update public.weekly_digest_generation_attempts
    set status = 'timed_out',
        finished_at = now(),
        error_code = 'worker_heartbeat_stale',
        error_message = 'Worker heartbeat was stale for more than 90 seconds.'
    where id = v_attempt.id
      and status = 'running';
    update public.weekly_digest_generation_jobs
    set status = v_status,
        locked_at = null,
        next_attempt_at = v_next_attempt_at,
        finished_at = case when v_status = 'failed' then now() else null end,
        failure_code = case when v_status = 'failed' then 'worker_heartbeat_stale' else null end,
        last_error = 'Worker heartbeat was stale for more than 90 seconds.',
        status_reason = case when v_status = 'failed' then 'Worker stopped sending heartbeats; retry limit reached' else 'Worker heartbeat stale; retry scheduled' end
    where id = v_job.id
      and current_attempt_id = v_attempt.id;
    insert into public.weekly_digest_generation_events (
      job_id, attempt_id, event_type, level, step, provider, model, message, metadata
    ) values (
      v_job.id, v_attempt.id, 'attempt_timed_out', 'error', v_job.current_step,
      v_attempt.provider, v_attempt.model,
      'Worker heartbeat was stale for more than 90 seconds.',
      jsonb_build_object('attempt', v_job.attempts, 'max_attempts', v_job.max_attempts, 'next_attempt_at', v_next_attempt_at)
    );
    timed_out := timed_out + 1;
    if v_status = 'failed' then terminal_failed := terminal_failed + 1; end if;
  end loop;

  -- The one-time legacy recovery keeps the original counter/history intact,
  -- terminalizes its stale Vercel lease, then mints exactly one new logical
  -- job. The normal GitHub dispatcher will reserve that retry with a fresh
  -- token in this same cron pass; a later reaper can never create a second
  -- recovery job because retry_of_job_id is checked before the insert.
  with legacy_failed as (
    update public.weekly_digest_generation_jobs job
    set status = 'failed',
        locked_at = null,
        finished_at = now(),
        failure_code = 'legacy_worker_timeout',
        last_error = coalesce(last_error, 'Legacy worker lease expired before the durable attempt ledger was enabled.'),
        status_reason = 'Legacy Vercel worker timed out; a linked GitHub Actions retry was queued'
    where job.status = 'running'
      and job.current_attempt_id is null
      and job.attempts >= job.max_attempts
      and coalesce(job.heartbeat_at, job.locked_at, job.started_at, job.created_at) < now() - p_stale_after
    returning job.*
  ), recovery_jobs as (
    insert into public.weekly_digest_generation_jobs (
      weekly_digest_id, revision_id, artifact_id, job_type, idempotency_key, status,
      input, execution_backend, max_attempts, retry_of_job_id, created_by, status_reason
    )
    select
      source.weekly_digest_id, source.revision_id, source.artifact_id, source.job_type,
      'legacy-retry:' || gen_random_uuid()::text, 'queued', source.input,
      public.weekly_generation_backend(source.job_type), source.max_attempts, source.id,
      source.created_by, 'Automatic retry after legacy worker timeout'
    from legacy_failed source
    where source.job_type in ('editorial_master', 'social_copy', 'video_script')
      and not exists (
        select 1 from public.weekly_digest_generation_jobs retry
        where retry.retry_of_job_id = source.id
      )
    returning id, retry_of_job_id, max_attempts
  )
  insert into public.weekly_digest_generation_events (job_id, event_type, level, step, message, metadata)
  select
    source.id, 'legacy_worker_timed_out', 'error', 'prepare',
    'Legacy Vercel worker timed out; historical attempts were preserved.',
    jsonb_build_object('failure_code', 'legacy_worker_timeout', 'attempt', source.attempts)
  from legacy_failed source
  union all
  select
    retry.id, 'legacy_recovery_retry_created', 'info', 'prepare',
    'Created linked GitHub Actions retry with Attempt 1/3.',
    jsonb_build_object('retry_of_job_id', retry.retry_of_job_id, 'attempt', 1, 'max_attempts', retry.max_attempts)
  from recovery_jobs retry;

  update public.weekly_digest_generation_jobs
  set status = 'queued',
      dispatch_token = null,
      status_reason = 'GitHub dispatch did not start; returned to queue',
      next_attempt_at = now()
  where status = 'dispatching'
    and updated_at < now() - interval '10 minutes';
  get diagnostics dispatches_requeued = row_count;
end;
$function$;

do $block$
declare
  v_existing_job record;
begin
  for v_existing_job in
    select jobid from cron.job where jobname = 'weekly_digest_generation_reaper'
  loop
    perform cron.unschedule(v_existing_job.jobid);
  end loop;
  perform cron.schedule(
    'weekly_digest_generation_reaper',
    '* * * * *',
    $command$select public.reap_stale_weekly_digest_generation_attempts(interval '90 seconds')$command$
  );
end;
$block$;

create or replace function public.prepare_weekly_digest_github_dispatch(p_job_id uuid default null)
returns table (job_id uuid, weekly_digest_id uuid, dispatch_token uuid)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_job public.weekly_digest_generation_jobs;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  select * into v_job
  from public.weekly_digest_generation_jobs
  where execution_backend = 'github_actions'
    and status in ('queued', 'retry_scheduled')
    and attempts < max_attempts
    and coalesce(next_attempt_at, '-infinity'::timestamptz) <= now()
    and (p_job_id is null or id = p_job_id)
  order by created_at
  for update skip locked;
  if v_job.id is null then return; end if;
  if not public.weekly_generation_job_ready(v_job) then
    update public.weekly_digest_generation_jobs job
    set status = 'waiting',
        status_reason = public.weekly_generation_waiting_reason(v_job),
        next_attempt_at = null
    where job.id = v_job.id
      and job.status in ('queued', 'retry_scheduled');
    insert into public.weekly_digest_generation_events (job_id, event_type, step, message, metadata)
    values (
      v_job.id, 'dependency_waiting', 'prepare',
      public.weekly_generation_waiting_reason(v_job), jsonb_build_object('state', 'waiting')
    );
    return;
  end if;
  update public.weekly_digest_generation_jobs
  set status = 'dispatching',
      dispatch_token = gen_random_uuid(),
      status_reason = 'Dispatching a dedicated GitHub Actions worker',
      next_attempt_at = null
  where job.id = v_job.id
  returning job.dispatch_token into dispatch_token;
  job_id := v_job.id;
  weekly_digest_id := v_job.weekly_digest_id;
  insert into public.weekly_digest_generation_events (job_id, event_type, step, message, metadata)
  values (
    v_job.id, 'github_dispatch_requested', 'prepare', 'GitHub Actions worker requested',
    jsonb_build_object('attempt', v_job.attempts + 1, 'max_attempts', v_job.max_attempts)
  );
  return next;
end;
$function$;

create or replace function public.checkpoint_weekly_digest_generation_attempt(
  p_attempt_id uuid,
  p_lease_token uuid,
  p_output jsonb,
  p_step text,
  p_progress_current integer default null,
  p_progress_total integer default 100
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_attempt public.weekly_digest_generation_attempts;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_output is null or jsonb_typeof(p_output) <> 'object' then
    raise exception 'Checkpoint output must be an object';
  end if;
  select attempt.* into v_attempt
  from public.weekly_digest_generation_attempts attempt
  join public.weekly_digest_generation_jobs job on job.id = attempt.job_id
  where attempt.id = p_attempt_id
    and attempt.lease_token = p_lease_token
    and attempt.status = 'running'
    and job.current_attempt_id = attempt.id
    and job.status = 'running'
  for update of attempt, job;
  if v_attempt.id is null then return false; end if;
  perform public.heartbeat_weekly_digest_generation_attempt(
    p_attempt_id, p_lease_token, p_step, p_progress_current, p_progress_total, null, null
  );
  update public.weekly_digest_generation_jobs
  set output = coalesce(output, '{}'::jsonb) || p_output,
      status_reason = 'Checkpoint persisted for ' || left(coalesce(nullif(btrim(p_step), ''), 'generation'), 100)
  where id = v_attempt.job_id
    and current_attempt_id = v_attempt.id;
  insert into public.weekly_digest_generation_events (
    job_id, attempt_id, event_type, step, progress_current, progress_total, message
  ) values (
    v_attempt.job_id, v_attempt.id, 'checkpoint_saved', nullif(btrim(p_step), ''),
    p_progress_current, p_progress_total, 'Durable checkpoint saved'
  );
  return true;
end;
$function$;

create or replace function public.retry_weekly_digest_generation_job(p_job_id uuid)
returns public.weekly_digest_generation_jobs
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_source public.weekly_digest_generation_jobs;
  v_retry public.weekly_digest_generation_jobs;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and not public.has_social_role(array['owner', 'editor']) then
    raise exception 'Owner or editor session required' using errcode = '42501';
  end if;
  select * into v_source
  from public.weekly_digest_generation_jobs
  where id = p_job_id
    and status in ('failed', 'cancelled')
  for update;
  if v_source.id is null then
    raise exception 'Only a terminal generation job can be retried';
  end if;
  insert into public.weekly_digest_generation_jobs (
    weekly_digest_id, revision_id, artifact_id, job_type, idempotency_key, status,
    input, execution_backend, max_attempts, retry_of_job_id, created_by, status_reason
  ) values (
    v_source.weekly_digest_id, v_source.revision_id, v_source.artifact_id, v_source.job_type,
    'manual-retry:' || gen_random_uuid()::text, 'queued', v_source.input,
    public.weekly_generation_backend(v_source.job_type), v_source.max_attempts, v_source.id,
    auth.uid(), 'Manual retry of terminal job ' || v_source.id::text
  ) returning * into v_retry;
  insert into public.weekly_digest_generation_events (job_id, event_type, message, metadata)
  values (
    v_retry.id, 'manual_retry_created', 'Created from a terminal job without erasing history',
    jsonb_build_object('retry_of_job_id', v_source.id)
  );
  return v_retry;
end;
$function$;

-- Keep the deployed pre-control-plane worker backward compatible during the
-- additive rollout.  Its legacy claim RPC must never claim a job routed to
-- GitHub Actions before the application deployment has switched to the v2
-- fenced claim path.
create or replace function public.claim_weekly_digest_generation_jobs(
  p_job_types text[] default null,
  p_limit integer default 5,
  p_stale_after interval default interval '15 minutes'
)
returns setof public.weekly_digest_generation_jobs
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_job public.weekly_digest_generation_jobs;
  v_claimed public.weekly_digest_generation_jobs;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_job_types is not null and (
    cardinality(p_job_types) = 0
    or exists (
      select 1 from unnest(p_job_types) as requested(job_type)
      where requested.job_type not in (
        'research_pack', 'editorial_master', 'social_copy', 'article', 'pdf',
        'cover', 'story_image', 'social_asset', 'video_script', 'video_manifest',
        'artifact_promotion'
      )
    )
  ) then
    raise exception 'Unsupported weekly digest generation job type filter';
  end if;
  if p_stale_after <= interval '0 seconds' or p_stale_after > interval '24 hours' then
    raise exception 'Stale timeout must be greater than zero and at most 24 hours';
  end if;

  for v_job in
    select job.*
    from public.weekly_digest_generation_jobs job
    join public.weekly_digests digest on digest.id = job.weekly_digest_id
    where job.execution_backend = 'vercel'
      and job.attempts < 5
      and digest.active_revision_id = job.revision_id
      and digest.status not in ('publishing', 'published', 'cancelled')
      and (p_job_types is null or job.job_type = any(p_job_types))
      and (
        job.status in ('queued', 'failed')
        or (job.status = 'running' and job.locked_at < now() - p_stale_after)
      )
      and case job.job_type
        when 'editorial_master' then (
          select count(*) = 3
          from public.weekly_digest_artifacts artifact
          join public.weekly_digest_revision_items item
            on item.id = artifact.revision_item_id
          where artifact.revision_id = job.revision_id
            and item.rank <= 3
            and artifact.artifact_type = 'research_pack'
            and artifact.is_current
            and artifact.generation_status = 'ready'
            and artifact.review_status = 'approved'
        )
        when 'story_image' then (
          (
            select count(*) = 2
            from public.weekly_digest_artifacts artifact
            where artifact.revision_id = job.revision_id
              and artifact.is_current
              and artifact.review_status = 'approved'
              and artifact.artifact_type = 'article'
              and artifact.slot_key in ('article:en', 'article:uk')
          )
          or (
            nullif(btrim(coalesce(job.input ->> 'revision_item_id', '')), '') is not null
            and exists (
              select 1
              from public.weekly_digest_artifacts artifact
              where artifact.revision_id = job.revision_id
                and artifact.revision_item_id = nullif(btrim(job.input ->> 'revision_item_id'), '')::uuid
                and artifact.artifact_type = 'story_image'
                and artifact.is_current
                and artifact.generation_status = 'ready'
            )
          )
        )
        when 'cover' then not exists (
          select 1
          from public.weekly_digest_revision_items item
          where item.revision_id = job.revision_id
            and not exists (
              select 1 from public.weekly_digest_artifacts artifact
              where artifact.revision_item_id = item.id
                and artifact.artifact_type = 'story_image'
                and artifact.is_current
                and artifact.generation_status = 'ready'
            )
        )
        when 'pdf' then exists (
          select 1 from public.weekly_digest_artifacts artifact
          where artifact.revision_id = job.revision_id
            and artifact.artifact_type = 'cover'
            and artifact.is_current
            and artifact.generation_status = 'ready'
        ) and exists (
          select 1 from public.weekly_digest_artifacts article
          where article.revision_id = job.revision_id
            and article.artifact_type = 'article'
            and article.locale = coalesce(nullif(job.input ->> 'locale', ''), 'en')
            and article.is_current
            and article.generation_status = 'ready'
        )
        when 'social_copy' then exists (
          select 1 from public.weekly_digest_artifacts artifact
          where artifact.revision_id = job.revision_id
            and artifact.artifact_type = 'cover'
            and artifact.is_current
            and artifact.generation_status = 'ready'
        ) and (
          select count(*) = 2 from public.weekly_digest_artifacts artifact
          where artifact.revision_id = job.revision_id
            and artifact.artifact_type = 'article'
            and artifact.is_current
            and artifact.review_status = 'approved'
        )
        when 'video_script' then (
          select count(*) = 2 from public.weekly_digest_artifacts artifact
          where artifact.revision_id = job.revision_id
            and artifact.artifact_type = 'article'
            and artifact.is_current
            and artifact.review_status = 'approved'
        )
        when 'video_manifest' then exists (
          select 1 from public.weekly_digest_artifacts artifact
          where artifact.revision_id = job.revision_id
            and artifact.artifact_type = 'video_script'
            and artifact.is_current
            and artifact.review_status = 'approved'
        ) and (
          select count(*) = 3
          from public.weekly_digest_artifacts artifact
          join public.weekly_digest_revision_items item
            on item.id = artifact.revision_item_id
          where artifact.revision_id = job.revision_id
            and item.rank <= 3
            and artifact.artifact_type = 'story_image'
            and artifact.is_current
            and artifact.generation_status = 'ready'
            and artifact.review_status = 'approved'
        ) and exists (
          select 1 from public.weekly_digest_artifacts cover
          where cover.revision_id = job.revision_id
            and cover.artifact_type = 'cover'
            and cover.is_current
            and cover.generation_status = 'ready'
        )
        else true
      end
    order by
      case job.status when 'queued' then 0 when 'failed' then 1 else 2 end,
      case job.job_type
        when 'research_pack' then 0
        when 'editorial_master' then 1
        when 'story_image' then 2
        when 'cover' then 3
        when 'social_copy' then 4
        when 'video_script' then 5
        when 'video_manifest' then 6
        when 'pdf' then 7
        when 'social_asset' then 8
        else 9
      end,
      job.created_at,
      job.id
    for update of job skip locked
    limit greatest(1, least(coalesce(p_limit, 5), 20))
  loop
    update public.weekly_digest_generation_jobs
    set status = 'running', attempts = attempts + 1, locked_at = now(),
        started_at = coalesce(started_at, now()), finished_at = null,
        last_error = null
    where id = v_job.id
    returning * into v_claimed;

    insert into public.weekly_digest_release_events (
      weekly_digest_id, revision_id, event_type, payload
    ) values (
      v_claimed.weekly_digest_id, v_claimed.revision_id, 'generation_started',
      jsonb_build_object(
        'job_id', v_claimed.id,
        'job_type', v_claimed.job_type,
        'attempt', v_claimed.attempts
      )
    );
    return next v_claimed;
  end loop;
end;
$function$;

revoke all on function public.claim_weekly_digest_generation_jobs_v2(text, text[], integer, uuid, uuid, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.weekly_generation_waiting_reason(public.weekly_digest_generation_jobs)
  from public, anon, authenticated;
revoke all on function public.weekly_generation_job_ready(public.weekly_digest_generation_jobs)
  from public, anon, authenticated;
revoke all on function public.heartbeat_weekly_digest_generation_attempt(uuid, uuid, text, integer, integer, text, text)
  from public, anon, authenticated;
revoke all on function public.record_weekly_digest_generation_event(uuid, uuid, text, text, text, text, text, integer, integer, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.finish_weekly_digest_generation_attempt(uuid, uuid, boolean, jsonb, text, text, boolean, uuid)
  from public, anon, authenticated;
revoke all on function public.checkpoint_weekly_digest_generation_attempt(uuid, uuid, jsonb, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.reap_stale_weekly_digest_generation_attempts(interval)
  from public, anon, authenticated;
revoke all on function public.refresh_weekly_digest_generation_waiting_states()
  from public, anon, authenticated;
revoke all on function public.prepare_weekly_digest_github_dispatch(uuid)
  from public, anon, authenticated;
revoke all on function public.retry_weekly_digest_generation_job(uuid)
  from public, anon, authenticated;

grant execute on function public.claim_weekly_digest_generation_jobs_v2(text, text[], integer, uuid, uuid, text, text, integer)
  to service_role;
grant execute on function public.weekly_generation_waiting_reason(public.weekly_digest_generation_jobs)
  to service_role;
grant execute on function public.weekly_generation_job_ready(public.weekly_digest_generation_jobs)
  to service_role;
grant execute on function public.heartbeat_weekly_digest_generation_attempt(uuid, uuid, text, integer, integer, text, text)
  to service_role;
grant execute on function public.record_weekly_digest_generation_event(uuid, uuid, text, text, text, text, text, integer, integer, text, jsonb)
  to service_role;
grant execute on function public.finish_weekly_digest_generation_attempt(uuid, uuid, boolean, jsonb, text, text, boolean, uuid)
  to service_role;
grant execute on function public.checkpoint_weekly_digest_generation_attempt(uuid, uuid, jsonb, text, integer, integer)
  to service_role;
grant execute on function public.reap_stale_weekly_digest_generation_attempts(interval)
  to service_role;
grant execute on function public.refresh_weekly_digest_generation_waiting_states()
  to service_role;
grant execute on function public.prepare_weekly_digest_github_dispatch(uuid)
  to service_role;
grant execute on function public.retry_weekly_digest_generation_job(uuid)
  to authenticated, service_role;

commit;
