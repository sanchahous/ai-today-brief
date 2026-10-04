import type { ReactNode } from 'react';
import type { Lang } from '@/lib/site';

export function EditorialHero({
  eyebrow,
  title,
  dek,
  meta,
  cta,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  dek?: ReactNode;
  meta?: ReactNode;
  cta?: ReactNode;
}) {
  return (
    <header className="mx-auto max-w-[800px] px-4 py-12 text-center sm:px-6 md:py-16 lg:px-8">
      {eyebrow && (
        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-accent">
          {eyebrow}
        </div>
      )}
      
      <h1 className="mb-6 font-serif text-3xl font-bold tracking-tight text-text sm:text-4xl md:text-5xl lg:text-6xl text-balance">
        {title}
      </h1>
      
      {dek && (
        <div className="mx-auto mb-8 max-w-[600px] text-lg text-muted sm:text-xl text-balance">
          {dek}
        </div>
      )}
      
      {meta && (
        <div className="mb-8 flex flex-wrap items-center justify-center gap-3 text-sm text-muted">
          {meta}
        </div>
      )}
      
      {cta && (
        <div className="flex justify-center">
          {cta}
        </div>
      )}
    </header>
  );
}
