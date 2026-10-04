import type { ReactNode } from 'react';
import Link from 'next/link';
import { SITE_NAME, SOCIALS, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { CookieSettingsButton } from '@/components/cookie-consent';
import { BrandMark } from '@/components/icons';
import { SocialLinkTracker } from '@/components/analytics/social-link-tracker';

const linkClass =
  'text-muted hover:text-accent inline-flex min-h-[44px] items-center text-sm no-underline transition-colors';

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-muted mb-2 font-mono text-2xs font-medium tracking-[var(--tracking-eyebrow)] uppercase">
        {title}
      </p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

export function SiteFooter({ lang }: { lang: Lang }) {
  const t = getStrings(lang);
  const linkedin = SOCIALS.find((s) => s.key === 'linkedin');

  return (
    <footer className="bg-bg-soft border-border-soft border-t">
      <div className="mx-auto max-w-[1160px] px-6 py-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
          <div className="min-w-0 max-w-md shrink-0 lg:max-w-xs">
            <Link
              href={`/${lang}`}
              aria-label={SITE_NAME}
              className="hover:text-accent inline-flex min-h-[44px] items-center gap-2.5 no-underline transition-colors"
            >
              <BrandMark size={28} className="shrink-0" />
              <span className="text-text font-serif text-lg font-semibold tracking-tight">
                {SITE_NAME}
              </span>
            </Link>
            <p className="text-muted mt-3 text-sm leading-relaxed">{t.footerTagline}</p>
            <ul className="mt-4 flex flex-wrap gap-2 list-none p-0">
              {SOCIALS.map((s) => {
                const isNewTab = s.key !== 'rss';
                const ariaLabel = isNewTab ? `${s.label} (${t.opensInNewTab})` : s.label;
                return (
                  <li key={s.key}>
                    <SocialLinkTracker network={s.key} placement="footer">
                      <a
                        href={s.url}
                        target={isNewTab ? '_blank' : undefined}
                        rel={isNewTab ? 'noopener noreferrer' : undefined}
                        aria-label={ariaLabel}
                        className="border-border text-muted hover:border-accent hover:text-accent rounded-pill inline-flex min-h-[44px] min-w-[44px] items-center justify-center border px-3 text-sm font-medium transition-colors"
                      >
                        {s.label}
                      </a>
                    </SocialLinkTracker>
                  </li>
                );
              })}
            </ul>
            {linkedin ? (
              <p className="text-muted mt-4 text-sm leading-relaxed">
                {t.footerLinkedinCtaLead}{' '}
                <SocialLinkTracker network="linkedin" placement="footer-cta">
                  <a
                    href={linkedin.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`LinkedIn (${t.opensInNewTab})`}
                    className="text-accent hover:text-text font-medium underline-offset-2 hover:underline"
                  >
                    LinkedIn
                  </a>
                </SocialLinkTracker>{' '}
                {t.footerLinkedinCtaRest}
              </p>
            ) : null}
          </div>

          <nav
            aria-label="Footer"
            className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 sm:gap-x-8"
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
              <Link className={linkClass} href={`/${lang}/tools`}>
                {t.nav.tools}
              </Link>
            </FooterCol>

            <FooterCol title={t.footerNavCompany}>
              <Link className={linkClass} href={`/${lang}/about`}>
                {t.about}
              </Link>
              <Link className={linkClass} href={`/${lang}/author`}>
                {t.footerAuthor}
              </Link>
              <Link className={linkClass} href={`/${lang}/subscribe`}>
                {t.footerSubscribe}
              </Link>
              <Link className={linkClass} href={`/${lang}/advertise`}>
                {t.footerAdvertise}
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
        <div className="border-border-soft mt-10 border-t pt-6 text-xs text-faint">
          <p>
            © {new Date().getFullYear()} {SITE_NAME} · {t.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
