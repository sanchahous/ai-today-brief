/** GA4 measurement ID — set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in Vercel when the property exists. */
export const GA_MEASUREMENT_ID = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '').trim();

export const analyticsConfigured = GA_MEASUREMENT_ID.length > 0;

/**
 * Reader Revenue Manager product ID — Publisher Center → Reader Revenue Manager,
 * format `CAow…:openaccess`. Set `NEXT_PUBLIC_SWG_PRODUCT_ID` in Vercel.
 */
export const SWG_PRODUCT_ID = (process.env.NEXT_PUBLIC_SWG_PRODUCT_ID ?? '').trim();

export const swgConfigured = SWG_PRODUCT_ID.length > 0;
