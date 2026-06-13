import Link from 'next/link';
import type { CSSProperties } from 'react';
import { getStrings } from '@/lib/i18n';
import { buildFactsVisual } from '@/lib/facts-visual';
import type { BriefItemDetail, ItemImpactLevel } from '@/lib/items';
import type { Lang } from '@/lib/site';
import { FactsVisualBlock } from '@/components/facts-visual';
import { MarkdownBody } from '@/components/markdown-body';

export type ToolLink = { name: string; href: string | null };

function impactLevelText(lang: Parameters<typeof getStrings>[0], level: ItemImpactLevel): string {
  const t = getStrings(lang);
  if (level === 'low') return t.impactLow;
  if (level === 'high') return t.impactHigh;
  return t.impactMedium;
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <p
      className={`m-0 mt-7 mb-2.5 text-[0.74rem] font-bold tracking-[0.08em] uppercase ${style ? 'cat-fg' : 'text-accent'}`}
      style={style}
    >
      {children}
    </p>
  );
}

/**
 * Article body v2 — the audit's "value stack": TL;DR, facts box, markdown
 * body (legacy deep-dive fallback), try-it code, when/when-not, action items,
 * editor's take, community voices, tool chips, sources. Every block renders
 * only when its data exists, so items of different calibre stay tight.
 */
export function StoryBody({
  lang,
  detail,
  toolLinks,
}: {
  lang: Lang;
  detail: BriefItemDetail;
  toolLinks: ToolLink[];
}) {
  const t = getStrings(lang);
  const color = detail.categoryColor ?? '#888888';
  const catStyle = { '--cat-color': color } as CSSProperties;
  const factsVisual = buildFactsVisual(detail.facts);

  return (
    <div>
      {detail.impactLevel && (
        <p className="text-faint mb-4 text-[0.74rem] font-semibold tracking-[0.06em] uppercase">
          {t.impactLabel}:{' '}
          <span className="text-accent">{impactLevelText(lang, detail.impactLevel)}</span>
        </p>
      )}

      {detail.why && (
        <div
          className="bg-surface-2 mb-5 rounded-r-lg py-3 pr-4 pl-4"
          style={{ borderLeft: `3px solid color-mix(in srgb, ${color} 55%, var(--border))` }}
        >
          <p className="cat-fg m-0 mb-1.5 text-[0.74rem] font-bold tracking-[0.08em] uppercase" style={catStyle}>
            {t.whyItMatters}
          </p>
          <p className="m-0 text-[0.92rem] leading-relaxed">{detail.why}</p>
        </div>
      )}

      {detail.takeaways.length > 0 && (
        <section aria-label={t.tldrLabel} className="mb-6">
          <p className="text-accent m-0 mb-2.5 text-[0.74rem] font-bold tracking-[0.08em] uppercase">
            {t.tldrLabel}
          </p>
          <ul className="m-0 list-none p-0">
            {detail.takeaways.map((bullet, i) => (
              <li key={i} className="mb-2 flex gap-2.5">
                <span className="cat-fg font-bold tabular-nums" style={catStyle}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[0.92rem] leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail.facts.length > 0 && (
        <section aria-label={t.factsTitle} className="border-border bg-surface mb-6 overflow-hidden rounded-lg border">
          <p
            className="cat-fg m-0 border-b px-4 py-2.5 text-[0.74rem] font-bold tracking-[0.08em] uppercase"
            style={{ ...catStyle, borderColor: 'var(--border)' }}
          >
            {t.factsTitle}
          </p>
          {factsVisual && <FactsVisualBlock visual={factsVisual} color={color} />}
          <dl className="m-0">
            {detail.facts.map((fact, i) => (
              <div
                key={i}
                className={`flex flex-wrap gap-x-4 gap-y-0.5 px-4 py-2.5 ${i % 2 === 1 ? 'bg-surface-2' : ''}`}
              >
                <dt className="text-muted m-0 min-w-[140px] flex-1 break-words text-[0.84rem]">{fact.label}</dt>
                <dd className="m-0 flex-[2] break-words text-[0.9rem] font-semibold">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {detail.bodyMd ? (
        <MarkdownBody markdown={detail.bodyMd} />
      ) : (
        paragraphs(detail.deepDive).map((para, i) => (
          <p key={i} className="mb-3.5 text-[0.96rem] leading-[1.75] last:mb-0">
            {para}
          </p>
        ))
      )}

      {detail.codeSnippet && (
        <section aria-label={t.tryItTitle}>
          <SectionLabel>{t.tryItTitle}</SectionLabel>
          <pre
            className="bg-surface-2 border-border mb-1 overflow-x-auto rounded-lg border p-3.5 font-mono text-[0.84rem] leading-relaxed"
            data-language={detail.codeSnippet.language}
          >
            <code>{detail.codeSnippet.code}</code>
          </pre>
          <p className="text-faint m-0 text-[0.72rem]">{detail.codeSnippet.language}</p>
        </section>
      )}

      {(detail.whenToUse.length > 0 || detail.whenNotToUse.length > 0) && (
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {detail.whenToUse.length > 0 && (
            <section
              aria-label={t.whenToUseTitle}
              className="border-border bg-surface rounded-lg border p-4"
            >
              <p className="m-0 mb-2 text-[0.74rem] font-bold tracking-[0.08em] uppercase text-[color:var(--ok,#3f9e58)]">
                ✓ {t.whenToUseTitle}
              </p>
              <ul className="m-0 list-none space-y-1.5 p-0">
                {detail.whenToUse.map((point, i) => (
                  <li key={i} className="text-[0.88rem] leading-relaxed">
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {detail.whenNotToUse.length > 0 && (
            <section
              aria-label={t.whenNotToUseTitle}
              className="border-border bg-surface rounded-lg border p-4"
            >
              <p className="text-faint m-0 mb-2 text-[0.74rem] font-bold tracking-[0.08em] uppercase">
                ✕ {t.whenNotToUseTitle}
              </p>
              <ul className="m-0 list-none space-y-1.5 p-0">
                {detail.whenNotToUse.map((point, i) => (
                  <li key={i} className="text-[0.88rem] leading-relaxed">
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {detail.actionItems.length > 0 && (
        <>
          <SectionLabel>{t.actionItemsToday}</SectionLabel>
          <ul className="m-0 list-none p-0">
            {detail.actionItems.map((step, i) => (
              <li key={i} className="mb-2 flex gap-2.5">
                <span className="text-accent font-bold" aria-hidden>
                  →
                </span>
                <span className="text-[0.92rem] leading-relaxed">{step}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {detail.editorTake && (
        <section
          aria-label={t.editorTakeTitle}
          className="bg-surface-2 mt-7 rounded-r-lg py-3.5 pr-4 pl-4"
          style={{ borderLeft: '3px solid var(--accent)' }}
        >
          <p className="text-accent m-0 mb-1.5 text-[0.74rem] font-bold tracking-[0.08em] uppercase">
            {t.editorTakeTitle}
          </p>
          <p className="m-0 text-[0.94rem] leading-relaxed">{detail.editorTake}</p>
        </section>
      )}

      {detail.communityReactions.length > 0 && (
        <section aria-label={t.communityTitle}>
          <SectionLabel>{t.communityTitle}</SectionLabel>
          <ul className="m-0 list-none space-y-3 p-0">
            {detail.communityReactions.map((reaction, i) => (
              <li key={i}>
                <blockquote className="border-border m-0 border-l-2 pl-3.5 text-[0.92rem] leading-relaxed italic">
                  “{reaction.quote}”
                </blockquote>
                <p className="text-faint m-0 mt-1 pl-3.5 text-[0.78rem]">
                  —{' '}
                  <a
                    href={reaction.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-faint underline underline-offset-2 hover:text-[color:var(--text)]"
                  >
                    {reaction.author || 'anon'} {t.onHackerNews}
                  </a>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {toolLinks.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {toolLinks.map((tool) =>
            tool.href ? (
              <Link
                key={tool.name}
                href={tool.href}
                className="rounded-pill border-border bg-surface-2 text-text hover:border-accent border px-2.5 py-1 text-[0.74rem] font-medium no-underline transition"
              >
                #{tool.name}
              </Link>
            ) : (
              <span
                key={tool.name}
                className="rounded-pill border-border bg-surface-2 text-muted border px-2.5 py-1 text-[0.74rem]"
              >
                #{tool.name}
              </span>
            ),
          )}
        </div>
      )}

      {detail.citations.length > 0 && (
        <section aria-label={t.sourcesTitle}>
          <SectionLabel>{t.sourcesTitle}</SectionLabel>
          <ul className="m-0 list-none space-y-1.5 p-0">
            {detail.citations.map((citation, i) => (
              <li key={i} className="text-[0.88rem]">
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text underline decoration-[color:var(--border)] underline-offset-2 hover:decoration-current"
                >
                  {citation.title || citation.url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
