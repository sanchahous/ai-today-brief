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
import { StoryCard } from '@/components/editorial/story-card';
import { SponsorCard } from '@/components/home/sponsor-card';
import { SlidersIcon } from '@/components/icons';
import {
  NewsSidebar,
  type DatePreset,
  type NewsFilters,
  type SortMode,
} from '@/components/news/news-sidebar';
import {
  applyNewsFilters,
  buildTopicFacet,
  countCategories,
  normalizePage,
  parseNewsUrlParams,
  serializeNewsUrlParams,
  sortItems,
} from '@/lib/news-filters';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  FilterChip,
  AccessiblePagination,
  Select,
  SearchInput,
  NewsletterForm,
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
  error = false,
  onRetry,
}: {
  lang: Lang;
  items: HomeItem[];
  categories: NewsCategoryFilter[];
  trending: TrendingTopic[];
  initialQuery?: string;
  initialCategory?: string;
  initialPage?: number;
  error?: boolean;
  onRetry?: () => void;
}) {
  const core = getStrings(lang);
  const t = core.news;
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
  const [ready, setReady] = useState(false);
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
    setReady(true);
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

  const topicOptions = useMemo(
    () => buildTopicFacet(items, filters, { serverSearch: serverSearchActive }),
    [items, filters, serverSearchActive],
  );

  const topicNames = useMemo(() => new Map(topicOptions.map(t => [t.slug, t.name])), [topicOptions]);
  const activeTopics = useMemo(() => topicOptions.filter(t => t.selected).map(t => t.slug), [topicOptions]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = normalizePage(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const itemStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const itemEnd = Math.min(safePage * PAGE_SIZE, filtered.length);
  const showingText = t.showingCountOf
    .replace('{start}', itemStart.toString())
    .replace('{end}', itemEnd.toString())
    .replace('{total}', filtered.length.toString())
    .replace('{max}', items.length.toString());

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

  const [searchValue, setSearchValue] = useState(filters.q);
  useEffect(() => {
    setSearchValue(filters.q);
  }, [filters.q]);

  const setSearchQuery = (q: string) => {
    if (q) trackEvent('search', { query: q });
    const nextFilters = { ...filters, q };
    if (!q && nextFilters.sort === 'relevance') nextFilters.sort = 'newest';
    setFilters(nextFilters);
    setPage(1);
    syncUrl(nextFilters, 1);
  };

  const toggleTopic = (slug: string) => {
    trackEvent('filter_topic', { topic: slug });
    const nextFilters: NewsFilters = {
      ...filters,
      topics: filters.topics.includes(slug)
        ? filters.topics.filter((s) => s !== slug)
        : [...filters.topics, slug],
    };
    setFilters(nextFilters);
    setPage(1);
    syncUrl(nextFilters, 1);
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

  const goToPage = (p: number) => {
    const target = normalizePage(p, pageCount);
    setPage(target);
    syncUrl(filters, target);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
    <div className="news-layout" data-testid="news-feed" data-hydrated={ready}>
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
        topicOptions={topicOptions}
        onToggleTopic={toggleTopic}
        hasActive={hasActive}
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        triggerRef={filtersTriggerRef}
        resultsCount={filtered.length}
      />

      <section aria-label={t.title} className="min-w-0">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 min-w-[200px] max-w-md">
            <SearchInput
              lang={lang}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setSearchQuery(searchValue);
                }
              }}
              onClear={() => setSearchQuery('')}
            />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-muted m-0 text-sm" aria-live="polite" role="status">
              {showingText}
            </p>
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
            <ActionButton variant="outline"
              ref={filtersTriggerRef}
              type="button"
              disabled={!ready}
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="mobile-only !rounded-pill"
              leftIcon={<SlidersIcon size={16} />}
            >
              {t.filters}
              {activeCount > 0 && (
                <span className="bg-accent text-on-accent size-5 rounded-full text-xs flex items-center justify-center font-bold">
                  {activeCount}
                </span>
              )}
            </ActionButton>
          </div>
        </div>
        
        {hasActive && (
          <div data-testid="active-filter-chips" className="mb-6 flex flex-wrap items-center gap-2">
            {filters.q.trim() && (
              <FilterChip
                lang={lang}
                label={filters.q}
                active
                onRemove={() => setSearchQuery('')}
                removeAriaLabel={t.removeTopic.replace('{name}', filters.q)}
              />
            )}
            {filters.categories.map(slug => {
              const cat = categories.find(c => c.slug === slug);
              return cat ? (
                <FilterChip
                  lang={lang}
                  key={slug}
                  label={cat.name}
                  active
                  onRemove={() => toggleCategory(slug)}
                  removeAriaLabel={t.removeTopic.replace('{name}', cat.name)}
                />
              ) : null;
            })}
            {activeTopics.map(slug => (
               <FilterChip
                  lang={lang}
                  key={slug}
                  label={topicNames.get(slug) ?? slug}
                  active
                  onRemove={() => removeTopic(slug)}
                  removeAriaLabel={t.removeTopic.replace('{name}', topicNames.get(slug) ?? slug)}
               />
            ))}
            {filters.date !== 'all' && (
              <FilterChip
                lang={lang}
                label={
                  filters.date === 'today' ? t.dateToday :
                  filters.date === 'week' ? t.dateWeek :
                  filters.date === 'month' ? t.dateMonth : ''
                }
                active
                onRemove={() => setDateFilter('all')}
                removeAriaLabel={t.removeTopic.replace('{name}', filters.date)}
              />
            )}
            <ActionButton variant="ghost" onClick={reset}>{t.filterReset}</ActionButton>
          </div>
        )}

        {error ? (
          <ErrorState
            title={core.searchErrorTitle}
            description={core.searchErrorDescription}
            retryLabel={core.searchErrorRetry}
            onRetry={onRetry}
          />
        ) : filtered.length === 0 ? (
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
                  <StoryCard lang={lang} item={p} />
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

        {/* Newsletter form — mobile only (desktop version is in the sidebar) */}
        <div className="mt-8 [@media(min-width:900px)]:hidden">
          <NewsletterForm lang={lang} variant="inline" placement="news-feed-mobile" />
        </div>
      </section>
    </div>
  );
}
