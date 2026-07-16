import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchReddit, isRedditApproved } from './reddit';

const originalEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

describe('Reddit approval gate', () => {
  it('requires an explicit written-approval flag, not OAuth credentials alone', async () => {
    process.env.REDDIT_CLIENT_ID = 'id';
    process.env.REDDIT_CLIENT_SECRET = 'secret';
    process.env.REDDIT_USERNAME = 'maintainer';
    delete process.env.REDDIT_DATA_API_APPROVED;

    const retry = vi.fn();
    await expect(fetchReddit(retry as never)).resolves.toEqual([]);
    expect(retry).not.toHaveBeenCalled();
    expect(isRedditApproved()).toBe(false);
  });

  it('requires the exact approval value and a maintainer username', async () => {
    process.env.REDDIT_DATA_API_APPROVED = 'yes';
    process.env.REDDIT_CLIENT_ID = 'id';
    process.env.REDDIT_CLIENT_SECRET = 'secret';
    delete process.env.REDDIT_USERNAME;

    const retry = vi.fn();
    await expect(fetchReddit(retry as never)).resolves.toEqual([]);
    expect(retry).not.toHaveBeenCalled();
    expect(isRedditApproved()).toBe(false);

    process.env.REDDIT_DATA_API_APPROVED = '1';
    expect(isRedditApproved()).toBe(true);
  });
});
