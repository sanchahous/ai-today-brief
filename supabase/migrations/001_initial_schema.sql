-- =========================================================
-- ai-news-scrapper: initial schema
-- =========================================================

-- Raw articles fetched from all sources (audit trail + rerank)
create table if not exists articles (
  id              uuid primary key default gen_random_uuid(),
  source_name     text not null,
  source_url      text not null,
  title           text not null,
  url             text not null,
  published_at    timestamptz not null,
  fetched_at      timestamptz default now(),
  raw             jsonb,
  hn_score        int,
  hn_comments     int,
  reddit_score    int,
  reddit_comments int,
  mentions_count  int default 1,   -- how many sources covered this story
  composite_score numeric,
  unique (url)
);

-- One brief per day (bilingual)
create table if not exists briefs (
  id           uuid primary key default gen_random_uuid(),
  date         date not null unique,
  title_en     text not null,
  title_uk     text not null,
  intro_en     text,
  intro_uk     text,
  status       text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  generated_by text,
  created_at   timestamptz default now()
);

-- Top-10 items per brief
create table if not exists brief_items (
  id              uuid primary key default gen_random_uuid(),
  brief_id        uuid not null references briefs (id) on delete cascade,
  article_id      uuid not null references articles (id),
  rank            int not null check (rank between 1 and 10),
  summary_en      text not null,
  summary_uk      text not null,
  why_matters_en  text,
  why_matters_uk  text,
  unique (brief_id, rank),
  unique (brief_id, article_id)
);

-- Pipeline run log (for debugging / retry decisions)
create table if not exists pipeline_runs (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  stage       text not null check (stage in ('fetch','rank','summarize','publish')),
  status      text not null check (status in ('ok','failed','skipped')),
  error       text,
  duration_ms int,
  meta        jsonb,
  created_at  timestamptz default now()
);

-- =========================================================
-- Indexes
-- =========================================================
create index if not exists articles_published_at_idx on articles (published_at desc);
create index if not exists articles_composite_score_idx on articles (composite_score desc);
create index if not exists briefs_date_status_idx on briefs (date desc) where status = 'published';
create index if not exists brief_items_brief_id_rank_idx on brief_items (brief_id, rank);
create index if not exists pipeline_runs_date_idx on pipeline_runs (date desc);

-- =========================================================
-- Row-Level Security
-- =========================================================
alter table briefs       enable row level security;
alter table brief_items  enable row level security;
alter table articles     enable row level security;
alter table pipeline_runs enable row level security;

-- Public: read published briefs + their items
create policy "public_read_briefs"
  on briefs for select
  using (status = 'published');

create policy "public_read_brief_items"
  on brief_items for select
  using (
    exists (
      select 1 from briefs b
      where b.id = brief_items.brief_id
        and b.status = 'published'
    )
  );

create policy "public_read_articles"
  on articles for select
  using (true);

-- pipeline_runs: no public access
-- (service role bypasses RLS automatically)
