import { Fragment, type ReactNode } from 'react';
import { headingId, parseMarkdown, type MdInline } from '@/lib/markdown';
import type { Lang } from '@/lib/site';
import { CodePanel } from '@/components/editorial/code-panel';
import { SectionDivider } from '@/components/editorial/section-divider';
import styles from '@/components/editorial/article-blocks.module.css';

function Inlines({ inlines }: { inlines: MdInline[] }) {
  return (
    <>
      {inlines.map((run, i): ReactNode => {
        if (run.kind === 'bold') return <strong key={i}>{run.text}</strong>;
        if (run.kind === 'code')
          return (
            <code key={i}>{run.text}</code>
          );
        if (run.kind === 'link')
          return (
            <a
              key={i}
              href={run.href}
              target="_blank"
              rel="noopener noreferrer"
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
  // Section index ("01", "02" …) counts only the `###` headings, which are the
  // article's main sections; `####` stays a sub-heading with an accent tick.
  let sectionCount = 0;

  return (
    <div className={`reading-copy ${styles.block} ${styles.prose}`}>
      {blocks.map((block, i) => {
        if (block.kind === 'table') {
          return (
            <div
              key={i}
              className={`${styles.tableWrap} overflow-x-auto`}
              tabIndex={0}
              role="region"
              aria-label={lang === 'uk' ? 'Таблиця' : 'Table'}
            >
              <table>
                <thead>
                  <tr>
                    {block.headers.map((cell, j) => (
                      <th key={j} scope="col">
                        <Inlines inlines={cell} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, j) => (
                    <tr key={j}>
                      {row.map((cell, k) => (
                        <td key={k}>
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
          if (block.level === 3) {
            const index = sectionCount++;
            return (
              <Fragment key={i}>
                {index > 0 && <SectionDivider />}
                <h3 id={id} className={`${styles.h2} ${index > 0 ? styles.h2Gap : ''}`}>
                  <span aria-hidden className={styles.h2Index}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <Inlines inlines={block.inlines} />
                </h3>
              </Fragment>
            );
          }
          return (
            <h4 id={id} key={i} className={styles.h3}>
              <Inlines inlines={block.inlines} />
            </h4>
          );
        }
        if (block.kind === 'list') {
          return (
            <ul key={i} className={styles.list}>
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
            <CodePanel
              key={i}
              code={block.code}
              language={block.language}
              label={lang === 'uk' ? 'Блок коду' : 'Code block'}
            />
          );
        }
        return (
          <p key={i}>
            <Inlines inlines={block.inlines} />
          </p>
        );
      })}
    </div>
  );
}
