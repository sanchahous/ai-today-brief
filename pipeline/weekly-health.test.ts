import { describe, expect, it } from 'vitest';
import { assessWeeklyDigestHealth, completedWeekForDate } from './weekly-health';

describe('completedWeekForDate', () => {
  it('returns the Sunday–Saturday period released on Monday', () => {
    expect(completedWeekForDate('2026-07-20')).toEqual({
      weekStart: '2026-07-12',
      weekEnd: '2026-07-18',
    });
  });

  it('uses the period that closed before Sunday started', () => {
    expect(completedWeekForDate('2026-07-19')).toEqual({
      weekStart: '2026-07-12',
      weekEnd: '2026-07-18',
    });
  });
});

describe('assessWeeklyDigestHealth', () => {
  it('requires both published status and timestamp', () => {
    expect(assessWeeklyDigestHealth('2026-07-12', null).health).toBe('missing');
    expect(
      assessWeeklyDigestHealth('2026-07-12', {
        week_start: '2026-07-12',
        status: 'in_review',
        published_at: null,
      }).health,
    ).toBe('unpublished');
    expect(
      assessWeeklyDigestHealth('2026-07-12', {
        week_start: '2026-07-12',
        status: 'published',
        published_at: '2026-07-20T07:00:00Z',
      }).health,
    ).toBe('healthy');
  });
});
