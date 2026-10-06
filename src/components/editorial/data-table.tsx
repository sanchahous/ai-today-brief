import type { ReactNode } from 'react';
import type { Lang } from '@/lib/site';

export function DataTable({
  title,
  children,
  caption,
}: {
  title: string;
  children: ReactNode;
  caption?: string;
}) {
  return (
    <figure className="my-8">
      <div 
        role="region" 
        aria-label={title}
        tabIndex={0}
        className="w-full overflow-x-auto rounded-xl border border-line"
      >
        <table className="w-full min-w-[500px] border-collapse text-left text-sm">
          {children}
        </table>
      </div>
      {caption && (
        <figcaption className="mt-2 text-sm text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
