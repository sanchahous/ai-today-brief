import type { Lang } from '@/lib/site';

const COPY = {
  en: {
    title: 'Which edition fits your week?',
    attribute: 'Attribute',
    dailyHead: 'Daily brief',
    weeklyHead: 'Weekly edition',
    rows: [
      ['Cadence', 'Published on days with a curated brief', 'Published when the weekly edition ships'],
      ['Reading time', 'Short edit — a few minutes', 'Long read — deeper context across the week'],
      [
        'What’s inside',
        'Selected stories, why each matters, one thing to try',
        'Through-line, action board, chapters, metrics, FAQ',
      ],
      ['Formats', 'Web · email', 'Web · PDF · video briefing'],
      ['Best for', 'Staying current before stand-up', 'Deciding what to try next week'],
    ],
  },
  uk: {
    title: 'Який формат пасує вашому тижню?',
    attribute: 'Параметр',
    dailyHead: 'Щоденний бриф',
    weeklyHead: 'Тижневий випуск',
    rows: [
      ['Частота', 'У дні з опублікованим брифом', 'Коли виходить тижневий випуск'],
      ['Час читання', 'Короткий випуск — кілька хвилин', 'Long read — глибший контекст тижня'],
      [
        'Що всередині',
        'Відібрані історії, чому кожна важлива, одна річ для практики',
        'Спільна думка, action board, розділи, метрики, FAQ',
      ],
      ['Формати', 'Сайт · email', 'Сайт · PDF · відеобрифінг'],
      ['Найкраще для', 'Бути в курсі до stand-up', 'Вирішити, що спробувати наступного тижня'],
    ],
  },
} as const;

export function FormatCompareTable({ lang, titleId }: { lang: Lang; titleId: string }) {
  const t = COPY[lang];
  return (
    <section className="mt-16" aria-labelledby={titleId}>
      <h2 id={titleId} className="font-serif text-2xl font-semibold sm:text-3xl">
        {t.title}
      </h2>
      <div
        className="border-line mt-6 overflow-x-auto rounded-card border"
        role="region"
        aria-labelledby={titleId}
        tabIndex={0}
      >
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-line border-b">
              <th scope="col" className="sr-only">{t.attribute}</th>
              <th scope="col" className="px-4 py-3 font-semibold">{t.dailyHead}</th>
              <th scope="col" className="px-4 py-3 font-semibold">{t.weeklyHead}</th>
            </tr>
          </thead>
          <tbody>
            {t.rows.map(([label, daily, weekly]) => (
              <tr key={label} className="border-line border-b last:border-b-0">
                <th scope="row" className="text-muted px-4 py-3 align-top font-medium whitespace-nowrap">
                  {label}
                </th>
                <td className="px-4 py-3 align-top" data-label={t.dailyHead}>{daily}</td>
                <td className="px-4 py-3 align-top" data-label={t.weeklyHead}>{weekly}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
