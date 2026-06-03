import Link from 'next/link';
import { SITE_NAME, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';

export function SiteFooter({ lang }: { lang: Lang }) {
  const t = getStrings(lang);
  return (
    <footer className="border-border-soft border-t">
      <div className="mx-auto max-w-[1160px] px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="text-faint text-sm">
            <p className="text-text font-serif text-base font-semibold">{SITE_NAME}</p>
            <p className="mt-2 max-w-md">{t.footerTagline}</p>
          </div>
          <nav className="text-muted flex flex-col gap-2 text-sm">
            <Link className="hover:text-text" href={`/${lang}/about`}>
              {t.about}
            </Link>
            <Link className="hover:text-text" href={`/${lang}/ai-disclosure`}>
              {t.aiDisclosure}
            </Link>
            <Link className="hover:text-text" href={`/${lang}/privacy`}>
              {t.privacy}
            </Link>
            <Link className="hover:text-text" href={`/${lang}/terms`}>
              {t.terms}
            </Link>
            <a className="hover:text-text" href="/rss.xml">
              RSS
            </a>
          </nav>
        </div>
        <p className="text-faint mt-8 text-sm">
          © {new Date().getFullYear()} {SITE_NAME}. {t.rights}
        </p>
      </div>
    </footer>
  );
}
