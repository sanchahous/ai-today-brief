import { afterEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => ({ rpc }) }));

import {
  dispatchQueuedWeeklyGenerationJobs,
  dispatchWeeklyMasterCliWorker,
  isRetryableGithubDispatchError,
} from './github-dispatch';

describe('dispatchWeeklyMasterCliWorker', () => {
  const originalToken = process.env.GH_ACTIONS_DISPATCH_TOKEN;

  afterEach(() => {
    process.env.GH_ACTIONS_DISPATCH_TOKEN = originalToken;
    rpc.mockReset();
    vi.unstubAllGlobals();
  });

  it('throws when the dispatch token is not configured', async () => {
    delete process.env.GH_ACTIONS_DISPATCH_TOKEN;
    await expect(
      dispatchWeeklyMasterCliWorker({
        jobId: 'job-1',
        dispatchToken: 'dispatch-1',
        weeklyDigestId: 'digest-1',
        fetchFn: vi.fn(),
      }),
    ).rejects.toThrow('GH_ACTIONS_DISPATCH_TOKEN is not set');
  });

  it('posts to the workflow dispatch endpoint with the bearer token and ref', async () => {
    process.env.GH_ACTIONS_DISPATCH_TOKEN = 'test-token';
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    await dispatchWeeklyMasterCliWorker({
      jobId: 'job-1',
      dispatchToken: 'dispatch-1',
      weeklyDigestId: 'digest-1',
      fetchFn,
    });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.github.com/repos/sanchahous/ai-today-brief/actions/workflows/weekly-master-cli-worker.yml/dispatches',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            job_id: 'job-1',
            dispatch_token: 'dispatch-1',
            weekly_digest_id: 'digest-1',
            job_type: 'editorial_master',
          },
        }),
      }),
    );
  });

  it('identifies story image dispatches so the workflow can run them independently', async () => {
    process.env.GH_ACTIONS_DISPATCH_TOKEN = 'test-token';
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    await dispatchWeeklyMasterCliWorker({
      jobId: 'image-job-1',
      dispatchToken: 'dispatch-1',
      weeklyDigestId: 'digest-1',
      jobType: 'story_image',
      fetchFn,
    });
    expect(fetchFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"job_type":"story_image"'),
      }),
    );
  });

  it('dispatches a bounded batch of independent queued jobs', async () => {
    process.env.GH_ACTIONS_DISPATCH_TOKEN = 'test-token';
    rpc
      .mockResolvedValueOnce({
        data: {
          job_id: 'image-job-1',
          weekly_digest_id: 'digest-1',
          job_type: 'story_image',
          dispatch_token: 'dispatch-1',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          job_id: 'image-job-2',
          weekly_digest_id: 'digest-1',
          job_type: 'story_image',
          dispatch_token: 'dispatch-2',
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchFn);

    await expect(dispatchQueuedWeeklyGenerationJobs(3)).resolves.toEqual({
      dispatched: 2,
      error: null,
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it('throws with the response body when GitHub rejects the dispatch', async () => {
    process.env.GH_ACTIONS_DISPATCH_TOKEN = 'test-token';
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    });
    await expect(
      dispatchWeeklyMasterCliWorker({
        jobId: 'job-1',
        dispatchToken: 'dispatch-1',
        weeklyDigestId: 'digest-1',
        fetchFn,
      }),
    ).rejects.toThrow('HTTP 404');
  });

  it('retries a transient GitHub response before succeeding', async () => {
    process.env.GH_ACTIONS_DISPATCH_TOKEN = 'test-token';
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'temporarily unavailable' })
      .mockResolvedValueOnce({ ok: true, text: async () => '' });
    const waitFn = vi.fn().mockResolvedValue(undefined);

    await dispatchWeeklyMasterCliWorker({
      jobId: 'job-1',
      dispatchToken: 'dispatch-1',
      weeklyDigestId: 'digest-1',
      fetchFn,
      waitFn,
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(waitFn).toHaveBeenCalledWith(300);
  });

  it('classifies exhausted transient errors so callers can leave the lease fenced', async () => {
    process.env.GH_ACTIONS_DISPATCH_TOKEN = 'test-token';
    const fetchFn = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 503, text: async () => 'temporarily unavailable' });

    await expect(
      dispatchWeeklyMasterCliWorker({
        jobId: 'job-1',
        dispatchToken: 'dispatch-1',
        weeklyDigestId: 'digest-1',
        fetchFn,
        waitFn: vi.fn().mockResolvedValue(undefined),
      }),
    ).rejects.toSatisfy(isRetryableGithubDispatchError);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
