import type { Lang } from '@/lib/site';
import { ListIcon } from '@/components/icons';
import styles from './article-blocks.module.css';

export function Takeaways({
  lang,
  items,
  title,
  headingLevel = 3,
}: {
  lang: Lang;
  items: string[];
  title?: string;
  headingLevel?: 2 | 3;
}) {
  const heading = title ?? (lang === 'uk' ? 'Головне' : 'Key Takeaways');
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <section aria-label={heading} className={`${styles.block} ${styles.takeaways}`}>
      <div className={styles.takeawaysHead}>
        <span className={styles.iconDot} aria-hidden>
          <ListIcon size={15} />
        </span>
        <Heading className={styles.eyebrow}>{heading}</Heading>
      </div>
      <ol className={styles.takeawaysList}>
        {items.map((item, i) => (
          <li key={i} className={styles.takeawaysItem}>
            <span aria-hidden className={styles.takeawaysNum}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className={styles.takeawaysText}>{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
