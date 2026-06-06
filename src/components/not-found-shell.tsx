import { AnalyticsProvider } from '@/components/analytics-provider';
import { CookieConsent } from '@/components/cookie-consent';
import { NotFoundContent } from '@/components/not-found-content';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';

/** Full chrome when Next renders root `not-found` (no `[lang]` layout). */
export async function NotFoundShell({ lang }: { lang: Lang }) {
  const t = getStrings(lang);
  return (
    <>
      <a href="#main-content" className="skip-link">
        {t.skipToContent}
      </a>
      <SiteHeader lang={lang} />
      <main id="main-content" className="flex-1">
        <NotFoundContent lang={lang} />
      </main>
      <SiteFooter lang={lang} />
      <AnalyticsProvider lang={lang} />
      <CookieConsent lang={lang} />
    </>
  );
}
