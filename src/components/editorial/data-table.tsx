import type { ReactNode } from 'react';

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
    <figure className="my-8 min-w-0 max-w-full overflow-x-clip">
      <div
        role="region"
        aria-label={title}
        tabIndex={0}
        className="w-full max-w-full overflow-x-auto rounded-[var(--radius-md)] border border-line [-webkit-overflow-scrolling:touch]"
      >
        <table
          className="w-full min-w-[560px] border-collapse text-left text-sm text-text
            [&_th]:border-b [&_th]:border-line [&_td]:border-b [&_td]:border-line
            [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-3
            [&_th]:align-top [&_td]:align-top
            [&_thead_th]:bg-surface [&_thead_th]:font-mono [&_thead_th]:text-2xs [&_thead_th]:font-medium
            [&_thead_th]:uppercase [&_thead_th]:tracking-[0.06em] [&_thead_th]:text-muted
            [&_tbody_tr:nth-child(even)]:bg-raised
            [&_tbody_tr:last-child_*]:border-b-0
            [&_tbody_th]:font-semibold
            [&_[data-numeric]]:font-mono [&_[data-numeric]]:tabular-nums"
        >
          {children}
        </table>
      </div>
      {caption && (
        <figcaption className="text-muted mt-2 text-xs leading-normal">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
