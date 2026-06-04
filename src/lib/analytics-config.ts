/** GA4 measurement ID — set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in Vercel when the property exists. */
export const GA_MEASUREMENT_ID = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '').trim();

export const analyticsConfigured = GA_MEASUREMENT_ID.length > 0;
