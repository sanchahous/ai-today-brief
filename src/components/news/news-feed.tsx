'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { HomeItem } from '@/lib/home';
import type { NewsCategoryFilter } from '@/lib/news';
import type { TrendingTopic } from '@/lib/home';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { trackEvent } from '@/lib/analytics-client';
import { Reveal } from '@/components/reveal';
import { PostCard } from '@/components/post-card';
import { Pagination } from '@/components/pagination';
import { SponsorCard } from '@/components/home/sponsor-card';
import { NewsletterBand } from '@/components/home/newsletter-band';
import { CloseIcon, SlidersIcon } from '@/components/icons';
import {
  NewsSidebar,
  type DatePreset,
  type NewsFilters,
  type SortMode,
} from '@/components/news/news-sidebar';
import { matchesQuery, sortItems, withinPreset } from '@/lib/news-filters';

const PAGE_SIZE = 6;

export function NewsFeed({
  lang,
  items,
  categories,
  trending,
  initialQuery = '',
  initialCategory = '',
}: {
  lang: Lang;
  items: HomeItem[];
  categories: NewsCategoryFilter[];
  trending: TrendingTopic[];
  initialQuery?: string;
  initialCategory?: string;
}) {
  const t = getStrings(lang).news;
  const router = useRouter();
  const serverSearchActive = initialQuery.trim().length > 0;

  const [filters, setFilters] = useState<NewsFilters>(() => ({
    q: initialQuery,
    categories: initialCategory ? [initialCategory] : [],
    date: 'all',
    sort: initialQuery ? 'relevance' : 'newest',
  }));
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const filtersTriggerRef = useRef<HTMLButtonElement>(null);
  const noResultsTracked = useRef('');

  const filtered = useMemo(() => {
    const rows = items.filter(
      (p) =>
        (filters.categories.length === 0 ||
          (p.categorySlug && filters.categories.includes(p.categorySlug))) &&
        withinPreset(p.date, filters.date) &&
        (serverSearchActive || matchesQuery(p, filters.q)),
    );
    return sortItems(rows, filters.sort);
  }, [items, filters, serverSearchActive]);

  const facets = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of items) {
      if (!p.categorySlug) continue;
      if (!withinPreset(p.date, filters.date)) continue;
      if (!serverSearchActive && !matchesQuery(p, filters.q)) continue;
      m.set(p.categorySlug, (m.get(p.categorySlug) ?? 0) + 1);
    }
    return m;
  }, [items, filters.date, filters.q, serverSearchActive]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasActive =
    filters.q.trim().length > 0 || filters.categories.length > 0 || filters.date !== 'all';

  useEffect(() => {
    const q = filters.q.trim() || initialQuery.trim();
    if (filtered.length > 0 || !q) {
      noResultsTracked.current = '';
      return;
    }
    if (noResultsTracked.current === q) return;
    noResultsTracked.current = q;
    trackEvent('search_no_results', { query: q });
  }, [filtered.length, filters.q, initialQuery]);

  const toggleCategory = (slug: string) => {
    const on = !filters.categories.includes(slug);
    trackEvent('filter_category', { category: slug, enabled: on });
    setFilters((f) => ({
      ...f,
      categories: on ? [...f.categories, slug] : f.categories.filter((c) => c !== slug),
    }));
    setPage(1);
  };

  const reset = () => {
    trackEvent('filters_reset', {});
    setFilters({ q: '', categories: [], date: 'all', sort: 'newest' });
    setPage(1);
    if (serverSearchActive) router.push(`/${lang}/news`);
  };

  const setDateFilter = (d: DatePreset) => {
    trackEvent('filter_date', { range: d });
    setFilters((f) => ({ ...f, date: d }));
    setPage(1);
  };

  const setSortFilter = (s: SortMode) => {
    trackEvent('sort_change', { sort: s });
    setFilters((f) => ({ ...f, sort: s }));
    setPage(1);
  };

  const goToPage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const dateChipLabel = (d: DatePreset) => {
    if (d === 'today') return t.dateToday;
    if (d === 'week') return t.dateWeek;
    if (d === 'month') return t.dateMonth;
    return t.dateAll;
  };

  return (
    <div className="news-layout">
      <NewsSidebar
        lang={lang}
        filters={filters}
        facets={facets}
        categories={categories}
        trending={trending}
        onToggleCategory={toggleCategory}
        onDate={setDateFilter}
        onSort={setSortFilter}
        onReset={reset}
        hasActive={hasActive}
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        triggerRef={filtersTriggerRef}
      />

      <section aria-label={t.title} className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted m-0 text-[0.9rem]" aria-live="polite">
            {t.resultsCount} {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="news-sort-top" className="sr-only">
              {t.sortLabel}
            </label>
            <select
              id="news-sort-top"
              value={filters.sort}
              onChange={(e) => setSortFilter(e.target.value as SortMode)}
              className="border-border bg-surface text-text rounded-lg border px-2 py-2 text-[0.85rem]"
            >
              <option value="newest">{t.sortNewest}</option>
              <option value="oldest">{t.sortOldest}</option>
              <option value="relevance">{t.sortRelevance}</option>
              <option value="discussed">{t.sortDiscussed}</option>
            </select>
            <button
              ref={filtersTriggerRef}
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="mobile-only rounded-pill border-border text-text hover:border-accent inline-flex items-center gap-1.5 border px-3 py-2 text-sm"
            >
              <SlidersIcon size={16} />
              {t.filters}
              {hasActive
                ? ` · ${filters.categories.length + (filters.date !== 'all' ? 1 : 0)}`
                : ''}
            </button>
          </div>
        </div>

        {hasActive && (
          <div className="mb-5 flex flex-wrap gap-2">
            {filters.q.trim() && (
              <button
                type="button"
                onClick={() => {
                  setFilters((f) => ({ ...f, q: '' }));
                  setPage(1);
                  if (serverSearchActive) router.push(`/${lang}/news`);
                }}
                className="rounded-pill border-accent/45 bg-accent/15 text-accent inline-flex items-center gap-1.5 border px-2.5 py-1 text-[0.78rem]"
              >
                «{filters.q.trim()}» <CloseIcon size={13} />
              </button>
            )}
            {filters.categories.map((slug) => {
              const c = categories.find((x) => x.slug === slug);
              const color = c?.color ?? '#888888';
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => toggleCategory(slug)}
                  className="cat-chip rounded-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.78rem]"
                  style={{ '--cat-color': color } as CSSProperties}
                >
                  {c?.name ?? slug} <CloseIcon size={13} />
                </button>
              );
            })}
            {filters.date !== 'all' && (
              <button
                type="button"
                onClick={() => {
                  setFilters((f) => ({ ...f, date: 'all' }));
                  setPage(1);
                }}
                className="rounded-pill border-border bg-surface-2 text-text inline-flex items-center gap-1.5 border px-2.5 py-1 text-[0.78rem]"
              >
                {dateChipLabel(filters.date)} <CloseIcon size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              className="text-accent border-0 bg-transparent text-[0.78rem] underline"
            >
              {t.filterReset}
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-card border-border border border-dashed px-4 py-14 text-center">
            <p className="font-serif mb-2 text-xl">{t.emptyTitle}</p>
            <p className="text-muted mb-5">{t.emptyBody}</p>
            <button
              type="button"
              onClick={reset}
              className="rounded-pill border-border text-text hover:border-accent inline-flex border px-4 py-2 text-sm font-semibold"
            >
              {t.filterReset}
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {pageRows.map((p, i) => (
              <Fragment key={p.id}>
                <Reveal delayMs={i * 45}>
                  <PostCard lang={lang} item={p} />
                </Reveal>
                {i === 2 && (
                  <Reveal delayMs={i * 45 + 20}>
                    <SponsorCard lang={lang} placement="news-feed" />
                  </Reveal>
                )}
              </Fragment>
            ))}
            <Reveal>
              <NewsletterBand lang={lang} embedded placement="news-feed" />
            </Reveal>
          </div>
        )}

        {filtered.length > 0 && (
          <Pagination
            lang={lang}
            page={safePage}
            pageCount={pageCount}
            onChange={goToPage}
          />
        )}
      </section>
    </div>
  );
}
