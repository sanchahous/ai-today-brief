import Link from 'next/link';
import type { Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import { SleeveArt } from './sleeve-art';

export interface DigestCardProps {
  lang: Lang;
  id: string;
  href: string;
  type: 'daily' | 'weekly';
  date: string; // ISO date
  isToday?: boolean; // Avoid "today" word if there is no new release
  
  // Daily specific
  itemCount?: number;
  minutes?: number;
  
  // Weekly specific
  issueNumber?: number;
  period?: string;
  thesis?: string;
  imageUrl?: string | null;
}

export function DigestCard({
  lang,
  id,
  href,
  type,
  date,
  isToday,
  itemCount,
  minutes,
  issueNumber,
  period,
  thesis,
  imageUrl,
}: DigestCardProps) {
  const t = getStrings(lang);
  const formatter = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const dateStr = formatter.format(new Date(`${date}T00:00:00`));

  if (type === 'daily') {
    const title = isToday 
      ? t.todaysBrief 
      : `${lang === 'uk' ? 'Бриф за' : 'Brief for'} ${dateStr}`;
      
    return (
      <Link href={href} className="group flex flex-col rounded-xl border border-line bg-surface p-5 transition-colors hover:border-accent">
        <h3 className="mb-2 font-serif text-lg font-semibold text-text group-hover:text-accent transition-colors">
          {title}
        </h3>
        <div className="mt-auto flex items-center gap-2 text-xs text-muted font-medium">
          <time dateTime={date}>{dateStr}</time>
          {itemCount && (
            <>
              <span aria-hidden>·</span>
              <span>{itemCount} {lang === 'uk' ? 'матеріалів' : 'items'}</span>
            </>
          )}
          {minutes && (
            <>
              <span aria-hidden>·</span>
              <span>{minutes} {t.news.readMin}</span>
            </>
          )}
        </div>
      </Link>
    );
  }

  // Weekly
  return (
    <Link href={href} className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-accent">
      <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-line">
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <SleeveArt seed={id} />
        )}
        <div className="absolute left-3 top-3 rounded bg-bg/90 px-2 py-1 text-xs font-semibold backdrop-blur">
          {lang === 'uk' ? 'Тижневик' : 'Weekly'} {issueNumber ? `#${issueNumber}` : ''}
        </div>
      </div>
      <div className="flex flex-col p-5">
        <div className="mb-1 text-xs font-medium text-accent">
          {period || <time dateTime={date}>{dateStr}</time>}
        </div>
        <h3 className="font-serif text-lg font-semibold text-text group-hover:text-accent transition-colors line-clamp-2">
          {thesis}
        </h3>
      </div>
    </Link>
  );
}
