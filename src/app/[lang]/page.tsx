import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SITE_TAGLINE, EDITOR_NAME, EDITOR_ROLE, isLang, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { getLatestBrief } from '@/lib/briefs';

// ISR: refresh every 30 min. (On-publish revalidation gets wired in P4.)
export const revalidate = 1800;

// Fallback shown only when Supabase is unreachable (e.g. no env on a local build).
const SAMPLE_BRIEF = [
  {
    categorySlug: 'models-and-releases',
    title: 'A new open-weight model lands — and the benchmarks are close',
    why: 'Open weights at near-frontier quality reshape what you can self-host and fine-tune.',
  },
  {
    categorySlug: 'frameworks',
    title: 'The agent framework everyone forked ships tool-calling v2',
    why: 'Less glue-code, more deterministic tool orchestration in production.',
  },
  {
    categorySlug: 'mlops',
    title: 'Inference got cheaper: a quantization trick with no quality cliff',
    why: 'Lower cost-per-token changes the math on shipping LLM features at scale.',
  },
];

function prettyCategory(slug: string | null): string {
  if (!slug) return 'AI';
  return slug.replace(/-/g, ' ').replace(/\band\b/g, '&');
}

function dateLabel(value: string, lang: Lang): string {
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const t = getStrings(lang);

  const brief = await getLatestBrief(lang);
  const items = brief?.items ?? [];
  const live = items.length > 0;

  const cards = live
    ? items.map((it) => ({
        key: it.id,
        category: prettyCategory(it.categorySlug),
        title: it.title,
        why: it.why,
        href: brief?.slug && it.slug ? `/${lang}/${brief.slug}/${it.slug}` : `/${lang}/news`,
      }))
    : SAMPLE_BRIEF.map((s, i) => ({
        key: `sample-${i}`,
        category: prettyCategory(s.categorySlug),
        title: s.title,
        why: s.why,
        href: `/${lang}/news`,
      }));

  const briefDate = brief?.date
    ? dateLabel(brief.date, lang)
    : dateLabel(new Date().toISOString(), lang);

  return (
    <main className="mx-auto w-full max-w-[1160px] flex-1 px-6">
      <section className="border-border-soft border-b py-14">
        <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">{t.eyebrow}</p>
        <h1 className="mt-4 max-w-3xl text-4xl leading-tight sm:text-5xl">{SITE_TAGLINE[lang]}</h1>
        <p className="text-muted mt-5 max-w-2xl text-lg">{t.heroLede}</p>
        <p className="text-faint mt-6 text-sm">
          {briefDate} · {t.editedBy} {EDITOR_NAME}, {EDITOR_ROLE[lang]}
        </p>
      </section>

      <section className="py-12">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2 className="text-2xl">{t.todaysBrief}</h2>
          {!live && (
            <span className="border-border-soft text-faint rounded-pill border px-3 py-1 text-xs">
              {t.sampleBadge}
            </span>
          )}
        </div>
        {brief?.intro && <p className="text-muted mb-6 max-w-2xl">{brief.intro}</p>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.key}
              href={card.href}
              className="rounded-card border-border bg-surface hover:border-accent block border p-5 transition-colors"
            >
              <span className="text-accent text-xs font-bold tracking-wider uppercase">
                {card.category}
              </span>
              <h3 className="mt-3 text-lg leading-snug">{card.title}</h3>
              <p className="text-muted mt-3 line-clamp-3 text-sm">{card.why}</p>
            </Link>
          ))}
        </div>
        <div className="mt-8">
          <Link href={`/${lang}/news`} className="text-accent text-sm font-semibold">
            {t.allNews} →
          </Link>
        </div>
      </section>
    </main>
  );
}
