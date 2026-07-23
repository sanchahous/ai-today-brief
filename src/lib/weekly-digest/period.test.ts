import { describe, expect, it } from 'vitest';
import { isWeeklyDigestReleaseDue, weeklyDigestPeriodForTrigger } from './period';

describe('Weekly Digest editorial period', () => {
  it('uses the prior Sunday–Saturday and summer Kyiv release gates', () => {
    expect(weeklyDigestPeriodForTrigger('2026-07-12')).toEqual({
      weekStart: '2026-07-05',
      weekEnd: '2026-07-11',
      releaseDate: '2026-07-13',
      preflightAt: '2026-07-13T12:45:00.000Z',
      releaseAt: '2026-07-13T13:00:00.000Z',
    });
  });

  it('keeps the Monday wall clock stable in winter', () => {
    expect(weeklyDigestPeriodForTrigger('2026-01-11')).toMatchObject({
      weekStart: '2026-01-04',
      weekEnd: '2026-01-10',
      releaseDate: '2026-01-12',
      preflightAt: '2026-01-12T13:45:00.000Z',
      releaseAt: '2026-01-12T14:00:00.000Z',
    });
  });

  it('keeps a later manual retry on the same completed weekly edition', () => {
    expect(weeklyDigestPeriodForTrigger('2026-07-16')).toMatchObject({
      weekStart: '2026-07-05',
      weekEnd: '2026-07-11',
      releaseDate: '2026-07-13',
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
