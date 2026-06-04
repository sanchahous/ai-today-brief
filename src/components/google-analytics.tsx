import Script from 'next/script';
import { GA_MEASUREMENT_ID, analyticsConfigured } from '@/lib/analytics-config';

/**
 * GA4 bootstrap — matches Google's gtag snippet but defers network work until
 * after the page is interactive (better CWV than sync tags in <head>).
 * Consent Mode v2 defaults stay denied until the CMP updates (GDPR-safe).
 * `send_page_view: false` — App Router sends page_view on route change.
 */
export function GoogleAnalytics() {
  if (!analyticsConfigured) return null;

  const init = `
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
window.gtag=gtag;
gtag('consent','default',{
  analytics_storage:'denied',
  ad_storage:'denied',
  ad_user_data:'denied',
  ad_personalization:'denied',
  wait_for_update:500
});
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
