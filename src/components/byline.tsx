import Link from 'next/link';
import { EDITOR_NAME, type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';

export function Byline({ lang, updated }: { lang: Lang; updated: string }) {
  const t = getStrings(lang).news;
  const date = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${updated}T00:00:00`));

  return (
    <div className="text-muted flex flex-wrap items-center gap-2 text-[0.82rem]">
      <span
        aria-hidden
        className="bg-accent-fill text-on-accent grid h-7 w-7 place-items-center rounded-full text-2xs font-bold"
      >
        OK
      </span>
      <span>
        {t.curatedBy}{' '}
        <Link
          href={`/${lang}/author`}
          className="text-text hover:text-accent inline-flex min-h-[var(--touch-target-min)] items-center align-middle font-semibold no-underline transition-colors"
        >
          {EDITOR_NAME}
        </Link>
        , {t.bylineRole}
      </span>
      <span aria-hidden className="text-faint">
        ·
      </span>
      <span>
        {lang === 'uk' ? 'Оновлено' : 'Updated'} {date}
      </span>
      <span aria-hidden className="text-faint">
        ·
      </span>
      <span>{t.sourcesCited}</span>
    </div>
  );
}
