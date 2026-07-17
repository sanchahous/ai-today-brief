import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { isInternalSocialRequest } from './internal-auth';

describe('social internal bearer auth', () => {
  afterEach(() => delete process.env.SOCIAL_CRON_SECRET);

  it('accepts only an exact bearer secret', () => {
    process.env.SOCIAL_CRON_SECRET = 'a-long-random-secret';
    expect(
      isInternalSocialRequest(
        new NextRequest('https://example.com/api/internal/social/publish-due', {
          headers: { authorization: 'Bearer a-long-random-secret' },
        }),
      ),
    ).toBe(true);
    expect(
      isInternalSocialRequest(
        new NextRequest('https://example.com/api/internal/social/publish-due', {
          headers: { authorization: 'Bearer a-long-random-secreu' },
        }),
      ),
    ).toBe(false);
  });

  it('fails closed when the secret is missing', () => {
    expect(isInternalSocialRequest(new NextRequest('https://example.com'))).toBe(false);
  });
});
