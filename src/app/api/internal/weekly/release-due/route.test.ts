import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { releaseDueWeeklyDigests, runDueWeeklyDigestPreflights } = vi.hoisted(() => ({
  releaseDueWeeklyDigests: vi.fn(async () => ({ claimed: 0, results: [] })),
  runDueWeeklyDigestPreflights: vi.fn(async () => ({ checked: 0, digests: [] })),
}));

vi.mock('@/lib/weekly-digest/release-worker', () => ({
  releaseDueWeeklyDigests,
  runDueWeeklyDigestPreflights,
}));

import { POST } from './route';

describe('Weekly release internal route', () => {
  afterEach(() => {
    delete process.env.SOCIAL_CRON_SECRET;
    releaseDueWeeklyDigests.mockClear();
    runDueWeeklyDigestPreflights.mockClear();
  });

  it('rejects requests without the existing social cron bearer', async () => {
    process.env.SOCIAL_CRON_SECRET = 'weekly-secret';
    const response = await POST(
      new NextRequest('https://example.com/api/internal/weekly/release-due', {
        method: 'POST',
      }),
    );
    expect(response.status).toBe(401);
    expect(releaseDueWeeklyDigests).not.toHaveBeenCalled();
    expect(runDueWeeklyDigestPreflights).not.toHaveBeenCalled();
  });

  it('runs the worker for an exact bearer secret', async () => {
    process.env.SOCIAL_CRON_SECRET = 'weekly-secret';
    const response = await POST(
      new NextRequest('https://example.com/api/internal/weekly/release-due', {
        method: 'POST',
        headers: { authorization: 'Bearer weekly-secret' },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      preflight: { checked: 0, digests: [] },
      release: { claimed: 0, results: [] },
    });
    expect(runDueWeeklyDigestPreflights).toHaveBeenCalledWith(10);
    expect(releaseDueWeeklyDigests).toHaveBeenCalledWith(10);
  });
});
