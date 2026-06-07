/** GA4 measurement ID — set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in Vercel when the property exists. */
export const GA_MEASUREMENT_ID = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '').trim();

export const analyticsConfigured = GA_MEASUREMENT_ID.length > 0;

/** Google Tag Manager container ID — set `NEXT_PUBLIC_GTM_ID` in Vercel (e.g. GTM-5S6TXPG5). */
export const GTM_ID = (process.env.NEXT_PUBLIC_GTM_ID ?? '').trim();

export const gtmConfigured = GTM_ID.length > 0;

export const tagsConfigured = analyticsConfigured || gtmConfigured;
