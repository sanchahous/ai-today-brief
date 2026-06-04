import { CategoryGlyph } from '@/components/icons';
import { SUBSCRIBE_BENEFITS } from '@/lib/marketing-content';
import type { Lang } from '@/lib/site';
import { Reveal } from '@/components/reveal';

export function SubscribeBenefitsGrid({ lang, title }: { lang: Lang; title: string }) {
  return (
    <section className="mt-14">
      <Reveal>
        <h2 className="text-center text-[clamp(1.35rem,3.2vw,1.9rem)]">{title}</h2>
      </Reveal>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SUBSCRIBE_BENEFITS.map((b, i) => (
          <Reveal key={b.title.en} delayMs={i * 60}>
            <article className="rounded-card border-border bg-surface h-full border p-5">
              <span
                aria-hidden
                className="text-accent mb-4 grid h-11 w-11 place-items-center rounded-xl border border-[rgba(240,192,64,0.35)] bg-[rgba(240,192,64,0.12)]"
              >
                <CategoryGlyph icon={b.icon} size={22} strokeWidth={1.6} />
              </span>
              <h3 className="text-lg">{b.title[lang]}</h3>
              <p className="text-muted mt-2 text-sm leading-relaxed">{b.body[lang]}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
