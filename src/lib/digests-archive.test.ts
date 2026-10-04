import { describe, expect, it } from 'vitest';
import {
  buildDigestArchiveMore,
  buildDigestCalendar,
  formatDigestMonthYear,
  sliceInitialTimeline,
  type DigestTimelineEntry,
} from '@/lib/digests-archive-shared';

const daily = (id: string, date: string): DigestTimelineEntry => ({
  kind: 'daily',
  id,
  date,
  slug: `brief-${id}`,
  title: `Daily ${id}`,
  href: `/en/brief-${id}`,
  weekday: 'Mon',
  dayNumber: Number(date.slice(8, 10)),
  leadTitle: 'Lead',
  storyCount: 4,
  readMinutes: 5,
});

describe('digests archive helpers', () => {
  it('formats month names with Intl', () => {
    expect(formatDigestMonthYear('2026-09', 'en')).toMatch(/September 2026/);
    expect(formatDigestMonthYear('2026-09', 'uk')).toMatch(/2026/);
  });

  it('slices the newest month to ten items and flags overflow', () => {
    const entries = [
      ...Array.from({ length: 12 }, (_, index) => daily(`a-${index}`, `2026-09-${String(index + 1).padStart(2, '0')}`)),
      daily('older', '2026-08-30'),
    ];
    const sliced = sliceInitialTimeline(entries);
    expect(sliced.initialMonthKey).toBe('2026-09');
    expect(sliced.initialTimeline).toHaveLength(10);
    expect(sliced.hasMoreTimeline).toBe(true);
    expect(sliced.overflowFirstMonth).toHaveLength(2);
  });

  it('returns remaining months for archive-more', () => {
    const entries = [
      daily('1', '2026-09-10'),
      daily('2', '2026-08-20'),
      daily('3', '2026-07-15'),
    ];
    const more = buildDigestArchiveMore(entries, '2026-09');
    expect(more.overflowFirstMonth).toEqual([]);
    expect(Object.keys(more.months).sort()).toEqual(['2026-07', '2026-08']);
  });

  it('builds a Monday-first calendar with accessible labels', () => {
    const calendar = buildDigestCalendar(
      'en',
      '2026-09',
      new Map([['2026-09-08', 'brief-08']]),
      [
        {
          weekStart: '2026-09-08',
          weekEnd: '2026-09-14',
          slug: 'weekly-38',
          issueNumber: 38,
        },
      ],
      '2026-09-08',
    );
    expect(calendar.weekdayHeaders[0]).toMatch(/Mon/i);
    const weekWithDaily = calendar.calendarWeeks.find((week) =>
      week.days.some((day) => day.date === '2026-09-08'),
    );
    const dailyCell = weekWithDaily?.days.find((day) => day.date === '2026-09-08');
    expect(dailyCell?.hasDaily).toBe(true);
    expect(dailyCell?.dailyHref).toBe('/en/brief-08');
    expect(dailyCell?.accessibleLabel).toMatch(/Daily brief/);
    expect(dailyCell?.isToday).toBe(true);
    expect(weekWithDaily?.weekly?.slug).toBe('weekly-38');
  });
});
