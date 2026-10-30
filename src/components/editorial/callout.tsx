import type { ReactNode } from 'react';
import type { Lang } from '@/lib/site';
import { CheckIcon, SparkleIcon } from '@/components/icons';
import styles from './article-blocks.module.css';

export type CalloutVariant = 'why-it-matters' | 'definition' | 'editor-take' | 'limits';

const VARIANT_CLASS: Record<CalloutVariant, string> = {
  'why-it-matters': '',
  definition: styles.calloutDefinition,
  'editor-take': styles.calloutEditor,
  limits: styles.calloutLimits,
};

export function Callout({
  lang,
  variant,
  title,
  headingLevel = 3,
  children,
}: {
  lang: Lang;
  variant: CalloutVariant;
  title?: string;
  /** Document-outline level of the title; the item page's sections use 2. */
  headingLevel?: 2 | 3;
  children: ReactNode;
}) {
  const getTitle = () => {
    if (title) return title;
    const isUk = lang === 'uk';
    switch (variant) {
      case 'why-it-matters':
        return isUk ? 'Чому це важливо' : 'Why it matters';
      case 'definition':
        return isUk ? 'Визначення' : 'Definition';
      case 'editor-take':
        return isUk ? 'Погляд редактора' : "Editor's take";
      case 'limits':
        return isUk ? 'Обмеження' : 'Limitations & Uncertainty';
    }
  };

  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const heading = getTitle();

  return (
    <aside
      aria-label={heading}
      className={`${styles.block} ${styles.callout} ${VARIANT_CLASS[variant]}`}
    >
      <div className={styles.calloutHead}>
        <span className={styles.iconDot} aria-hidden>
          {variant === 'definition' ? <CheckIcon size={15} /> : <SparkleIcon size={15} />}
        </span>
        <Heading className={styles.eyebrow}>{heading}</Heading>
      </div>
      <div className={styles.calloutBody}>{children}</div>
      {variant === 'editor-take' && (
        <p className={styles.calloutNote}>
          {lang === 'uk' ? 'Редакційна думка' : 'Opinion disclaimer'}
        </p>
      )}
    </aside>
  );
}
