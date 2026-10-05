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
import { NewsletterForm } from '@/components/ui/newsletter-form';
import { socialMeta } from '@/lib/seo';

export const revalidate = 86400;

type Params = { lang: string };

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

  const jobCards = [
    {
      Icon: CompassIcon,
      title: lang === 'uk' ? 'Обрати агента для коду' : 'Choose a coding agent',
      description:
        lang === 'uk'
          ? 'Структурні ставки, командний фіт і чекліст «обирайте, якщо».'
          : 'Structural bets, team fit and a “choose this if” checklist.',
      href: `/${lang}/guides/${comparison.slug}`,
    },
    {
      Icon: EyeIcon,
      title: lang === 'uk' ? 'Оцінити новий реліз' : 'Evaluate a new release',
      description:
        lang === 'uk'
          ? 'Читайте результат за умовами: епік, харнес, повтори, рев’ю.'
          : 'Read a result by its conditions: epic, harness, retries, review.',
      href: `/${lang}/guides/${bench.slug}`,
    },
    {
      Icon: BoltIcon,
      title: lang === 'uk' ? 'Скоротити витрати агента' : 'Cut agent spend',
      description:
        lang === 'uk'
          ? 'Технічний гайд про межі кешу, контекстні вікна й токени.'
          : 'A field guide to cache boundaries and what to measure.',
      href: `/${lang}/category/optimization`,
    },
    {
      Icon: ShieldIcon,
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

  return (
    <div className="mx-auto w-full max-w-[1200px] flex-1 px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <HubViewTracker hubType="guides" slug="guides" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Library Hero ── */}
      <header className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-8 lg:gap-12 items-end pb-12 sm:pb-16 border-b border-line">
        <div>
          <div className="text-2xs font-semibold uppercase tracking-wider text-accent mb-3">
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

        <ul className="grid gap-3 list-none p-0 m-0">
          <li className="flex gap-4 p-4 rounded-lg border border-line bg-surface">
            <CalendarIcon className="text-accent mt-0.5 shrink-0" size={20} />
            <span className="grid gap-0.5 text-sm text-muted">
              <strong className="text-text font-semibold">
                {lang === 'uk' ? 'Перевірка за розкладом' : 'Re-verified on a schedule'}
              </strong>
              <span>
                {lang === 'uk'
                  ? 'дата на кожному гайді — сигнал довіри'
                  : 'the date on every guide is the trust signal'}
              </span>
            </span>
          </li>
          <li className="flex gap-4 p-4 rounded-lg border border-line bg-surface">
            <LayersIcon className="text-accent mt-0.5 shrink-0" size={20} />
            <span className="grid gap-0.5 text-sm text-muted">
              <strong className="text-text font-semibold">
                {lang === 'uk' ? 'Лише структурні твердження' : 'Structural claims only'}
              </strong>
              <span>
                {lang === 'uk'
                  ? 'без цін і версій, якщо не перевірено щойно'
                  : 'no prices or versions unless freshly checked'}
              </span>
            </span>
          </li>
          <li className="flex gap-4 p-4 rounded-lg border border-line bg-surface">
            <FileTextIcon className="text-accent mt-0.5 shrink-0" size={20} />
            <span className="grid gap-0.5 text-sm text-muted">
              <strong className="text-text font-semibold">
                {lang === 'uk' ? 'Changelog на кожній сторінці' : 'A changelog on every page'}
              </strong>
              <span>
                {lang === 'uk' ? 'щоб бачити, що змінилося' : 'so you see what moved'}
              </span>
            </span>
          </li>
        </ul>
      </header>

      {/* ── Feature Block 1: Comparison ── */}
      <section
        className="mt-12 sm:mt-16 rounded-2xl border border-line bg-surface p-6 sm:p-8 lg:p-10 shadow-sm"
        aria-labelledby="g1-title"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <span className="inline-flex items-center rounded-pill border border-line bg-surface px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider text-muted mb-3">
              {lang === 'uk' ? 'Порівняння' : 'Comparison'}
            </span>
            <h2 id="g1-title" className="font-serif text-2xl sm:text-3xl font-bold text-text mb-3 leading-snug">
              <Link
                href={`/${lang}/guides/${comparison.slug}`}
                className="hover:text-accent transition-colors"
              >
                {comparison.title[lang]}
              </Link>
            </h2>
            <p className="text-muted text-base leading-relaxed mb-4">
              {comparison.description[lang]}
            </p>
            <p className="flex items-start gap-2 text-text font-medium text-sm mb-4">
              <CheckIcon size={16} className="text-signal mt-0.5 shrink-0" />
              <span>{comparison.outcome[lang]}</span>
            </p>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-faint list-none p-0 mb-6">
              <li>{comparison.level[lang]}</li>
              <li className="inline-flex items-center gap-1.5">
                <ClockIcon size={14} />
                <span>
                  {comparison.read} {lang === 'uk' ? 'хв' : 'min'}
                </span>
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CheckIcon size={14} />
                <span>
                  {t.lastVerifiedLabel}{' '}
                  <time dateTime={comparison.lastVerified}>
                    {dateFmt.format(new Date(`${comparison.lastVerified}T00:00:00`))}
                  </time>
                </span>
              </li>
              <li>
                {comparison.sections} {lang === 'uk' ? 'розділів' : 'sections'}
              </li>
            </ul>
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
              className="overflow-hidden rounded-xl border border-line bg-surface"
              role="img"
              aria-label={
                lang === 'uk' ? 'Прев’ю матриці порівняння' : 'Preview of the comparison matrix'
              }
            >
              <div className="grid grid-cols-[minmax(88px,0.9fr)_repeat(3,minmax(0,1fr))] border-b border-line bg-surface p-3 sm:p-4 text-accent font-serif text-sm sm:text-base font-bold">
                <span />
                <span>Claude Code</span>
                <span>Cursor</span>
                <span>Codex</span>
              </div>
              {comparisonRows.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[minmax(88px,0.9fr)_repeat(3,minmax(0,1fr))] border-b border-line last:border-b-0"
                >
                  <span className="p-3 sm:p-4 text-faint font-mono text-2xs uppercase tracking-wider">
                    {row.key}
                  </span>
                  <span className="p-3 sm:p-4 text-text text-xs sm:text-sm leading-snug">
                    {row.claude}
                  </span>
                  <span className="p-3 sm:p-4 text-text text-xs sm:text-sm leading-snug">
                    {row.cursor}
                  </span>
                  <span className="p-3 sm:p-4 text-text text-xs sm:text-sm leading-snug">
                    {row.codex}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Block 2: Benchmark (is-alt) ── */}
      <section
        className="mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-8 lg:p-10 shadow-sm"
        aria-labelledby="g2-title"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="order-2 lg:order-1">
            <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-line">
                <span className="inline-flex items-center gap-1.5 rounded-pill border border-signal/55 bg-surface text-signal px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wider">
                  <CheckIcon size={12} className="text-signal" />
                  <span>{lang === 'uk' ? 'Протокол v1 зафіксовано' : 'Protocol v1 frozen'}</span>
                </span>
                <span className="text-faint font-mono text-2xs">10 dimensions · 0–50 max</span>
              </div>
              <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2 list-none p-0 m-0">
                {benchDimensions.map((dim) => (
                  <li
                    key={dim.id}
                    className="flex items-center gap-2 p-2 rounded-md bg-surface text-xs text-text border border-line/50"
                  >
                    <span className="font-mono text-2xs text-accent font-semibold">{dim.id}</span>
                    <span className="truncate">{lang === 'uk' ? dim.uk : dim.en}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 pt-3 border-t border-line text-xs text-faint m-0">
                {lang === 'uk'
                  ? 'Реальні логи прогонів та профіль вимірів — у гайді. Жодних демонстраційних оцінок.'
                  : 'Real run logs and dimension profiles live in the guide. No illustrative estimates.'}
              </p>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <span className="inline-flex items-center rounded-pill border border-line bg-surface px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider text-muted mb-3">
              {lang === 'uk' ? 'Бенчмарк' : 'Benchmark'}
            </span>
            <h2 id="g2-title" className="font-serif text-2xl sm:text-3xl font-bold text-text mb-3 leading-snug">
              <Link
                href={`/${lang}/guides/${bench.slug}`}
                className="hover:text-accent transition-colors"
              >
                {bench.title[lang]}
              </Link>
            </h2>
            <p className="text-muted text-base leading-relaxed mb-4">
              {bench.description[lang]}
            </p>
            <p className="flex items-start gap-2 text-text font-medium text-sm mb-4">
              <CheckIcon size={16} className="text-signal mt-0.5 shrink-0" />
              <span>{bench.outcome[lang]}</span>
            </p>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-faint list-none p-0 mb-6">
              <li>{bench.level[lang]}</li>
              <li className="inline-flex items-center gap-1.5">
                <ClockIcon size={14} />
                <span>
                  {bench.read} {lang === 'uk' ? 'хв' : 'min'}
                </span>
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CheckIcon size={14} />
                <span>
                  {t.lastVerifiedLabel}{' '}
                  <time dateTime={bench.lastVerified}>
                    {dateFmt.format(new Date(`${bench.lastVerified}T00:00:00`))}
                  </time>
                </span>
              </li>
              <li>
                {bench.sections} {lang === 'uk' ? 'розділів' : 'sections'}
              </li>
            </ul>
            <Link
              href={`/${lang}/guides/${bench.slug}`}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-line bg-surface px-5 py-2.5 font-semibold text-sm text-text hover:border-accent hover:text-accent transition-colors"
            >
              <span>{lang === 'uk' ? 'Переглянути бенчмарк' : 'See the benchmark'}</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Start from your job ── */}
      <section className="mt-14 sm:mt-20" aria-labelledby="jobs-title">
        <h2 id="jobs-title" className="font-serif text-2xl sm:text-3xl font-bold text-text mb-6">
          {lang === 'uk' ? 'Почніть зі своєї задачі.' : 'Start from your job.'}
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0 m-0">
          {jobCards.map((card, idx) => (
            <li key={idx}>
              <Link
                href={card.href}
                className="group flex flex-col justify-between h-full rounded-xl border border-line bg-surface p-5 text-text hover:border-accent hover:shadow-sm transition-all min-h-[44px]"
              >
                <div>
                  <div className="w-12 h-12 rounded-lg bg-accent/10 text-accent grid place-items-center mb-4 group-hover:scale-105 transition-transform">
                    <card.Icon size={24} />
                  </div>
                  <strong className="block font-serif text-lg font-semibold text-text mb-2 group-hover:text-accent transition-colors">
                    {card.title}
                  </strong>
                  <p className="text-sm text-muted m-0 leading-relaxed">
                    {card.description}
                  </p>
                </div>
                <div className="mt-4 pt-3 flex items-center text-accent text-sm font-medium">
                  <span className="sr-only">{card.title}</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Verification cycle ── */}
      <section className="mt-14 sm:mt-20" aria-labelledby="cycle-title">
        <h2 id="cycle-title" className="font-serif text-2xl sm:text-3xl font-bold text-text mb-6">
          {lang === 'uk' ? 'Як гайд лишається актуальним.' : 'How a guide stays true.'}
        </h2>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 list-none p-0 m-0">
          {cycleSteps.map((c) => (
            <li
              key={c.step}
              className="flex flex-col gap-2 p-5 rounded-xl border border-line bg-surface"
            >
              <span className="font-mono text-2xs text-accent font-semibold">{c.step}</span>
              <strong className="font-serif text-xl font-normal text-text">{c.title}</strong>
              <span className="text-sm text-muted leading-relaxed">{c.desc}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── All guides table ── */}
      <section className="mt-14 sm:mt-20" aria-labelledby="all-guides-title">
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
            <tbody className="divide-y divide-border">
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

      {/* ── Newsletter Band ── */}
      <div className="mt-14 sm:mt-20">
        <NewsletterForm lang={lang} variant="band" placement="guides-page" />
      </div>
    </div>
  );
}
