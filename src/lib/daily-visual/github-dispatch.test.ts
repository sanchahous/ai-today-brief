import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchDailyVisualFinalizer } from './github-dispatch';

describe('dispatchDailyVisualFinalizer', () => {
  const originalToken = process.env.GH_ACTIONS_DISPATCH_TOKEN;

  afterEach(() => {
    process.env.GH_ACTIONS_DISPATCH_TOKEN = originalToken;
  });

  it('dispatches the exact closed editorial date rather than relying on next-day cron', async () => {
    process.env.GH_ACTIONS_DISPATCH_TOKEN = 'test-token';
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });

    await dispatchDailyVisualFinalizer({ editorialDate: '2026-08-24', fetchFn });

    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.github.com/repos/sanchahous/ai-today-brief/actions/workflows/daily-visual-finalizer.yml/dispatches',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        body: JSON.stringify({ ref: 'main', inputs: { date: '2026-08-24' } }),
      }),
    );
  });

  it('does not accept an unbounded dispatch target', async () => {
    await expect(
      dispatchDailyVisualFinalizer({ editorialDate: 'not-a-date', fetchFn: vi.fn() }),
    ).rejects.toThrow('ISO editorial date');
  });
});
