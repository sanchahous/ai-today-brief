'use client';

import { useRouter } from 'next/navigation';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { HomeItem } from '@/lib/home';
import type { NewsCategoryFilter } from '@/lib/news';
import type { TrendingTopic } from '@/lib/home';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { trackEvent } from '@/lib/analytics-client';
import { Reveal } from '@/components/reveal';
import { PostCard } from '@/components/post-card';
import { SponsorCard } from '@/components/home/sponsor-card';
import { NewsletterBand } from '@/components/home/newsletter-band';
import { SlidersIcon } from '@/components/icons';
import {
  NewsSidebar,
  type DatePreset,
  type NewsFilters,
  type SortMode,
} from '@/components/news/news-sidebar';
import {
  applyNewsFilters,
  countCategories,
  normalizePage,
  parseNewsUrlParams,
  serializeNewsUrlParams,
  sortItems,
} from '@/lib/news-filters';
import { resolveTopicNames } from '@/lib/topic-normalize';
import {
  ActionButton,
  EmptyState,
  FilterChip,
  AccessiblePagination,
  Select,
} from '@/components/ui';

const PAGE_SIZE = 12;

export function NewsFeed({
  lang,
  items,
  categories,
  trending,
  initialQuery = '',
  initialCategory = '',
  initialPage = 1,
}: {
  lang: Lang;
  items: HomeItem[];
  categories: NewsCategoryFilter[];
  trending: TrendingTopic[];
  initialQuery?: string;
  initialCategory?: string;
  initialPage?: number;
}) {
  const t = getStrings(lang).news;
  const router = useRouter();
  const serverSearchActive = initialQuery.trim().length > 0;

  const [filters, setFilters] = useState<NewsFilters>(() => ({
    q: initialQuery,
    categories: initialCategory ? [initialCategory] : [],
    topics: [],
    date: 'all',
    sort: initialQuery ? 'relevance' : 'newest',
  }));
  const [page, setPage] = useState(initialPage);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const filtersTriggerRef = useRef<HTMLButtonElement>(null);
  const noResultsTracked = useRef('');
  const isHydrated = useRef(false);

  // Synchronize state with URL on mount (without breaking ISR SSR)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.search) {
      const parsed = parseNewsUrlParams(window.location.search);
      setFilters((prev) => ({
        q: parsed.filters.q || prev.q,
        categories:
          parsed.filters.categories.length > 0
            ? parsed.filters.categories
            : prev.categories,
        topics: parsed.filters.topics,
        date: parsed.filters.date,
        sort: parsed.filters.sort,
      }));
      setPage(parsed.page);
    }
    isHydrated.current = true;
  }, []);

  // Browser Back/Forward navigation listener
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseNewsUrlParams(window.location.search);
      setFilters(parsed.filters);
      setPage(parsed.page);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // URL state synchronizer
  const syncUrl = useCallback(
    (nextFilters: NewsFilters, nextPage: number) => {
      if (typeof window === 'undefined') return;
      const qs = serializeNewsUrlParams(nextFilters, nextPage);
      const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.pushState(null, '', newUrl);
    },
    [],
  );

  const filtered = useMemo(() => {
    const rows = applyNewsFilters(items, filters, { serverSearch: serverSearchActive });
    return sortItems(rows, filters.sort, filters.q);
  }, [items, filters, serverSearchActive]);

  const facets = useMemo(
    () => countCategories(items, filters, { serverSearch: serverSearchActive }),
    [items, filters, serverSearchActive],
  );

  const topicNames = useMemo(() => resolveTopicNames(items.map((p) => p.tools)), [items]);
  // A stale link can carry topics no story has: they filter nothing, so they get no chip either.
  const activeTopics = filters.topics.filter((slug) => topicNames.has(slug));

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = normalizePage(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasActive =
    filters.q.trim().length > 0 ||
    filters.categories.length > 0 ||
    activeTopics.length > 0 ||
    filters.date !== 'all';

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
    const nextFilters: NewsFilters = {
      ...filters,
      categories: on
        ? [...filters.categories, slug]
        : filters.categories.filter((c) => c !== slug),
    };
    setFilters(nextFilters);
    setPage(1);
    syncUrl(nextFilters, 1);
  };

  const reset = () => {
    trackEvent('filters_reset', {});
    const nextFilters: NewsFilters = {
      q: '',
      categories: [],
      topics: [],
      date: 'all',
      sort: 'newest',
    };
    setFilters(nextFilters);
    setPage(1);
    if (serverSearchActive) {
      router.push(`/${lang}/news`);
    } else {
      syncUrl(nextFilters, 1);
    }
  };

  const removeTopic = (slug: string) => {
    const nextFilters: NewsFilters = {
      ...filters,
      topics: filters.topics.filter((s) => s !== slug),
    };
    setFilters(nextFilters);
    setPage(1);
    syncUrl(nextFilters, 1);
  };

  const setDateFilter = (d: DatePreset) => {
    trackEvent('filter_date', { range: d });
    const nextFilters: NewsFilters = { ...filters, date: d };
    setFilters(nextFilters);
    setPage(1);
    syncUrl(nextFilters, 1);
  };

  const setSortFilter = (s: SortMode) => {
    trackEvent('sort_change', { sort: s });
    const nextFilters: NewsFilters = { ...filters, sort: s };
    setFilters(nextFilters);
    setPage(1);
    syncUrl(nextFilters, 1);
  };

  const removeQuery = () => {
    const nextSort = filters.sort === 'relevance' ? 'newest' : filters.sort;
    const nextFilters: NewsFilters = { ...filters, q: '', sort: nextSort };
    setFilters(nextFilters);
    setPage(1);
    if (serverSearchActive) {
      router.push(`/${lang}/news`);
    } else {
      syncUrl(nextFilters, 1);
    }
  };

  const goToPage = (p: number) => {
    const target = normalizePage(p, pageCount);
    setPage(target);
    syncUrl(filters, target);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const dateChipLabel = (d: DatePreset) => {
    if (d === 'today') return t.dateToday;
    if (d === 'week') return t.dateWeek;
    if (d === 'month') return t.dateMonth;
    return t.dateAll;
  };

  const sortOptions = filters.q.trim()
    ? [
        { value: 'relevance', label: t.sortRelevance },
        { value: 'newest', label: t.sortNewest },
        { value: 'oldest', label: t.sortOldest },
      ]
    : [
        { value: 'newest', label: t.sortNewest },
        { value: 'oldest', label: t.sortOldest },
      ];

  const activeCount =
    filters.categories.length +
    activeTopics.length +
    (filters.date !== 'all' ? 1 : 0) +
    (filters.q.trim() ? 1 : 0);

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
        resultsCount={filtered.length}
      />

      <section aria-label={t.title} className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted m-0 text-[0.9rem]" aria-live="polite">
            {t.resultsCount} <span className="text-text font-semibold">{filtered.length}</span>
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="news-sort-top" className="sr-only">
              {t.sortLabel}
            </label>
            <div className="min-w-[150px]">
              <Select
                id="news-sort-top"
                value={filters.sort}
                onChange={(e) => setSortFilter(e.target.value as SortMode)}
                options={sortOptions}
                aria-label={t.sortLabel}
              />
            </div>
            <button
              ref={filtersTriggerRef}
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="mobile-only rounded-pill border-border text-text hover:border-accent inline-flex min-h-[44px] items-center gap-1.5 border px-3.5 py-2 text-sm font-medium transition cursor-pointer select-none"
            >
              <SlidersIcon size={16} />
              {t.filters}
              {activeCount > 0 && (
                <span className="bg-accent text-on-accent size-5 rounded-full text-xs flex items-center justify-center font-bold">
                  {activeCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {hasActive && (
          <div
            data-testid="active-filter-chips"
            className="mb-5 flex flex-wrap items-center gap-2"
            role="region"
            aria-label="Active filters"
          >
            {filters.q.trim() && (
              <FilterChip
                label={`«${filters.q.trim()}»`}
                active
                onRemove={removeQuery}
                removeAriaLabel={`Remove search query ${filters.q.trim()}`}
              />
            )}
            {filters.categories.map((slug) => {
              const c = categories.find((x) => x.slug === slug);
              return (
                <FilterChip
                  key={slug}
                  label={c?.name ?? slug}
                  categorySlug={slug}
                  categoryColor={c?.color}
                  active
                  onRemove={() => toggleCategory(slug)}
                  removeAriaLabel={`Remove category ${c?.name ?? slug}`}
                />
              );
            })}
            {activeTopics.map((slug) => {
              const name = topicNames.get(slug) ?? slug;
              return (
                <FilterChip
                  key={slug}
                  label={name}
                  active
                  onRemove={() => removeTopic(slug)}
                  removeAriaLabel={t.removeTopic.replace('{name}', name)}
                />
              );
            })}
            {filters.date !== 'all' && (
              <FilterChip
                label={dateChipLabel(filters.date)}
                onRemove={() => setDateFilter('all')}
                removeAriaLabel={`Remove date filter ${dateChipLabel(filters.date)}`}
              />
            )}
            <ActionButton
              variant="ghost"
              size="sm"
              onClick={reset}
              className="text-accent hover:underline text-xs p-1 min-h-[36px]"
            >
              {t.filterReset}
            </ActionButton>
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            title={t.emptyTitle}
            description={t.emptyBody}
            action={
              <ActionButton variant="primary" onClick={reset}>
                {t.filterReset}
              </ActionButton>
            }
          />
        ) : (
          <div data-testid="news-feed-list" className="grid gap-4">
            {pageRows.map((p, i) => (
              <Fragment key={p.id}>
                <Reveal delayMs={i * 45}>
                  <PostCard lang={lang} item={p} />
                </Reveal>
                {i === 5 && (
                  <Reveal delayMs={i * 45 + 20}>
                    <SponsorCard lang={lang} placement="news-feed" />
                  </Reveal>
                )}
              </Fragment>
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <AccessiblePagination
            page={safePage}
            pageCount={pageCount}
            onPageChange={goToPage}
            getPageHref={(p) => {
              const qs = serializeNewsUrlParams(filters, p);
              return qs ? `?${qs}` : '?';
            }}
            prevLabel={t.prev}
            nextLabel={t.next}
            ariaLabel={t.page}
          />
        )}

        {/* Newsletter band — mobile only (desktop version is in the sidebar) */}
        <div className="mt-8 [@media(min-width:900px)]:hidden">
          <NewsletterBand lang={lang} embedded placement="news-feed-mobile" />
        </div>
      </section>
    </div>
  );
}
