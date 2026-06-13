import type { CSSProperties } from 'react';

/** Pure-CSS shimmer block — pair with `.skeleton` in globals.css. */
export function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <span className={`skeleton block ${className}`.trim()} style={style} aria-hidden />;
}

export function SearchPreviewSkeleton() {
  return (
    <div className="px-1 py-1 md:px-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-lg px-3 py-2.5 md:px-4 md:py-3">
          <Skeleton className="mb-2 h-4 w-28 rounded-md md:w-32" />
          <Skeleton className="mb-1.5 h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-[85%] rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function HeroStatsSkeleton() {
  return (
    <div className="mt-10 flex flex-wrap gap-8" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <Skeleton className="h-9 w-16 rounded-md" />
          <Skeleton className="mt-2 h-4 w-24 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function CategoryCardSkeleton() {
  return (
    <div className="rounded-card border-border bg-surface flex h-full flex-col overflow-hidden border" aria-hidden>
      <div className="flex items-center gap-3 p-4">
        <Skeleton className="h-11 w-11 shrink-0 rounded-[12px]" />
        <div className="min-w-0 flex-1">
          <Skeleton className="mb-2 h-5 w-[55%] rounded-md" />
          <Skeleton className="h-3.5 w-[40%] rounded-md" />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <Skeleton className="mb-3 h-3 w-[35%] rounded-md" />
        <Skeleton className="mb-2 h-3.5 w-[92%] rounded-md" />
        <Skeleton className="mb-2 h-3.5 w-[85%] rounded-md" />
        <Skeleton className="mb-6 h-3.5 w-[70%] rounded-md" />
        <Skeleton className="mt-auto h-9 w-32 rounded-pill" />
      </div>
    </div>
  );
}

export function PostCardSkeleton() {
  // Mirror the real PostCard structure (outer bordered card -> post-grid -> 92px thumb +
  // content) so hydration does not shift the layout.
  return (
    <div className="rounded-card border-border bg-surface border p-4" aria-hidden>
      <div className="post-grid">
        <Skeleton className="h-[92px] w-[92px] rounded-card" />
        <div>
          <Skeleton className="mb-3 h-5 w-28 rounded-pill" />
          <Skeleton className="mb-2 h-5 w-full rounded-md" />
          <Skeleton className="mb-2 h-5 w-[80%] rounded-md" />
          <Skeleton className="h-4 w-40 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div className="skeleton-reveal flex-1">
      <section className="border-border-soft border-b px-6 pt-[4.5rem] pb-14">
        <div className="mx-auto max-w-[1160px]">
          <Skeleton className="h-3 w-40 rounded-md" />
          <Skeleton className="mt-4 h-12 max-w-3xl rounded-md" />
          <Skeleton className="mt-3 h-12 max-w-2xl rounded-md sm:hidden" />
          <Skeleton className="mt-5 h-5 w-full max-w-2xl rounded-md" />
          <Skeleton className="mt-2 h-5 w-[90%] max-w-2xl rounded-md" />
          <div className="mt-7 flex gap-3">
            <Skeleton className="h-11 w-36 rounded-pill" />
            <Skeleton className="h-11 w-32 rounded-pill" />
          </div>
          <Skeleton className="mt-8 h-12 max-w-xl rounded-pill" />
          <HeroStatsSkeleton />
        </div>
      </section>
      <section className="mx-auto w-full max-w-[1160px] px-6 py-12">
        <Skeleton className="h-3 w-16 rounded-md" />
        <Skeleton className="mt-2 h-8 w-64 rounded-md" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full rounded-md" />
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CategoryCardSkeleton key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function NewsPageSkeleton() {
  return (
    <div className="skeleton-reveal mx-auto w-full max-w-[1160px] flex-1 px-6 py-10">
      <Skeleton className="mb-6 h-4 w-48 rounded-md" />
      <Skeleton className="h-9 w-64 rounded-md" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl rounded-md" />
      <div className="mt-10 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function CategoryPageSkeleton() {
  return (
    <div className="skeleton-reveal mx-auto w-full max-w-[1160px] flex-1 px-6 py-10">
      <Skeleton className="mb-6 h-4 w-56 rounded-md" />
      <Skeleton className="h-10 w-72 rounded-md" />
      <Skeleton className="mt-3 h-5 w-full max-w-lg rounded-md" />
      <div className="mt-10 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
