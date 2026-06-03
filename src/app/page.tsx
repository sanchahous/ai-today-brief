import {
  SITE_NAME,
  SITE_TAGLINE,
  DEFAULT_LANG,
  EDITOR_NAME,
  EDITOR_ROLE,
  MARK_COLOR,
} from '@/lib/site';
import { getLatestBrief } from '@/lib/briefs';

const lang = DEFAULT_LANG;

// ISR: refresh the homepage every 30 min without a per-request DB hit.
// (On-publish revalidation gets wired in P4 once the pipeline lands.)
export const revalidate = 1800;

// Fallback shown only when Supabase is unreachable (e.g. no env on a local build).
const SAMPLE_BRIEF = [
  {
    category: 'Models & Releases',
    title: 'A new open-weight model lands — and the benchmarks are close',
    why: 'Open weights at near-frontier quality reshape what you can self-host and fine-tune.',
  },
  {
    category: 'Frameworks',
    title: 'The agent framework everyone forked ships tool-calling v2',
    why: 'Less glue-code, more deterministic tool orchestration in production.',
  },
  {
    category: 'MLOps',
    title: 'Inference got cheaper: a quantization trick with no quality cliff',
    why: 'Lower cost-per-token changes the math on shipping LLM features at scale.',
  },
];

function prettyCategory(slug: string | null): string {
  if (!slug) return 'AI';
  return slug.replace(/-/g, ' ').replace(/\band\b/g, '&');
}

function dateLabel(value: string): string {
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export default async function Home() {
  const brief = await getLatestBrief();
  const items = brief?.items ?? [];
  const live = items.length > 0;

  const cards = live
    ? items.map((it) => ({
        key: it.id,
        category: prettyCategory(it.category_slug),
        title: it.title_en ?? it.summary_en,
        why: it.why_matters_en ?? it.summary_en,
        href: brief?.slug && it.slug ? `/${lang}/${brief.slug}/${it.slug}` : `/${lang}/news`,
      }))
    : SAMPLE_BRIEF.map((s, i) => ({ key: `sample-${i}`, ...s, href: `/${lang}/news` }));

  const briefDate = brief?.date ? dateLabel(brief.date) : dateLabel(new Date().toISOString());

  return (
    <>
      <header className="border-border-soft border-b">
        <div className="mx-auto flex max-w-[1160px] items-center gap-4 px-6 py-4">
          <a href={`/${lang}`} className="flex items-center gap-2">
            <span
              aria-hidden
              className="rounded-pill grid h-8 w-8 place-items-center font-serif text-sm font-bold text-black"
              style={{ background: MARK_COLOR }}
            >
              AT
            </span>
            <span className="font-serif text-lg font-semibold">{SITE_NAME}</span>
          </a>
          <nav className="text-muted ml-auto hidden items-center gap-6 text-sm md:flex">
            <a className="hover:text-text" href={`/${lang}/news`}>
              News
            </a>
            <a className="hover:text-text" href={`/${lang}/models`}>
              Models
            </a>
            <a className="hover:text-text" href={`/${lang}/frameworks`}>
              Frameworks
            </a>
            <a className="hover:text-text" href={`/${lang}/mlops`}>
              MLOps
            </a>
          </nav>
          <a
            href={`/${lang}/subscribe`}
            className="rounded-pill bg-accent ml-auto px-4 py-2 text-sm font-semibold text-black md:ml-0"
          >
            Subscribe
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1160px] flex-1 px-6">
        <section className="border-border-soft border-b py-14">
          <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">
            Daily AI-engineering brief
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl leading-tight sm:text-5xl">
            {SITE_TAGLINE[lang]}
          </h1>
          <p className="text-muted mt-5 max-w-2xl text-lg">
            Curated, human-edited signal for people who build with AI — models, frameworks, MLOps.
            One brief a day. No hype.
          </p>
          <p className="text-faint mt-6 text-sm">
            {briefDate} · Edited by {EDITOR_NAME}, {EDITOR_ROLE[lang]}
          </p>
        </section>

        <section className="py-12">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 className="text-2xl">Today’s brief</h2>
            {!live && (
              <span className="border-border-soft text-faint rounded-pill border px-3 py-1 text-xs">
                Sample — connect Supabase env to go live
              </span>
            )}
          </div>
          {brief?.intro_en && <p className="text-muted mb-6 max-w-2xl">{brief.intro_en}</p>}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <a
                key={card.key}
                href={card.href}
                className="rounded-card border-border bg-surface hover:border-accent block border p-5 transition-colors"
              >
                <span className="text-accent text-xs font-bold tracking-wider uppercase">
                  {card.category}
                </span>
                <h3 className="mt-3 text-lg leading-snug">{card.title}</h3>
                <p className="text-muted mt-3 line-clamp-3 text-sm">{card.why}</p>
                <span className="text-accent mt-4 inline-block text-sm font-semibold">Read →</span>
              </a>
            ))}
          </div>
          <div className="mt-8">
            <a href={`/${lang}/news`} className="text-accent text-sm font-semibold">
              All news →
            </a>
          </div>
        </section>
      </main>

      <footer className="border-border-soft border-t">
        <div className="text-faint mx-auto max-w-[1160px] px-6 py-10 text-sm">
          <p className="text-text font-serif text-base font-semibold">{SITE_NAME}</p>
          <p className="mt-2 max-w-md">The daily AI-engineering brief. Built in public. EN · UK.</p>
          <p className="mt-6">
            © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  );
}
