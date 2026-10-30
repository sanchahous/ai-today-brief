import type { Lang } from '@/lib/site';
import { CheckIcon, CloseIcon } from '@/components/icons';
import styles from './article-blocks.module.css';

export function WhenGrid({
  lang,
  useCases,
  avoidCases,
  useTitle: useTitleProp,
  avoidTitle: avoidTitleProp,
  headingLevel = 3,
}: {
  lang: Lang;
  useCases: string[];
  avoidCases: string[];
  useTitle?: string;
  avoidTitle?: string;
  headingLevel?: 2 | 3;
}) {
  const useTitle = useTitleProp ?? (lang === 'uk' ? 'Коли використовувати' : 'When to use');
  const avoidTitle = avoidTitleProp ?? (lang === 'uk' ? 'Коли уникати' : 'When to avoid');
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <div className={`${styles.block} ${styles.when}`}>
      {useCases.length > 0 && (
        <section aria-label={useTitle} className={styles.whenCard}>
          <div className={styles.whenTitle}>
            <span className={styles.iconDot} aria-hidden>
              <CheckIcon size={15} />
            </span>
            <Heading className={styles.eyebrow}>{useTitle}</Heading>
          </div>
          <ul className={styles.whenList}>
            {useCases.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      )}
      {avoidCases.length > 0 && (
        <section aria-label={avoidTitle} className={`${styles.whenCard} ${styles.whenAvoid}`}>
          <div className={styles.whenTitle}>
            <span className={styles.iconDot} aria-hidden>
              <CloseIcon size={15} />
            </span>
            <Heading className={styles.eyebrow}>{avoidTitle}</Heading>
          </div>
          <ul className={styles.whenList}>
            {avoidCases.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
