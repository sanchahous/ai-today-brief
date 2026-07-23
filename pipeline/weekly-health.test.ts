import { describe, expect, it } from 'vitest';
import { assessWeeklyDigestHealth, completedWeekForDate } from './weekly-health';

describe('completedWeekForDate', () => {
  it('returns the Monday–Sunday week completed before Monday', () => {
    expect(completedWeekForDate('2026-07-20')).toEqual({
      weekStart: '2026-07-13',
      weekEnd: '2026-07-19',
    });
  });

  it('does not treat an in-progress Sunday as already complete', () => {
    expect(completedWeekForDate('2026-07-19')).toEqual({
      weekStart: '2026-07-06',
      weekEnd: '2026-07-12',
    });
  });
});

describe('assessWeeklyDigestHealth', () => {
  it('requires both published status and timestamp', () => {
    expect(assessWeeklyDigestHealth('2026-07-13', null).health).toBe('missing');
    expect(
      assessWeeklyDigestHealth('2026-07-13', {
        week_start: '2026-07-13',
        status: 'in_review',
        published_at: null,
      }).health,
    ).toBe('unpublished');
    expect(
      assessWeeklyDigestHealth('2026-07-13', {
        week_start: '2026-07-13',
        status: 'published',
        published_at: '2026-07-20T07:00:00Z',
      }).health,
    ).toBe('healthy');
  });
});
