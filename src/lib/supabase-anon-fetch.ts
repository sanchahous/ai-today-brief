import {
  PUBLIC_CONTENT_REVALIDATE_SECONDS,
  PUBLIC_CONTENT_TAG,
} from '@/lib/public-content-tag';

type NextCachedInit = RequestInit & {
  next?: { revalidate: number; tags: string[] };
};

export function restUrlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return String(input);
}

export function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

/** Only public PostgREST GETs — never auth, storage, or mutations. */
export function shouldCacheAnonRestGet(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (requestMethod(input, init) !== 'GET') return false;
  return restUrlOf(input).includes('/rest/v1/');
}

/**
 * Drop `cache: 'no-store'` (supabase-js / undici defaults) so Next can Data-Cache
 * the GET. `next.revalidate` + tag is the contract publish uses to bust.
 */
export function withPublicContentCache(init?: RequestInit): NextCachedInit {
  const nextInit: NextCachedInit = {
    ...init,
    next: {
      revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
      tags: [PUBLIC_CONTENT_TAG],
    },
  };
  delete nextInit.cache;
  return nextInit;
}

export async function fetchAnonRestCached(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (!shouldCacheAnonRestGet(input, init)) {
    return fetch(input, init);
  }
  const url = restUrlOf(input);
  // Next.js extends fetch(); DOM RequestInit does not list `next`.
  return fetch(url, withPublicContentCache(init) as RequestInit);
}
