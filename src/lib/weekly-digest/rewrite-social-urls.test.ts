import { afterEach, describe, expect, it, vi } from 'vitest';
import { rewriteSocialCopyUrls } from './rewrite-social-copy';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => ({ rpc }) }));

import { syncWeeklySocialUrlsAfterPublish } from './rewrite-social-urls';

const TOKEN = '8837f54c-7129-4df1-8503-689c739779b8';
const TRACKED =
  'https://aitodaybrief.com/uk/weekly/topic-slug-2026-08-23?utm_source=telegram&utm_medium=social&utm_campaign=weekly_digest&s=8837f54c-7129-4df1-8503-689c739779b8';

describe('rewriteSocialCopyUrls', () => {
  it('replaces the hop URL and the leftover placeholder weekly URL with one tracked link', () => {
    const text = [
      'CTA',
      `https://aitodaybrief.com/r/s/${TOKEN}`,
      'https://aitodaybrief.com/uk/weekly/ai-weekly-2026-08-23',
    ].join('\n');
    expect(
      rewriteSocialCopyUrls(text, {
        token: TOKEN,
        trackedUrl: TRACKED,
        oldSlug: 'ai-weekly-2026-08-23',
        newSlug: 'topic-slug-2026-08-23',
      }),
    ).toBe(`CTA\n${TRACKED}`);
  });
});

describe('syncWeeklySocialUrlsAfterPublish', () => {
  afterEach(() => {
    rpc.mockReset();
  });

  it('rewrites through the service-role RPC so approval guards do not fire', async () => {
    rpc.mockResolvedValue({ data: 6, error: null });
    await syncWeeklySocialUrlsAfterPublish(
      '6c50127e-c98f-4c34-8a16-ed4d1a742c63',
      'ai-weekly-2026-08-23',
      'topic-slug-2026-08-23',
    );
    expect(rpc).toHaveBeenCalledWith('rewrite_weekly_digest_social_urls', {
      p_weekly_digest_id: '6c50127e-c98f-4c34-8a16-ed4d1a742c63',
      p_old_slug: 'ai-weekly-2026-08-23',
      p_new_slug: 'topic-slug-2026-08-23',
    });
  });

  it('surfaces the RPC error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'service_role required' } });
    await expect(
      syncWeeklySocialUrlsAfterPublish('digest-1', 'old', 'new'),
    ).rejects.toThrow('[weekly-release] social urls: service_role required');
  });
});
