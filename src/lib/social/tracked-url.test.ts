import { describe, expect, it } from 'vitest';
import {
  isSocialTrackingToken,
  socialClickTokenFromSearch,
  trackingTokenFromUrl,
  weeklyTrackedUrl,
  withSocialClickToken,
  withWeeklySlug,
} from './tracked-url';

const TOKEN = '8837f54c-7129-4df1-8503-689c739779b8';

describe('tracked-url', () => {
  it('appends s= on a destination that already has UTM params', () => {
    const dest =
      'https://aitodaybrief.com/uk/weekly/example?utm_source=telegram&utm_medium=social';
    expect(withSocialClickToken(dest, TOKEN)).toBe(`${dest}&s=${TOKEN}`);
  });

  it('rewrites a leftover weekly slug and keeps query params', () => {
    const stale =
      'https://aitodaybrief.com/uk/weekly/ai-weekly-2026-08-23?utm_source=telegram';
    expect(withWeeklySlug(stale, 'topic-slug-2026-08-23')).toBe(
      'https://aitodaybrief.com/uk/weekly/topic-slug-2026-08-23?utm_source=telegram',
    );
  });

  it('reads the click token from query or a legacy /r/s/ path', () => {
    expect(socialClickTokenFromSearch(`?utm_source=x&s=${TOKEN}`)).toBe(TOKEN);
    expect(isSocialTrackingToken('token-x')).toBe(false);
    expect(trackingTokenFromUrl(`https://aitodaybrief.com/en/weekly/x?s=${TOKEN}`)).toBe(TOKEN);
    expect(trackingTokenFromUrl(`https://aitodaybrief.com/r/s/${TOKEN}`)).toBe(TOKEN);
  });

  it('builds the weekly tracked URL operators copy from admin', () => {
    expect(
      weeklyTrackedUrl('uk', 'topic-slug-2026-08-23', TOKEN, { source: 'telegram' }),
    ).toBe(
      `https://aitodaybrief.com/uk/weekly/topic-slug-2026-08-23?utm_source=telegram&utm_medium=social&utm_campaign=weekly_digest&s=${TOKEN}`,
    );
  });
});
