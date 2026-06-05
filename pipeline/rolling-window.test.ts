import { describe, expect, it } from 'vitest';
import {
  hnCreatedAtLowerBoundSec,
  isPublishedWithinRollingWindow,
  rollingWindowCutoffIso,
  rollingWindowCutoffMs,
  ROLLING_NEWS_WINDOW_MS,
} from './rolling-window';

const NOW = Date.parse('2026-06-05T12:00:00Z');

describe('rolling window', () => {
  it('cutoff is exactly the window before now', () => {
    expect(rollingWindowCutoffMs(NOW)).toBe(NOW - ROLLING_NEWS_WINDOW_MS);
    expect(rollingWindowCutoffIso(NOW)).toBe(new Date(NOW - ROLLING_NEWS_WINDOW_MS).toISOString());
  });

  it('accepts items inside the window and rejects older / invalid', () => {
    expect(isPublishedWithinRollingWindow(new Date(NOW - 3_600_000).toISOString(), NOW)).toBe(true);
    expect(isPublishedWithinRollingWindow(new Date(NOW - 25 * 3_600_000).toISOString(), NOW)).toBe(
      false,
    );
    expect(isPublishedWithinRollingWindow('garbage', NOW)).toBe(false);
  });

  it('HN lower bound is the window in seconds before now', () => {
    const nowSec = Math.floor(NOW / 1000);
    expect(hnCreatedAtLowerBoundSec(nowSec)).toBe(nowSec - 24 * 60 * 60);
  });
});
