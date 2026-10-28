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
  
  const parseDate = (d: string) => new Date(d.includes('T') ? d : `${d}T00:00:00`);
  const pubDate = formatter.format(parseDate(publishedAt));
  const updDate = updatedAt ? formatter.format(parseDate(updatedAt)) : null;

  return (
    <p className="text-muted m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem] leading-normal">
      <Link 
        href={`/${lang}/author`} 
        className="hover:opacity-80 transition-opacity inline-flex shrink-0 items-center justify-center" 
        // Decorative twin of the name link below: the initials are not part of any accessible
        // name (axe label-content-name-mismatch), so keep it out of the a11y tree and tab order.
        aria-hidden
        tabIndex={-1}
      >
        <span
          aria-hidden
          className="bg-accent-fill text-on-accent grid h-7 w-7 place-items-center rounded-full text-2xs font-bold"
        >
          {initials}
        </span>
      </Link>
      <span className="inline-flex items-center">
        <Link
          href={`/${lang}/author`}
          className="text-text hover:text-accent font-semibold no-underline transition-colors"
        >
          {authorName}
        </Link>
        <span>, {role}</span>
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
    </p>
  );
}
