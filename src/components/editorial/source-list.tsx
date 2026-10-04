import type { Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';

export interface SourceItem {
  id: string;
  author: string;
  title: string;
  url: string;
  date: string;
}

export function SourceList({ lang, sources }: { lang: Lang; sources: SourceItem[] }) {
  const t = getStrings(lang);
  
  const formatter = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="border-border bg-surface rounded-xl border p-4 sm:p-6">
      <h3 className="mb-4 font-serif text-lg font-semibold">{t.news.sourcesCited || (lang === 'uk' ? 'Джерела' : 'Sources')}</h3>
      <ul className="space-y-4">
        {sources.map((source) => {
          const pubDate = formatter.format(new Date(`${source.date}T00:00:00`));
          const hostname = new URL(source.url).hostname.replace(/^www\./, '');
          
          return (
            <li key={source.id} className="text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
                <span className="font-semibold text-text">{source.author}</span>
                <span className="hidden text-faint sm:inline">·</span>
                <time dateTime={source.date} className="text-muted text-xs sm:text-sm">{pubDate}</time>
              </div>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text hover:text-accent mt-1 block font-medium underline decoration-[color:var(--border)] underline-offset-2 hover:decoration-current transition-colors"
              >
                {source.title}
              </a>
              <div className="mt-1 text-xs text-muted truncate">
                {source.url}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
