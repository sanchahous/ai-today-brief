import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  E2E_MINIMAL_PRERENDER_LIMIT,
  PUBLIC_CONTENT_REVALIDATE_SECONDS,
  PUBLIC_CONTENT_TAG,
} from '@/lib/public-content-tag';
import {
  fetchAnonRestCached,
  requestMethod,
  restUrlOf,
  shouldCacheAnonRestGet,
  withPublicContentCache,
} from '@/lib/supabase-anon-fetch';
import {
  cachePublicRead,
  isMinimalPrerender,
  limitPrerenderPaths,
} from '@/lib/public-content-cache';
import { excludeRelatedById, pickAdjacentStories } from '@/lib/items-nav';

describe('anon REST fetch cache policy', () => {
  it('caches only PostgREST GET URLs', () => {
    expect(
      shouldCacheAnonRestGet('https://ex.supabase.co/rest/v1/brief_items?select=id'),
    ).toBe(true);
    expect(
      shouldCacheAnonRestGet('https://ex.supabase.co/rest/v1/brief_items', { method: 'POST' }),
    ).toBe(false);
    expect(
      shouldCacheAnonRestGet('https://ex.supabase.co/storage/v1/object/public/card-images/x.jpg'),
    ).toBe(false);
    expect(shouldCacheAnonRestGet('https://ex.supabase.co/auth/v1/user')).toBe(false);
  });

  it('reads method and URL from Request objects', () => {
    const req = new Request('https://ex.supabase.co/rest/v1/briefs', { method: 'GET' });
    expect(restUrlOf(req)).toContain('/rest/v1/briefs');
    expect(requestMethod(req)).toBe('GET');
    expect(shouldCacheAnonRestGet(req)).toBe(true);
  });

  it('strips cache: no-store and tags the Next Data Cache', () => {
    const init = withPublicContentCache({
      cache: 'no-store',
      headers: { apikey: 'anon' },
    });
    expect(init.cache).toBeUndefined();
    expect(init.next).toEqual({
      revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
      tags: [PUBLIC_CONTENT_TAG],
    });
    expect(init.headers).toEqual({ apikey: 'anon' });
  });
});

describe('fetchAnonRestCached', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards mutations unchanged', async () => {
    const fetchMock = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    await fetchAnonRestCached('https://ex.supabase.co/rest/v1/briefs', { method: 'PATCH' });
    expect(fetchMock).toHaveBeenCalledWith('https://ex.supabase.co/rest/v1/briefs', {
      method: 'PATCH',
    });
  });

  it('rewrites cacheable GETs onto the public-content tag', async () => {
    const fetchMock = vi.fn(async () => new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    await fetchAnonRestCached('https://ex.supabase.co/rest/v1/brief_items?select=id', {
      cache: 'no-store',
      headers: { Authorization: 'Bearer x' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const args = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit & { next?: unknown; cache?: RequestCache },
    ];
    const init = args[1];
    expect(init.cache).toBeUndefined();
    expect(init.next).toEqual({
      revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
      tags: [PUBLIC_CONTENT_TAG],
    });
  });
});

describe('cachePublicRead under Vitest', () => {
  it('does not wrap the loader, so mocks stay per-test', async () => {
    const fn = vi.fn(async (n: number) => n * 2);
    const wrapped = cachePublicRead('double', fn);
    expect(wrapped).toBe(fn);
    expect(await wrapped(3)).toBe(6);
  });
});

describe('limitPrerenderPaths', () => {
  afterEach(() => {
    delete process.env.E2E_MINIMAL_PRERENDER;
  });

  it('passes through in production builds', () => {
    delete process.env.E2E_MINIMAL_PRERENDER;
    expect(isMinimalPrerender()).toBe(false);
    const paths = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(limitPrerenderPaths(paths)).toEqual(paths);
  });

  it('caps generateStaticParams during e2e builds', () => {
    process.env.E2E_MINIMAL_PRERENDER = '1';
    expect(isMinimalPrerender()).toBe(true);
    const paths = Array.from({ length: 40 }, (_, i) => i);
    expect(limitPrerenderPaths(paths)).toEqual(
      paths.slice(0, E2E_MINIMAL_PRERENDER_LIMIT),
    );
  });
});

describe('items-nav', () => {
  const rows = [
    {
      slug: 'older',
      rank: 1,
      title_en: 'Older EN',
      title_uk: 'Older UK',
      category_slug: 'models',
    },
    {
      slug: 'current',
      rank: 2,
      title_en: 'Current',
      title_uk: 'Поточна',
      category_slug: 'models',
    },
    {
      slug: 'newer',
      rank: 3,
      title_en: 'Newer EN',
      title_uk: 'Newer UK',
      category_slug: 'models',
    },
  ];

  it('picks prev/next by rank and skips the current item', () => {
    expect(pickAdjacentStories(rows, 2, 'en')).toEqual({
      prev: { href: '/en/news/models/older', title: 'Older EN' },
      next: { href: '/en/news/models/newer', title: 'Newer EN' },
    });
  });

  it('uses the UK title for uk', () => {
    expect(pickAdjacentStories(rows, 2, 'uk').prev?.title).toBe('Older UK');
  });

  it('returns empty neighbours when the brief has a single story', () => {
    expect(pickAdjacentStories([rows[1]], 2, 'en')).toEqual({ prev: null, next: null });
  });

  it('drops the current id from related rows before the limit slice', () => {
    const related = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
      { id: 'c', title: 'C' },
    ];
    expect(excludeRelatedById(related, 'b').map((r) => r.id)).toEqual(['a', 'c']);
  });
});
