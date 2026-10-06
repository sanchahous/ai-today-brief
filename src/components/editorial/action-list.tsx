import type { Lang } from '@/lib/site';

export interface ActionItem {
  id: string;
  title: string;
  description?: string;
  href?: string;
}

export function ActionList({ lang, title, items }: { lang: Lang; title?: string; items: ActionItem[] }) {
  const heading = title || (lang === 'uk' ? 'Що зробити сьогодні' : 'Action items today');
  
  return (
    <div className="my-8">
      <h3 className="mb-4 font-serif text-xl font-semibold">{heading}</h3>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.id} className="group flex items-start gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line">
              {/* Checkbox visual placeholder */}
            </div>
            <div className="flex-1 mt-0.5">
              <div className="font-medium text-text">
                {item.href ? (
                  <a href={item.href} className="text-text hover:text-accent underline decoration-[color:var(--line)] underline-offset-2 hover:decoration-current transition-colors inline-flex items-center min-h-[var(--touch-target-min)] -mx-2 px-2 -my-2 py-2">
                    {item.title}
                  </a>
                ) : (
                  item.title
                )}
              </div>
              {item.description && (
                <div className="mt-1 text-sm text-muted">
                  {item.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
