import type { ReactNode } from 'react';
import Link from 'next/link';
import { SITE_NAME, SOCIALS, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { CookieSettingsButton } from '@/components/cookie-consent';

const linkClass = 'hover:text-text inline-flex min-h-10 items-center';

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-faint mb-1 text-xs font-bold tracking-[0.1em] uppercase">{title}</p>
      <div className="text-muted flex flex-col text-sm">{children}</div>
    </div>
  );
}

export function SiteFooter({ lang }: { lang: Lang }) {
  const t = getStrings(lang);
  const linkedin = SOCIALS.find((s) => s.key === 'linkedin');

  return (
    <footer className="border-border-soft border-t">
      <div className="mx-auto max-w-[1160px] px-6 py-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
          <div className="text-faint min-w-0 max-w-md shrink-0 text-sm lg:max-w-xs">
            <p className="text-text font-serif text-base font-semibold">{SITE_NAME}</p>
            <p className="mt-2 leading-relaxed">{t.footerTagline}</p>
            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1">
              {SOCIALS.map((s) => (
                <a
                  key={s.key}
                  href={s.url}
                  target={s.key === 'rss' ? undefined : '_blank'}
                  rel={s.key === 'rss' ? undefined : 'noopener noreferrer'}
                  className="text-muted hover:text-accent inline-flex min-h-10 items-center text-sm font-medium"
                >
                  {s.label}
                </a>
              ))}
            </div>
            {linkedin ? (
              <p className="text-muted mt-4 leading-relaxed">
                {t.footerLinkedinCtaLead}{' '}
                <a
                  href={linkedin.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-text font-medium underline-offset-2 hover:underline"
                >
                  LinkedIn
                </a>{' '}
                {t.footerLinkedinCtaRest}
              </p>
            ) : null}
          </div>

          <nav
            aria-label="Footer"
            className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 sm:gap-x-8"
          >
            <FooterCol title={t.footerNavExplore}>
              <Link className={linkClass} href={`/${lang}/news`}>
                {t.nav.news}
              </Link>
              <Link className={linkClass} href={`/${lang}/digests`}>
                {t.nav.digests}
              </Link>
              <Link className={linkClass} href={`/${lang}/concepts`}>
                {t.nav.concepts}
              </Link>
              <Link className={linkClass} href={`/${lang}/guides`}>
                {t.guidesTitle}
              </Link>
            </FooterCol>

            <FooterCol title={t.footerNavCompany}>
              <Link className={linkClass} href={`/${lang}/subscribe`}>
                {t.footerSubscribe}
              </Link>
              <Link className={linkClass} href={`/${lang}/advertise`}>
                {t.footerAdvertise}
              </Link>
              <Link className={linkClass} href={`/${lang}/about`}>
                {t.about}
              </Link>
            </FooterCol>

            <FooterCol title={t.footerNavLegal}>
              <Link className={linkClass} href={`/${lang}/editorial-policy`}>
                {t.editorialPolicy}
              </Link>
              <Link className={linkClass} href={`/${lang}/ai-disclosure`}>
                {t.aiDisclosure}
              </Link>
              <Link className={linkClass} href={`/${lang}/privacy`}>
                {t.privacy}
              </Link>
              <Link className={linkClass} href={`/${lang}/terms`}>
                {t.terms}
              </Link>
              <CookieSettingsButton lang={lang} />
            </FooterCol>
          </nav>
        </div>
        <p className="text-faint mt-8 text-sm">
          © {new Date().getFullYear()} {SITE_NAME}. {t.rights}
        </p>
      </div>
    </footer>
  );
}
