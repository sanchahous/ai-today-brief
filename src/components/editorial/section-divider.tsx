import styles from './article-blocks.module.css';

/**
 * Ornament between major article sections: hairlines fading out from a small
 * mark that echoes the brand's nested-A strokes plus the signal dot. Purely
 * decorative, so it is hidden from assistive tech.
 */
export function SectionDivider({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`${styles.block} ${styles.divider} ${className}`}>
      <svg viewBox="0 0 44 18" fill="none" focusable="false">
        <path
          d="M9 15.5 18 3l9 12.5M13 15.5l5-7.5 5 7.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="35" cy="5" r="2.2" fill="currentColor" />
      </svg>
    </div>
  );
}
