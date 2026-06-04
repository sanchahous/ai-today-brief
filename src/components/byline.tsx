import { EDITOR_NAME, MARK_COLOR, type Lang } from '@/lib/site';
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
        className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold text-black"
        style={{ background: MARK_COLOR }}
      >
        OK
      </span>
      <span>
        {t.curatedBy}{' '}
        <strong className="text-text font-semibold">{EDITOR_NAME}</strong>, {t.bylineRole}
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
