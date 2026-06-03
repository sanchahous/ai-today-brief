import Link from 'next/link';
import { SITE_NAME, MARK_COLOR, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';

export function SiteHeader({ lang }: { lang: Lang }) {
  const t = getStrings(lang);
  return (
    <header className="border-border-soft border-b">
      <div className="mx-auto flex max-w-[1160px] items-center gap-4 px-6 py-4">
        <Link href={`/${lang}`} className="flex items-center gap-2">
          <span
            aria-hidden
            className="rounded-pill grid h-8 w-8 place-items-center font-serif text-sm font-bold text-black"
            style={{ background: MARK_COLOR }}
          >
            AT
          </span>
          <span className="font-serif text-lg font-semibold">{SITE_NAME}</span>
        </Link>
        <nav className="text-muted ml-auto hidden items-center gap-6 text-sm md:flex">
          <Link className="hover:text-text" href={`/${lang}/news`}>
            {t.nav.news}
          </Link>
          <Link className="hover:text-text" href={`/${lang}/concepts`}>
            {t.nav.concepts}
          </Link>
          <Link className="hover:text-text" href={`/${lang}/models`}>
            {t.nav.models}
          </Link>
          <Link className="hover:text-text" href={`/${lang}/frameworks`}>
            {t.nav.frameworks}
          </Link>
          <Link className="hover:text-text" href={`/${lang}/mlops`}>
            {t.nav.mlops}
          </Link>
        </nav>
        <div className="text-faint ml-auto flex items-center gap-1 text-xs md:ml-4">
          <Link
            className={lang === 'en' ? 'text-text font-semibold' : 'hover:text-text'}
            href="/en"
          >
            EN
          </Link>
          <span aria-hidden>·</span>
          <Link
            className={lang === 'uk' ? 'text-text font-semibold' : 'hover:text-text'}
            href="/uk"
          >
            UK
          </Link>
        </div>
        <Link
          href={`/${lang}/subscribe`}
          className="rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-black"
        >
          {t.subscribe}
        </Link>
      </div>
    </header>
  );
}
