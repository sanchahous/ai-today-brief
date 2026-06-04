'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { HomeItem } from '@/lib/home';
import type { NewsCategoryFilter } from '@/lib/news';
import type { TrendingTopic } from '@/lib/home';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
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

const PAGE_SIZE = 6;

function daysAgo(n: number): number {
  return Date.now() - n * 86_400_000;
}

function withinPreset(iso: string, preset: DatePreset): boolean {
  if (preset === 'all') return true;
  const ts = new Date(`${iso}T00:00:00`).getTime();
  const span = preset === 'today' ? 1 : preset === 'week' ? 7 : 31;
  return ts >= daysAgo(span);
}

function matchesQuery(item: HomeItem, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = `${item.title} ${item.summary} ${item.why} ${item.categoryName ?? ''} ${item.sourceName ?? ''}`.toLowerCase();
  return hay.includes(needle);
}

function sortItems(rows: HomeItem[], sort: SortMode): HomeItem[] {
  const copy = [...rows];
  switch (sort) {
    case 'newest':
      return copy.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.rank - b.rank));
    case 'oldest':
      return copy.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : a.rank - b.rank));
    case 'discussed':
      return copy.sort((a, b) => b.rank - a.rank);
    case 'relevance':
    default:
      return copy.sort((a, b) => a.rank - b.rank);
  }
}

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

  const toggleCategory = (slug: string) => {
    setFilters((f) => {
      const on = !f.categories.includes(slug);
      return {
        ...f,
        categories: on ? [...f.categories, slug] : f.categories.filter((c) => c !== slug),
      };
    });
    setPage(1);
  };

  const reset = () => {
    setFilters({ q: '', categories: [], date: 'all', sort: 'newest' });
    setPage(1);
    if (serverSearchActive) router.push(`/${lang}/news`);
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
        onDate={(d) => {
          setFilters((f) => ({ ...f, date: d }));
          setPage(1);
        }}
        onSort={(s) => {
          setFilters((f) => ({ ...f, sort: s }));
          setPage(1);
        }}
        onReset={reset}
        hasActive={hasActive}
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
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
              onChange={(e) => {
                setFilters((f) => ({ ...f, sort: e.target.value as SortMode }));
                setPage(1);
              }}
              className="border-border bg-surface text-text rounded-lg border px-2 py-2 text-[0.85rem]"
            >
              <option value="newest">{t.sortNewest}</option>
              <option value="oldest">{t.sortOldest}</option>
              <option value="relevance">{t.sortRelevance}</option>
              <option value="discussed">{t.sortDiscussed}</option>
            </select>
            <button
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
                  className="rounded-pill inline-flex items-center gap-1.5 border px-2.5 py-1 text-[0.78rem]"
                  style={{
                    color,
                    background: `${color}1f`,
                    borderColor: `${color}55`,
                  }}
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
              <Reveal key={p.id} delayMs={i * 45}>
                <PostCard lang={lang} item={p} />
                {i === 2 && (
                  <Reveal>
                    <SponsorCard lang={lang} />
                  </Reveal>
                )}
              </Reveal>
            ))}
            <Reveal>
              <NewsletterBand lang={lang} embedded />
            </Reveal>
          </div>
        )}

        {filtered.length > 0 && (
          <Pagination
            lang={lang}
            page={safePage}
            pageCount={pageCount}
            onChange={(p) => {
              setPage(p);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </section>
    </div>
  );
}
