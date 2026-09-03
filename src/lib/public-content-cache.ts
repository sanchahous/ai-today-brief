import 'server-only';

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { withBuildMemo } from '@/lib/public-content-build-memo';
import {
  E2E_MINIMAL_PRERENDER_LIMIT,
  PUBLIC_CONTENT_REVALIDATE_SECONDS,
  PUBLIC_CONTENT_TAG,
} from '@/lib/public-content-tag';

export {
  E2E_MINIMAL_PRERENDER_LIMIT,
  PUBLIC_CONTENT_REVALIDATE_SECONDS,
  PUBLIC_CONTENT_TAG,
} from '@/lib/public-content-tag';

function skipPersistentCache(): boolean {
  return Boolean(process.env.VITEST);
}

/**
 * Dedupes identical public reads inside one render (`cache`), across SSG
 * workers (`withBuildMemo` disk file), and across the ISR window
 * (`unstable_cache`). Vitest keeps the raw function so mocked clients
 * are not memoized across tests.
 */
export function cachePublicRead<Args extends unknown[], Result>(
  key: string,
  fn: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  if (skipPersistentCache()) return fn;
  const persistent = unstable_cache(fn, [key], {
    revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
    tags: [PUBLIC_CONTENT_TAG],
  });
  async function load(...args: Args): Promise<Result> {
    return withBuildMemo(key, args, () => persistent(...args));
  }
  return cache(load);
}

export function isMinimalPrerender(): boolean {
  if (process.env.E2E_MINIMAL_PRERENDER === '1') return true;
  // Preview deploys used to full-SSG prod PostgREST on every PR push. Production
  // (`VERCEL_ENV=production`) still prerenders every indexed item. Do not
  // Promote a preview build to production — merge to main starts a fresh build.
  return process.env.VERCEL_ENV === 'preview';
}

/** CI / Vercel preview / local pr:check — production Vercel must prerender every indexed item. */
export function limitPrerenderPaths<T>(paths: T[]): T[] {
  if (!isMinimalPrerender()) return paths;
  return paths.slice(0, E2E_MINIMAL_PRERENDER_LIMIT);
}
