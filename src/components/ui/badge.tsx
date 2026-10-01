import type { HTMLAttributes } from 'react';
import type { Lang } from '@/lib/site';
import styles from './actions.module.css';

export type BadgeKind = 'live' | 'new' | 'verified' | 'partial' | 'sponsored' | 'format';
const LABELS: Record<Lang, Record<BadgeKind, string>> = {
  en: { live: 'Live', new: 'New', verified: 'Verified', partial: 'Partial', sponsored: 'Sponsored', format: 'Format' },
  uk: { live: 'Наживо', new: 'Нове', verified: 'Перевірено', partial: 'Частково', sponsored: 'Спонсоровано', format: 'Формат' },
};
const SYMBOLS: Record<BadgeKind, string> = { live: '●', new: '+', verified: '✓', partial: '≈', sponsored: '◇', format: '▤' };

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  kind: BadgeKind;
  lang?: Lang;
}

export function Badge({ kind, lang = 'en', children, className = '', ...props }: BadgeProps) {
  return <span {...props} data-kind={kind}
    className={`${styles.badge} inline-flex max-w-full items-center gap-1.5 rounded-pill border px-2 py-1 text-xs font-medium ${className}`}>
    <span aria-hidden="true">{SYMBOLS[kind]}</span><span>{children ?? LABELS[lang][kind]}</span>
  </span>;
}
