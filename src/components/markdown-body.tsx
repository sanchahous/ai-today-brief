import type { ReactNode } from 'react';
import { parseMarkdown, type MdInline } from '@/lib/markdown';

function Inlines({ inlines }: { inlines: MdInline[] }) {
  return (
    <>
      {inlines.map((run, i): ReactNode => {
        if (run.kind === 'bold') return <strong key={i}>{run.text}</strong>;
        if (run.kind === 'code')
          return (
            <code
              key={i}
              className="bg-surface-2 border-border rounded border px-1 py-0.5 font-mono text-[0.85em]"
            >
              {run.text}
            </code>
          );
        if (run.kind === 'link')
          return (
            <a
              key={i}
              href={run.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-[color:var(--border)] underline-offset-2 hover:decoration-current"
            >
              {run.text}
            </a>
          );
        return <span key={i}>{run.text}</span>;
      })}
    </>
  );
}

/**
 * Renders the constrained markdown the pipeline writes into `body_md_*`
 * (see src/lib/markdown.ts). Emits React elements only — no raw HTML.
 */
export function MarkdownBody({ markdown }: { markdown: string }) {
  const blocks = parseMarkdown(markdown);

  return (
    <div>
      {blocks.map((block, i) => {
        if (block.kind === 'heading') {
          return block.level === 3 ? (
            <h3 key={i} className="mt-7 mb-3 text-[1.18rem] leading-snug first:mt-0">
              <Inlines inlines={block.inlines} />
            </h3>
          ) : (
            <h4 key={i} className="mt-5 mb-2 text-[1.02rem] leading-snug first:mt-0">
              <Inlines inlines={block.inlines} />
            </h4>
          );
        }
        if (block.kind === 'list') {
          return (
            <ul key={i} className="mb-3.5 list-disc space-y-1.5 pl-5">
              {block.items.map((item, j) => (
                <li key={j} className="text-[0.96rem] leading-[1.7]">
                  <Inlines inlines={item} />
                </li>
              ))}
            </ul>
          );
        }
        if (block.kind === 'codeBlock') {
          return (
            <pre
              key={i}
              className="bg-surface-2 border-border mb-4 overflow-x-auto rounded-lg border p-3.5 font-mono text-[0.84rem] leading-relaxed"
              data-language={block.language}
            >
              <code>{block.code}</code>
            </pre>
          );
        }
        return (
          <p key={i} className="mb-3.5 text-[0.96rem] leading-[1.75] last:mb-0">
            <Inlines inlines={block.inlines} />
          </p>
        );
      })}
    </div>
  );
}
