import type { Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';
import type { StoryCardItem } from './story-card';
import Link from 'next/link';

export function RelatedContent({
  lang,
  related,
  prev,
  next,
}: {
  lang: Lang;
  related: StoryCardItem[];
  prev?: { title: string; href: string };
  next?: { title: string; href: string };
}) {
  const t = getStrings(lang).news;

  return (
    <div className="my-10 border-t border-border pt-8">
      {related.length > 0 && (
        <div className="mb-10">
          <h3 className="mb-6 font-serif text-xl font-semibold">
            {lang === 'uk' ? 'Схожі матеріали' : 'Related coverage'}
          </h3>
          <div className="flex flex-col gap-4">
            {related.map((item, idx) => (
              // Using existing StoryRow which displays horizontally
              <div key={item.id}>
                 <Link href={item.href} className="group flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent">
                    {item.imageUrl && (
                      <div className="relative h-20 w-full sm:w-24 shrink-0 overflow-hidden rounded-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-accent mb-1">{item.categoryName}</div>
                      <h4 className="font-semibold text-text group-hover:text-accent transition-colors">{item.title}</h4>
                    </div>
                 </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {(prev || next) && (
        <div className="flex flex-col sm:flex-row gap-4 border-t border-border pt-6">
          {prev && (
            <Link href={prev.href} className="flex-1 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent group">
              <div className="text-xs text-muted mb-1">{t.prev}</div>
              <div className="font-medium text-text group-hover:text-accent transition-colors">{prev.title}</div>
            </Link>
          )}
          {next && (
            <Link href={next.href} className="flex-1 rounded-xl border border-border bg-surface p-4 text-right transition-colors hover:border-accent group">
              <div className="text-xs text-muted mb-1">{t.next}</div>
              <div className="font-medium text-text group-hover:text-accent transition-colors">{next.title}</div>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
