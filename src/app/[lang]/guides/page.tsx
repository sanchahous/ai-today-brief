import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GUIDES } from '@/content/guides';
import { getStrings } from '@/lib/i18n';
import { CONTACT_EMAIL, isLang, SITE_NAME, SITE_URL, type Lang } from '@/lib/site';
import {
  ArrowRight,
  BoltIcon,
  CalendarIcon,
  CheckIcon,
  CompassIcon,
  EyeIcon,
  FileTextIcon,
  LayersIcon,
  ShieldIcon,
} from '@/components/guides/guide-icons';
import { ClockIcon } from '@/components/icons';
import { HubViewTracker } from '@/components/analytics/hub-view-tracker';
import { NewsletterBand } from '@/components/home/newsletter-band';
import { socialMeta } from '@/lib/seo';

export const revalidate = 86400;

type Params = { lang: string };

type Guide = (typeof GUIDES)[number];

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLang(lang) ? lang : 'en';
  const t = getStrings(l);
  return {
    title: t.guidesTitle,
    description: t.guidesLede,
    alternates: {
      canonical: `${SITE_URL}/${l}/guides`,
      languages: {
        en: `${SITE_URL}/en/guides`,
        uk: `${SITE_URL}/uk/guides`,
        'x-default': `${SITE_URL}/en/guides`,
      },
    },
    ...socialMeta({ title: t.guidesTitle, description: t.guidesLede, path: `/${l}/guides`, lang: l }),
  };
}

/**
 * Level · read time · last verified · sections. Shared by both feature blocks; `className`
 * carries the tone because the two sit on different surfaces (velvet vs stage).
 */
function GuideMeta({
  guide,
  lang,
  verifiedLabel,
  dateFmt,
  className,
}: {
  guide: Guide;
  lang: Lang;
  verifiedLabel: string;
  dateFmt: Intl.DateTimeFormat;
  className: string;
}) {
  return (
    <ul
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-xs list-none p-0 mb-6 ${className}`}
    >
      <li>{guide.level[lang]}</li>
      <li className="inline-flex items-center gap-1.5">
        <ClockIcon size={14} />
        <span>
          {guide.read} {lang === 'uk' ? 'хв' : 'min'}
        </span>
      </li>
      <li className="inline-flex items-center gap-1.5">
        <CheckIcon size={14} />
        <span>
          {verifiedLabel}{' '}
          <time dateTime={guide.lastVerified}>
            {dateFmt.format(new Date(`${guide.lastVerified}T00:00:00`))}
          </time>
        </span>
      </li>
      <li>
        {guide.sections} {lang === 'uk' ? 'розділів' : 'sections'}
      </li>
    </ul>
  );
}

const EYEBROW = 'text-2xs font-semibold uppercase tracking-wider text-accent mb-2';

export default async function GuidesPage({ params }: { params: Promise<Params> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang: Lang = raw;
  const t = getStrings(lang);

  const dateFmt = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t.guidesTitle,
    description: t.guidesLede,
    inLanguage: lang,
    url: `${SITE_URL}/${lang}/guides`,
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  };

  const [comparison, bench] = GUIDES;

  const comparisonRows = [
    {
      key: lang === 'uk' ? 'Де працює' : 'Where it lives',
      claude: lang === 'uk' ? 'Термінал' : 'Terminal',
      cursor: 'IDE',
      codex: lang === 'uk' ? 'Хмарна пісочниця' : 'Cloud sandbox',
    },
    {
      key: lang === 'uk' ? 'Автономність' : 'Autonomy',
      claude: '●●●',
      cursor: '●●○',
      codex: '●●●',
    },
    {
      key: lang === 'uk' ? 'Найкраще для' : 'Best for',
      claude: lang === 'uk' ? 'Скрипти й CI' : 'Scripting & CI',
      cursor: lang === 'uk' ? 'Внутрішній цикл' : 'Inner loop',
      codex: lang === 'uk' ? 'Делегування' : 'Delegation',
    },
  ];

  const benchDimensions = [
    { id: '01', en: 'Planning & decomposition', uk: 'Планування й декомпозиція' },
    { id: '02', en: 'Long-term memory (restart test)', uk: 'Довгострокова памʼять (тест рестартом)' },
    { id: '03', en: 'Token economy', uk: 'Токен-економіка' },
    { id: '04', en: 'Code quality', uk: 'Якість коду' },
    { id: '05', en: 'Self-review & critique', uk: 'Само-ревʼю і критика' },
    { id: '06', en: 'Tests (unit + e2e)', uk: 'Тести (unit + e2e)' },
    { id: '07', en: 'Design fidelity', uk: 'Відповідність дизайну' },
    { id: '08', en: 'Tech-debt honesty', uk: 'Чесність техборгу' },
    { id: '09', en: 'Autonomy', uk: 'Автономність' },
    { id: '10', en: 'Time to done', uk: 'Час до готовності' },
  ];

  // Each job gets its own category hue so the four cards read as four different doors,
  // not one card repeated. Hues come from the `--cat-*` tokens (Day-safe).
  const jobCards = [
    {
      Icon: CompassIcon,
      hue: 'var(--cat-agents)',
      title: lang === 'uk' ? 'Обрати агента для коду' : 'Choose a coding agent',
      description:
        lang === 'uk'
          ? 'Структурні ставки, командний фіт і чекліст «обирайте, якщо».'
          : 'Structural bets, team fit and a “choose this if” checklist.',
      href: `/${lang}/guides/${comparison.slug}`,
    },
    {
      Icon: EyeIcon,
      hue: 'var(--cat-models)',
      title: lang === 'uk' ? 'Оцінити новий реліз' : 'Evaluate a new release',
      description:
        lang === 'uk'
          ? 'Читайте результат за умовами: епік, харнес, повтори, рев’ю.'
          : 'Read a result by its conditions: epic, harness, retries, review.',
      href: `/${lang}/guides/${bench.slug}`,
    },
    {
      Icon: BoltIcon,
      hue: 'var(--cat-cost)',
      title: lang === 'uk' ? 'Скоротити витрати агента' : 'Cut agent spend',
      description:
        lang === 'uk'
          ? 'Технічний гайд про межі кешу, контекстні вікна й токени.'
          : 'A field guide to cache boundaries and what to measure.',
      href: `/${lang}/category/optimization`,
    },
    {
      Icon: ShieldIcon,
      hue: 'var(--cat-tools)',
      title: lang === 'uk' ? 'Випускати із запобіжниками' : 'Ship with guardrails',
      description:
        lang === 'uk'
          ? 'Дозволи й hooks, які можна перевірити до експорту.'
          : 'Permissions and hooks you can review before exporting.',
      href: `/${lang}/tools/settings-builder`,
    },
  ];

  const cycleSteps = [
    {
      step: '01',
      title: lang === 'uk' ? 'Чернетка' : 'Draft',
      desc:
        lang === 'uk'
          ? 'Структурні твердження з джерелами.'
          : 'Structural claims, sourced.',
    },
    {
      step: '02',
      title: lang === 'uk' ? 'Перевірка' : 'Verify',
      desc:
        lang === 'uk'
          ? 'Фактчек редактора за документацією.'
          : "Editor's fact pass against docs.",
    },
    {
      step: '03',
      title: lang === 'uk' ? 'Публікація' : 'Publish',
      desc:
        lang === 'uk'
          ? 'Дата на сторінці та в schema.'
          : 'Date shown on page and in schema.',
    },
    {
      step: '04',
      title: lang === 'uk' ? 'Повторна перевірка' : 'Re-check',
      desc:
        lang === 'uk'
          ? 'За розкладом або після великого релізу.'
          : 'On a schedule or on a major release.',
    },
  ];

  const trustPoints = [
    {
      Icon: CalendarIcon,
      title: lang === 'uk' ? 'Перевірка за розкладом' : 'Re-verified on a schedule',
      body:
        lang === 'uk'
          ? 'дата на кожному гайді — сигнал довіри'
          : 'the date on every guide is the trust signal',
    },
    {
      Icon: LayersIcon,
      title: lang === 'uk' ? 'Лише структурні твердження' : 'Structural claims only',
      body:
        lang === 'uk'
          ? 'без цін і версій, якщо не перевірено щойно'
          : 'no prices or versions unless freshly checked',
    },
    {
      Icon: FileTextIcon,
      title: lang === 'uk' ? 'Changelog на кожній сторінці' : 'A changelog on every page',
      body: lang === 'uk' ? 'щоб бачити, що змінилося' : 'so you see what moved',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1200px] flex-1 px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <HubViewTracker hubType="guides" slug="guides" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Library hero: one lit panel, trust signals as a single divided list ── */}
      <header
        className="rounded-2xl border border-line bg-hero-surface p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-8 lg:gap-12 items-center"
        style={{ backgroundImage: 'var(--stage-light)' }}
      >
        <div>
          <div className={`${EYEBROW} mb-3`}>
            {lang === 'uk' ? 'Практична бібліотека' : 'The practical library'}
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-text mb-4 leading-tight">
            {lang === 'uk' ? (
              <>
                Менше здогадок.
                <br />
                <em className="italic font-normal">Кращі рішення.</em>
              </>
            ) : (
              <>
                Less guessing.
                <br />
                <em className="italic font-normal">Better decisions.</em>
              </>
            )}
          </h1>
          <p className="text-base sm:text-lg text-muted leading-relaxed max-w-[65ch] m-0">
            {lang === 'uk'
              ? 'Живі довідники для рішень, які ви реально ухвалюєте. Ми регулярно їх перевіряємо — дата на кожному гайді і є сигнал довіри.'
              : 'Living references for the decisions you actually face. We re-verify them on a schedule — the date on every guide is the trust signal.'}
          </p>
        </div>

        <ul className="list-none p-0 m-0 divide-y divide-line-soft border-t border-line-soft lg:border-t-0 lg:border-l lg:pl-10">
          {trustPoints.map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-4 py-4 first:pt-0 last:pb-0 max-lg:first:pt-4">
              <Icon className="text-accent mt-0.5 shrink-0" size={20} />
              <span className="grid gap-0.5 text-sm text-muted">
                <strong className="text-text font-semibold">{title}</strong>
                <span>{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </header>

      {/* ── Feature 1: Comparison — velvet, the same wine surface as the weekly digest ── */}
      <section
        className="mt-8 sm:mt-10 rounded-2xl border border-on-velvet/10 bg-velvet text-on-velvet p-6 sm:p-8 lg:p-10"
        aria-labelledby="g1-title"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <span className="inline-flex items-center rounded-pill border border-on-velvet/25 px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider text-on-velvet mb-3">
              {lang === 'uk' ? 'Порівняння' : 'Comparison'}
            </span>
            <h2 id="g1-title" className="font-serif text-2xl sm:text-3xl font-bold mb-3 leading-snug">
              <Link
                href={`/${lang}/guides/${comparison.slug}`}
                className="hover:underline underline-offset-4 decoration-1"
              >
                {comparison.title[lang]}
              </Link>
            </h2>
            <p className="text-on-velvet/80 text-base leading-relaxed mb-4">
              {comparison.description[lang]}
            </p>
            <p className="flex items-start gap-2 font-medium text-sm mb-4">
              <CheckIcon size={16} className="text-signal mt-0.5 shrink-0" />
              <span>{comparison.outcome[lang]}</span>
            </p>
            <GuideMeta
              guide={comparison}
              lang={lang}
              verifiedLabel={t.lastVerifiedLabel}
              dateFmt={dateFmt}
              className="text-on-velvet/75"
            />
            <Link
              href={`/${lang}/guides/${comparison.slug}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-accent-fill text-on-accent px-5 py-2.5 font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <span>{lang === 'uk' ? 'Читати порівняння' : 'Read the comparison'}</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          <div>
            <div
              className="overflow-hidden rounded-xl border border-on-velvet/15 bg-velvet-deep"
              role="img"
              aria-label={
                lang === 'uk' ? 'Прев’ю матриці порівняння' : 'Preview of the comparison matrix'
              }
            >
              <div className="grid grid-cols-[64px_repeat(3,minmax(0,1fr))] sm:grid-cols-[minmax(88px,0.9fr)_repeat(3,minmax(0,1fr))] border-b border-on-velvet/15 p-2 sm:p-4 text-accent font-serif text-sm sm:text-base font-bold">
                <span />
                <span>Claude Code</span>
                <span>Cursor</span>
                <span>Codex</span>
              </div>
              {comparisonRows.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-[64px_repeat(3,minmax(0,1fr))] sm:grid-cols-[minmax(88px,0.9fr)_repeat(3,minmax(0,1fr))] border-b border-on-velvet/15 last:border-b-0"
                >
                  <span className="p-2 sm:p-4 text-on-velvet/70 font-mono break-words text-2xs uppercase tracking-wider">
                    {row.key}
                  </span>
                  <span className="p-2 sm:p-4 text-xs sm:text-sm leading-snug break-words hyphens-auto">{row.claude}</span>
                  <span className="p-2 sm:p-4 text-xs sm:text-sm leading-snug break-words hyphens-auto">{row.cursor}</span>
                  <span className="p-2 sm:p-4 text-xs sm:text-sm leading-snug break-words hyphens-auto">{row.codex}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature 2: Benchmark — stage black, the "instrument panel" look (fixed in both themes) ── */}
      <section
        className="mt-6 sm:mt-8 rounded-2xl border border-white/10 bg-stage text-[var(--art-text)] p-6 sm:p-8 lg:p-10"
        aria-labelledby="g2-title"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="order-2 lg:order-1">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-white/10">
                <span className="inline-flex items-center gap-1.5 rounded-pill border border-[var(--art-tools)]/55 text-[var(--art-tools)] px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wider">
                  <CheckIcon size={12} />
                  <span>{lang === 'uk' ? 'Протокол v1 зафіксовано' : 'Protocol v1 frozen'}</span>
                </span>
                <span className="text-[var(--art-neutral)] font-mono text-2xs">
                  10 dimensions · 0–50 max
                </span>
              </div>
              <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2 list-none p-0 m-0">
                {benchDimensions.map((dim) => (
                  <li
                    key={dim.id}
                    className="flex items-center gap-2 p-2 rounded-md bg-white/[0.04] text-xs border border-white/[0.06]"
                  >
                    <span className="shrink-0 font-mono text-2xs text-[var(--art-tutorials)] font-semibold">
                      {dim.id}
                    </span>
                    <span className="truncate">{lang === 'uk' ? dim.uk : dim.en}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 pt-3 border-t border-white/10 text-xs text-[var(--art-neutral)] m-0">
                {lang === 'uk'
                  ? 'Реальні логи прогонів та профіль вимірів — у гайді. Жодних демонстраційних оцінок.'
                  : 'Real run logs and dimension profiles live in the guide. No illustrative estimates.'}
              </p>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <span className="inline-flex items-center rounded-pill border border-white/20 px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider text-[var(--art-neutral)] mb-3">
              {lang === 'uk' ? 'Бенчмарк' : 'Benchmark'}
            </span>
            <h2 id="g2-title" className="font-serif text-2xl sm:text-3xl font-bold mb-3 leading-snug">
              <Link
                href={`/${lang}/guides/${bench.slug}`}
                className="hover:underline underline-offset-4 decoration-1"
              >
                {bench.title[lang]}
              </Link>
            </h2>
            <p className="text-[var(--art-neutral)] text-base leading-relaxed mb-4">
              {bench.description[lang]}
            </p>
            <p className="flex items-start gap-2 font-medium text-sm mb-4">
              <CheckIcon size={16} className="text-[var(--art-tools)] mt-0.5 shrink-0" />
              <span>{bench.outcome[lang]}</span>
            </p>
            <GuideMeta
              guide={bench}
              lang={lang}
              verifiedLabel={t.lastVerifiedLabel}
              dateFmt={dateFmt}
              className="text-[var(--art-neutral)]"
            />
            <Link
              href={`/${lang}/guides/${bench.slug}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[var(--art-text)] text-[var(--art-stage)] px-5 py-2.5 font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <span>{lang === 'uk' ? 'Переглянути бенчмарк' : 'See the benchmark'}</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Start from your job: four doors, four hues ── */}
      <section className="mt-14 sm:mt-20" aria-labelledby="jobs-title">
        <p className={EYEBROW}>{lang === 'uk' ? 'Навігація' : 'Navigate'}</p>
        <h2 id="jobs-title" className="font-serif text-2xl sm:text-3xl font-bold text-text mb-6">
          {lang === 'uk' ? 'Почніть зі своєї задачі.' : 'Start from your job.'}
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0 m-0">
          {jobCards.map((card) => (
            <li key={card.href + card.title}>
              <Link
                href={card.href}
                style={{ '--hue': card.hue } as CSSProperties}
                className="group relative flex flex-col justify-between h-full overflow-hidden rounded-xl border border-line bg-surface p-5 pt-6 text-text transition-all hover:border-[var(--hue)] motion-safe:hover:-translate-y-0.5 min-h-[44px]"
              >
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-[var(--hue)]" />
                <div>
                  <div className="w-12 h-12 rounded-lg bg-[color-mix(in_srgb,var(--hue)_16%,transparent)] text-[var(--hue)] grid place-items-center mb-4">
                    <card.Icon size={24} />
                  </div>
                  <strong className="block font-serif text-lg font-semibold text-text mb-2">
                    {card.title}
                  </strong>
                  <p className="text-sm text-muted m-0 leading-relaxed">{card.description}</p>
                </div>
                <div className="mt-4 pt-3 flex items-center text-[var(--hue)] text-sm font-medium">
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Verification cycle: a timeline on a recessed panel, not four more cards ── */}
      <section
        className="mt-14 sm:mt-20 rounded-2xl border border-line-soft bg-bg-deep p-6 sm:p-8 lg:p-10"
        aria-labelledby="cycle-title"
      >
        <p className={EYEBROW}>{lang === 'uk' ? 'Методологія' : 'Method'}</p>
        <h2 id="cycle-title" className="font-serif text-2xl sm:text-3xl font-bold text-text mb-8">
          {lang === 'uk' ? 'Як гайд лишається актуальним.' : 'How a guide stays true.'}
        </h2>
        <ol className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:gap-6 list-none p-0 m-0">
          {cycleSteps.map((c) => (
            <li key={c.step} className="group relative pl-8 lg:pl-0 lg:pt-8">
              <span
                aria-hidden="true"
                className="absolute left-0 top-1.5 lg:top-0 size-4 rounded-full border-2 border-accent bg-bg-deep"
              />
              <span
                aria-hidden="true"
                className="absolute left-[7px] top-6 -bottom-8 w-px bg-line group-last:hidden lg:hidden"
              />
              <span
                aria-hidden="true"
                className="hidden lg:block absolute left-6 -right-6 top-[7px] h-px bg-line group-last:hidden"
              />
              <span className="font-serif italic text-3xl leading-none text-accent">{c.step}</span>
              <strong className="mt-2 block font-serif text-xl font-normal text-text">{c.title}</strong>
              <span className="mt-1 block text-sm text-muted leading-relaxed">{c.desc}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── All guides table ── */}
      <section className="mt-14 sm:mt-20" aria-labelledby="all-guides-title">
        <p className={EYEBROW}>{lang === 'uk' ? 'Каталог' : 'Catalog'}</p>
        <h2 id="all-guides-title" className="font-serif text-2xl sm:text-3xl font-bold text-text mb-6">
          {lang === 'uk' ? 'Усі гайди' : 'All guides'}
        </h2>
        <div
          className="overflow-x-auto rounded-xl border border-line bg-surface"
          role="region"
          aria-labelledby="all-guides-title"
          tabIndex={0}
        >
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-raised">
                <th scope="col" className="p-4 font-semibold text-muted text-xs uppercase tracking-wider">
                  {lang === 'uk' ? 'Гайд' : 'Guide'}
                </th>
                <th scope="col" className="p-4 font-semibold text-muted text-xs uppercase tracking-wider">
                  {lang === 'uk' ? 'Формат' : 'Format'}
                </th>
                <th scope="col" className="p-4 font-semibold text-muted text-xs uppercase tracking-wider">
                  {lang === 'uk' ? 'Читання' : 'Reading'}
                </th>
                <th scope="col" className="p-4 font-semibold text-muted text-xs uppercase tracking-wider">
                  {lang === 'uk' ? 'Перевірено' : 'Last verified'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {GUIDES.map((g) => (
                <tr key={g.slug} className="hover:bg-raised/50 transition-colors">
                  <th scope="row" className="p-4 font-normal">
                    <Link
                      href={`/${lang}/guides/${g.slug}`}
                      className="inline-flex min-h-[44px] items-center font-semibold text-text hover:text-accent transition-colors"
                    >
                      {g.title[lang]}
                    </Link>
                  </th>
                  <td className="p-4 text-muted">{g.level[lang]}</td>
                  <td className="p-4 text-muted">
                    {g.read} {lang === 'uk' ? 'хв' : 'min'}
                  </td>
                  <td className="p-4 text-muted">
                    <time dateTime={g.lastVerified}>
                      {dateFmt.format(new Date(`${g.lastVerified}T00:00:00`))}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-muted">
          {lang === 'uk' ? 'Бракує рішення, з яким ви стикаєтесь?' : 'Missing a decision you face?'}{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
              lang === 'uk' ? 'Запит на гайд' : 'Guide request',
            )}`}
            className="text-accent font-semibold underline underline-offset-4 hover:opacity-90 inline-flex min-h-[44px] items-center"
          >
            {lang === 'uk' ? 'Запропонуйте гайд' : 'Suggest a guide'}
          </a>
        </p>
      </section>

      {/* The bare `band` form had no heading or surface and vanished into the page. */}
      <div className="mt-8 sm:mt-12">
        <NewsletterBand lang={lang} embedded placement="guides-page" />
      </div>
    </div>
  );
}
