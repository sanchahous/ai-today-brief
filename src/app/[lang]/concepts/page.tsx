import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLang, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getConcepts } from '@/lib/concepts';

export const revalidate = 3600;

type Params = { lang: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : 'en';
  return { title: getStrings(l).nav.concepts };
}

export default async function ConceptsIndex({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const t = getStrings(lang);
  const concepts = await getConcepts(lang);

  return (
    <main className="mx-auto w-full max-w-[1160px] flex-1 px-6 py-12">
      <h1 className="text-3xl sm:text-4xl">{t.nav.concepts}</h1>
      <p className="text-muted mt-4 max-w-2xl">{t.conceptsLede}</p>

      {concepts.length === 0 ? (
        <p className="text-muted mt-10">{t.noResults}</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {concepts.map((c) => (
            <Link
              key={c.slug}
              href={`/${lang}/concepts/${c.slug}`}
              className="rounded-card border-border bg-surface hover:border-accent block border p-5 transition-colors"
            >
              <span className="text-accent text-xs font-bold tracking-wider uppercase">
                {c.type}
              </span>
              <h2 className="mt-2 text-lg leading-snug">{c.name}</h2>
              {c.description && (
                <p className="text-muted mt-2 line-clamp-3 text-sm">{c.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
