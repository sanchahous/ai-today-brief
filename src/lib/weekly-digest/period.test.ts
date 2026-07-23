import { describe, expect, it } from 'vitest';
import { isWeeklyDigestReleaseDue, weeklyDigestPeriodForTrigger } from './period';

describe('Weekly Digest editorial period', () => {
  it('uses the rolling seven-day window and next Monday summer Kyiv gates', () => {
    expect(weeklyDigestPeriodForTrigger('2026-07-12')).toEqual({
      weekStart: '2026-07-06',
      weekEnd: '2026-07-12',
      releaseDate: '2026-07-13',
      preflightAt: '2026-07-13T12:45:00.000Z',
      releaseAt: '2026-07-13T13:00:00.000Z',
    });
  });

  it('keeps the Monday wall clock stable in winter', () => {
    expect(weeklyDigestPeriodForTrigger('2026-01-11')).toMatchObject({
      weekStart: '2026-01-05',
      weekEnd: '2026-01-11',
      releaseDate: '2026-01-12',
      preflightAt: '2026-01-12T13:45:00.000Z',
      releaseAt: '2026-01-12T14:00:00.000Z',
    });
  });

  it('uses the next Monday for a weekday-created test edition', () => {
    expect(weeklyDigestPeriodForTrigger('2026-07-16')).toMatchObject({
      weekStart: '2026-07-10',
      weekEnd: '2026-07-16',
      releaseDate: '2026-07-20',
    });
  });

  it('does not consider an invalid or future release due', () => {
    const now = new Date('2026-07-13T12:59:59.999Z');
    expect(isWeeklyDigestReleaseDue('2026-07-13T13:00:00.000Z', now)).toBe(false);
    expect(isWeeklyDigestReleaseDue('not-a-date', now)).toBe(false);
    expect(
      isWeeklyDigestReleaseDue('2026-07-13T13:00:00.000Z', new Date('2026-07-13T13:00:00.000Z')),
    ).toBe(true);
  });
});
