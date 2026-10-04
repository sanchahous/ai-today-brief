import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLatestBrief } from '@/lib/briefs';
import {
  buildDigestArchiveMore,
  buildDigestCalendar,
  formatDigestWeekday,
  sliceInitialTimeline,
  type DigestArchiveFilter,
  type DigestArchiveMoreResult,
  type DigestDailySpotlight,
  type DigestTimelineDailyEntry,
  type DigestTimelineEntry,
  type DigestTimelineWeeklyEntry,
  type DigestsPageData,
} from '@/lib/digests-archive-shared';
import {
  calendarDateInZone,
  readMinutesForParts,
  shiftIsoDate,
  sumReadMinutes,
} from '@/lib/home-stats';
import { getSupabase } from '@/lib/supabase';
import type { Lang } from '@/lib/site';
import { getDigestArchive, getLatestWeeklyDigest } from '@/lib/digests';

export type {
  DigestArchiveFilter,
  DigestArchiveCounts,
  DigestDailySpotlight,
  DigestTimelineEntry,
  DigestCalendarWeekRow,
  DigestsPageData,
  DigestArchiveMoreResult,
} from '@/lib/digests-archive-shared';

export {
  buildDigestArchiveMore,
  buildDigestCalendar,
  formatDigestMonthYear,
  formatDigestWeekday,
  issueLabel,
  sliceInitialTimeline,
  timelineStatsLabel,
} from '@/lib/digests-archive-shared';

interface DailyRow {
  id: string;
  date: string;
  slug: string | null;
  title_en: string | null;
  title_uk: string | null;
  intro_en: string | null;
  intro_uk: string | null;
}

interface WeeklyRow {
  id: string;
  week_start: string;
  week_end: string | null;
  slug: string;
  title_en: string;
  title_uk: string;
  intro_en: string | null;
  intro_uk: string | null;
  published_revision_id: string | null;
}

interface BriefItemRow {
  brief_id: string;
  rank: number;
  title_en: string | null;
  title_uk: string | null;
  summary_en: string;
  summary_uk: string;
  why_matters_en: string | null;
  why_matters_uk: string | null;
}

function pick(lang: Lang, en: string | null | undefined, uk: string | null | undefined): string {
  return ((lang === 'uk' ? uk : en) ?? en ?? uk ?? '').trim();
}

function dayNumberFromIso(iso: string): number {
  return Number(iso.slice(8, 10));
}

async function readArchiveCounts(db: SupabaseClient) {
  const [{ count: daily }, { count: weekly }] = await Promise.all([
    db
      .from('briefs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('edition', 1)
      .not('slug', 'is', null),
    db
      .from('weekly_digests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published'),
  ]);
  const dailyCount = daily ?? 0;
  const weeklyCount = weekly ?? 0;
  return { all: dailyCount + weeklyCount, daily: dailyCount, weekly: weeklyCount };
}

async function readDailyRows(db: SupabaseClient): Promise<DailyRow[]> {
  const { data } = await db
    .from('briefs')
    .select('id,date,slug,title_en,title_uk,intro_en,intro_uk')
    .eq('status', 'published')
    .eq('edition', 1)
    .not('slug', 'is', null)
    .order('date', { ascending: false });
  return (data as DailyRow[] | null) ?? [];
}

async function readWeeklyRows(db: SupabaseClient): Promise<WeeklyRow[]> {
  const { data } = await db
    .from('weekly_digests')
    .select(
      'id,week_start,week_end,slug,title_en,title_uk,intro_en,intro_uk,published_revision_id',
    )
    .eq('status', 'published')
    .order('week_start', { ascending: false });
  return (data as WeeklyRow[] | null) ?? [];
}

async function readBriefItemsByBriefIds(
  db: SupabaseClient,
  briefIds: string[],
): Promise<Map<string, BriefItemRow[]>> {
  if (!briefIds.length) return new Map();
  const { data } = await db
    .from('brief_items')
    .select(
      'brief_id,rank,title_en,title_uk,summary_en,summary_uk,why_matters_en,why_matters_uk',
    )
    .in('brief_id', briefIds)
    .is('canonical_item_id', null)
    .order('rank', { ascending: true });
  const grouped = new Map<string, BriefItemRow[]>();
  for (const row of (data as BriefItemRow[] | null) ?? []) {
    const list = grouped.get(row.brief_id) ?? [];
    list.push(row);
    grouped.set(row.brief_id, list);
  }
  return grouped;
}

async function readWeeklyIssueNumbers(db: SupabaseClient): Promise<Map<string, number>> {
  const { data } = await db
    .from('weekly_digests')
    .select('week_start')
    .eq('status', 'published')
    .eq('is_test', false);
  const starts = ((data as Array<{ week_start: string }> | null) ?? []).map((row) => row.week_start);
  const unique = [...new Set(starts)].sort((a, b) => a.localeCompare(b));
  const map = new Map<string, number>();
  for (let index = 0; index < unique.length; index += 1) {
    map.set(unique[index], index + 1);
  }
  return map;
}

function dailyTimelineEntry(
  lang: Lang,
  row: DailyRow,
  items: BriefItemRow[],
): DigestTimelineDailyEntry | null {
  if (!row.slug) return null;
  const cards = items.map((item) => ({
    title: pick(lang, item.title_en, item.title_uk) || pick(lang, item.summary_en, item.summary_uk),
    summary: pick(lang, item.summary_en, item.summary_uk),
    why: pick(lang, item.why_matters_en, item.why_matters_uk),
  }));
  const lead = cards[0]?.title ?? null;
  const readMinutes = sumReadMinutes(
    cards.map((card) => ({
      readMinutes: readMinutesForParts([{ summary: card.summary, why: card.why }]),
    })),
  );
  return {
    kind: 'daily',
    id: row.id,
    date: row.date,
    slug: row.slug,
    title: pick(lang, row.title_en, row.title_uk) || row.date,
    href: `/${lang}/${row.slug}`,
    weekday: formatDigestWeekday(row.date, lang, 'short'),
    dayNumber: dayNumberFromIso(row.date),
    leadTitle: lead,
    storyCount: cards.length,
    readMinutes,
  };
}

function weeklyTimelineEntry(
  lang: Lang,
  row: WeeklyRow,
  issueNumber: number | null,
): DigestTimelineWeeklyEntry {
  return {
    kind: 'weekly',
    id: row.id,
    date: row.week_start,
    slug: row.slug,
    title: pick(lang, row.title_en, row.title_uk),
    href: `/${lang}/weekly/${row.slug}`,
    weekEnd: row.week_end ?? shiftIsoDate(row.week_start, 6) ?? row.week_start,
    issueNumber,
    standfirst: pick(lang, row.intro_en, row.intro_uk) || null,
    storyCount: 0,
    readMinutes: 0,
    hasPdf: false,
    hasVideo: false,
  };
}

async function buildTimelineEntries(
  db: SupabaseClient,
  lang: Lang,
  filter: DigestArchiveFilter,
): Promise<DigestTimelineEntry[]> {
  const [dailies, weeklies, issueMap] = await Promise.all([
    filter === 'weekly' ? Promise.resolve([]) : readDailyRows(db),
    filter === 'daily' ? Promise.resolve([]) : readWeeklyRows(db),
    readWeeklyIssueNumbers(db),
  ]);
  const itemMap = await readBriefItemsByBriefIds(db, dailies.map((row) => row.id));

  const dailyEntries = dailies.flatMap((row) => {
    const entry = dailyTimelineEntry(lang, row, itemMap.get(row.id) ?? []);
    return entry ? [entry] : [];
  });

  const weeklyEntries = weeklies.map((row) =>
    weeklyTimelineEntry(lang, row, issueMap.get(row.week_start) ?? null),
  );

  return [...dailyEntries, ...weeklyEntries].sort((a, b) => (a.date < b.date ? 1 : -1));
}

async function buildDailySpotlight(lang: Lang): Promise<DigestDailySpotlight | null> {
  const latest = await getLatestBrief(lang, 3);
  if (!latest?.slug) return null;
  const monthYear = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${latest.date}T00:00:00Z`));
  const readMinutes = sumReadMinutes(latest.items);
  return {
    id: latest.id,
    date: latest.date,
    slug: latest.slug,
    title: latest.title || latest.date,
    href: `/${lang}/${latest.slug}`,
    dayNumber: dayNumberFromIso(latest.date),
    weekday: formatDigestWeekday(latest.date, lang, 'long'),
    monthYear,
    storyCount: latest.items.length,
    readMinutes,
    topStories: latest.items.slice(0, 3).map((item) => item.title),
  };
}

function calendarMonthFromToday(todayIso: string): string {
  return todayIso.slice(0, 7);
}

function dailySlugByDate(dailies: DailyRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of dailies) {
    if (row.slug) map.set(row.date, row.slug);
  }
  return map;
}

export async function getDigestsPageData(lang: Lang): Promise<DigestsPageData> {
  const typed = getSupabase();
  const empty: DigestsPageData = {
    counts: { all: 0, daily: 0, weekly: 0 },
    dailySpotlight: null,
    weeklySpotlight: null,
    calendarMonth: calendarMonthFromToday(calendarDateInZone(new Date())),
    calendarCaption: '',
    weekdayHeaders: [],
    calendarWeeks: [],
    initialTimeline: [],
    initialMonthKey: null,
    hasMoreTimeline: false,
    itemListEntries: [],
  };
  if (!typed) return empty;

  const db = typed as unknown as SupabaseClient;
  const todayIso = calendarDateInZone(new Date());
  const calendarMonth = calendarMonthFromToday(todayIso);

  const [counts, dailySpotlight, weeklySpotlight, dailies, weeklies, issueMap, itemListEntries] =
    await Promise.all([
      readArchiveCounts(db),
      buildDailySpotlight(lang),
      getLatestWeeklyDigest(lang),
      readDailyRows(db),
      readWeeklyRows(db),
      readWeeklyIssueNumbers(db),
      getDigestArchive(lang),
    ]);

  const timeline = await buildTimelineEntries(db, lang, 'all');
  const { initialTimeline, initialMonthKey, hasMoreTimeline } = sliceInitialTimeline(timeline);

  const weeklyCalendarRows = weeklies.map((row) => ({
    weekStart: row.week_start,
    weekEnd: row.week_end ?? shiftIsoDate(row.week_start, 6) ?? row.week_start,
    slug: row.slug,
    issueNumber: issueMap.get(row.week_start) ?? null,
  }));
  const calendar = buildDigestCalendar(
    lang,
    calendarMonth,
    dailySlugByDate(dailies),
    weeklyCalendarRows,
    todayIso,
  );

  return {
    counts,
    dailySpotlight,
    weeklySpotlight,
    calendarMonth,
    calendarCaption: calendar.calendarCaption,
    weekdayHeaders: calendar.weekdayHeaders,
    calendarWeeks: calendar.calendarWeeks,
    initialTimeline,
    initialMonthKey,
    hasMoreTimeline,
    itemListEntries,
  };
}

export async function getDigestArchiveMoreData(
  lang: Lang,
  filter: DigestArchiveFilter,
  initialMonthKey: string | null,
): Promise<DigestArchiveMoreResult> {
  const typed = getSupabase();
  if (!typed) return { months: {}, overflowFirstMonth: [] };
  const db = typed as unknown as SupabaseClient;
  const entries = await buildTimelineEntries(db, lang, filter);
  return buildDigestArchiveMore(entries, initialMonthKey);
}
