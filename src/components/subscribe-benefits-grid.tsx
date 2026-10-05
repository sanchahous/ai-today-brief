import { CategoryGlyph } from '@/components/icons';
import { SUBSCRIBE_BENEFITS } from '@/lib/marketing-content';
import type { Lang } from '@/lib/site';

export function SubscribeBenefitsGrid({ lang, title }: { lang: Lang; title: string }) {
  return (
    <section className="section mt-16" aria-labelledby="benefits-title">
      <h2
        id="benefits-title"
        data-gesture="settle"
        className="text-center font-serif text-[clamp(1.5rem,3.2vw,2rem)] font-bold text-text"
      >
        {title}
      </h2>
      <ul className="benefit-grid mt-8 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {SUBSCRIBE_BENEFITS.map((b, i) => (
          <li key={b.title.en}>
            <article
              data-gesture="settle"
              data-gesture-delay={String(i * 60)}
              className="rounded-card border-border bg-surface flex h-full flex-col gap-3 border p-6"
            >
              <span
                aria-hidden
                className="text-accent mb-1 grid h-12 w-12 place-items-center rounded-full bg-accent/10"
              >
                <CategoryGlyph icon={b.icon} size={24} strokeWidth={1.6} />
              </span>
              <strong className="font-serif text-xl font-normal text-text">{b.title[lang]}</strong>
              <span className="text-muted text-sm leading-relaxed">{b.body[lang]}</span>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
