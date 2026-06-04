import Link from 'next/link';
import { CategoryBadge } from '@/components/home/category-badge';
import { ArrowRight } from '@/components/icons';
import type { HomeItem } from '@/lib/home';
import { Reveal } from '@/components/reveal';

export function SubscribeSampleList({
  title,
  lead,
  items,
}: {
  title: string;
  lead: string;
  items: HomeItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="mx-auto mt-14 max-w-[760px]">
      <Reveal>
        <h2 className="text-[clamp(1.35rem,3.2vw,1.9rem)]">{title}</h2>
        <p className="text-muted mt-2 mb-6">{lead}</p>
      </Reveal>
      <ul className="grid list-none gap-3 p-0">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="rounded-card border-border bg-surface hover:border-accent/40 flex items-center gap-3 border px-4 py-3.5 transition-colors"
            >
              {item.categoryName ? (
                <CategoryBadge name={item.categoryName} color={item.categoryColor} />
              ) : null}
              <span className="font-serif text-text min-w-0 flex-1 text-base font-semibold">
                {item.title}
              </span>
              <ArrowRight size={16} className="text-faint shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
