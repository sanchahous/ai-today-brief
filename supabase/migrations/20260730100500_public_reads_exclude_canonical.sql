-- ============================================================================
-- 20260730100500 — Public read RPCs exclude canonicalized (merged) items
--
-- `pipeline/dedup-scan.ts` (this PR) starts writing brief_items.canonical_item_id
-- on later copies of a story the retroactive scan confirmed as a duplicate —
-- same pattern as 031's one-time backfill, just ongoing. 031 only handled the
-- backfill data; the three SECURITY DEFINER read RPCs that bypass RLS never
-- got the matching `canonical_item_id is null` filter, so a freshly-merged
-- duplicate would keep showing up in search, facets and concept hubs until
-- the underlying row was removed by hand.
--
-- The item page itself (src/lib/items.ts getNewsItem) and RLS
-- (public_read_brief_items) are deliberately NOT touched here — a merged
-- item's own URL still needs to resolve so it can serve the 308 redirect to
-- its canonical.
--
-- search_facets also picks up `review_status = 'approved'`, which it was
-- missing entirely (a pre-existing bug: facet counts included pending/
-- rejected items via the definer bypass, diverging from what search_brief_items
-- actually lists) — noted separately in the PR description as a public-count
-- behaviour change.
-- ============================================================================

begin;

-- ── search_brief_items ───────────────────────────────────────────────────────
create or replace function public.search_brief_items(
  p_query      text,
  p_lang       text    default 'en',
  p_categories text[]  default null,
  p_from_date  date    default null,
  p_to_date    date    default null,
  p_sort       text    default 'auto',
  p_limit      integer default 20,
  p_offset     integer default 0
)
returns table (
  id           uuid,
  brief_id     uuid,
  rank         integer,
  slug         text,
  category_slug text,
  title_en     text,
  title_uk     text,
  summary_en   text,
  summary_uk   text,
  brief_date   date,
  brief_slug   text,
  source_name  text,
  rank_score   real,
  total_count  bigint
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  q         tsquery;
  ts_config regconfig;
  cleaned   text;
  sort_mode text;
begin
  ts_config := case when p_lang = 'uk' then 'simple'::regconfig
                                       else 'english'::regconfig end;

  cleaned := lower(trim(coalesce(p_query, '')));
  cleaned := regexp_replace(cleaned, '[^a-zа-яії0-9\s\-]', ' ', 'g');
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');

  if cleaned = '' then
    q := null;
  else
    q := (
      select to_tsquery(ts_config, string_agg(word || ':*', ' & '))
      from (select word from regexp_split_to_table(cleaned, ' ') as word
            where length(word) > 0) tokens
    );
  end if;

  sort_mode := case
    when p_sort in ('relevance', 'newest', 'oldest') then p_sort
    when q is null then 'newest'
    else 'relevance'
  end;

  return query
  with filtered as (
    select
      bi.*,
      b.date        as brief_date,
      b.slug        as brief_slug,
      a.source_name,
      case
        when q is null then 0::real
        when p_lang = 'uk' then ts_rank_cd(bi.search_tsv_uk, q)
        else                    ts_rank_cd(bi.search_tsv_en, q)
      end as rank_score
    from public.brief_items bi
    join public.briefs   b on b.id = bi.brief_id
    join public.articles a on a.id = bi.article_id
    where b.status = 'published'
      and bi.review_status = 'approved'
      and bi.canonical_item_id is null          -- ← new: hide merged duplicates
      and (
        q is null
        or (p_lang = 'uk' and bi.search_tsv_uk @@ q)
        or (p_lang <> 'uk' and bi.search_tsv_en @@ q)
      )
      and (p_categories is null or bi.category_slug = any (p_categories))
      and (p_from_date  is null or b.date >= p_from_date)
      and (p_to_date    is null or b.date <= p_to_date)
  ),
  counted as (
    select count(*) as total from filtered
  )
  select
    f.id, f.brief_id, f.rank, f.slug, f.category_slug,
    f.title_en, f.title_uk, f.summary_en, f.summary_uk,
    f.brief_date, f.brief_slug, f.source_name, f.rank_score,
    c.total
  from filtered f, counted c
  order by
    case when sort_mode = 'relevance' then f.rank_score else 0 end desc,
    case when sort_mode = 'oldest'    then f.brief_date end asc,
    case when sort_mode in ('newest', 'relevance') then f.brief_date end desc,
    f.rank asc
  limit  p_limit
  offset p_offset;
end;
$$;

grant execute on function public.search_brief_items(text, text, text[], date, date, text, int, int)
  to anon, authenticated;

-- ── search_facets ─────────────────────────────────────────────────────────────
create or replace function public.search_facets(
  p_query     text,
  p_lang      text default 'en',
  p_from_date date default null,
  p_to_date   date default null
)
returns table (
  category_slug text,
  count         bigint
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  q tsquery;
  ts_config regconfig;
  cleaned   text;
begin
  ts_config := case when p_lang = 'uk' then 'simple'::regconfig
                                       else 'english'::regconfig end;

  cleaned := lower(trim(coalesce(p_query, '')));
  cleaned := regexp_replace(cleaned, '[^a-zа-яії0-9\s\-]', ' ', 'g');
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');

  if cleaned = '' then
    q := null;
  else
    q := (
      select to_tsquery(ts_config, string_agg(word || ':*', ' & '))
      from (select word from regexp_split_to_table(cleaned, ' ') as word
            where length(word) > 0) tokens
    );
  end if;

  return query
  select
    bi.category_slug,
    count(*) as count
  from public.brief_items bi
  join public.briefs b on b.id = bi.brief_id
  where b.status = 'published'
    and bi.review_status = 'approved'            -- ← new: was missing entirely
    and bi.canonical_item_id is null              -- ← new: hide merged duplicates
    and bi.category_slug is not null
    and (
      q is null
      or (p_lang = 'uk' and bi.search_tsv_uk @@ q)
      or (p_lang <> 'uk' and bi.search_tsv_en @@ q)
    )
    and (p_from_date is null or b.date >= p_from_date)
    and (p_to_date   is null or b.date <= p_to_date)
  group by bi.category_slug
  order by count desc;
end;
$$;

grant execute on function public.search_facets(text, text, date, date)
  to anon, authenticated;

-- ── get_concept_items ─────────────────────────────────────────────────────────
create or replace function public.get_concept_items(
  p_concept_slug text,
  p_lang         text default 'en',
  p_limit        int  default 80
)
returns table (
  id              uuid,
  rank            int,
  slug            text,
  category_slug   text,
  title_en        text,
  title_uk        text,
  summary_en      text,
  summary_uk      text,
  why_en          text,
  why_uk          text,
  has_video       boolean,
  tools_mentioned jsonb,
  brief_slug      text,
  brief_date      date,
  source_name     text
)
language sql stable security definer
set search_path = public, pg_temp
as $func$
  select
    bi.id,
    bi.rank,
    bi.slug,
    bi.category_slug,
    bi.title_en,
    bi.title_uk,
    bi.summary_en,
    bi.summary_uk,
    bi.why_matters_en,
    bi.why_matters_uk,
    (bi.youtube_url is not null) as has_video,
    bi.tools_mentioned,
    b.slug as brief_slug,
    b.date as brief_date,
    a.source_name
  from public.brief_item_concepts bic
  join public.brief_items bi on bi.id = bic.item_id
  join public.briefs b        on b.id = bi.brief_id
  join public.articles a      on a.id = bi.article_id
  where bic.concept_slug = p_concept_slug
    and b.status = 'published'
    and bi.review_status = 'approved'
    and bi.canonical_item_id is null            -- ← new: hide merged duplicates
  order by b.date desc, bi.rank asc
  limit p_limit;
$func$;

grant execute on function public.get_concept_items(text, text, int)
  to anon, authenticated;

commit;
