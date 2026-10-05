import { getStrings } from '@/lib/i18n';
import { pluralLabel } from '@/lib/home-stats';
import type { HomeEdition } from '@/lib/home';
import type { Lang } from '@/lib/site';

function formatEditionDate(date: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Last published day, with its date. “Today” only when that day is today in Kyiv. */
export function HomeDateline({
  lang,
  edition,
  todayIso,
}: {
  lang: Lang;
  edition: HomeEdition | null;
  todayIso: string;
}) {
  if (!edition) return null;
  const t = getStrings(lang).landing;
  const label = edition.date === todayIso ? t.datelineToday : t.datelineLatest;

  return (
    <div className="border-line-soft mx-auto flex w-full max-w-[1160px] flex-wrap items-baseline justify-between gap-3 border-b px-6 py-4">
      <p className="text-muted text-sm">
        <strong className="text-text">{label}</strong>
        <span aria-hidden> · </span>
        <time dateTime={edition.date}>{formatEditionDate(edition.date, lang)}</time>
      </p>
      {edition.readMinutes > 0 ? (
        <p className="text-muted text-sm">
          {edition.readMinutes} {pluralLabel(edition.readMinutes, lang, 'minutes')}
        </p>
      ) : null}
    </div>
  );
}
