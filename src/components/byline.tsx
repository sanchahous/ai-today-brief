import Link from 'next/link';
import { type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { AiDisclosureNote } from '@/components/ai-disclosure-note';

export function Byline({
  lang,
  initials,
  authorName,
  role,
  publishedAt,
  updatedAt,
  minutes,
  hasAiDisclosure = false,
}: {
  lang: Lang;
  initials: string;
  authorName: string;
  role: string;
  publishedAt: string;
  updatedAt?: string;
  minutes?: number;
  hasAiDisclosure?: boolean;
}) {
  const t = getStrings(lang).news;
  
  const formatter = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  
  const pubDate = formatter.format(new Date(`${publishedAt}T00:00:00`));
  const updDate = updatedAt ? formatter.format(new Date(`${updatedAt}T00:00:00`)) : null;

  return (
    <div className="text-muted flex flex-wrap items-center gap-2 text-[0.82rem]">
      <Link href={`/${lang}/author`} className="hover:opacity-80 transition-opacity" aria-label={`Author ${authorName}`}>
        <span
          aria-hidden
          className="bg-accent-fill text-on-accent grid h-7 w-7 place-items-center rounded-full text-2xs font-bold"
        >
          {initials}
        </span>
      </Link>
      <span>
        <Link
          href={`/${lang}/author`}
          className="text-text hover:text-accent inline-flex min-h-[var(--touch-target-min)] items-center align-middle font-semibold no-underline transition-colors"
        >
          {authorName}
        </Link>
        , {role}
      </span>
      
      <span aria-hidden className="text-faint">·</span>
      
      <span>
        {lang === 'uk' ? 'Опубліковано' : 'Published'} <time dateTime={publishedAt}>{pubDate}</time>
        {updDate && (
          <>
            {' / '}
            {lang === 'uk' ? 'оновлено' : 'updated'} <time dateTime={updatedAt}>{updDate}</time>
          </>
        )}
      </span>

      {minutes && (
        <>
          <span aria-hidden className="text-faint">·</span>
          <span>{minutes} {t.readMin}</span>
        </>
      )}

      {hasAiDisclosure && (
        <>
          <span aria-hidden className="text-faint">·</span>
          <AiDisclosureNote lang={lang} variant="inline" />
        </>
      )}
    </div>
  );
}
