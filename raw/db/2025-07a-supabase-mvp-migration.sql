-- ============================================================================
-- 07a — AI Brief · Supabase MVP migration
-- Project: ai-news-scrapper (ref mdiqfatpqczwqghwttpm) · Postgres 17
-- Adds the MVP business layer (subscribers, sponsors, social, sends),
-- P2 scaffolding (profiles, saved, comments, embeddings), RLS, and the fixes
-- for the current security advisors. Idempotent where practical.
--
-- SECURITY MODEL (read before running):
--   • anon/authenticated read ONLY published content + active sponsor units.
--   • subscribers / newsletter_sends / sponsors are NEVER readable by anon —
--     all writes go through Edge Functions using the service_role key.
--   • service_role bypasses RLS; never expose it in the client.
-- Re-run get_advisors(security|performance) after applying.
-- ============================================================================

begin;

-- ── Extensions (kept in the `extensions` schema, not public) ────────────────
create extension if not exists pgcrypto  with schema extensions;  -- gen_random_bytes
create extension if not exists citext     with schema extensions;  -- case-insensitive email
create extension if not exists moddatetime with schema extensions; -- updated_at triggers

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 · P0 — business core
-- ════════════════════════════════════════════════════════════════════════════

-- 1.1 subscribers — the monetisable asset (email list) ───────────────────────
create table if not exists public.subscribers (
  id            uuid primary key default gen_random_uuid(),
  email         citext not null unique,
  lang          text not null default 'uk' check (lang in ('uk','en')),
  segment       text not null default 'all' check (segment in ('all','dev','ua')),
  status        text not null default 'pending'
                  check (status in ('pending','active','unsubscribed','bounced')),
  source        text,                          -- e.g. home_band, feed_inline, /subscribe
  placement     text,                          -- F1 placement id (A/B)
  referral_code text unique default encode(extensions.gen_random_bytes(6),'hex'),
  referred_by   uuid references public.subscribers(id) on delete set null,
  beehiiv_id    text,                          -- id returned by Beehiiv
  ip_country    text,                          -- GDPR-minimal (country only)
  confirmed_at  timestamptz,                   -- double opt-in timestamp
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unsubscribed_at timestamptz
);
create index if not exists subscribers_status_idx  on public.subscribers (status);
create index if not exists subscribers_segment_idx on public.subscribers (segment);

alter table public.subscribers enable row level security;
-- No anon/authenticated policies → table is locked to service_role only.
-- (Subscribe flow runs in an Edge Function with the service_role key.)

drop trigger if exists subscribers_set_updated_at on public.subscribers;
create trigger subscribers_set_updated_at before update on public.subscribers
  for each row execute function extensions.moddatetime (updated_at);

-- 1.2 newsletter_sends — email analytics (feeds the open-rate decision gate) ──
create table if not exists public.newsletter_sends (
  id              uuid primary key default gen_random_uuid(),
  brief_id        uuid references public.briefs(id) on delete set null,
  beehiiv_post_id text,
  segment         text not null default 'all',
  status          text not null default 'queued'
                    check (status in ('queued','sent','failed')),
  recipients      integer default 0,
  opens           integer default 0,
  clicks          integer default 0,
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists newsletter_sends_brief_idx on public.newsletter_sends (brief_id);
alter table public.newsletter_sends enable row level security;
-- service_role only (no public policies).

-- 1.3 social_posts — Telegram / X / LinkedIn publish tracking ────────────────
create table if not exists public.social_posts (
  id            uuid primary key default gen_random_uuid(),
  brief_id      uuid references public.briefs(id) on delete cascade,
  brief_item_id uuid references public.brief_items(id) on delete cascade,
  channel       text not null check (channel in ('telegram','x','linkedin','devto')),
  external_id   text,
  url           text,
  status        text not null default 'queued'
                  check (status in ('queued','posted','failed')),
  posted_at     timestamptz,
  meta          jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists social_posts_brief_idx   on public.social_posts (brief_id);
create index if not exists social_posts_channel_idx on public.social_posts (channel, status);
alter table public.social_posts enable row level security;

drop policy if exists "social posts: public read posted" on public.social_posts;
create policy "social posts: public read posted"
  on public.social_posts for select
  to anon, authenticated
  using (status = 'posted');

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2 · P1 — monetisation (sponsors)
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.sponsors (
  id            uuid primary key default gen_random_uuid(),
  brand         text not null,
  color         text,
  logo_url      text,
  contact_email citext,
  notes         text,
  created_at    timestamptz not null default now()
);
alter table public.sponsors enable row level security;  -- service_role only

create table if not exists public.sponsor_placements (
  id           uuid primary key default gen_random_uuid(),
  sponsor_id   uuid not null references public.sponsors(id) on delete cascade,
  slot         text not null check (slot in ('home_week','feed','email','item')),
  lang         text not null default 'uk' check (lang in ('uk','en')),
  starts_on    date not null,
  ends_on      date not null,
  headline_en  text, headline_uk text,
  body_en      text, body_uk text,
  cta_en       text, cta_uk text,
  url          text not null,
  impressions  integer not null default 0,
  clicks       integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists sponsor_placements_live_idx
  on public.sponsor_placements (slot, lang, active, starts_on, ends_on);
alter table public.sponsor_placements enable row level security;

-- anon reads only currently-live placements (replaces hard-coded SPONSOR in F2)
drop policy if exists "placements: public read live" on public.sponsor_placements;
create policy "placements: public read live"
  on public.sponsor_placements for select
  to anon, authenticated
  using (active and current_date between starts_on and ends_on);

drop trigger if exists sponsor_placements_set_updated_at on public.sponsor_placements;
create trigger sponsor_placements_set_updated_at before update on public.sponsor_placements
  for each row execute function extensions.moddatetime (updated_at);

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3 · P2 — accounts, engagement, semantics (defer until needed)
-- ════════════════════════════════════════════════════════════════════════════

-- 3.1 profiles (when auth lands) ─────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  lang_pref   text default 'uk' check (lang_pref in ('uk','en')),
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles: self read"   on public.profiles;
drop policy if exists "profiles: self write"  on public.profiles;
create policy "profiles: self read"  on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles: self write" on public.profiles for all   to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- 3.2 saved_items (MVP uses localStorage; this is for the auth era) ──────────
create table if not exists public.saved_items (
  user_id       uuid not null references auth.users(id) on delete cascade,
  brief_item_id uuid not null references public.brief_items(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, brief_item_id)
);
alter table public.saved_items enable row level security;
drop policy if exists "saved: owner" on public.saved_items;
create policy "saved: owner" on public.saved_items for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3.3 comments (moderated) ───────────────────────────────────────────────────
create table if not exists public.comments (
  id            uuid primary key default gen_random_uuid(),
  brief_item_id uuid not null references public.brief_items(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  author_name   text,
  body          text not null,
  status        text not null default 'pending'
                  check (status in ('pending','approved','spam')),
  created_at    timestamptz not null default now()
);
create index if not exists comments_item_idx on public.comments (brief_item_id, status);
alter table public.comments enable row level security;
drop policy if exists "comments: public read approved" on public.comments;
drop policy if exists "comments: auth insert"          on public.comments;
create policy "comments: public read approved" on public.comments for select
  to anon, authenticated using (status = 'approved');
create policy "comments: auth insert" on public.comments for insert
  to authenticated with check (user_id = auth.uid());

-- 3.4 semantic embeddings (pgvector) — recommendations + dedup ───────────────
-- Uncomment to enable. Dimension must match your embedding model (1536 shown).
-- create extension if not exists vector with schema extensions;
-- create table if not exists public.brief_item_embeddings (
--   brief_item_id uuid primary key references public.brief_items(id) on delete cascade,
--   embedding     extensions.vector(1536) not null,
--   model         text not null,
--   created_at    timestamptz not null default now()
-- );
-- create index if not exists brief_item_embeddings_hnsw
--   on public.brief_item_embeddings using hnsw (embedding extensions.vector_cosine_ops);
-- alter table public.brief_item_embeddings enable row level security;  -- service_role only

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 4 · Security advisor fixes
-- ════════════════════════════════════════════════════════════════════════════

-- 4.1 pipeline_runs: RLS on but no policy. It is intentionally internal-only.
--     Make that explicit so the linter and humans agree (anon/auth see nothing).
drop policy if exists "pipeline_runs: no public access" on public.pipeline_runs;
create policy "pipeline_runs: no public access"
  on public.pipeline_runs for select to anon, authenticated using (false);

-- 4.2 Pin search_path on the search functions (mutable search_path WARN).
--     Loops over overloads so exact signatures aren't needed.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('search_brief_items','search_facets')
  loop
    execute format('alter function %s set search_path = public, pg_temp;', r.sig);
  end loop;
end $$;

commit;

-- 4.3 MANUAL / CAUTION — move pg_trgm out of the public schema.
-- Trigram operator classes are schema-qualified, so moving the extension can
-- break GIN/GiST indexes that reference public.gin_trgm_ops. Verify dependent
-- indexes first, then run OUTSIDE this transaction:
--   alter extension pg_trgm set schema extensions;
-- (If indexes break, recreate them referencing extensions.gin_trgm_ops.)

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 5 · RLS AUDIT CHECKLIST (existing content tables — verify manually)
-- ════════════════════════════════════════════════════════════════════════════
-- Lesson from research: 303 endpoints were once readable via the anon key.
-- Confirm anon reads ONLY published content:
--   • brief_items : SELECT allowed only where parent briefs.status = 'published'
--   • briefs      : SELECT allowed only where status = 'published'
--   • articles    : raw ingest — anon should have NO read access (serve via brief_items)
--   • categories / concepts : public read OK (reference data)
-- Example tightening (adjust to your existing policies):
--   drop policy if exists "brief_items public read" on public.brief_items;
--   create policy "brief_items: published only" on public.brief_items for select
--     to anon, authenticated using (
--       exists (select 1 from public.briefs b
--               where b.id = brief_items.brief_id and b.status = 'published'));
-- ============================================================================
