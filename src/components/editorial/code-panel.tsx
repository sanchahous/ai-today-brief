import type { ReactNode } from 'react';
import styles from './article-blocks.module.css';

/**
 * Code block chrome: a header bar with the language label (and an optional
 * action, e.g. the copy button) over a stage-dark surface that is deliberately
 * different from the tinted callouts around it. Server-safe.
 */
export function CodePanel({
  code,
  language,
  label,
  action,
  className = '',
}: {
  code: string;
  language?: string | null;
  label: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${styles.block} ${styles.code} ${className}`}>
      <div className={styles.codeBar}>
        <span className={styles.codeLang}>{language || 'text'}</span>
        {action}
      </div>
      <div className={`${styles.codeScroll} overflow-x-auto`} tabIndex={0} role="region" aria-label={label}>
        <pre className={styles.codePre} data-language={language ?? undefined}>
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
