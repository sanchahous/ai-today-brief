import { describe, expect, it } from 'vitest';
import {
  formatKyivCycleLabel,
  formatKyivSlotTime,
  geminiMaxAttemptsForSlot,
  getKyivCycleIndex,
  getKyivMinutesOfDay,
  getKyivScheduleAttemptSlot,
  getPipelineDateKyiv,
  parseScheduleAttemptFlag,
  resolveScheduleAttempt,
} from './schedule';

// EEST = UTC+3 (Europe/Kyiv DST active during these test dates)
const kyiv = (h: number, m = 0) => {
  // UTC = Kyiv - 3h
  return new Date(Date.UTC(2026, 5, 9, h - 3, m, 0));
};

describe('getKyivCycleIndex', () => {
  it('maps hours to a 2 h cycle slot 0–11', () => {
    expect(getKyivCycleIndex(kyiv(0, 0))).toBe(0);
    expect(getKyivCycleIndex(kyiv(1, 59))).toBe(0);
    expect(getKyivCycleIndex(kyiv(2, 0))).toBe(1);
    expect(getKyivCycleIndex(kyiv(8, 0))).toBe(4);
    expect(getKyivCycleIndex(kyiv(20, 0))).toBe(10);
  });
});

describe('formatKyivSlotTime', () => {
  it('formats slot times within a cycle (cycle 4 = 08:00)', () => {
    expect(formatKyivSlotTime(4, 1)).toBe('08:00');
    expect(formatKyivSlotTime(4, 4)).toBe('09:30');
  });
});

describe('formatKyivCycleLabel', () => {
  it('shows the 4-slot cycle window', () => {
    expect(formatKyivCycleLabel(4)).toBe('08:00–09:30');
  });
});

describe('getPipelineDateKyiv', () => {
  it('returns YYYY-MM-DD', () => {
    expect(getPipelineDateKyiv(kyiv(6, 0))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns Kyiv date not UTC date (when they differ near midnight)', () => {
    const nearMidnight = new Date('2026-05-28T22:00:00.000Z');
    const kyivDate = getPipelineDateKyiv(nearMidnight);
    expect(kyivDate).toBe('2026-05-29');
  });
});

describe('getKyivMinutesOfDay', () => {
  it('returns minutes since Kyiv midnight', () => {
    expect(getKyivMinutesOfDay(kyiv(8, 0))).toBe(8 * 60);
    expect(getKyivMinutesOfDay(kyiv(8, 30))).toBe(8 * 60 + 30);
  });
});

describe('getKyivScheduleAttemptSlot', () => {
  it('maps 08:00 (cycle 4 start) → slot 1', () => {
    expect(getKyivScheduleAttemptSlot(kyiv(8, 0))).toBe(1);
  });

  it('maps 08:30 → slot 2', () => {
    expect(getKyivScheduleAttemptSlot(kyiv(8, 30))).toBe(2);
  });

  it('maps 09:30 → slot 4 (final)', () => {
    expect(getKyivScheduleAttemptSlot(kyiv(9, 30))).toBe(4);
  });

  it('returns null after the 1.5 h slot window (before the next 2 h cycle)', () => {
    expect(getKyivScheduleAttemptSlot(kyiv(9, 40))).toBeNull();
    expect(getKyivScheduleAttemptSlot(kyiv(9, 50))).toBeNull();
    // 10:00 is the START of the next cycle → slot 1 again, not null
    expect(getKyivScheduleAttemptSlot(kyiv(10, 0))).toBe(1);
  });

  it('returns null for non-slot minutes (e.g. 08:15)', () => {
    expect(getKyivScheduleAttemptSlot(kyiv(8, 15))).toBeNull();
  });
});

describe('parseScheduleAttemptFlag', () => {
  it('returns undefined when --attempt is absent', () => {
    expect(parseScheduleAttemptFlag(['node', 'run'])).toBeUndefined();
  });

  it('parses --attempt N correctly', () => {
    expect(parseScheduleAttemptFlag(['node', 'run', '--attempt', '4'])).toBe(4);
  });

  it('throws on out-of-range attempt (max is now slot 4)', () => {
    expect(() => parseScheduleAttemptFlag(['node', 'run', '--attempt', '5'])).toThrow(/--attempt/);
    expect(() => parseScheduleAttemptFlag(['node', 'run', '--attempt', '99'])).toThrow(/--attempt/);
    expect(() => parseScheduleAttemptFlag(['node', 'run', '--attempt', '0'])).toThrow(/--attempt/);
  });
});

describe('resolveScheduleAttempt', () => {
  it('uses --attempt flag first', () => {
    expect(resolveScheduleAttempt({ argv: ['node', 'run', '--attempt', '4'], now: kyiv(12, 0) })).toBe(
      4,
    );
  });

  it('uses Kyiv slot when in-window and no flag', () => {
    expect(resolveScheduleAttempt({ argv: [], env: {}, now: kyiv(8, 0) })).toBe(1);
    expect(resolveScheduleAttempt({ argv: [], env: {}, now: kyiv(9, 30) })).toBe(4);
  });

  it('uses failure count + 1 when outside Kyiv window', () => {
    expect(
      resolveScheduleAttempt({
        argv: [],
        env: {},
        now: kyiv(15, 50), // past the 1.5 h slot window of cycle 7 (14:00), before cycle 8
        summarizeFailuresInCycle: 2,
      }),
    ).toBe(3);
  });
});

describe('geminiMaxAttemptsForSlot', () => {
  it('returns 2 for early slots and 3 for the final slot', () => {
    expect(geminiMaxAttemptsForSlot(1)).toBe(2);
    expect(geminiMaxAttemptsForSlot(3)).toBe(2);
    expect(geminiMaxAttemptsForSlot(4)).toBe(3);
  });
});
