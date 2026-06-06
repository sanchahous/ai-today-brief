import { describe, expect, it } from 'vitest';
import {
  geminiMaxAttemptsForSlot,
  getKyivMinutesOfDay,
  getKyivScheduleAttemptSlot,
  getPipelineDateKyiv,
  KYIV_SCHEDULE_ATTEMPTS,
  parseScheduleAttemptFlag,
  resolveScheduleAttempt,
  shouldUseOpenRouter,
} from './schedule';

// EEST = UTC+3 in summer (Europe/Kyiv DST active during these test dates)
// UTC 03:00 = Kyiv 06:00
const AT_600 = new Date('2026-05-29T03:00:00.000Z');
const AT_630 = new Date('2026-05-29T03:30:00.000Z');
const AT_700 = new Date('2026-05-29T04:00:00.000Z');
const AT_830 = new Date('2026-05-29T05:30:00.000Z');
const AT_NOON = new Date('2026-05-29T09:00:00.000Z'); // Kyiv 12:00 — outside window
const AT_0530 = new Date('2026-05-29T02:30:00.000Z'); // Kyiv 05:30 — before window

describe('getPipelineDateKyiv', () => {
  it('returns YYYY-MM-DD', () => {
    expect(getPipelineDateKyiv(AT_600)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns Kyiv date not UTC date (when they differ near midnight)', () => {
    // UTC 22:00 on May 28 = Kyiv 01:00 on May 29
    const nearMidnight = new Date('2026-05-28T22:00:00.000Z');
    const kyivDate = getPipelineDateKyiv(nearMidnight);
    expect(kyivDate).toBe('2026-05-29'); // Kyiv is already the next day
  });
});

describe('getKyivMinutesOfDay', () => {
  it('returns 360 for 06:00 Kyiv (UTC 03:00 EEST)', () => {
    expect(getKyivMinutesOfDay(AT_600)).toBe(6 * 60);
  });

  it('returns 390 for 06:30 Kyiv', () => {
    expect(getKyivMinutesOfDay(AT_630)).toBe(6 * 60 + 30);
  });

  it('returns 510 for 08:30 Kyiv', () => {
    expect(getKyivMinutesOfDay(AT_830)).toBe(8 * 60 + 30);
  });
});

describe('getKyivScheduleAttemptSlot', () => {
  it('maps 06:00 → slot 1', () => {
    expect(getKyivScheduleAttemptSlot(AT_600)).toBe(1);
  });

  it('maps 06:30 → slot 2', () => {
    expect(getKyivScheduleAttemptSlot(AT_630)).toBe(2);
  });

  it('maps 07:00 → slot 3', () => {
    expect(getKyivScheduleAttemptSlot(AT_700)).toBe(3);
  });

  it('maps 08:30 → slot 6 (final)', () => {
    expect(getKyivScheduleAttemptSlot(AT_830)).toBe(6);
  });

  it('returns null before 06:00', () => {
    expect(getKyivScheduleAttemptSlot(AT_0530)).toBeNull();
  });

  it('returns null after 08:30', () => {
    expect(getKyivScheduleAttemptSlot(AT_NOON)).toBeNull();
  });

  it('returns null for non-slot minutes (e.g. 06:15)', () => {
    const at615 = new Date('2026-05-29T03:15:00.000Z'); // Kyiv 06:15
    expect(getKyivScheduleAttemptSlot(at615)).toBeNull();
  });
});

describe('parseScheduleAttemptFlag', () => {
  it('returns undefined when --attempt is absent', () => {
    expect(parseScheduleAttemptFlag(['node', 'run'])).toBeUndefined();
  });

  it('parses --attempt N correctly', () => {
    expect(parseScheduleAttemptFlag(['node', 'run', '--attempt', '4'])).toBe(4);
  });

  it('throws on out-of-range attempt', () => {
    expect(() => parseScheduleAttemptFlag(['node', 'run', '--attempt', '99'])).toThrow(/--attempt/);
    expect(() => parseScheduleAttemptFlag(['node', 'run', '--attempt', '0'])).toThrow(/--attempt/);
  });

  it('returns undefined when --attempt has no following value', () => {
    expect(parseScheduleAttemptFlag(['node', 'run', '--attempt'])).toBeUndefined();
  });
});

describe('resolveScheduleAttempt', () => {
  it('uses --attempt flag first', () => {
    expect(
      resolveScheduleAttempt({ argv: ['node', 'run', '--attempt', '4'], now: AT_NOON }),
    ).toBe(4);
  });

  it('uses PIPELINE_SCHEDULE_ATTEMPT env when no flag', () => {
    expect(
      resolveScheduleAttempt({
        argv: ['node', 'run'],
        env: { PIPELINE_SCHEDULE_ATTEMPT: '3' },
        now: AT_NOON,
      }),
    ).toBe(3);
  });

  it('uses Kyiv slot when in-window and no flag/env', () => {
    expect(resolveScheduleAttempt({ argv: [], env: {}, now: AT_600 })).toBe(1);
    expect(resolveScheduleAttempt({ argv: [], env: {}, now: AT_830 })).toBe(6);
  });

  it('uses failure count + 1 when outside Kyiv window', () => {
    expect(
      resolveScheduleAttempt({
        argv: [],
        env: {},
        now: AT_NOON,
        summarizeFailuresToday: 2,
      }),
    ).toBe(3);
  });

  it('clamps failure-based attempt to KYIV_SCHEDULE_ATTEMPTS max', () => {
    expect(
      resolveScheduleAttempt({
        argv: [],
        env: {},
        now: AT_NOON,
        summarizeFailuresToday: 10,
      }),
    ).toBe(KYIV_SCHEDULE_ATTEMPTS);
  });

  it('defaults to attempt 1 when no failures and outside window', () => {
    expect(
      resolveScheduleAttempt({
        argv: [],
        env: {},
        now: AT_NOON,
        summarizeFailuresToday: 0,
      }),
    ).toBe(1);
  });

  it('ignores invalid PIPELINE_SCHEDULE_ATTEMPT env', () => {
    const result = resolveScheduleAttempt({
      argv: [],
      env: { PIPELINE_SCHEDULE_ATTEMPT: 'bad' },
      now: AT_NOON,
      summarizeFailuresToday: 0,
    });
    // Falls through to failure-count path → 1
    expect(result).toBe(1);
  });
});

describe('shouldUseOpenRouter', () => {
  it('returns false for slots 1–5', () => {
    for (let i = 1; i < KYIV_SCHEDULE_ATTEMPTS; i++) {
      expect(shouldUseOpenRouter(i)).toBe(false);
    }
  });

  it('returns true for slot 6 (final)', () => {
    expect(shouldUseOpenRouter(6)).toBe(true);
  });

  it('returns true for values > 6', () => {
    expect(shouldUseOpenRouter(7)).toBe(true);
  });
});

describe('geminiMaxAttemptsForSlot', () => {
  it('returns 2 for early slots', () => {
    expect(geminiMaxAttemptsForSlot(1)).toBe(2);
    expect(geminiMaxAttemptsForSlot(5)).toBe(2);
  });

  it('returns 3 for final slot', () => {
    expect(geminiMaxAttemptsForSlot(6)).toBe(3);
    expect(geminiMaxAttemptsForSlot(7)).toBe(3);
  });
});
