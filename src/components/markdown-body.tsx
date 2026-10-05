import type { ReactNode } from 'react';
import { headingId, parseMarkdown, type MdInline } from '@/lib/markdown';
import type { Lang } from '@/lib/site';

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
export function MarkdownBody({ markdown, lang = 'en' }: { markdown: string; lang?: Lang }) {
  // Table presentation is opt-in; the existing SEO plain-text projection stays stable.
  const blocks = parseMarkdown(markdown, { tables: true });

  return (
    <div className="reading-copy">
      {blocks.map((block, i) => {
        if (block.kind === 'table') {
          return (
            <div
              key={i}
              className="my-6 max-w-full overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label={lang === 'uk' ? 'Таблиця' : 'Table'}
            >
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {block.headers.map((cell, j) => (
                      <th key={j} scope="col" className="border-border border p-3 text-left">
                        <Inlines inlines={cell} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, j) => (
                    <tr key={j}>
                      {row.map((cell, k) => (
                        <td key={k} className="border-border border p-3">
                          <Inlines inlines={cell} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.kind === 'heading') {
          const text = block.inlines.map((run) => run.text).join('');
          const id = headingId(text);
          return block.level === 3 ? (
            <h3 id={id} key={i} className="mt-7 mb-3 text-[1.18rem] leading-snug first:mt-0 scroll-mt-24">
              <Inlines inlines={block.inlines} />
            </h3>
          ) : (
            <h4 id={id} key={i} className="mt-5 mb-2 text-[1.02rem] leading-snug first:mt-0 scroll-mt-24">
              <Inlines inlines={block.inlines} />
            </h4>
          );
        }
        if (block.kind === 'list') {
          return (
            <ul key={i} className="mb-3.5 list-disc space-y-1.5 pl-5">
              {block.items.map((item, j) => (
                <li key={j}>
                  <Inlines inlines={item} />
                </li>
              ))}
            </ul>
          );
        }
        if (block.kind === 'codeBlock') {
          return (
            <div key={i} className="my-4">
              <pre
                tabIndex={0}
                role="region"
                aria-label={lang === 'uk' ? 'Блок коду' : 'Code block'}
                className="bg-surface-2 border-border overflow-x-auto rounded-lg border p-3.5 font-mono text-[0.84rem] leading-relaxed sm:text-[14px]"
                data-language={block.language}
              >
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }
        return (
          <p key={i} className="mb-3.5 last:mb-0">
            <Inlines inlines={block.inlines} />
          </p>
        );
      })}
    </div>
  );
}
