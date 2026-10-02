import Script from 'next/script';
import { GA_MEASUREMENT_ID, analyticsConfigured, gtagInitScript } from '@/lib/analytics-config';

/**
 * GA4 bootstrap — defers network work until after interactive (CWV).
 * Consent Mode: analytics denied by default; CMP opt-in sets granted.
 * `send_page_view: false` — App Router sends page_view on route change.
 * Automated browsers are muted in the init script (see `gtagInitScript`).
 */
export function GoogleAnalytics() {
  if (!analyticsConfigured) return null;

  return (
    <>
      <Script id="gtag-init" strategy="afterInteractive">
        {gtagInitScript(GA_MEASUREMENT_ID)}
      </Script>
      <Script
        id="gtag-js"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
    </>
  );
}
