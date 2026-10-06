import Link from 'next/link';
import { getStrings } from '@/lib/i18n';
import { pluralLabel } from '@/lib/home-stats';
import type { Lang } from '@/lib/site';
import { ArrowRight } from '@/components/icons';

export function HomePaths({ lang, conceptCount }: { lang: Lang; conceptCount: number }) {
  const t = getStrings(lang);
  const landing = t.landing;
  const cards = [
    {
      href: `/${lang}/concepts`,
      title: landing.pathConceptsTitle,
      body:
        conceptCount > 0
          ? `${conceptCount} ${pluralLabel(conceptCount, lang, 'concepts')}. ${t.conceptsLede}`
          : t.conceptsLede,
    },
    {
      href: `/${lang}/guides`,
      title: landing.pathGuidesTitle,
      body: t.guidesLede,
    },
    {
      href: `/${lang}/tools`,
      title: landing.pathToolsTitle,
      body: t.toolsPage.lede,
    },
  ];

  return (
    <section aria-labelledby="paths-title" className="mx-auto w-full max-w-[1160px] px-6 py-12">
      <h2 id="paths-title" className="text-2xl sm:text-3xl">
        {landing.pathsTitle}
      </h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {cards.map((card, index) => (
          <Link
            key={card.href}
            href={card.href}
            className="border-line bg-surface hover:border-accent rounded-card flex min-h-[var(--touch-target-min)] flex-col gap-3 border p-5 no-underline"
          >
            <span className="text-faint font-serif text-xl" aria-hidden>
              {String(index + 1).padStart(2, '0')}
            </span>
            <strong className="text-text text-lg">{card.title}</strong>
            <span className="text-muted text-sm leading-6">{card.body}</span>
            <span className="text-accent mt-auto inline-flex items-center gap-1 text-sm font-semibold">
              <ArrowRight size={16} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
