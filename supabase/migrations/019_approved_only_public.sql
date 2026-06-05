-- ============================================================================
-- 019 — Approved-only public read filter
--
-- Rejected brief_items must never surface publicly (they stay in the DB as a
-- fine-tuning dataset). Two places expose items to anonymous readers:
--   1. The `public_read_brief_items` RLS policy (covers all direct table reads).
--   2. The `search_brief_items` SECURITY DEFINER function (bypasses RLS).
-- Both get `review_status = 'approved'` added.
-- ============================================================================

begin;

-- ── 1. RLS policy on brief_items ────────────────────────────────────────────
drop policy if exists public_read_brief_items on public.brief_items;
create policy public_read_brief_items
  on public.brief_items for select
  using (
    review_status = 'approved'
    and exists (
      select 1 from public.briefs b
      where b.id = brief_items.brief_id
        and b.status = 'published'
    )
  );

-- ── 2. search_brief_items: add approved filter ───────────────────────────────
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
      and bi.review_status = 'approved'          -- ← new: hide rejected items
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

commit;
