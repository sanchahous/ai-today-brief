-- Social delivery queue is a first-party capability: Postiz is intentionally not a
-- dependency. These fields make every post traceable from editorial approval
-- through provider delivery and later native-platform metric collection.

begin;

alter table public.social_posts
  add column if not exists idempotency_key text,
  add column if not exists scheduled_for timestamptz,
  add column if not exists attempts integer not null default 0,
  add column if not exists last_error text,
  add column if not exists post_text text,
  add column if not exists utm_url text,
  add column if not exists provider_meta jsonb not null default '{}'::jsonb;

alter table public.social_posts
  drop constraint if exists social_posts_channel_check,
  add constraint social_posts_channel_check
    check (channel in ('telegram', 'threads', 'x', 'instagram', 'facebook', 'linkedin', 'devto')),
  drop constraint if exists social_posts_status_check,
  add constraint social_posts_status_check
    check (status in ('draft', 'queued', 'scheduled', 'publishing', 'posted', 'failed', 'cancelled')),
  drop constraint if exists social_posts_attempts_nonnegative,
  add constraint social_posts_attempts_nonnegative check (attempts >= 0);

create unique index if not exists social_posts_idempotency_key_uniq
  on public.social_posts (idempotency_key)
  where idempotency_key is not null;

create index if not exists social_posts_due_idx
  on public.social_posts (status, scheduled_for)
  where status in ('queued', 'scheduled', 'failed');

-- Append-only snapshots: one post can accumulate 1h/24h/7d/30d metrics while
-- preserving the history needed to compare formats and platforms fairly.
create table if not exists public.social_post_metrics (
  id             bigint generated always as identity primary key,
  social_post_id uuid not null references public.social_posts(id) on delete cascade,
  measured_at    timestamptz not null default now(),
  impressions    integer,
  reach          integer,
  engagements    integer,
  likes          integer,
  comments       integer,
  shares         integer,
  saves          integer,
  clicks         integer,
  raw            jsonb not null default '{}'::jsonb,
  check (coalesce(impressions, 0) >= 0),
  check (coalesce(reach, 0) >= 0),
  check (coalesce(engagements, 0) >= 0)
);
create index if not exists social_post_metrics_post_measured_idx
  on public.social_post_metrics (social_post_id, measured_at desc);
alter table public.social_post_metrics enable row level security;
-- No anon/authenticated policy: metrics remain service-role/admin data.

commit;
