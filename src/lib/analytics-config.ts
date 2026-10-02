/** GA4 measurement ID — set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in Vercel when the property exists. */
export const GA_MEASUREMENT_ID = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '').trim();

export const analyticsConfigured = GA_MEASUREMENT_ID.length > 0;

/**
 * Inline GA4 bootstrap (runs after hydration, before gtag.js loads). Automated
 * browsers (Playwright, Puppeteer, Selenium, `--enable-automation`) expose
 * `navigator.webdriver`; GA4's `ga-disable-<ID>` flag stops every hit to that ID,
 * including gtag.js's own automatic events (scroll, outbound click) that
 * `trackEvent` never sees. Our own headless live checks against production
 * showed up as ~590 "users" from one city between 2026-09-29 and 2026-10-01.
 * It does not stop bots that hide the flag — those are handled at the edge.
 */
export function gtagInitScript(measurementId: string): string {
  return `
if(navigator.webdriver)window['ga-disable-${measurementId}']=true;
gtag('js',new Date());
gtag('config','${measurementId}',{send_page_view:false});
`.trim();
}

/**
 * Reader Revenue Manager product ID — Publisher Center → Reader Revenue Manager,
 * format `CAow…:openaccess`. Set `NEXT_PUBLIC_SWG_PRODUCT_ID` in Vercel.
 */
export const SWG_PRODUCT_ID = (process.env.NEXT_PUBLIC_SWG_PRODUCT_ID ?? '').trim();

export const swgConfigured = SWG_PRODUCT_ID.length > 0;
