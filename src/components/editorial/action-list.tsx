import type { Lang } from '@/lib/site';
import { ArrowRight } from '@/components/icons';
import { SectionLabel } from './section-label';
import styles from './article-blocks.module.css';

export interface ActionItem {
  id: string;
  title: string;
  description?: string;
  href?: string;
}

export function ActionList({
  lang,
  title,
  items,
  headingLevel = 3,
}: {
  lang: Lang;
  title?: string;
  items: ActionItem[];
  headingLevel?: 2 | 3;
}) {
  const heading = title || (lang === 'uk' ? 'Що зробити сьогодні' : 'Action items today');

  return (
    <div className={styles.block}>
      <SectionLabel level={headingLevel}>{heading}</SectionLabel>
      <ul className={styles.actions}>
        {items.map((item) => (
          <li key={item.id} className={styles.action}>
            <span className={styles.actionIcon} aria-hidden>
              <ArrowRight size={14} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              {item.href ? (
                <a href={item.href} className="text-text underline decoration-[color:var(--line-strong)] underline-offset-2">
                  {item.title}
                </a>
              ) : (
                item.title
              )}
              {item.description && <div className="text-muted mt-1 text-sm">{item.description}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
