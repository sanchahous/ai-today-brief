import { describe, expect, it } from 'vitest';
import {
  channelRunsOnDate,
  completedWeeklyRangeForTrigger,
  kyivWallClockToUtc,
  nextScheduledForChannel,
  nextWeeklyScheduledForChannel,
  rollingWeeklyRangeForDate,
  resolveCadenceSettings,
  weeklyDigestTriggerDateForManualCreate,
} from './schedule';

describe('Kyiv social scheduling', () => {
  it('converts winter and summer wall clocks with DST', () => {
    expect(kyivWallClockToUtc('2026-01-15', 21, 0).toISOString()).toBe('2026-01-15T19:00:00.000Z');
    expect(kyivWallClockToUtc('2026-07-15', 21, 0).toISOString()).toBe('2026-07-15T18:00:00.000Z');
  });

  it('honours channel weekdays', () => {
    expect(channelRunsOnDate('instagram', '2026-07-15')).toBe(true); // Wednesday
    expect(channelRunsOnDate('instagram', '2026-07-16')).toBe(false);
    expect(channelRunsOnDate('linkedin', '2026-07-16')).toBe(true); // Thursday
  });

  it('moves an elapsed slot to the next allowed day', () => {
    expect(
      nextScheduledForChannel('linkedin', '2026-07-16', new Date('2026-07-16T12:00:00Z')),
    ).toBe('2026-07-20T07:00:00.000Z');
  });

  it('resolves Sunday and later retries to the prior Sunday–Saturday window', () => {
    expect(completedWeeklyRangeForTrigger('2026-07-12')).toEqual({
      weekStart: '2026-07-05',
      weekEnd: '2026-07-11',
    });
    expect(completedWeeklyRangeForTrigger('2026-07-16')).toEqual({
      weekStart: '2026-07-05',
      weekEnd: '2026-07-11',
    });
  });

  it('uses the seven editorial days ending at Weekly creation', () => {
    expect(rollingWeeklyRangeForDate('2026-07-12')).toEqual({
      weekStart: '2026-07-06',
      weekEnd: '2026-07-12',
    });
    expect(rollingWeeklyRangeForDate('2026-07-16')).toEqual({
      weekStart: '2026-07-10',
      weekEnd: '2026-07-16',
    });
  });

  it('uses the Sunday closing the latest completed week for manual Weekly creation', () => {
    expect(weeklyDigestTriggerDateForManualCreate('2026-08-01')).toBe('2026-08-02'); // Saturday
    expect(weeklyDigestTriggerDateForManualCreate('2026-08-02')).toBe('2026-08-02'); // Sunday
    expect(weeklyDigestTriggerDateForManualCreate('2026-08-03')).toBe('2026-08-02'); // Monday
  });

  it('uses same-day weekly slots from the release anchor, not the next Monday', () => {
    const now = new Date('2026-07-12T12:00:00Z');
    const anchor = '2026-07-11';
    expect(nextWeeklyScheduledForChannel('linkedin', anchor, now)).toBe('2026-07-12T13:10:00.000Z');
    expect(nextWeeklyScheduledForChannel('x', anchor, now)).toBe('2026-07-12T13:20:00.000Z');
    expect(nextWeeklyScheduledForChannel('threads', anchor, now)).toBe('2026-07-12T13:30:00.000Z');
    expect(nextWeeklyScheduledForChannel('telegram', anchor, now)).toBe('2026-07-12T15:00:00.000Z');
    expect(nextWeeklyScheduledForChannel('instagram', anchor, now)).toBe(
      '2026-07-12T16:00:00.000Z',
    );
    expect(nextWeeklyScheduledForChannel('facebook', anchor, now)).toBe('2026-07-12T16:30:00.000Z');
  });

  it('keeps weekly wall clocks stable across winter DST offset', () => {
    expect(
      nextWeeklyScheduledForChannel('linkedin', '2026-01-10', new Date('2026-01-11T12:00:00Z')),
    ).toBe('2026-01-11T14:10:00.000Z');
    expect(
      nextWeeklyScheduledForChannel('facebook', '2026-01-10', new Date('2026-01-11T12:00:00Z')),
    ).toBe('2026-01-11T17:30:00.000Z');
  });

  it('moves only an elapsed weekly slot to the next calendar day', () => {
    const now = new Date('2026-07-13T13:11:00.000Z');
    expect(nextWeeklyScheduledForChannel('linkedin', '2026-07-11', now)).toBe(
      '2026-07-14T13:10:00.000Z',
    );
    expect(nextWeeklyScheduledForChannel('x', '2026-07-11', now)).toBe('2026-07-13T13:20:00.000Z');
  });

  it('validates persisted cadence and falls back per channel', () => {
    const cadence = resolveCadenceSettings({
      x: { days: [1, 3], hour: 9, minute: 45 },
      threads: { days: [], hour: 99, minute: 0 },
    });
    expect(cadence.x).toEqual({ days: [1, 3], hour: 9, minute: 45 });
    expect(cadence.threads).toEqual({
      days: [0, 1, 2, 3, 4, 5, 6],
      hour: 18,
      minute: 0,
    });
  });
});
