'use client';

import Link from 'next/link';
import { type CSSProperties, type ReactNode, type RefObject } from 'react';
import { getStrings } from '@/lib/i18n';
import { trackEvent } from '@/lib/analytics-client';
import type { TrendingTopic } from '@/lib/home';
import type { NewsCategoryFilter } from '@/lib/news';
import type { Lang } from '@/lib/site';
import { CategoryGlyph, CloseIcon, SparkleIcon } from '@/components/icons';
import { OverlayDrawer } from '@/components/ui/overlay-drawer';
import { NewsletterBand } from '@/components/home/newsletter-band';

export type { SortMode, DatePreset } from '@/lib/news-filters';
import type { SortMode, DatePreset } from '@/lib/news-filters';

export interface NewsFilters {
  q: string;
  categories: string[];
  date: DatePreset;
  sort: SortMode;
}

interface SidebarControlsProps {
  lang: Lang;
  filters: NewsFilters;
  facets: Map<string, number>;
  categories: NewsCategoryFilter[];
  trending: TrendingTopic[];
  onToggleCategory: (slug: string) => void;
  onDate: (d: DatePreset) => void;
  onSort: (s: SortMode) => void;
  onReset: () => void;
  hasActive: boolean;
  compact?: boolean;
  showSort?: boolean;
}

function FilterGroup({
  label,
  children,
  testId,
  compact,
}: {
  label: string;
  children: ReactNode;
  testId?: string;
  compact?: boolean;
}) {
  return (
    <section className={compact ? 'mb-0 min-w-0' : 'mb-6'} data-testid="filter-group">
      <div data-testid={testId} className={testId ? 'contents' : undefined}>
        <h3 className="text-accent m-0 mb-3 text-[0.72rem] font-bold tracking-[0.1em] uppercase">
          {label}
        </h3>
        {children}
      </div>
    </section>
  );
}

function SidebarControls({
  lang,
  filters,
  facets,
  categories,
  trending,
  onToggleCategory,
  onDate,
  onSort,
  onReset,
  hasActive,
  compact = false,
  showSort = true,
}: SidebarControlsProps) {
  const t = getStrings(lang).news;
  const dates: DatePreset[] = ['today', 'week', 'month', 'all'];
  const sorts: SortMode[] = ['newest', 'oldest', 'relevance', 'discussed'];

  const sortLabel = (s: SortMode) => {
    if (s === 'newest') return t.sortNewest;
    if (s === 'oldest') return t.sortOldest;
    if (s === 'relevance') return t.sortRelevance;
    return t.sortDiscussed;
  };

  const dateLabel = (d: DatePreset) => {
    if (d === 'today') return t.dateToday;
    if (d === 'week') return t.dateWeek;
    if (d === 'month') return t.dateMonth;
    return t.dateAll;
  };

  const rowClass = (active: boolean) =>
    `filter-row flex cursor-pointer items-center gap-2 py-1 text-[0.86rem] ${active ? 'text-text' : 'text-muted'}`;

  return (
    <div className={compact ? 'grid grid-cols-1 gap-4 min-[380px]:grid-cols-2' : undefined}>
      {showSort && (
        <FilterGroup label={t.sortLabel} compact={compact}>
          <div className="grid gap-1">
            {sorts.map((s) => {
              const active = filters.sort === s;
              return (
                <label key={s} className={rowClass(active)}>
                  <input
                    type="radio"
                    name="news-sort"
                    checked={active}
                    onChange={() => onSort(s)}
                    className="accent-accent size-4 shrink-0"
                  />
                  {sortLabel(s)}
                </label>
              );
            })}
          </div>
        </FilterGroup>
      )}

      <FilterGroup label={t.filterCategories} compact={compact}>
        <ul className={`m-0 grid list-none gap-1 p-0 ${compact ? 'min-[520px]:grid-cols-2' : ''}`}>
          {categories.map((c) => {
            const checked = filters.categories.includes(c.slug);
            const count = facets.get(c.slug) ?? 0;
            const color = c.color ?? '#888888';
            return (
              <li key={c.slug}>
                <label className={rowClass(checked)}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleCategory(c.slug)}
                    className="accent-accent size-4 shrink-0"
                    style={{ accentColor: color } as CSSProperties}
                  />
                  <span
                    className="cat-fg inline-flex shrink-0"
                    style={{ '--cat-color': color } as CSSProperties}
                  >
                    <CategoryGlyph icon={c.icon} size={16} strokeWidth={1.6} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="text-faint ml-2 shrink-0 text-[0.72rem] tabular-nums">
                    {count}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </FilterGroup>

      <FilterGroup label={t.filterDate} compact={compact}>
        <div className="grid grid-cols-2 gap-1.5">
          {dates.map((d) => {
            const active = filters.date === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onDate(d)}
                aria-pressed={active}
                className={`rounded-lg border px-2 py-2 text-[0.8rem] transition ${
                  active
                    ? 'border-accent bg-accent text-on-accent font-semibold'
                    : 'border-border text-text hover:border-accent'
                }`}
              >
                {dateLabel(d)}
              </button>
            );
          })}
        </div>
      </FilterGroup>

      {hasActive && (
        <button
          type="button"
          onClick={onReset}
          className={`rounded-pill border-border text-text hover:border-accent flex w-full items-center justify-center border px-4 py-2.5 text-sm font-semibold transition ${
            compact ? 'min-[380px]:self-start' : 'mb-6'
          }`}
        >
          {t.filterReset}
        </button>
      )}

      {trending.length > 0 && (
        <FilterGroup label={t.trendingSidebar} testId="news-trending-section" compact={compact}>
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {trending.slice(0, 8).map((topic, idx) => (
              <li key={topic.name}>
                <Link
                  href={topic.href}
                  onClick={() =>
                    trackEvent('trending_topic_click', {
                      topic: topic.name,
                      placement: 'news_sidebar',
                    })
                  }
                  className="text-muted hover:text-accent flex items-center gap-2 text-[0.84rem] no-underline transition"
                >
                  <span className="text-faint w-4 shrink-0 text-right text-[0.7rem] tabular-nums font-medium">
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{topic.name}</span>
                  <span className="text-faint ml-2 shrink-0 text-[0.72rem] tabular-nums">
                    {topic.mentions}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </FilterGroup>
      )}
    </div>
  );
}

export function NewsSidebar({
  drawerOpen,
  setDrawerOpen,
  triggerRef,
  ...controls
}: SidebarControlsProps & {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  triggerRef?: RefObject<HTMLElement | null>;
}) {
  const t = getStrings(controls.lang).news;

  return (
    <>
      <aside
        data-testid="news-sidebar"
        className="sidebar-scroll sidebar-viewport-height desktop-only sticky top-[var(--header-h)] self-start overflow-x-hidden overflow-y-auto overscroll-y-contain pr-3"
        aria-label={t.filters}
      >
        <SidebarControls {...controls} />
        <div className="border-border mt-2 border-t pt-5">
          <NewsletterBand
            lang={controls.lang}
            embedded
            compact
            placement="news-sidebar"
          />
        </div>
      </aside>

      <div className="mobile-only">
        <OverlayDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          ariaLabel={t.filters}
          triggerRef={triggerRef}
          placement="fullscreen"
          panelTestId="news-filters-drawer"
          backdropTestId="news-filters-backdrop"
          panelClassName="sidebar-drawer-touch border-border p-4 sm:p-5"
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 className="m-0 text-lg">{t.filters}</h2>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close"
              className="text-muted inline-flex border-0 bg-transparent p-1"
            >
              <CloseIcon />
            </button>
          </div>
          <SidebarControls {...controls} compact showSort={false} />
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="rounded-pill bg-accent text-on-accent sticky bottom-0 mt-5 flex w-full items-center justify-center px-4 py-2.5 text-sm font-semibold shadow-pop"
          >
            {t.applyFilters}
          </button>
        </OverlayDrawer>
      </div>
    </>
  );
}
