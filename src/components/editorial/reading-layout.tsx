import type { ReactNode } from 'react';

export function ReadingLayout({
  toc,
  content,
  tools,
}: {
  toc?: ReactNode;
  content: ReactNode;
  tools?: ReactNode;
}) {
  return (
    <div className="mx-auto min-w-0 max-w-[1200px] overflow-x-clip px-4 md:px-6 lg:px-8 xl:px-10">
      <div className="flex min-w-0 flex-col gap-8 overflow-x-clip lg:flex-row lg:items-start lg:gap-10">
        {toc && (
          <aside className="min-w-0 w-full lg:sticky lg:top-24 lg:w-[140px] lg:shrink-0 xl:w-[170px]">
            {toc}
          </aside>
        )}

        <div className="min-w-0 w-full overflow-x-clip lg:max-w-[680px] lg:flex-1">
          <div
            className="prose prose-neutral dark:prose-invert max-w-none min-w-0 overflow-x-clip text-base leading-relaxed sm:text-lg
              prose-p:max-w-[75ch] prose-ul:max-w-[75ch] prose-ol:max-w-[75ch]
              prose-headings:text-text prose-p:text-text prose-li:text-text
              prose-h2:mt-12 prose-h2:mb-4 prose-h2:text-3xl prose-h2:scroll-mt-[calc(var(--header-h,4rem)+2.5rem)]
              prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-2xl prose-h3:scroll-mt-[calc(var(--header-h,4rem)+2.5rem)]"
          >
            {content}
          </div>
        </div>

        {tools && (
          <aside className="hidden min-w-0 w-full lg:sticky lg:top-24 lg:block lg:w-[170px] lg:shrink-0">
            {tools}
          </aside>
        )}
      </div>
    </div>
  );
}
