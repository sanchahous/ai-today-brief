/** Next Data Cache tag for anon PostgREST reads of published site content. */
export const PUBLIC_CONTENT_TAG = 'public-content';

/** ISR-aligned: listings refresh at least hourly; publish flows bust the tag immediately. */
export const PUBLIC_CONTENT_REVALIDATE_SECONDS = 3600;

/** How many item paths CI/e2e prerenders when `E2E_MINIMAL_PRERENDER=1`. */
export const E2E_MINIMAL_PRERENDER_LIMIT = 8;
