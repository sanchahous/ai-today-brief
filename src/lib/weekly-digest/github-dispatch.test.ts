import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchWeeklyMasterCliWorker } from './github-dispatch';

describe('dispatchWeeklyMasterCliWorker', () => {
  const originalToken = process.env.GH_ACTIONS_DISPATCH_TOKEN;

  afterEach(() => {
    process.env.GH_ACTIONS_DISPATCH_TOKEN = originalToken;
  });

  it('throws when the dispatch token is not configured', async () => {
    delete process.env.GH_ACTIONS_DISPATCH_TOKEN;
    await expect(dispatchWeeklyMasterCliWorker({ fetchFn: vi.fn() })).rejects.toThrow(
      'GH_ACTIONS_DISPATCH_TOKEN is not set',
    );
  });

  it('posts to the workflow dispatch endpoint with the bearer token and ref', async () => {
    process.env.GH_ACTIONS_DISPATCH_TOKEN = 'test-token';
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    await dispatchWeeklyMasterCliWorker({ fetchFn });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.github.com/repos/sanchahous/ai-today-brief/actions/workflows/weekly-master-cli-worker.yml/dispatches',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        body: JSON.stringify({ ref: 'main' }),
      }),
    );
  });

  it('throws with the response body when GitHub rejects the dispatch', async () => {
    process.env.GH_ACTIONS_DISPATCH_TOKEN = 'test-token';
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    });
    await expect(dispatchWeeklyMasterCliWorker({ fetchFn })).rejects.toThrow('HTTP 404');
  });
});
