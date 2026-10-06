import Link from 'next/link';
import { CategoryBadge } from '@/components/ui/category-badge';
import { ArrowRight } from '@/components/icons';
import type { SubscribeSampleItem } from '@/lib/subscribe-page';

export interface SubscribeSampleListProps {
  kicker?: string;
  title: string;
  lead?: string;
  items: SubscribeSampleItem[];
  readHref?: string;
  readLabel?: string;
}

export function SubscribeSampleList({
  kicker,
  title,
  items,
  readHref = '/digests',
  readLabel = 'Read it on the web',
}: SubscribeSampleListProps) {
  if (items.length === 0) return null;

  return (
    <aside
      className="sample-issue rounded-card border-line bg-raised border p-6 shadow-sm lg:sticky lg:top-24 lg:rotate-[1.2deg] transition-transform"
      aria-labelledby="sample-title"
    >
      <p className="sample-kicker font-mono text-2xs uppercase tracking-wider text-accent font-semibold">
        {kicker || 'A sample issue'}
      </p>
      <h2 id="sample-title" className="font-serif text-2xl font-bold mt-2 mb-4 text-text">
        {title}
      </h2>
      <ol className="grid gap-3 mb-5 list-none p-0">
        {items.map((item, i) => (
          <li
            key={item.id}
            className="grid grid-cols-[30px_minmax(0,1fr)] gap-2 pt-3 border-t border-line"
          >
            <span className="font-mono text-xs text-accent">0{i + 1}</span>
            <div>
              {item.categoryName ? (
                <div className="mb-1">
                  <CategoryBadge
                    slug={item.categorySlug}
                    name={item.categoryName}
                    color={item.categoryColor}
                  />
                </div>
              ) : null}
              <p className="text-sm font-medium text-text leading-snug">
                {item.title}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <Link
        href={readHref}
        className="text-accent hover:underline inline-flex items-center gap-1.5 text-sm font-semibold"
      >
        <span>{readLabel}</span>
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </aside>
  );
}
