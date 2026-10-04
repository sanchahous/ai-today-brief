import { pluralLabel, shiftIsoDate } from '@/lib/home-stats';
import type { DigestArchiveEntry, WeeklyDigestHomeView } from '@/lib/digests';
import type { Lang } from '@/lib/site';

export type DigestArchiveFilter = 'all' | 'daily' | 'weekly';

export interface DigestArchiveCounts {
  all: number;
  daily: number;
  weekly: number;
}

export interface DigestDailySpotlight {
  id: string;
  date: string;
  slug: string;
  title: string;
  href: string;
  dayNumber: number;
  weekday: string;
  monthYear: string;
  storyCount: number;
  readMinutes: number;
  topStories: string[];
}

export interface DigestTimelineDailyEntry {
  kind: 'daily';
  id: string;
  date: string;
  slug: string;
  title: string;
  href: string;
  weekday: string;
  dayNumber: number;
  leadTitle: string | null;
  storyCount: number;
  readMinutes: number;
}

export interface DigestTimelineWeeklyEntry {
  kind: 'weekly';
  id: string;
  date: string;
  slug: string;
  title: string;
  href: string;
  weekEnd: string;
  issueNumber: number | null;
  standfirst: string | null;
  storyCount: number;
  readMinutes: number;
  hasPdf: boolean;
  hasVideo: boolean;
}

export type DigestTimelineEntry = DigestTimelineDailyEntry | DigestTimelineWeeklyEntry;

export interface DigestCalendarCell {
  date: string | null;
  dayNumber: number | null;
  hasDaily: boolean;
  dailyHref: string | null;
  accessibleLabel: string | null;
  isToday: boolean;
  isFuture: boolean;
}

export interface DigestCalendarWeekRow {
  days: DigestCalendarCell[];
  weekly:
    | {
        slug: string;
        issueNumber: number | null;
        href: string;
        label: string;
      }
    | null;
  weeklyState: 'published' | 'soon' | null;
}

export interface DigestsPageData {
  counts: DigestArchiveCounts;
  dailySpotlight: DigestDailySpotlight | null;
  weeklySpotlight: WeeklyDigestHomeView | null;
  calendarMonth: string;
  calendarCaption: string;
  weekdayHeaders: string[];
  calendarWeeks: DigestCalendarWeekRow[];
  initialTimeline: DigestTimelineEntry[];
  initialMonthKey: string | null;
  hasMoreTimeline: boolean;
  itemListEntries: DigestArchiveEntry[];
}

export interface DigestArchiveMoreResult {
  months: Record<string, DigestTimelineEntry[]>;
  overflowFirstMonth: DigestTimelineEntry[];
}

export const TIMELINE_INITIAL_PER_MONTH = 10;

function localeFor(lang: Lang): string {
  return lang === 'uk' ? 'uk-UA' : 'en-US';
}

export function formatDigestWeekday(iso: string, lang: Lang, style: 'short' | 'long' = 'long'): string {
  return new Intl.DateTimeFormat(localeFor(lang), {
    weekday: style,
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function formatDigestMonthYear(yearMonth: string, lang: Lang): string {
  const [year, month] = yearMonth.split('-').map((part) => Number(part));
  if (!year || !month) return yearMonth;
  return new Intl.DateTimeFormat(localeFor(lang), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function monthKeyFromIso(iso: string): string {
  return iso.slice(0, 7);
}

function compareTimelineDesc(a: DigestTimelineEntry, b: DigestTimelineEntry): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.kind !== b.kind) return a.kind === 'weekly' ? -1 : 1;
  return 0;
}

function groupTimelineByMonth(entries: DigestTimelineEntry[]): Record<string, DigestTimelineEntry[]> {
  const groups: Record<string, DigestTimelineEntry[]> = {};
  for (const entry of [...entries].sort(compareTimelineDesc)) {
    const key = monthKeyFromIso(entry.date);
    (groups[key] ||= []).push(entry);
  }
  return groups;
}

export function sliceInitialTimeline(entries: DigestTimelineEntry[]): {
  initialTimeline: DigestTimelineEntry[];
  initialMonthKey: string | null;
  hasMoreTimeline: boolean;
  overflowFirstMonth: DigestTimelineEntry[];
} {
  const groups = groupTimelineByMonth(entries);
  const monthKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  const firstKey = monthKeys[0] ?? null;
  if (!firstKey) {
    return {
      initialTimeline: [],
      initialMonthKey: null,
      hasMoreTimeline: false,
      overflowFirstMonth: [],
    };
  }
  const firstMonth = groups[firstKey] ?? [];
  const initialTimeline = firstMonth.slice(0, TIMELINE_INITIAL_PER_MONTH);
  const overflowFirstMonth = firstMonth.slice(TIMELINE_INITIAL_PER_MONTH);
  const hasMoreTimeline = overflowFirstMonth.length > 0 || monthKeys.length > 1;
  return { initialTimeline, initialMonthKey: firstKey, hasMoreTimeline, overflowFirstMonth };
}

export function buildDigestArchiveMore(
  entries: DigestTimelineEntry[],
  initialMonthKey: string | null,
): DigestArchiveMoreResult {
  const groups = groupTimelineByMonth(entries);
  const monthKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  const overflowFirstMonth =
    initialMonthKey && groups[initialMonthKey]
      ? groups[initialMonthKey].slice(TIMELINE_INITIAL_PER_MONTH)
      : [];
  const months: Record<string, DigestTimelineEntry[]> = {};
  for (const key of monthKeys) {
    if (key === initialMonthKey) continue;
    months[key] = groups[key] ?? [];
  }
  return { months, overflowFirstMonth };
}

export function buildDigestCalendar(
  lang: Lang,
  yearMonth: string,
  dailyByDate: ReadonlyMap<string, string>,
  weeklies: ReadonlyArray<{
    weekStart: string;
    weekEnd: string;
    slug: string;
    issueNumber: number | null;
  }>,
  todayIso: string,
): {
  calendarCaption: string;
  weekdayHeaders: string[];
  calendarWeeks: DigestCalendarWeekRow[];
} {
  const [year, month] = yearMonth.split('-').map((part) => Number(part));
  if (!year || !month) {
    return { calendarCaption: yearMonth, weekdayHeaders: [], calendarWeeks: [] };
  }
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mondayFirstLead = (firstDay.getUTCDay() + 6) % 7;
  const cells: Array<number | null> = [
    ...Array.from({ length: mondayFirstLead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weekdayHeaders = Array.from({ length: 7 }, (_, index) => {
    const iso = shiftIsoDate('2024-01-01', index) ?? '2024-01-01';
    return formatDigestWeekday(iso, lang, 'short');
  });

  const weeklyForWeek = (weekDays: Array<number | null>) => {
    const valid = weekDays.filter((day): day is number => day !== null);
    if (!valid.length) return null;
    const lastIso = `${yearMonth}-${String(valid[valid.length - 1]).padStart(2, '0')}`;
    const firstIso = `${yearMonth}-${String(valid[0]).padStart(2, '0')}`;
    return (
      weeklies.find(
        (issue) => issue.weekStart <= lastIso && issue.weekEnd >= firstIso,
      ) ?? null
    );
  };

  const calendarWeeks: DigestCalendarWeekRow[] = [];
  for (let index = 0; index < cells.length; index += 7) {
    const weekDays = cells.slice(index, index + 7);
    const issue = weeklyForWeek(weekDays);
    const firstDayInWeek = weekDays.find((day) => day !== null) ?? null;
    const weekIsFuture =
      firstDayInWeek !== null &&
      `${yearMonth}-${String(firstDayInWeek).padStart(2, '0')}` > todayIso;

    calendarWeeks.push({
      days: weekDays.map((day) => {
        if (!day) {
          return {
            date: null,
            dayNumber: null,
            hasDaily: false,
            dailyHref: null,
            accessibleLabel: null,
            isToday: false,
            isFuture: false,
          };
        }
        const iso = `${yearMonth}-${String(day).padStart(2, '0')}`;
        const slug = dailyByDate.get(iso) ?? null;
        const hasDaily = Boolean(slug);
        const isToday = iso === todayIso;
        const isFuture = iso > todayIso;
        const longDate = new Intl.DateTimeFormat(localeFor(lang), {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(`${iso}T00:00:00Z`));
        const dailyLabel =
          lang === 'uk' ? `Щоденний бриф ${longDate}` : `Daily brief ${longDate}`;
        const offLabel =
          lang === 'uk'
            ? `${longDate}: без щоденного випуску`
            : `${longDate}: no daily edition`;
        const futureLabel = lang === 'uk' ? `${longDate}: ще попереду` : `${longDate}: upcoming`;
        return {
          date: iso,
          dayNumber: day,
          hasDaily,
          dailyHref: slug ? `/${lang}/${slug}` : null,
          accessibleLabel: hasDaily
            ? `${dailyLabel}${isToday ? (lang === 'uk' ? ' · сьогодні' : ' · today') : ''}`
            : isFuture
              ? futureLabel
              : offLabel,
          isToday,
          isFuture,
        };
      }),
      weekly: issue
        ? {
            slug: issue.slug,
            issueNumber: issue.issueNumber,
            href: `/${lang}/weekly/${issue.slug}`,
            label:
              issue.issueNumber !== null
                ? lang === 'uk'
                  ? `№ ${issue.issueNumber}`
                  : `No. ${issue.issueNumber}`
                : lang === 'uk'
                  ? 'Тижневик'
                  : 'Weekly',
          }
        : null,
      weeklyState: issue ? 'published' : weekIsFuture ? 'soon' : null,
    });
  }

  return {
    calendarCaption: formatDigestMonthYear(yearMonth, lang),
    weekdayHeaders,
    calendarWeeks,
  };
}

export function timelineStatsLabel(lang: Lang, entry: DigestTimelineEntry): string {
  const stories = pluralLabel(entry.storyCount, lang, 'stories');
  const minutes = pluralLabel(entry.readMinutes, lang, 'minutes');
  const parts = [`${entry.storyCount} ${stories}`, `${entry.readMinutes} ${minutes}`];
  if (entry.kind === 'weekly') {
    if (entry.hasPdf) parts.push('PDF');
    if (entry.hasVideo) parts.push(lang === 'uk' ? 'Відео' : 'Video');
  }
  return parts.join(' · ');
}

export function issueLabel(lang: Lang, issueNumber: number | null): string | null {
  if (issueNumber === null) return null;
  return lang === 'uk' ? `№ ${issueNumber}` : `No. ${issueNumber}`;
}
