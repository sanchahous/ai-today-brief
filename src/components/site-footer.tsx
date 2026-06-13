import Link from 'next/link';
import { SITE_NAME, SOCIALS, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { CookieSettingsButton } from '@/components/cookie-consent';

export function SiteFooter({ lang }: { lang: Lang }) {
  const t = getStrings(lang);
  return (
    <footer className="border-border-soft border-t">
      <div className="mx-auto max-w-[1160px] px-6 py-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between">
          <div className="text-faint min-w-0 text-sm">
            <p className="text-text font-serif text-base font-semibold">{SITE_NAME}</p>
            <p className="mt-2 max-w-md leading-relaxed">{t.footerTagline}</p>
            <div className="mt-4 flex flex-wrap gap-3">
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
          </div>
          <nav aria-label="Footer" className="text-muted flex flex-col text-sm">
            <Link className="hover:text-text inline-flex min-h-10 items-center" href={`/${lang}/news`}>
              {t.nav.news}
            </Link>
            <Link className="hover:text-text inline-flex min-h-10 items-center" href={`/${lang}/concepts`}>
              {t.nav.concepts}
            </Link>
            <Link className="hover:text-text inline-flex min-h-10 items-center" href={`/${lang}/guides`}>
              {t.guidesTitle}
            </Link>
            <Link className="hover:text-text inline-flex min-h-10 items-center" href={`/${lang}/subscribe`}>
              {t.footerSubscribe}
            </Link>
            <Link className="hover:text-text inline-flex min-h-10 items-center" href={`/${lang}/advertise`}>
              {t.footerAdvertise}
            </Link>
            <Link className="hover:text-text inline-flex min-h-10 items-center" href={`/${lang}/about`}>
              {t.about}
            </Link>
            <Link className="hover:text-text inline-flex min-h-10 items-center" href={`/${lang}/editorial-policy`}>
              {t.editorialPolicy}
            </Link>
            <Link className="hover:text-text inline-flex min-h-10 items-center" href={`/${lang}/ai-disclosure`}>
              {t.aiDisclosure}
            </Link>
            <Link className="hover:text-text inline-flex min-h-10 items-center" href={`/${lang}/privacy`}>
              {t.privacy}
            </Link>
            <Link className="hover:text-text inline-flex min-h-10 items-center" href={`/${lang}/terms`}>
              {t.terms}
            </Link>
            <CookieSettingsButton lang={lang} />
          </nav>
        </div>
        <p className="text-faint mt-8 text-sm">
          © {new Date().getFullYear()} {SITE_NAME}. {t.rights}
        </p>
      </div>
    </footer>
  );
}
