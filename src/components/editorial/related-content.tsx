import type { Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import type { StoryCardItem } from './story-card';
import { ArrowRight } from '@/components/icons';
import Link from 'next/link';

function ConceptRail({
  lang,
  concepts,
  workLinks,
}: {
  lang: Lang;
  concepts: { name: string; href: string }[];
  workLinks: { title: string; href: string }[];
}) {
  const t = getStrings(lang);
  return (
    <div className="grid min-w-0 gap-3">
      {concepts.length > 0 ? (
        <section className="border-line bg-surface min-w-0 rounded-[var(--radius-md)] border p-4" aria-labelledby="related-concepts-title">
          <p id="related-concepts-title" className="text-muted m-0 mb-3 font-mono text-2xs font-medium tracking-[0.08em] uppercase">
            {t.conceptOther}
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {concepts.map((concept) => (
              <li key={concept.href}>
                <Link
                  href={concept.href}
                  className="text-text hover:text-accent inline-flex min-h-11 items-center text-sm font-medium"
                >
                  {concept.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {workLinks.length > 0 ? (
        <section className="border-line bg-surface min-w-0 rounded-[var(--radius-md)] border p-4" aria-labelledby="put-to-work-title">
          <p id="put-to-work-title" className="text-muted m-0 mb-3 font-mono text-2xs font-medium tracking-[0.08em] uppercase">
            {t.conceptPutToWork}
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {workLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-text hover:text-accent inline-flex min-h-11 items-center gap-1 text-sm font-medium"
                >
                  {link.title}
                  <ArrowRight size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function RelatedContent({
  lang,
  related,
  prev,
  next,
  concepts = [],
  workLinks = [],
}: {
  lang: Lang;
  related: StoryCardItem[];
  prev?: { title: string; href: string };
  next?: { title: string; href: string };
  concepts?: { name: string; href: string }[];
  workLinks?: { title: string; href: string }[];
}) {
  const t = getStrings(lang).news;
  const rail =
    concepts.length > 0 || workLinks.length > 0 ? (
      <ConceptRail lang={lang} concepts={concepts} workLinks={workLinks} />
    ) : null;
  if (rail && related.length === 0 && !prev && !next) return rail;

  return (
    <div className="my-10 border-t border-line pt-8">
      {rail}
      {related.length > 0 && (
        <div className="mb-10">
          <h3 className="mb-6 font-serif text-xl font-semibold">
            {lang === 'uk' ? 'Схожі матеріали' : 'Related coverage'}
          </h3>
          <div className="flex flex-col gap-4">
            {related.map((item) => (
              // Using existing StoryRow which displays horizontally
              <div key={item.id}>
                 <Link href={item.href} className="group flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent">
                    {item.imageUrl && (
                      <div className="relative h-20 w-full sm:w-24 shrink-0 overflow-hidden rounded-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-accent mb-1">{item.categoryName}</div>
                      <h4 className="font-semibold text-text group-hover:text-accent transition-colors">{item.title}</h4>
                    </div>
                 </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {(prev || next) && (
        <div className="flex flex-col sm:flex-row gap-4 border-t border-line pt-6">
          {prev && (
            <Link href={prev.href} className="flex-1 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent group">
              <div className="text-xs text-muted mb-1">{t.prev}</div>
              <div className="font-medium text-text group-hover:text-accent transition-colors">{prev.title}</div>
            </Link>
          )}
          {next && (
            <Link href={next.href} className="flex-1 rounded-xl border border-line bg-surface p-4 text-right transition-colors hover:border-accent group">
              <div className="text-xs text-muted mb-1">{t.next}</div>
              <div className="font-medium text-text group-hover:text-accent transition-colors">{next.title}</div>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
