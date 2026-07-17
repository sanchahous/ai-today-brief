import { describe, expect, it } from 'vitest';
import {
  channelRunsOnDate,
  kyivWallClockToUtc,
  nextScheduledForChannel,
  nextWeeklyScheduledForChannel,
  resolveCadenceSettings,
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

  it('uses the dedicated Sunday weekly Telegram slot', () => {
    expect(
      nextWeeklyScheduledForChannel('telegram', '2026-07-12', new Date('2026-07-11T12:00:00Z')),
    ).toBe('2026-07-12T15:00:00.000Z');
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
