/** Next Data Cache tag for anon PostgREST reads of published site content. */
export const PUBLIC_CONTENT_TAG = 'public-content';

/**
 * Data Cache window for anon PostgREST reads. Next takes the *lowest* `revalidate`
 * across a route's page, layouts and data reads, so this is a floor under every
 * page's own `export const revalidate`: at 3600 the item page's declared 24 h was
 * silently an hour (Vercel log: `Cache TTL 1h`), and every crawler hit on a stale
 * article re-rendered it and re-queried Supabase. Content changes do not wait for
 * the timer — publish, editor-take, weekly release and `/api/revalidate` all call
 * `revalidatePublicContentTag()`. Hubs that declare 1 h (home, news, digests) still
 * regenerate hourly, now from the Data Cache instead of Supabase.
 */
export const PUBLIC_CONTENT_REVALIDATE_SECONDS = 86400;

/** How many item paths CI/e2e prerenders when `E2E_MINIMAL_PRERENDER=1`. */
export const E2E_MINIMAL_PRERENDER_LIMIT = 8;
