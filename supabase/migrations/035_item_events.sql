-- ============================================================================
-- 035 — First-party per-item interaction events (the audience reward signal)
--
-- Engagement currently lives only in GA4: sampled, latent 24–48h, not ours, and
-- not joinable to brief_items. To calibrate ranking weights against what readers
-- actually engage with, we need a per-item, first-party, PII-free signal we own.
--
-- item_events  — append-only raw beacon hits. No raw ip/ua is ever stored: only a
--                daily-rotating session_hash = sha256(ip + ua + yyyy-mm-dd + salt),
--                so we count interactions, not people. Plus a coarse ua_class.
-- item_metrics — per-item rollup (human-only) for cheap joins to brief_items: the
--                reward vector for weight calibration. Refreshed on a schedule.
--
-- Service-role writes only (the /api/ev route). RLS on, no anon policy.
-- ============================================================================

begin;

create table if not exists public.item_events (
  id            bigint generated always as identity primary key,
  brief_item_id uuid references public.brief_items(id) on delete set null,
  slug          text,
  event_type    text not null check (event_type in
                  ('view','post_expand','scroll_50','scroll_90',
                   'save_toggle','outbound_click','share','dwell')),
  value         numeric,            -- dwell ms / scroll pct, when relevant
  session_hash  text,               -- sha256(ip+ua+yyyy-mm-dd+salt) — NOT PII, rotates daily
  lang          text,
  ua_class      text,               -- 'human' | 'bot' | 'unknown'
  ts            timestamptz not null default now()
);

create index if not exists idx_item_events_item on public.item_events(brief_item_id, ts);
create index if not exists idx_item_events_slug on public.item_events(slug, ts);
create index if not exists idx_item_events_type on public.item_events(event_type, ts);

comment on table public.item_events is
  'Append-only first-party per-item interaction beacons (reward signal). PII-free: only a daily-rotating session_hash, never raw ip/ua. Written by /api/ev (service role).';

create table if not exists public.item_metrics (
  brief_item_id uuid primary key references public.brief_items(id) on delete cascade,
  views         integer default 0,
  expands       integer default 0,
  scroll50      integer default 0,
  scroll90      integer default 0,
  saves         integer default 0,
  outbound      integer default 0,
  shares        integer default 0,
  dwell_ms_p50  integer,
  updated_at    timestamptz default now()
);

comment on table public.item_metrics is
  'Per-item engagement rollup (human ua_class only) for joins to brief_items — the reward vector for weight calibration. Refreshed on a schedule from item_events.';

alter table public.item_events  enable row level security;
alter table public.item_metrics enable row level security;

commit;
