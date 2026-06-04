import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { Reveal } from '@/components/reveal';
import { NewsletterForm } from '@/components/home/newsletter-form';

/**
 * Email-digest band (FEATURE F1). Social proof (subscriber count) is omitted on
 * purpose — there is no real list yet, and a fabricated count would undercut the
 * product's trust positioning. It returns once the Beehiiv list is live (P5).
 */
export function NewsletterBand({ lang }: { lang: Lang }) {
  const t = getStrings(lang).landing;
  return (
    <section className="mx-auto w-full max-w-[1160px] px-6 py-6">
      <Reveal>
        <div
          className="rounded-card border-border relative overflow-hidden border p-6 sm:p-10"
          style={{
            background:
              'radial-gradient(120% 160% at 0% 0%, rgba(240,192,64,0.14), transparent 55%), var(--surface)',
          }}
        >
          <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">{t.subEyebrow}</p>
          <h2 className="mt-2 text-2xl sm:text-3xl">{t.subTitle}</h2>
          <p className="text-muted mt-2 mb-5 max-w-xl text-sm leading-relaxed">{t.subBody}</p>
          <NewsletterForm placeholder={t.subPlaceholder} button={t.subButton} done={t.subDone} />
          <p className="text-faint mt-4 text-xs">{t.subPrivacy}</p>
        </div>
      </Reveal>
    </section>
  );
}
