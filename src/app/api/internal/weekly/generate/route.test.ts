import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { runWeeklyDigestGenerationJobs } = vi.hoisted(() => ({
  runWeeklyDigestGenerationJobs: vi.fn(async () => ({ claimed: 0, results: [] })),
}));

vi.mock('@/lib/weekly-digest/generation-worker', () => ({
  runWeeklyDigestGenerationJobs,
}));

import { maxDuration, POST } from './route';

describe('Weekly generation internal route', () => {
  afterEach(() => {
    delete process.env.SOCIAL_CRON_SECRET;
    runWeeklyDigestGenerationJobs.mockClear();
  });

  it('rejects a request without the cron bearer', async () => {
    process.env.SOCIAL_CRON_SECRET = 'generation-secret';
    const response = await POST(
      new NextRequest('https://example.com/api/internal/weekly/generate', { method: 'POST' }),
    );
    expect(response.status).toBe(401);
    expect(runWeeklyDigestGenerationJobs).not.toHaveBeenCalled();
  });

  it('allows a complete bilingual writer and critic cycle', () => {
    expect(maxDuration).toBe(300);
  });

  it('claims one heavy job for the exact bearer secret', async () => {
    process.env.SOCIAL_CRON_SECRET = 'generation-secret';
    const response = await POST(
      new NextRequest('https://example.com/api/internal/weekly/generate', {
        method: 'POST',
        headers: { authorization: 'Bearer generation-secret' },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ claimed: 0, results: [] });
    expect(runWeeklyDigestGenerationJobs).toHaveBeenCalledWith(1);
  });
});
