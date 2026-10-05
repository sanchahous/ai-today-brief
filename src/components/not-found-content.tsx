import Link from 'next/link';
import { NotFoundSearch } from '@/components/not-found-search';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import styles from './not-found.module.css';

/** 404 main column — used inside `[lang]` layout or the root not-found shell. */
export function NotFoundContent({ lang }: { lang: Lang }) {
  const t = getStrings(lang);
  const suggestedLinks = [
    { href: `/${lang}`, label: t.navHome },
    { href: `/${lang}/news`, label: t.nav.news },
    { href: `/${lang}/digests`, label: t.nav.digests },
    { href: `/${lang}/subscribe`, label: t.subscribe },
  ];

  return (
    <section className={`${styles.page} mx-auto w-full max-w-[51.25rem] flex-1 px-6 py-16 md:py-24`} aria-labelledby="nf-title">
      <p className={styles.code} aria-hidden="true">
        4<span>0</span>4
      </p>

      <p className="text-accent eyebrow mt-6">{t.notFoundEyebrow}</p>

      <h1 id="nf-title" className="text-text mt-3 font-serif text-[clamp(1.7rem,4.5vw,2.5rem)] leading-[1.12] font-semibold tracking-tight">
        {t.notFoundTitleLead}{' '}
        <em className="font-display italic font-normal text-inherit">{t.notFoundTitleEm}</em>
      </h1>

      <p className="text-muted mt-4 max-w-[36rem] text-base leading-relaxed">{t.notFoundBody}</p>

      <NotFoundSearch
        lang={lang}
        label={t.notFoundSearchLabel}
        placeholder={t.searchPlaceholder}
        button={t.search}
      />

      <nav aria-label={t.notFoundSuggestedPages} className={`${styles.links} mt-8`}>
        {suggestedLinks.map((link) => (
          <Link key={link.href} href={link.href} className={styles.link}>
            {link.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
