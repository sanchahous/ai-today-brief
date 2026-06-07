import Script from 'next/script';
import { GA_MEASUREMENT_ID, analyticsConfigured } from '@/lib/analytics-config';

/**
 * GA4 bootstrap — defers network work until after interactive (CWV).
 * Consent Mode v2: storage denied by default; events still send as cookieless
 * pings until the CMP grants analytics_storage (advanced / modeling mode).
 * `send_page_view: false` — App Router sends page_view on route change.
 */
export function GoogleAnalytics() {
  if (!analyticsConfigured) return null;

  const init = `
gtag('js',new Date());
gtag('config','${GA_MEASUREMENT_ID}',{send_page_view:false});
`;

  return (
    <>
      <Script id="gtag-init" strategy="afterInteractive">
        {init}
      </Script>
      <Script
        id="gtag-js"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
    </>
  );
}
