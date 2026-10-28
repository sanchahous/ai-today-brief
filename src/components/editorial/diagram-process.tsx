import { useId } from 'react';
import type { Lang } from '@/lib/site';
import { visualCopy } from './visual-copy';

export type ProcessDiagramNode = {
  /** Short role already present in the source, such as Host / Client / Server. */
  role?: string;
  title: string;
  detail?: string;
};

function nodeText(node: ProcessDiagramNode): string {
  const parts = [node.role, node.title, node.detail].filter((part): part is string => Boolean(part?.trim()));
  return parts.join(', ');
}

/**
 * Arrow flow of named steps. Default layout is a column so 320 px reads
 * top to bottom; from the `md` breakpoint (47.5rem) the nodes sit in a row.
 * Renders nothing when fewer than two named steps exist.
 */
export function ProcessDiagram({
  lang,
  nodes,
  title,
  caption,
}: {
  lang: Lang;
  nodes: ProcessDiagramNode[];
  title?: string;
  caption: string;
}) {
  const titleId = useId();
  const descId = useId();
  const shown = nodes.filter((node) => node.title.trim());
  if (shown.length < 2) return null;

  const copy = visualCopy(lang);
  const heading = title ?? copy.processTitle;
  const description = `${caption} ${shown.map(nodeText).join('. ')}`;

  return (
    <figure
      data-diagram="process"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="border-line bg-surface my-6 min-w-0 max-w-full overflow-x-clip rounded-[var(--radius-md)] border px-4 py-4"
    >
      <figcaption
        id={titleId}
        className="text-accent m-0 font-mono text-2xs font-medium tracking-[var(--tracking-eyebrow)] uppercase"
      >
        {heading}
      </figcaption>
      <p className="text-muted mt-1 mb-3 text-xs leading-normal break-words">{caption}</p>
      <p id={descId} className="sr-only">
        {description}
      </p>
      <ol className="m-0 flex list-none flex-col gap-2 p-0 md:flex-row md:items-stretch">
        {shown.map((node, index) => (
          <li
            key={`${node.title}:${index}`}
            className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-stretch"
          >
            {index > 0 ? (
              <span
                aria-hidden="true"
                className="text-accent flex rotate-90 items-center justify-center text-lg md:rotate-0"
              >
                →
              </span>
            ) : null}
            <div
              data-terminal={index === shown.length - 1 ? 'true' : undefined}
              className={`flex min-w-0 flex-1 flex-col gap-1 rounded-[var(--radius-sm)] border p-4 ${
                index === shown.length - 1
                  ? 'border-signal bg-signal/10'
                  : 'border-line-strong bg-raised'
              }`}
            >
              {node.role ? (
                <span className="text-accent font-mono text-2xs font-medium tracking-[var(--tracking-eyebrow)] uppercase break-words">
                  {node.role}
                </span>
              ) : null}
              <strong className="text-text text-base leading-snug font-semibold break-words">{node.title}</strong>
              {node.detail ? (
                <span className="text-muted text-xs leading-snug break-words">{node.detail}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </figure>
  );
}
