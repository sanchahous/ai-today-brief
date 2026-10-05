'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { ArrowDown } from '@/components/icons';
import { LinkTabs } from '@/components/ui/tabs';
import { SleeveArt } from '@/components/editorial/sleeve-art';
import type {
  DigestArchiveCounts,
  DigestArchiveFilter,
  DigestCalendarWeekRow,
  DigestTimelineEntry,
} from '@/lib/digests-archive-shared';
import {
  formatDigestMonthYear,
  issueLabel,
  timelineStatsLabel,
} from '@/lib/digests-archive-shared';
import type { Lang } from '@/lib/site';

const COPY = {
  en: {
    archive: 'The archive',
    tabsLabel: 'Edition type',
    all: 'All',
    daily: 'Daily',
    weekly: 'Weekly',
    weeklyCol: 'Weekly',
    showEarlier: 'Show earlier editions',
    loading: 'Loading earlier editions…',
    loadError: 'Could not load earlier editions. Try again.',
    retry: 'Try again',
    dailyKind: 'Daily',
    weeklyKind: 'Weekly',
    soon: 'soon',
    legendDaily: 'Daily edition',
    legendToday: 'Today',
    legendOff: 'Day without a daily edition',
  },
  uk: {
    archive: 'Архів',
    tabsLabel: 'Тип випуску',
    all: 'Усі',
    daily: 'Щоденні',
    weekly: 'Тижневі',
    weeklyCol: 'Тижневик',
    showEarlier: 'Показати ранніші випуски',
    loading: 'Завантажуємо ранніші випуски…',
    loadError: 'Не вдалося завантажити ранніші випуски. Спробуйте ще раз.',
    retry: 'Спробувати знову',
    dailyKind: 'Щоденний',
    weeklyKind: 'Тижневик',
    soon: 'скоро',
    legendDaily: 'Щоденний випуск',
    legendToday: 'Сьогодні',
    legendOff: 'День без щоденного випуску',
  },
} as const;

function readTypeFromUrl(): DigestArchiveFilter {
  if (typeof window === 'undefined') return 'all';
  const value = new URLSearchParams(window.location.search).get('type');
  return value === 'daily' || value === 'weekly' ? value : 'all';
}

function readMoreFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('more') === '1';
}

function syncArchiveUrl(type: DigestArchiveFilter, more: boolean) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (type === 'all') url.searchParams.delete('type');
  else url.searchParams.set('type', type);
  if (more) url.searchParams.set('more', '1');
  else url.searchParams.delete('more');
  const qs = url.searchParams.toString();
  window.history.pushState(null, '', qs ? `${url.pathname}?${qs}` : url.pathname);
}

function formatShortRange(start: string, end: string, lang: Lang): string {
  const fmt = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return `${fmt.format(new Date(`${start}T00:00:00Z`))}–${fmt.format(new Date(`${end}T00:00:00Z`))}`;
}

function filterEntries(entries: DigestTimelineEntry[], type: DigestArchiveFilter): DigestTimelineEntry[] {
  if (type === 'all') return entries;
  return entries.filter((entry) => entry.kind === type);
}

function groupByMonth(entries: DigestTimelineEntry[]): Record<string, DigestTimelineEntry[]> {
  const groups: Record<string, DigestTimelineEntry[]> = {};
  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    (groups[key] ||= []).push(entry);
  }
  return groups;
}

function DigestsCalendar({
  lang,
  caption,
  weekdayHeaders,
  weeks,
}: {
  lang: Lang;
  caption: string;
  weekdayHeaders: string[];
  weeks: DigestCalendarWeekRow[];
}) {
  const t = COPY[lang];
  return (
    <div className="border-line bg-surface rounded-card border p-4">
      <table className="w-full border-collapse text-center text-sm">
        <caption className="mb-3 text-left font-serif text-lg font-semibold">{caption}</caption>
        <thead>
          <tr>
            {weekdayHeaders.map((day) => (
              <th key={day} scope="col" className="text-muted px-1 py-2 text-xs font-medium">
                {day}
              </th>
            ))}
            <th scope="col" className="text-muted px-1 py-2 text-xs font-medium">
              {t.weeklyCol}
            </th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, weekIndex) => (
            <tr key={`week-${weekIndex}`}>
              {week.days.map((cell, dayIndex) => (
                <td key={`${weekIndex}-${dayIndex}`} className="p-1 align-top">
                  {!cell.dayNumber ? (
                    <span className="block min-h-10" aria-hidden />
                  ) : cell.hasDaily && cell.dailyHref ? (
                    <Link
                      href={cell.dailyHref}
                      aria-label={cell.accessibleLabel ?? undefined}
                      aria-current={cell.isToday ? 'date' : undefined}
                      className={`grid min-h-10 place-items-center rounded-md text-sm font-semibold no-underline transition-colors ${
                        cell.isToday
                          ? 'bg-accent text-bg'
                          : 'bg-[var(--surface-raised)] text-text hover:bg-[var(--tint-hover)]'
                      }`}
                    >
                      <span>{cell.dayNumber}</span>
                    </Link>
                  ) : (
                    <span
                      aria-label={cell.accessibleLabel ?? undefined}
                      className={`grid min-h-10 place-items-center rounded-md text-sm ${
                        cell.isFuture ? 'text-faint' : 'text-muted'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                  )}
                </td>
              ))}
              <td className="p-1 align-middle text-xs">
                {week.weekly ? (
                  <Link href={week.weekly.href} className="text-accent font-semibold no-underline">
                    {week.weekly.label}
                  </Link>
                ) : week.weeklyState === 'soon' ? (
                  <span className="text-faint">{t.soon}</span>
                ) : (
                  <span className="text-faint" aria-hidden>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs">
        <span className="inline-flex items-center gap-2">
          <i className="inline-block size-2 rounded-full bg-accent" aria-hidden />
          {t.legendDaily}
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="inline-block size-2 rounded-full bg-accent/80 ring-2 ring-accent" aria-hidden />
          {t.legendToday}
        </span>
        <span className="inline-flex items-center gap-2">
          <i className="inline-block size-2 rounded-full bg-[var(--surface-raised)]" aria-hidden />
          {t.legendOff}
        </span>
      </p>
    </div>
  );
}

function TimelineRow({ lang, entry }: { lang: Lang; entry: DigestTimelineEntry }) {
  if (entry.kind === 'daily') {
    return (
      <li className="border-line border-b py-4 last:border-b-0">
        <Link href={entry.href} className="grid gap-4 no-underline sm:grid-cols-[5rem_minmax(0,1fr)_auto]">
          <span className="text-text grid leading-tight">
            <strong className="font-serif text-3xl">{entry.dayNumber}</strong>
            <span className="text-muted text-sm">{entry.weekday}</span>
          </span>
          <span>
            <span className="text-accent text-xs font-bold tracking-wide uppercase">{COPY[lang].dailyKind}</span>
            <span className="text-text mt-1 block text-lg font-bold">{entry.title}</span>
            {entry.leadTitle ? <span className="text-muted mt-1 block text-sm">{entry.leadTitle}</span> : null}
          </span>
          <span className="text-muted self-center text-sm">{timelineStatsLabel(lang, entry)}</span>
        </Link>
      </li>
    );
  }

  return (
    <li className="border-line border-b py-4 last:border-b-0">
      <Link
        href={entry.href}
        className="grid gap-4 no-underline sm:grid-cols-[5rem_minmax(0,1fr)_auto]"
      >
        <span className="border-line relative hidden h-20 w-20 overflow-hidden rounded-md border sm:block">
          <SleeveArt seed={entry.slug} />
        </span>
        <span className="sm:col-start-2">
          <span className="text-accent text-xs font-bold tracking-wide uppercase">
            {COPY[lang].weeklyKind}
            {entry.issueNumber ? ` · ${issueLabel(lang, entry.issueNumber)}` : ''}
            {' · '}
            {formatShortRange(entry.date, entry.weekEnd, lang)}
          </span>
          <span className="text-text mt-1 block text-lg font-bold">{entry.title}</span>
          {entry.standfirst ? (
            <span className="text-muted mt-1 block text-sm">{entry.standfirst}</span>
          ) : null}
        </span>
        <span className="text-muted self-center text-sm sm:col-start-3">{timelineStatsLabel(lang, entry)}</span>
      </Link>
    </li>
  );
}

export function DigestsArchivePanel({
  lang,
  counts,
  calendarCaption,
  weekdayHeaders,
  calendarWeeks,
  initialTimeline,
  initialMonthKey,
  hasMoreTimeline,
}: {
  lang: Lang;
  counts: DigestArchiveCounts;
  calendarCaption: string;
  weekdayHeaders: string[];
  calendarWeeks: DigestCalendarWeekRow[];
  initialTimeline: DigestTimelineEntry[];
  initialMonthKey: string | null;
  hasMoreTimeline: boolean;
}) {
  const t = COPY[lang];
  const [type, setType] = useState<DigestArchiveFilter>('all');
  const [showMore, setShowMore] = useState(false);
  const [extraMonths, setExtraMonths] = useState<Record<string, DigestTimelineEntry[]>>({});
  const [overflowFirstMonth, setOverflowFirstMonth] = useState<DigestTimelineEntry[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const deepLinkLoaded = useRef(false);

  useEffect(() => {
    setType(readTypeFromUrl());
    setShowMore(readMoreFromUrl());
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setType(readTypeFromUrl());
      setShowMore(readMoreFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const filteredInitial = useMemo(
    () => filterEntries(initialTimeline, type),
    [initialTimeline, type],
  );

  const mergedTimeline = useMemo(() => {
    const overflow = showMore ? overflowFirstMonth : [];
    const extra = showMore
      ? Object.keys(extraMonths)
          .sort((a, b) => b.localeCompare(a))
          .flatMap((key) => extraMonths[key] ?? [])
      : [];
    return filterEntries([...filteredInitial, ...overflow, ...extra], type);
  }, [filteredInitial, overflowFirstMonth, extraMonths, showMore, type]);

  const grouped = useMemo(() => groupByMonth(mergedTimeline), [mergedTimeline]);
  const monthKeys = useMemo(
    () => Object.keys(grouped).sort((a, b) => b.localeCompare(a)),
    [grouped],
  );

  const tabCounts = {
    all: counts.all,
    daily: counts.daily,
    weekly: counts.weekly,
  };

  const handleTabClick = (event: MouseEvent<HTMLAnchorElement>, nextType: DigestArchiveFilter) => {
    event.preventDefault();
    setExtraMonths({});
    setOverflowFirstMonth([]);
    setLoadError(false);
    setType(nextType);
    syncArchiveUrl(nextType, showMore);
  };

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    const scrollY = window.scrollY;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams({ lang, type });
      if (initialMonthKey) params.set('month', initialMonthKey);
      const response = await fetch(`/api/digests/archive?${params.toString()}`);
      if (!response.ok) throw new Error('archive fetch failed');
      const payload = (await response.json()) as {
        months: Record<string, DigestTimelineEntry[]>;
        overflowFirstMonth: DigestTimelineEntry[];
      };
      setExtraMonths(payload.months);
      setOverflowFirstMonth(payload.overflowFirstMonth);
      setShowMore(true);
      syncArchiveUrl(type, true);
      requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
      moreButtonRef.current?.focus();
    }
  }, [initialMonthKey, lang, loadingMore, type]);

  useEffect(() => {
    if (deepLinkLoaded.current || !readMoreFromUrl()) return;
    deepLinkLoaded.current = true;
    void loadMore();
  }, [loadMore]);

  const canLoadMore = hasMoreTimeline && !showMore;

  return (
    <section className="mt-16" aria-labelledby="digests-archive-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="digests-archive-title" className="font-serif text-2xl font-semibold sm:text-3xl">
          {t.archive}
        </h2>
        <LinkTabs
          ariaLabel={t.tabsLabel}
          activeTabId={type}
          tabs={[
            {
              id: 'all',
              label: t.all,
              href: `?type=all`,
              count: tabCounts.all,
            },
            {
              id: 'daily',
              label: t.daily,
              href: `?type=daily`,
              count: tabCounts.daily,
            },
            {
              id: 'weekly',
              label: t.weekly,
              href: `?type=weekly`,
              count: tabCounts.weekly,
            },
          ]}
          wrap
          onTabClick={(event, tab) => handleTabClick(event, tab.id as DigestArchiveFilter)}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <DigestsCalendar
          lang={lang}
          caption={calendarCaption}
          weekdayHeaders={weekdayHeaders}
          weeks={calendarWeeks}
        />

        <div ref={scrollAnchorRef}>
          {monthKeys.length ? (
            monthKeys.map((monthKey) => (
              <section key={monthKey} aria-labelledby={`archive-month-${monthKey}`} className="mb-8">
                <h3 id={`archive-month-${monthKey}`} className="text-muted mb-3 text-sm font-semibold uppercase tracking-wide">
                  {formatDigestMonthYear(monthKey, lang)}
                </h3>
                <ol className="m-0 list-none p-0">
                  {(grouped[monthKey] ?? []).map((entry) => (
                    <TimelineRow key={`${entry.kind}-${entry.id}`} lang={lang} entry={entry} />
                  ))}
                </ol>
              </section>
            ))
          ) : (
            <p className="text-muted border-line rounded-card border border-dashed p-6 text-sm">
              {lang === 'uk' ? 'Немає випусків для цього фільтра.' : 'No editions match this filter.'}
            </p>
          )}

          {canLoadMore ? (
            <button
              ref={moreButtonRef}
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="border-line text-text hover:border-accent hover:text-accent rounded-pill inline-flex min-h-[var(--touch-target-min)] items-center gap-2 border px-5 py-2.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:opacity-60"
            >
              {loadingMore ? t.loading : t.showEarlier}
              <ArrowDown size={18} aria-hidden />
            </button>
          ) : null}

          {loadError ? (
            <p className="text-muted mt-3 text-sm" role="alert">
              {t.loadError}{' '}
              <button
                type="button"
                onClick={() => void loadMore()}
                className="text-accent font-semibold underline-offset-2 hover:underline"
              >
                {t.retry}
              </button>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
