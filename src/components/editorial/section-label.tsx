import type { ReactNode } from 'react';
import styles from './article-blocks.module.css';

/** Section eyebrow heading: accent bar, mono caps label, hairline running to the edge. */
export function SectionLabel({ children, level = 2 }: { children: ReactNode; level?: 2 | 3 }) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <div className={`${styles.block} ${styles.label}`}>
      <Heading className={styles.labelText}>{children}</Heading>
    </div>
  );
}
