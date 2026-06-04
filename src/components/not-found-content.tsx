import Link from 'next/link';
import { HeaderSearchField } from '@/components/header-search-field';
import { ArrowRight } from '@/components/icons';
import { NotFoundIllustration } from '@/components/not-found-illustration';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';

/** 404 main column — used inside `[lang]` layout or the root not-found shell. */
export function NotFoundContent({ lang }: { lang: Lang }) {
  const t = getStrings(lang);

  return (
    <main className="not-found-page border-border-soft relative flex-1 overflow-hidden border-b">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block"
      >
        <span
          className="orb orb-a"
          style={{ left: '70%', top: '-8%', width: 280, height: 280, background: 'rgba(240,192,64,0.18)' }}
        />
        <span
          className="orb orb-b"
          style={{ left: '12%', top: '55%', width: 220, height: 220, background: 'rgba(91,201,240,0.12)' }}
        />
      </div>

      <div className="relative mx-auto flex min-h-[58vh] w-full max-w-[1160px] flex-col items-center justify-center px-6 py-16 text-center md:py-24">
        <NotFoundIllustration />

        <p className="text-accent font-serif text-[clamp(4rem,14vw,6.5rem)] leading-none font-bold tracking-tight">
          404
        </p>

        <h1 className="text-text mt-3 font-serif text-[clamp(1.45rem,4vw,2.1rem)] font-semibold tracking-tight">
          {t.notFoundTitle}
        </h1>

        <p className="text-muted mx-auto mt-4 max-w-[32rem] text-base leading-relaxed">
          {t.notFoundBody}
        </p>

        <div className="mt-10 w-full max-w-xl text-left">
          <p className="text-faint mb-2 text-xs font-semibold tracking-widest uppercase">
            {t.notFoundSearchHint}
          </p>
          <HeaderSearchField lang={lang} placeholder={t.searchPlaceholder} className="max-w-none" />
        </div>

        <nav
          aria-label={t.notFoundMetaTitle}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            href={`/${lang}`}
            className="rounded-pill bg-accent inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-black no-underline"
          >
            {t.navHome}
            <ArrowRight size={16} />
          </Link>
          <Link
            href={`/${lang}/news`}
            className="rounded-pill border-border text-text hover:border-accent hover:text-accent inline-flex items-center border px-5 py-3 text-sm font-semibold no-underline transition-colors"
          >
            {t.nav.news}
          </Link>
          <Link
            href={`/${lang}/subscribe`}
            className="rounded-pill border-border text-text hover:border-accent hover:text-accent inline-flex items-center border px-5 py-3 text-sm font-semibold no-underline transition-colors"
          >
            {t.subscribe}
          </Link>
        </nav>
      </div>
    </main>
  );
}
