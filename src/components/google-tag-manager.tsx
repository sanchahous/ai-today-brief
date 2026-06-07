import Script from 'next/script';
import { GTM_ID, gtmConfigured } from '@/lib/analytics-config';

/**
 * Google Tag Manager — loader deferred until after interactive (CWV).
 * Consent Mode defaults live in <head> via consent-mode-snippet (no extra network).
 * Noscript iframe sits at the top of <body> per Google's install guide.
 */
export function GoogleTagManager() {
  if (!gtmConfigured) return null;

  const loader = `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');
`;

  return (
    <>
      <noscript>
        <iframe
          title="Google Tag Manager"
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
        />
      </noscript>
      <Script id="gtm-loader" strategy="afterInteractive">
        {loader}
      </Script>
    </>
  );
}
