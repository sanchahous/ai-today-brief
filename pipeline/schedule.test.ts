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
  it('maps hours to progón 0–5 (every 4 h)', () => {
    expect(getKyivCycleIndex(kyiv(0, 0))).toBe(0);
    expect(getKyivCycleIndex(kyiv(3, 59))).toBe(0);
    expect(getKyivCycleIndex(kyiv(4, 0))).toBe(1);
    expect(getKyivCycleIndex(kyiv(8, 0))).toBe(2);
    expect(getKyivCycleIndex(kyiv(20, 0))).toBe(5);
  });
});

describe('formatKyivSlotTime', () => {
  it('formats slot times within a progón', () => {
    expect(formatKyivSlotTime(2, 1)).toBe('08:00');
    expect(formatKyivSlotTime(2, 4)).toBe('09:30');
  });
});

describe('formatKyivCycleLabel', () => {
  it('shows the 4-slot progón window', () => {
    expect(formatKyivCycleLabel(2)).toBe('08:00–09:30');
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
  it('maps 08:00 progón 2 → slot 1', () => {
    expect(getKyivScheduleAttemptSlot(kyiv(8, 0))).toBe(1);
  });

  it('maps 08:30 → slot 2', () => {
    expect(getKyivScheduleAttemptSlot(kyiv(8, 30))).toBe(2);
  });

  it('maps 09:30 → slot 4 (final)', () => {
    expect(getKyivScheduleAttemptSlot(kyiv(9, 30))).toBe(4);
  });

  it('returns null after the 1.5 h progón window', () => {
    expect(getKyivScheduleAttemptSlot(kyiv(10, 0))).toBeNull();
    expect(getKyivScheduleAttemptSlot(kyiv(11, 0))).toBeNull();
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
        now: kyiv(15, 0),
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
