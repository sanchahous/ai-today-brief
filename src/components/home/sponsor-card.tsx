import Link from 'next/link';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { SPONSOR } from '@/lib/home-content';
import { ArrowRight } from '@/components/icons';

/**
 * Native, clearly-disclosed sponsor unit (FEATURE F2). A demo placeholder until
 * the `sponsors` table lands. The "why am I seeing this?" disclosure is a native
 * <details> — no client JS — and the outbound link is `rel="sponsored"`.
 */
export function SponsorCard({ lang }: { lang: Lang }) {
  const t = getStrings(lang).landing;
  const s = SPONSOR;
  return (
    <article
      className="rounded-card relative border p-4"
      style={{
        background: `linear-gradient(135deg, ${s.color}14, transparent 60%), var(--surface)`,
        borderColor: `${s.color}55`,
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className="rounded-pill border px-2 py-0.5 text-[0.62rem] font-bold tracking-[0.1em] uppercase"
          style={{ color: s.color, borderColor: `${s.color}66` }}
        >
          {t.sponsorLabel}
        </span>
        <details className="relative">
          <summary className="text-faint hover:text-muted cursor-pointer list-none text-[0.68rem] underline decoration-dotted [&::-webkit-details-marker]:hidden">
            {t.sponsorWhy}
          </summary>
          <div className="bg-bg border-border rounded-card absolute top-full right-0 z-20 mt-2 w-64 max-w-[80vw] border p-3 text-left shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
            <strong className="text-text mb-1 block text-sm">{t.sponsorWhyTitle}</strong>
            <p className="text-muted mb-2 text-xs leading-relaxed">{t.sponsorWhyBody}</p>
            <Link href={`/${lang}/about`} className="text-accent text-xs font-semibold">
              {t.sponsorWhyCta} →
            </Link>
          </div>
        </details>
      </div>

      <div className="mb-2 flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] text-lg font-extrabold text-black"
          style={{ background: s.color }}
        >
          {s.brand[0]}
        </span>
        <h3 className="min-w-0 text-base">
          {s.brand} — {s.tagline[lang]}
        </h3>
      </div>
      <p className="text-muted mb-4 text-sm leading-relaxed">{s.body[lang]}</p>
      <a
        href={s.url}
        target="_blank"
        rel="nofollow sponsored noopener"
        className="rounded-pill inline-flex items-center gap-1.5 border px-4 py-2 text-sm font-semibold transition-colors"
        style={{ borderColor: `${s.color}66`, color: s.color }}
      >
        {s.cta[lang]}
        <ArrowRight size={15} />
      </a>
    </article>
  );
}
