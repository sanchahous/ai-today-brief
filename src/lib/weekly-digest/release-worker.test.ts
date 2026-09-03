import { describe, expect, it, vi } from 'vitest';
import type { ClaimedWeeklyDigest, WeeklyReleaseDependencies } from './release-worker';
import { preflightBlockersFromRpc, releaseDueWeeklyDigests } from './release-worker';
import { TOP_CATEGORY_SLUGS } from '@/lib/category-meta';
import { revalidatePathsForPublish } from '@/lib/revalidate-site';

function dependencies(
  claimed: ClaimedWeeklyDigest[],
  preflight: unknown = { ready: true, blockers: [] },
) {
  const calls: Array<unknown[]> = [];
  const value: WeeklyReleaseDependencies = {
    claimDue: vi.fn(async (limit) => {
      calls.push(['claim', limit]);
      return claimed;
    }),
    preflight: vi.fn(async (id) => {
      calls.push(['preflight', id]);
      return preflight;
    }),
    promote: vi.fn(async (id) => {
      calls.push(['promote', id]);
    }),
    finish: vi.fn(async (id, succeeded, error) => {
      calls.push(['finish', id, succeeded, error]);
      return succeeded ? (claimed.find((row) => row.id === id)?.slug ?? null) : null;
    }),
    revalidate: vi.fn((path) => {
      calls.push(['revalidate', path]);
    }),
    alert: vi.fn(async (input) => {
      calls.push(['alert', input]);
    }),
  };
  return { calls, value };
}

const dueDigest: ClaimedWeeklyDigest = {
  id: 'digest-1',
  slug: 'ai-weekly-2026-07-05',
  release_at: '2026-07-13T13:00:00.000Z',
};

describe('Weekly Digest release worker', () => {
  it('finishes a due, ready digest once and revalidates every public surface', async () => {
    const deps = dependencies([dueDigest]);
    const result = await releaseDueWeeklyDigests(10, {
      now: new Date('2026-07-13T13:00:00.000Z'),
      dependencies: deps.value,
    });

    expect(result).toMatchObject({
      claimed: 1,
      results: [{ id: dueDigest.id, outcome: 'published' }],
    });
    expect(deps.calls.filter(([kind]) => kind === 'finish')).toEqual([
      ['finish', dueDigest.id, true, null],
    ]);
    expect(deps.calls.filter(([kind]) => kind === 'revalidate')).toEqual(
      [
        '/',
        '/en',
        '/en/news',
        '/en/digests',
        '/en/concepts',
        ...TOP_CATEGORY_SLUGS.map((slug) => `/en/category/${slug}`),
        '/sitemap.xml',
        '/news-sitemap.xml',
        '/rss.xml',
        '/uk',
        '/uk/news',
        '/uk/digests',
        '/uk/concepts',
        ...TOP_CATEGORY_SLUGS.map((slug) => `/uk/category/${slug}`),
        '/rss-uk.xml',
        '/en/weekly/ai-weekly-2026-07-05',
        '/uk/weekly/ai-weekly-2026-07-05',
        '/admin/weekly/digest-1',
      ].map((path) => ['revalidate', path]),
    );
  });

  it('revalidates the topic slug when finish rewrites the placeholder', async () => {
    const deps = dependencies([dueDigest]);
    vi.mocked(deps.value.finish).mockResolvedValue('topic-slug-2026-07-05');
    const result = await releaseDueWeeklyDigests(10, {
      now: new Date('2026-07-13T13:00:00.000Z'),
      dependencies: deps.value,
    });

    expect(result.results[0]?.outcome).toBe('published');
    const weeklyPaths = deps.calls
      .filter(
        (call) =>
          call[0] === 'revalidate' &&
          String(call[1]).includes('/weekly/') &&
          !String(call[1]).startsWith('/admin/'),
      )
      .map((call) => call[1]);
    expect(weeklyPaths).toEqual([
      '/en/weekly/ai-weekly-2026-07-05',
      '/uk/weekly/ai-weekly-2026-07-05',
      '/en/weekly/topic-slug-2026-07-05',
      '/uk/weekly/topic-slug-2026-07-05',
    ]);
  });

  it('rewrites social URLs after finish returns the published slug', async () => {
    const deps = dependencies([dueDigest]);
    deps.value.syncSocialUrls = vi.fn(async () => undefined);
    vi.mocked(deps.value.finish).mockResolvedValue('topic-slug-2026-07-05');
    await releaseDueWeeklyDigests(10, {
      now: new Date('2026-07-13T13:00:00.000Z'),
      dependencies: deps.value,
    });
    expect(deps.value.syncSocialUrls).toHaveBeenCalledWith(
      dueDigest.id,
      dueDigest.slug,
      'topic-slug-2026-07-05',
    );
  });

  it('refuses an unexpectedly early claim before running preflight', async () => {
    const deps = dependencies([dueDigest]);
    const result = await releaseDueWeeklyDigests(10, {
      now: new Date('2026-07-13T12:59:59.999Z'),
      dependencies: deps.value,
    });

    expect(result.results[0].outcome).toBe('not_due');
    expect(deps.value.preflight).not.toHaveBeenCalled();
    expect(deps.value.finish).toHaveBeenCalledWith(
      dueDigest.id,
      false,
      expect.stringContaining('publication refused'),
    );
    expect(deps.value.revalidate).not.toHaveBeenCalled();
  });

  it('records preflight blockers without publishing or revalidating', async () => {
    const deps = dependencies([dueDigest], {
      ready: false,
      blockers: [{ code: 'artifact_missing', slot: 'pdf:uk' }],
    });
    const result = await releaseDueWeeklyDigests(10, {
      now: new Date('2026-07-13T13:01:00.000Z'),
      dependencies: deps.value,
    });

    expect(result.results).toEqual([{ id: dueDigest.id, outcome: 'blocked', blockerCount: 1 }]);
    expect(deps.value.finish).toHaveBeenCalledWith(
      dueDigest.id,
      false,
      expect.stringContaining('artifact_missing'),
    );
    expect(deps.value.revalidate).not.toHaveBeenCalled();
    expect(deps.value.promote).not.toHaveBeenCalled();
  });

  it('fails the release when approved private images cannot be promoted', async () => {
    const deps = dependencies([dueDigest]);
    vi.mocked(deps.value.promote).mockRejectedValue(new Error('cover download failed'));
    const result = await releaseDueWeeklyDigests(10, {
      now: new Date('2026-07-13T13:01:00.000Z'),
      dependencies: deps.value,
    });

    expect(result.results[0]).toMatchObject({
      id: dueDigest.id,
      outcome: 'failed',
      error: 'cover download failed',
    });
    expect(deps.value.finish).toHaveBeenCalledWith(dueDigest.id, false, 'cover download failed');
    expect(deps.value.revalidate).not.toHaveBeenCalled();
  });

  it('fails closed for malformed preflight responses', () => {
    expect(preflightBlockersFromRpc(null)).toHaveLength(1);
    expect(preflightBlockersFromRpc({})).toHaveLength(1);
    expect(preflightBlockersFromRpc({ ready: true })).toEqual([]);
    expect(preflightBlockersFromRpc([])).toEqual([]);
    expect(preflightBlockersFromRpc({ ready: false, blockers: [] })).toEqual([
      expect.objectContaining({ code: 'preflight_not_ready' }),
    ]);
  });

  it('keeps the published result when only cache invalidation fails', async () => {
    const deps = dependencies([dueDigest]);
    vi.mocked(deps.value.revalidate).mockImplementation((path) => {
      if (path === '/en') throw new Error('cache unavailable');
    });
    const result = await releaseDueWeeklyDigests(10, {
      now: new Date('2026-07-13T13:01:00.000Z'),
      dependencies: deps.value,
    });

    expect(result.results[0]).toMatchObject({
      outcome: 'published',
      revalidationError: '/en: cache unavailable',
    });
    expect(deps.value.finish).toHaveBeenCalledTimes(1);
    expect(deps.value.finish).toHaveBeenCalledWith(dueDigest.id, true, null);
    expect(deps.value.revalidate).toHaveBeenCalledTimes(
      revalidatePathsForPublish([
        '/en/weekly/ai-weekly-2026-07-05',
        '/uk/weekly/ai-weekly-2026-07-05',
      ]).length + 1,
    );
  });

  it('normalizes an invalid claim limit without bypassing the database cap', async () => {
    const deps = dependencies([]);
    await releaseDueWeeklyDigests(Number.NaN, { dependencies: deps.value });
    expect(deps.value.claimDue).toHaveBeenCalledWith(10);

    await releaseDueWeeklyDigests(100, { dependencies: deps.value });
    expect(deps.value.claimDue).toHaveBeenLastCalledWith(25);
  });
});
