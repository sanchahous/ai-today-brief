import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { Reveal } from '@/components/reveal';
import { NewsletterForm } from '@/components/home/newsletter-form';

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
      <Reveal>
        <div
          className={`newsletter-card-bg rounded-card border-border relative overflow-hidden border ${innerPadding}`}
        >
          {showHeader ? (
            <>
              <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">{t.subEyebrow}</p>
              <h2 id="newsletter-title" className="mt-2 text-2xl sm:text-3xl">{t.subTitle}</h2>
              <p className="text-muted mt-2 max-w-xl text-sm leading-relaxed">{t.subBody}</p>
              <ul className="text-muted mt-4 mb-5 flex flex-wrap gap-x-4 gap-y-2 text-xs sm:text-sm">
                {t.subProofItems.map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <span aria-hidden className="text-accent">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <NewsletterForm
            lang={lang}
            placeholder={t.subPlaceholder}
            button={t.subButton}
            done={t.subDone}
            notConfigured={getStrings(lang).subscribeForm.notConfigured}
            failed={getStrings(lang).subscribeForm.failed}
            placement={placement ?? (embedded ? 'subscribe-page' : 'home-band')}
          />
          <p className={`text-faint text-xs ${showHeader ? 'mt-4' : 'mt-3'}`}>{t.subPrivacy}</p>
        </div>
      </Reveal>
    </section>
  );
}
