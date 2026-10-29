import type { ReactNode } from 'react';
import styles from './article-blocks.module.css';

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
    <figure className={`${styles.block} my-8 min-w-0 max-w-full overflow-x-clip`}>
      <div
        role="region"
        aria-label={title}
        tabIndex={0}
        className={`${styles.tableWrap} !my-0 w-full max-w-full overflow-x-auto`}
      >
        <table className="min-w-[560px] [&_[data-numeric]]:font-mono [&_[data-numeric]]:tabular-nums">
          {children}
        </table>
      </div>
      {caption && (
        <figcaption className="text-muted mt-2 text-xs leading-normal">{caption}</figcaption>
      )}
    </figure>
  );
}
