import Script from 'next/script';
import { SWG_PRODUCT_ID, swgConfigured } from '@/lib/analytics-config';
import type { Lang } from '@/lib/site';

/**
 * Google Reader Revenue Manager (swg-basic) — contribution/subscription prompts
 * configured in Publisher Center. Renders nothing until NEXT_PUBLIC_SWG_PRODUCT_ID
 * is set, so it is safe to keep mounted everywhere.
 */
export function ReaderRevenue({ lang }: { lang: Lang }) {
  if (!swgConfigured) return null;

  const init = `(self.SWG_BASIC=self.SWG_BASIC||[]).push(function(basicSubscriptions){basicSubscriptions.init({type:"NewsArticle",isPartOfType:["Product"],isPartOfProductId:"${SWG_PRODUCT_ID}",clientOptions:{theme:"light",lang:"${lang}"}});});`;

  return (
    <>
      <Script id="swg-basic-init" strategy="afterInteractive">
        {init}
      </Script>
      <Script
        id="swg-basic-js"
        strategy="afterInteractive"
        src="https://news.google.com/swg/js/v1/swg-basic.js"
      />
    </>
  );
}
