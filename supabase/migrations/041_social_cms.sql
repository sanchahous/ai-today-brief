-- Mobile-first social CMS foundation, applied after the social delivery queue.
-- Adds versioned approval, a lock-safe delivery queue, persisted weekly
-- digests, account health, engagement tasks, and owner-only RLS.

begin;

create extension if not exists supabase_vault with schema vault;

-- ── Admin identity and authorization helpers ──────────────────────────────

create table if not exists public.social_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'owner'
                check (role in ('owner', 'editor', 'analyst')),
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.social_admins enable row level security;

create or replace function public.is_social_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.social_admins
    where user_id = auth.uid() and enabled
  )
$$;

create or replace function public.has_social_aal2()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

revoke all on function public.is_social_admin() from public;
revoke all on function public.has_social_aal2() from public;
grant execute on function public.is_social_admin() to authenticated, service_role;
grant execute on function public.has_social_aal2() to authenticated, service_role;

drop policy if exists "social admins: self read" on public.social_admins;
create policy "social admins: self read"
  on public.social_admins for select to authenticated
  using (user_id = auth.uid() and enabled);

-- ── Packages and persisted weekly editions ────────────────────────────────

create table if not exists public.weekly_digests (
  id            uuid primary key default gen_random_uuid(),
  week_start    date not null,
  slug          text not null unique,
  status        text not null default 'draft'
                  check (status in ('draft', 'in_review', 'published', 'cancelled')),
  title_en      text not null,
  title_uk      text not null,
  intro_en      text,
  intro_uk      text,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (week_start)
);

create table if not exists public.weekly_digest_items (
  weekly_digest_id uuid not null references public.weekly_digests(id) on delete cascade,
  brief_item_id    uuid not null references public.brief_items(id) on delete restrict,
  rank             smallint not null check (rank between 1 and 7),
  snapshot          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  primary key (weekly_digest_id, brief_item_id),
  unique (weekly_digest_id, rank)
);

create table if not exists public.social_packages (
  id                   uuid primary key default gen_random_uuid(),
  kind                 text not null
                         check (kind in ('daily_digest', 'top_story', 'weekly_digest', 'breaking', 'evergreen')),
  risk_level           text not null
                         check (risk_level in ('green', 'yellow', 'red')),
  status               text not null default 'draft'
                         check (status in ('draft', 'in_review', 'approved', 'scheduled', 'publishing', 'posted', 'failed', 'needs_reconciliation', 'cancelled')),
  source_date          date,
  source_brief_id      uuid references public.briefs(id) on delete set null,
  source_brief_item_id uuid references public.brief_items(id) on delete set null,
  source_item_ids      uuid[] not null default '{}'::uuid[],
  weekly_digest_id     uuid references public.weekly_digests(id) on delete set null,
  title                text not null,
  generation_version   text not null default 'social-v1',
  generated_at         timestamptz not null default now(),
  green_success_counted_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (
    (kind = 'weekly_digest' and weekly_digest_id is not null)
    or kind <> 'weekly_digest'
  )
);

create unique index if not exists social_packages_generation_uniq
  on public.social_packages (
    kind,
    coalesce(source_date, '-infinity'::date),
    coalesce(source_brief_item_id, '00000000-0000-0000-0000-000000000000'::uuid),
    generation_version
  )
  where status <> 'cancelled';

create index if not exists social_packages_review_idx
  on public.social_packages (status, source_date desc);

-- ── Versioned channel variants ────────────────────────────────────────────

drop policy if exists "social posts: public read posted" on public.social_posts;

update public.social_posts set status = 'draft' where status = 'queued';

alter table public.social_posts
  add column if not exists package_id uuid references public.social_packages(id) on delete cascade,
  add column if not exists locale text,
  add column if not exists format text,
  add column if not exists first_comment text,
  add column if not exists asset_urls jsonb not null default '[]'::jsonb,
  add column if not exists alt_text text,
  add column if not exists quality_report jsonb not null default '{"blocking":[],"warnings":[]}'::jsonb,
  add column if not exists content_hash text,
  add column if not exists content_version integer not null default 1,
  add column if not exists approval_version integer,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists retry_after timestamptz,
  add column if not exists publishing_started_at timestamptz,
  add column if not exists tracking_token uuid not null default gen_random_uuid();

alter table public.subscribers
  add column if not exists social_post_id uuid references public.social_posts(id) on delete set null;

create index if not exists subscribers_social_post_idx
  on public.subscribers (social_post_id)
  where social_post_id is not null;

alter table public.social_posts
  alter column status set default 'draft',
  drop constraint if exists social_posts_status_check,
  add constraint social_posts_status_check
    check (status in ('draft', 'in_review', 'approved', 'scheduled', 'publishing', 'posted', 'failed', 'needs_reconciliation', 'cancelled')),
  drop constraint if exists social_posts_locale_check,
  add constraint social_posts_locale_check check (locale is null or locale in ('uk', 'en')),
  drop constraint if exists social_posts_content_version_positive,
  add constraint social_posts_content_version_positive check (content_version > 0),
  drop constraint if exists social_posts_approval_version_valid,
  add constraint social_posts_approval_version_valid
    check (approval_version is null or approval_version <= content_version),
  drop constraint if exists social_posts_assets_array,
  add constraint social_posts_assets_array check (jsonb_typeof(asset_urls) = 'array');

create unique index if not exists social_posts_tracking_token_uniq
  on public.social_posts (tracking_token);

create unique index if not exists social_posts_package_channel_uniq
  on public.social_posts (package_id, channel)
  where package_id is not null;

drop index if exists public.social_posts_due_idx;
create index social_posts_due_idx
  on public.social_posts (coalesce(retry_after, scheduled_for), status)
  where status in ('approved', 'scheduled', 'failed');

create table if not exists public.social_post_reviews (
  id               bigint generated always as identity primary key,
  social_post_id   uuid not null references public.social_posts(id) on delete cascade,
  package_id       uuid references public.social_packages(id) on delete cascade,
  reviewer_id      uuid references auth.users(id) on delete set null,
  action           text not null
                     check (action in ('generated', 'edited', 'approved', 'rejected', 'scheduled', 'cancelled', 'auto_revoked')),
  content_version  integer not null,
  content_hash     text,
  snapshot         jsonb not null,
  note             text,
  created_at       timestamptz not null default now()
);

create index if not exists social_post_reviews_post_created_idx
  on public.social_post_reviews (social_post_id, created_at desc);

create table if not exists public.social_delivery_attempts (
  id                bigint generated always as identity primary key,
  social_post_id    uuid not null references public.social_posts(id) on delete cascade,
  attempt_number    integer not null check (attempt_number > 0),
  idempotency_key   text,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  outcome           text not null default 'started'
                      check (outcome in ('started', 'posted', 'retryable_error', 'permanent_error', 'ambiguous')),
  request_summary   jsonb not null default '{}'::jsonb,
  response_summary  jsonb not null default '{}'::jsonb,
  error_code        text,
  error_message     text,
  unique (social_post_id, attempt_number)
);

-- Each event is intentionally anonymous: no IP address, full referrer, or raw
-- user-agent is retained.
create table if not exists public.social_click_events (
  id             bigint generated always as identity primary key,
  social_post_id uuid not null references public.social_posts(id) on delete cascade,
  clicked_at     timestamptz not null default now(),
  referrer_host  text,
  device_class   text check (device_class is null or device_class in ('mobile', 'desktop', 'bot', 'unknown'))
);

create index if not exists social_click_events_post_clicked_idx
  on public.social_click_events (social_post_id, clicked_at desc);

-- ── Accounts, switches, and curated engagement ────────────────────────────

create table if not exists public.social_accounts (
  id                  uuid primary key default gen_random_uuid(),
  channel             text not null unique
                        check (channel in ('telegram', 'x', 'threads', 'linkedin', 'instagram', 'facebook')),
  handle              text,
  provider_account_id text,
  capabilities        jsonb not null default '{}'::jsonb,
  token_expires_at    timestamptz,
  connection_health   text not null default 'unconfigured'
                        check (connection_health in ('unconfigured', 'healthy', 'warning', 'expired', 'revoked', 'error')),
  secret_reference    text,
  last_checked_at     timestamptz,
  last_alerted_at     timestamptz,
  enabled             boolean not null default false,
  updated_at          timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create table if not exists public.social_account_metrics (
  id              bigint generated always as identity primary key,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  measured_at     timestamptz not null default now(),
  followers_count integer check (followers_count is null or followers_count >= 0),
  raw             jsonb not null default '{}'::jsonb
);

create index if not exists social_account_metrics_account_measured_idx
  on public.social_account_metrics (social_account_id, measured_at desc);

create table if not exists public.social_settings (
  id                   boolean primary key default true check (id),
  global_kill_switch   boolean not null default true,
  channel_enabled      jsonb not null default '{"telegram":false,"x":false,"threads":false,"linkedin":false,"instagram":false,"facebook":false}'::jsonb,
  cadence              jsonb not null default '{}'::jsonb,
  auto_publish_green   boolean not null default false,
  green_success_count  integer not null default 0 check (green_success_count >= 0),
  x_monthly_budget_eur numeric(6,2) not null default 10.00
                         check (x_monthly_budget_eur between 0 and 10),
  x_monthly_spend_eur  numeric(6,2) not null default 0
                         check (x_monthly_spend_eur >= 0),
  x_budget_month       date not null default date_trunc('month', current_date)::date,
  updated_by           uuid references auth.users(id) on delete set null,
  updated_at           timestamptz not null default now()
);

insert into public.social_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.engagement_targets (
  id          uuid primary key default gen_random_uuid(),
  channel     text not null
                check (channel in ('telegram', 'x', 'threads', 'linkedin', 'instagram', 'facebook')),
  handle      text not null,
  profile_url text not null,
  rationale   text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (channel, handle)
);

create table if not exists public.engagement_tasks (
  id             uuid primary key default gen_random_uuid(),
  target_id      uuid references public.engagement_targets(id) on delete set null,
  channel        text not null
                   check (channel in ('telegram', 'x', 'threads', 'linkedin', 'instagram', 'facebook')),
  action         text not null
                   check (action in ('review_profile', 'follow', 'comment', 'reshare', 'invite_connection')),
  native_url     text not null,
  suggested_text text,
  rationale      text,
  status         text not null default 'open'
                   check (status in ('open', 'completed', 'dismissed')),
  due_at         timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists engagement_tasks_status_due_idx
  on public.engagement_tasks (status, due_at);

-- ── RLS ───────────────────────────────────────────────────────────────────

alter table public.weekly_digests enable row level security;
alter table public.weekly_digest_items enable row level security;
alter table public.social_packages enable row level security;
alter table public.social_post_reviews enable row level security;
alter table public.social_delivery_attempts enable row level security;
alter table public.social_click_events enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_account_metrics enable row level security;
alter table public.social_settings enable row level security;
alter table public.engagement_targets enable row level security;
alter table public.engagement_tasks enable row level security;

drop policy if exists "weekly digests: public published" on public.weekly_digests;
create policy "weekly digests: public published"
  on public.weekly_digests for select to anon, authenticated
  using (status = 'published');

drop policy if exists "weekly items: public published" on public.weekly_digest_items;
create policy "weekly items: public published"
  on public.weekly_digest_items for select to anon, authenticated
  using (exists (
    select 1 from public.weekly_digests wd
    where wd.id = weekly_digest_id and wd.status = 'published'
  ));

-- Admin reads require membership; every direct browser mutation additionally
-- requires an AAL2 session. Worker/service-role access bypasses RLS.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'social_posts', 'social_post_metrics', 'social_packages',
    'social_post_reviews', 'social_delivery_attempts', 'social_click_events',
    'social_accounts', 'social_account_metrics', 'social_settings', 'engagement_targets', 'engagement_tasks'
  ]
  loop
    execute format('drop policy if exists "social cms: admin read" on public.%I', table_name);
    execute format(
      'create policy "social cms: admin read" on public.%I for select to authenticated using (public.is_social_admin())',
      table_name
    );
    execute format('drop policy if exists "social cms: aal2 write" on public.%I', table_name);
    execute format(
      'create policy "social cms: aal2 write" on public.%I for all to authenticated using (public.is_social_admin() and public.has_social_aal2()) with check (public.is_social_admin() and public.has_social_aal2())',
      table_name
    );
  end loop;
end $$;

drop policy if exists "weekly digests: admin read" on public.weekly_digests;
create policy "weekly digests: admin read"
  on public.weekly_digests for select to authenticated using (public.is_social_admin());
drop policy if exists "weekly digests: aal2 write" on public.weekly_digests;
create policy "weekly digests: aal2 write"
  on public.weekly_digests for all to authenticated
  using (public.is_social_admin() and public.has_social_aal2())
  with check (public.is_social_admin() and public.has_social_aal2());

drop policy if exists "weekly items: admin read" on public.weekly_digest_items;
create policy "weekly items: admin read"
  on public.weekly_digest_items for select to authenticated using (public.is_social_admin());
drop policy if exists "weekly items: aal2 write" on public.weekly_digest_items;
create policy "weekly items: aal2 write"
  on public.weekly_digest_items for all to authenticated
  using (public.is_social_admin() and public.has_social_aal2())
  with check (public.is_social_admin() and public.has_social_aal2());

-- ── Approval and queue RPCs ────────────────────────────────────────────────

create or replace function public.approve_social_post(p_social_post_id uuid)
returns public.social_posts
language plpgsql
security invoker
set search_path = public
as $$
declare
  approved_post public.social_posts;
begin
  if not public.is_social_admin() or not public.has_social_aal2() then
    raise exception 'AAL2 social admin session required' using errcode = '42501';
  end if;

  update public.social_posts
  set status = 'approved',
      approval_version = content_version,
      approved_by = auth.uid(),
      approved_at = now(),
      last_error = null
  where id = p_social_post_id
    and status in ('draft', 'in_review', 'failed')
    and content_hash is not null
    and jsonb_array_length(coalesce(quality_report -> 'blocking', '[]'::jsonb)) = 0
  returning * into approved_post;

  if approved_post.id is null then
    raise exception 'Post is missing, blocked by quality rules, or not reviewable';
  end if;

  insert into public.social_post_reviews (
    social_post_id, package_id, reviewer_id, action,
    content_version, content_hash, snapshot
  ) values (
    approved_post.id, approved_post.package_id, auth.uid(), 'approved',
    approved_post.content_version, approved_post.content_hash,
    jsonb_build_object(
      'channel', approved_post.channel,
      'locale', approved_post.locale,
      'format', approved_post.format,
      'post_text', approved_post.post_text,
      'first_comment', approved_post.first_comment,
      'asset_urls', approved_post.asset_urls,
      'alt_text', approved_post.alt_text,
      'scheduled_for', approved_post.scheduled_for,
      'quality_report', approved_post.quality_report
    )
  );

  update public.social_packages p
  set status = case
        when not exists (
          select 1 from public.social_posts sp
          where sp.package_id = p.id and sp.status <> 'approved'
        ) then 'approved'
        else 'in_review'
      end,
      updated_at = now()
  where p.id = approved_post.package_id;

  return approved_post;
end;
$$;

create or replace function public.edit_social_post(
  p_social_post_id uuid,
  p_expected_version integer,
  p_post_text text,
  p_first_comment text,
  p_alt_text text,
  p_scheduled_for timestamptz,
  p_quality_report jsonb,
  p_content_hash text
)
returns public.social_posts
language plpgsql
security invoker
set search_path = public
as $$
declare
  edited_post public.social_posts;
begin
  if not public.is_social_admin() then
    raise exception 'Social admin session required' using errcode = '42501';
  end if;

  update public.social_posts
  set post_text = p_post_text,
      first_comment = nullif(p_first_comment, ''),
      alt_text = nullif(p_alt_text, ''),
      scheduled_for = p_scheduled_for,
      quality_report = p_quality_report,
      content_version = content_version + 1,
      content_hash = p_content_hash,
      approval_version = null,
      approved_by = null,
      approved_at = null,
      status = 'in_review',
      retry_after = null,
      last_error = null
  where id = p_social_post_id
    and content_version = p_expected_version
    and status not in ('publishing', 'posted', 'cancelled')
  returning * into edited_post;

  if edited_post.id is null then
    raise exception 'Variant changed concurrently or can no longer be edited';
  end if;

  insert into public.social_post_reviews (
    social_post_id, package_id, reviewer_id, action,
    content_version, content_hash, snapshot
  ) values (
    edited_post.id, edited_post.package_id, auth.uid(), 'edited',
    edited_post.content_version, edited_post.content_hash,
    jsonb_build_object(
      'channel', edited_post.channel,
      'locale', edited_post.locale,
      'format', edited_post.format,
      'post_text', edited_post.post_text,
      'first_comment', edited_post.first_comment,
      'asset_urls', edited_post.asset_urls,
      'alt_text', edited_post.alt_text,
      'scheduled_for', edited_post.scheduled_for,
      'quality_report', edited_post.quality_report
    )
  );

  update public.social_packages
  set status = 'in_review', updated_at = now()
  where id = edited_post.package_id;

  return edited_post;
end;
$$;

create or replace function public.guard_social_content_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.post_text is distinct from old.post_text
    or new.first_comment is distinct from old.first_comment
    or new.asset_urls is distinct from old.asset_urls
    or new.alt_text is distinct from old.alt_text
    or new.scheduled_for is distinct from old.scheduled_for
    or new.locale is distinct from old.locale
    or new.format is distinct from old.format
  then
    if old.status in ('publishing', 'posted') then
      raise exception 'A publishing or posted variant is immutable';
    end if;
    if new.content_version = old.content_version then
      new.content_version := old.content_version + 1;
    end if;
    if new.content_hash is not distinct from old.content_hash then
      new.content_hash := null;
    end if;
    new.approval_version := null;
    new.approved_by := null;
    new.approved_at := null;
    new.status := 'in_review';
  end if;
  return new;
end;
$$;

drop trigger if exists social_posts_guard_content_approval on public.social_posts;
create trigger social_posts_guard_content_approval
  before update on public.social_posts
  for each row execute function public.guard_social_content_approval();

create or replace function public.approve_social_package(p_package_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  post_id uuid;
  approved_count integer := 0;
begin
  if not public.is_social_admin() or not public.has_social_aal2() then
    raise exception 'AAL2 social admin session required' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.social_posts
    where package_id = p_package_id
      and (
        content_hash is null
        or jsonb_array_length(coalesce(quality_report -> 'blocking', '[]'::jsonb)) > 0
        or status not in ('draft', 'in_review', 'approved', 'failed')
      )
  ) then
    raise exception 'Package contains a blocked or non-reviewable variant';
  end if;

  for post_id in
    select id from public.social_posts
    where package_id = p_package_id and status <> 'approved'
    order by created_at
  loop
    perform public.approve_social_post(post_id);
    approved_count := approved_count + 1;
  end loop;

  update public.social_packages
  set status = 'approved', updated_at = now()
  where id = p_package_id;

  update public.weekly_digests wd
  set status = 'published', published_at = coalesce(wd.published_at, now())
  where wd.id = (
    select weekly_digest_id from public.social_packages where id = p_package_id
  );

  return approved_count;
end;
$$;

create or replace function public.claim_due_social_posts(p_limit integer default 10)
returns setof public.social_posts
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;

  return query
  with settings as (
    select global_kill_switch, channel_enabled, x_monthly_budget_eur, x_monthly_spend_eur
    from public.social_settings where id = true
  ), candidates as (
    select sp.id
    from public.social_posts sp
    cross join settings s
    left join public.social_accounts sa on sa.channel = sp.channel
    where not s.global_kill_switch
      and coalesce((s.channel_enabled ->> sp.channel)::boolean, false)
      and coalesce(sa.enabled, false)
      and (sp.channel <> 'x' or s.x_monthly_spend_eur < s.x_monthly_budget_eur)
      and sp.status in ('approved', 'scheduled', 'failed')
      and (sp.status <> 'failed' or sp.retry_after is not null)
      and sp.approval_version = sp.content_version
      and sp.content_hash is not null
      -- Initial delivery plus retries after 5m, 30m and 2h.
      and sp.attempts < 4
      and coalesce(sp.retry_after, sp.scheduled_for) <= now()
    order by coalesce(sp.retry_after, sp.scheduled_for), sp.created_at
    for update of sp skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 10))
  ), claimed as (
    update public.social_posts sp
    set status = 'publishing',
        attempts = sp.attempts + 1,
        publishing_started_at = now(),
        retry_after = null,
        last_error = null
    from candidates c
    where sp.id = c.id
    returning sp.*
  )
  select * from claimed;
end;
$$;

create or replace function public.reconcile_stale_social_posts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;

  update public.social_posts
  set status = 'needs_reconciliation',
      last_error = 'Delivery worker stopped after provider request; verify the native account before retrying.'
  where status = 'publishing'
    and publishing_started_at < now() - interval '15 minutes';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.reserve_x_budget(p_amount numeric)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_amount <= 0 then return true; end if;

  update public.social_settings
  set x_monthly_spend_eur = case
        when x_budget_month = date_trunc('month', current_date)::date
          then x_monthly_spend_eur + p_amount
        else p_amount
      end,
      x_budget_month = date_trunc('month', current_date)::date
  where id = true
    and (
      case
        when x_budget_month = date_trunc('month', current_date)::date
          then x_monthly_spend_eur
        else 0
      end
    ) + p_amount <= x_monthly_budget_eur;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create or replace function public.auto_approve_green_package(p_package_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  select exists (
    select 1
    from public.social_packages p
    cross join public.social_settings s
    where p.id = p_package_id
      and p.risk_level = 'green'
      and p.status = 'in_review'
      and s.id = true
      and s.auto_publish_green
      and s.green_success_count >= 30
      and not exists (
        select 1 from public.social_posts sp
        where sp.package_id = p.id
          and (
            sp.content_hash is null
            or jsonb_array_length(coalesce(sp.quality_report -> 'blocking', '[]'::jsonb)) > 0
          )
      )
  ) into allowed;
  if not allowed then return false; end if;

  update public.social_posts
  set status = 'approved',
      approval_version = content_version,
      approved_at = now(),
      approved_by = null
  where package_id = p_package_id and status = 'in_review';

  insert into public.social_post_reviews (
    social_post_id, package_id, reviewer_id, action,
    content_version, content_hash, snapshot, note
  )
  select
    sp.id, sp.package_id, null, 'approved', sp.content_version, sp.content_hash,
    jsonb_build_object(
      'channel', sp.channel, 'post_text', sp.post_text,
      'first_comment', sp.first_comment, 'asset_urls', sp.asset_urls,
      'scheduled_for', sp.scheduled_for, 'quality_report', sp.quality_report
    ),
    'Automatic green approval after 30 incident-free green deliveries'
  from public.social_posts sp where sp.package_id = p_package_id;

  update public.social_packages set status = 'approved' where id = p_package_id;
  update public.weekly_digests wd
  set status = 'published', published_at = coalesce(wd.published_at, now())
  where wd.id = (
    select weekly_digest_id from public.social_packages where id = p_package_id
  );
  return true;
end;
$$;

create or replace function public.record_green_delivery_success(p_package_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  update public.social_packages
  set green_success_counted_at = now()
  where id = p_package_id
    and risk_level = 'green'
    and status = 'posted'
    and green_success_counted_at is null
    and not exists (
      select 1 from public.social_posts sp
      where sp.package_id = p_package_id and sp.attempts <> 1
    );
  get diagnostics affected = row_count;
  if affected = 1 then
    update public.social_settings
    set green_success_count = green_success_count + 1
    where id = true;
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.store_social_oauth_secret(
  p_channel text,
  p_secret text,
  p_expires_at timestamptz,
  p_provider_account_id text default null
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_name text := 'social_' || p_channel || '_oauth';
  secret_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  if p_channel not in ('threads', 'linkedin', 'instagram', 'facebook') then
    raise exception 'Unsupported OAuth channel';
  end if;
  select id into secret_id from vault.secrets where name = secret_name limit 1;
  if secret_id is null then
    perform vault.create_secret(p_secret, secret_name, 'Refreshable social OAuth access token');
  else
    perform vault.update_secret(secret_id, p_secret, secret_name, 'Refreshable social OAuth access token');
  end if;
  insert into public.social_accounts (
    channel, provider_account_id, token_expires_at,
    connection_health, secret_reference, last_checked_at, enabled
  ) values (
    p_channel, p_provider_account_id, p_expires_at,
    'healthy', secret_name, now(), false
  )
  on conflict (channel) do update
  set provider_account_id = coalesce(excluded.provider_account_id, social_accounts.provider_account_id),
      token_expires_at = excluded.token_expires_at,
      connection_health = 'healthy',
      secret_reference = secret_name,
      last_checked_at = now();
end;
$$;

create or replace function public.read_social_oauth_secret(p_channel text)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_value text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role required' using errcode = '42501';
  end if;
  select decrypted_secret into secret_value
  from vault.decrypted_secrets
  where name = 'social_' || p_channel || '_oauth'
  limit 1;
  return secret_value;
end;
$$;

revoke all on function public.approve_social_post(uuid) from public;
revoke all on function public.edit_social_post(uuid, integer, text, text, text, timestamptz, jsonb, text) from public;
revoke all on function public.approve_social_package(uuid) from public;
revoke all on function public.claim_due_social_posts(integer) from public;
revoke all on function public.reconcile_stale_social_posts() from public;
revoke all on function public.reserve_x_budget(numeric) from public;
revoke all on function public.auto_approve_green_package(uuid) from public;
revoke all on function public.record_green_delivery_success(uuid) from public;
revoke all on function public.store_social_oauth_secret(text, text, timestamptz, text) from public;
revoke all on function public.read_social_oauth_secret(text) from public;
grant execute on function public.approve_social_post(uuid) to authenticated;
grant execute on function public.edit_social_post(uuid, integer, text, text, text, timestamptz, jsonb, text) to authenticated;
grant execute on function public.approve_social_package(uuid) to authenticated;
grant execute on function public.claim_due_social_posts(integer) to service_role;
grant execute on function public.reconcile_stale_social_posts() to service_role;
grant execute on function public.reserve_x_budget(numeric) to service_role;
grant execute on function public.auto_approve_green_package(uuid) to service_role;
grant execute on function public.record_green_delivery_success(uuid) to service_role;
grant execute on function public.store_social_oauth_secret(text, text, timestamptz, text) to service_role;
grant execute on function public.read_social_oauth_secret(text) to service_role;

-- Immutable/versioned social assets. Uploads are service-role-only; delivery
-- providers need the final object URLs to remain publicly readable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-assets',
  'social-assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "social assets: public read" on storage.objects;
create policy "social assets: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'social-assets');

-- Updated timestamps.
drop trigger if exists weekly_digests_set_updated_at on public.weekly_digests;
create trigger weekly_digests_set_updated_at before update on public.weekly_digests
  for each row execute function extensions.moddatetime(updated_at);
drop trigger if exists social_packages_set_updated_at on public.social_packages;
create trigger social_packages_set_updated_at before update on public.social_packages
  for each row execute function extensions.moddatetime(updated_at);
drop trigger if exists social_accounts_set_updated_at on public.social_accounts;
create trigger social_accounts_set_updated_at before update on public.social_accounts
  for each row execute function extensions.moddatetime(updated_at);
drop trigger if exists social_settings_set_updated_at on public.social_settings;
create trigger social_settings_set_updated_at before update on public.social_settings
  for each row execute function extensions.moddatetime(updated_at);
drop trigger if exists engagement_targets_set_updated_at on public.engagement_targets;
create trigger engagement_targets_set_updated_at before update on public.engagement_targets
  for each row execute function extensions.moddatetime(updated_at);
drop trigger if exists engagement_tasks_set_updated_at on public.engagement_tasks;
create trigger engagement_tasks_set_updated_at before update on public.engagement_tasks
  for each row execute function extensions.moddatetime(updated_at);

commit;
