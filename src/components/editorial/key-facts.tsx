import type { ReactNode } from 'react';
import type { Lang } from '@/lib/site';
import { DocIcon } from '@/components/icons';
import styles from './article-blocks.module.css';

export interface Fact {
  term: string;
  definition: string;
}

export function KeyFacts({
  lang,
  title,
  facts,
  headingLevel = 3,
  visual,
}: {
  lang: Lang;
  title?: string;
  facts: Fact[];
  headingLevel?: 2 | 3;
  /** Optional chart layer (comparison bars) rendered above the tiles. */
  visual?: ReactNode;
}) {
  const heading = title || (lang === 'uk' ? 'Ключові факти' : 'Key facts');
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <section aria-label={heading} className={`${styles.block} ${styles.facts}`}>
      <div className={styles.factsHead}>
        <span className={styles.iconDot} aria-hidden>
          <DocIcon size={15} />
        </span>
        <Heading className={styles.eyebrow}>{heading}</Heading>
      </div>
      <div className={styles.factsBody}>
        {visual && <div className={styles.factsVisual}>{visual}</div>}
        <dl className={styles.factsGrid}>
          {facts.map((fact, i) => (
            <div key={i} className={styles.fact}>
              <dt className={styles.factLabel}>{fact.term}</dt>
              <dd className={styles.factValue}>{fact.definition}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
