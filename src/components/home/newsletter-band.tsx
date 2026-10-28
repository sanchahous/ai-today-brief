import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { NewsletterForm } from '@/components/home/newsletter-form';
import styles from './newsletter-band.module.css';

/**
 * Email-digest band (FEATURE F1). Social proof (subscriber count) is omitted on
 * purpose — there is no real list yet, and a fabricated count would undercut the
 * product's trust positioning. It returns once the Beehiiv list is live (P5).
 */
export function NewsletterBand({
  lang,
  embedded = false,
  showHeader = true,
  compact = false,
  placement,
}: {
  lang: Lang;
  embedded?: boolean;
  /** When false, only the form card (subscribe landing hero already has H1). */
  showHeader?: boolean;
  /** Compact padding for narrow containers like the sidebar. */
  compact?: boolean;
  /** GA4 newsletter_subscribe placement — overrides embedded default. */
  placement?: string;
}) {
  const t = getStrings(lang).landing;
  const outer = embedded ? 'w-full' : 'mx-auto w-full max-w-[1160px] px-6 py-6';
  const innerPadding = compact ? 'p-4' : 'p-6 sm:p-10';

  return (
    <section aria-labelledby={showHeader ? 'newsletter-title' : undefined} className={outer}>
      <div
        data-gesture="fold"
        className={`${styles.cardBg} rounded-card relative overflow-hidden ${innerPadding}`}
      >
        {showHeader ? (
          <div className={styles.copy}>
            <p className={`eyebrow ${styles.muted}`}>{t.subEyebrow}</p>
            <h2 id="newsletter-title" className="mt-2 text-2xl sm:text-3xl">
              {t.subTitleLead}{' '}
              <em className="font-[family-name:var(--font-display)] italic">{t.subTitleEmphasis}</em>
            </h2>
            <p className={`mt-2 max-w-xl text-sm leading-relaxed ${styles.muted}`}>{t.subBody}</p>
            <ul className={`${styles.proof} mt-4 mb-2`}>
              {t.subProofItems.map((item) => (
                <li key={item}>
                  <span aria-hidden="true" className={styles.check}>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className={styles.formCol}>
          <NewsletterForm
            lang={lang}
            variant="band"
            placement={placement ?? (embedded ? 'subscribe-page' : 'home-band')}
          />
        </div>
      </div>
    </section>
  );
}
