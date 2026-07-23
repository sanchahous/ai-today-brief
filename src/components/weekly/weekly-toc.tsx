import type { Lang } from '@/lib/site';
import type { WeeklyDigestItemView } from '@/lib/digests';
import { WEEKLY_COPY } from './copy';

export function WeeklyToc({ items, lang }: { items: WeeklyDigestItemView[]; lang: Lang }) {
  const copy = WEEKLY_COPY[lang];
  return (
    <nav aria-label={copy.contents}>
      <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">{copy.contents}</p>
      <ol className="mt-4 grid gap-3">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#story-${item.rank}`}
              className="text-muted hover:text-accent grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 text-sm leading-5 no-underline transition-colors"
            >
              <span className="text-faint font-serif text-lg leading-5">{item.rank}</span>
              <span>{item.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
