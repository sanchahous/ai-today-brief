import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { runWeeklyDigestGenerationJobs } = vi.hoisted(() => ({
  runWeeklyDigestGenerationJobs: vi.fn(async () => ({ claimed: 0, results: [] })),
}));
const { dispatchQueuedWeeklyGenerationJobs } = vi.hoisted(() => ({
  dispatchQueuedWeeklyGenerationJobs: vi.fn(async () => ({ dispatched: 0, error: null })),
}));

vi.mock('@/lib/weekly-digest/generation-worker', () => ({
  runWeeklyDigestGenerationJobs,
}));
vi.mock('@/lib/weekly-digest/github-dispatch', () => ({ dispatchQueuedWeeklyGenerationJobs }));
vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({
    rpc: async () => ({ data: { timed_out: 0 }, error: null }),
  }),
}));

import { maxDuration, POST } from './route';

describe('Weekly generation internal route', () => {
  afterEach(() => {
    delete process.env.SOCIAL_CRON_SECRET;
    runWeeklyDigestGenerationJobs.mockClear();
    dispatchQueuedWeeklyGenerationJobs.mockClear();
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

  it('claims one short Vercel job and dispatches long jobs for the exact bearer secret', async () => {
    process.env.SOCIAL_CRON_SECRET = 'generation-secret';
    const response = await POST(
      new NextRequest('https://example.com/api/internal/weekly/generate', {
        method: 'POST',
        headers: { authorization: 'Bearer generation-secret' },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      claimed: 0,
      results: [],
      githubDispatched: false,
    });
    expect(runWeeklyDigestGenerationJobs).toHaveBeenCalledWith(
      1,
      ['research_pack', 'cover', 'pdf', 'social_asset', 'video_manifest'],
      { backend: 'vercel' },
    );
    expect(dispatchQueuedWeeklyGenerationJobs).toHaveBeenCalledWith(10);
  });
});
