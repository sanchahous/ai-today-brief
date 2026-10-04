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
    <div className="mx-auto max-w-[1200px] px-4 md:px-6 lg:px-8 xl:px-10">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        
        {/* TOC - Inline on mobile, left sidebar on tablet/desktop */}
        {toc && (
          <aside className="w-full lg:sticky lg:top-24 lg:w-[140px] xl:w-[170px] lg:shrink-0">
            {toc}
          </aside>
        )}
        
        {/* Main reading content with measure limit */}
        <div className="w-full lg:max-w-[680px] lg:flex-1">
          <div className="prose prose-neutral dark:prose-invert max-w-none 
            prose-p:max-w-[75ch] prose-ul:max-w-[75ch] prose-ol:max-w-[75ch]
            text-base sm:text-lg leading-relaxed">
            {content}
          </div>
        </div>

        {/* Tools - Right sidebar */}
        {tools && (
          <aside className="w-full lg:sticky lg:top-24 lg:w-[170px] lg:shrink-0 hidden lg:block">
            {tools}
          </aside>
        )}
        
      </div>
    </div>
  );
}
