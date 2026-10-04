import { categoryColor } from '@/lib/category-meta';
import { Tag } from '@/components/ui/tag';
import { selectStorySections } from '@/lib/story-sections';
import type { CSSProperties } from 'react';
import { getStrings } from '@/lib/i18n';
import { buildFactsVisual } from '@/lib/facts-visual';
import type { BriefItemDetail } from '@/lib/items';
import type { Lang } from '@/lib/site';
import { FactsVisualBlock } from '@/components/facts-visual';
import { MarkdownBody } from '@/components/markdown-body';

export type ToolLink = { name: string; href: string | null };

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <h2
      className={`text-2xs m-0 mt-7 mb-2.5 font-bold tracking-[0.08em] uppercase ${style ? 'cat-fg' : 'text-accent'}`}
      style={style}
    >
      {children}
    </h2>
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
  detail: Partial<BriefItemDetail>;
  toolLinks: ToolLink[];
}) {
  const t = getStrings(lang);
  const color = categoryColor(detail.categorySlug, detail.categoryColor);
  const catStyle = { '--cat-color': color } as CSSProperties;
  const sections = selectStorySections(detail, toolLinks.length);
  const factsVisual = buildFactsVisual(detail.facts ?? []);

  return (
    <div>
      {sections.why && (
        <section
          aria-label={t.whyItMatters}
          className="bg-surface-2 mb-5 rounded-r-lg py-3 pr-4 pl-4"
          style={{
            // Solid floor first so the accent stripe never vanishes where color-mix is unsupported.
            borderLeft: '3px solid var(--border)',
            borderLeftColor: `color-mix(in srgb, ${color} 55%, var(--border))`,
          }}
        >
          <h2
            className="cat-fg text-2xs m-0 mb-1.5 font-bold tracking-[0.08em] uppercase"
            style={catStyle}
          >
            {t.whyItMatters}
          </h2>
          <p className="m-0 text-[0.92rem] leading-relaxed">{detail.why}</p>
        </section>
      )}

      {sections.takeaways && (
        <section aria-label={t.tldrLabel} className="mb-6">
          <h2 className="text-accent text-2xs m-0 mb-2.5 font-bold tracking-[0.08em] uppercase">
            {t.tldrLabel}
          </h2>
          <ul className="m-0 list-none p-0">
            {detail.takeaways?.map((bullet, i) => (
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

      {sections.facts && (
        <section
          aria-label={t.factsTitle}
          className="border-border bg-surface mb-6 overflow-hidden rounded-lg border"
        >
          <h2
            className="cat-fg text-2xs m-0 border-b px-4 py-2.5 font-bold tracking-[0.08em] uppercase"
            style={{ ...catStyle, borderColor: 'var(--border)' }}
          >
            {t.factsTitle}
          </h2>
          {factsVisual && <FactsVisualBlock visual={factsVisual} color={color} />}
          <dl className="m-0">
            {detail.facts?.map((fact, i) => (
              <div
                key={i}
                className={`flex flex-wrap gap-x-4 gap-y-0.5 px-4 py-2.5 ${i % 2 === 1 ? 'bg-surface-2' : ''}`}
              >
                <dt className="text-muted m-0 min-w-[140px] flex-1 text-[0.84rem] break-words">
                  {fact.label}
                </dt>
                <dd className="m-0 min-w-0 flex-[2] text-[0.9rem] font-semibold break-words">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {sections.body &&
        (detail.bodyMd?.trim() ? (
          <MarkdownBody markdown={detail.bodyMd} lang={lang} />
        ) : (
          paragraphs(detail.deepDive ?? '').map((para, i) => (
            <p key={i} className="mb-3.5 text-[0.96rem] leading-[1.75] last:mb-0">
              {para}
            </p>
          ))
        ))}

      {sections.codeSnippet && detail.codeSnippet && (
        <section aria-label={t.tryItTitle}>
          <SectionLabel>{t.tryItTitle}</SectionLabel>
          <pre
            tabIndex={0}
            role="region"
            aria-label={t.tryItTitle}
            className="bg-surface-2 border-border mb-1 overflow-x-auto rounded-lg border p-3.5 font-mono text-[0.84rem] leading-relaxed"
            data-language={detail.codeSnippet.language}
          >
            <code>{detail.codeSnippet.code}</code>
          </pre>
          <p className="text-faint text-2xs m-0">{detail.codeSnippet.language}</p>
        </section>
      )}

      {(sections.whenToUse || sections.whenNotToUse) && (
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          {sections.whenToUse && (
            <section
              aria-label={t.whenToUseTitle}
              className="border-border bg-surface rounded-lg border p-4"
            >
              <h2 className="text-2xs text-success-contrast m-0 mb-2 font-bold tracking-[0.08em] uppercase">
                ✓ {t.whenToUseTitle}
              </h2>
              <ul className="m-0 list-none space-y-1.5 p-0">
                {detail.whenToUse?.map((point, i) => (
                  <li key={i} className="text-[0.88rem] leading-relaxed">
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {sections.whenNotToUse && (
            <section
              aria-label={t.whenNotToUseTitle}
              className="border-border bg-surface rounded-lg border p-4"
            >
              <h2 className="text-faint text-2xs m-0 mb-2 font-bold tracking-[0.08em] uppercase">
                ✕ {t.whenNotToUseTitle}
              </h2>
              <ul className="m-0 list-none space-y-1.5 p-0">
                {detail.whenNotToUse?.map((point, i) => (
                  <li key={i} className="text-[0.88rem] leading-relaxed">
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {sections.actionItems && (
        <>
          <SectionLabel>{t.actionItemsToday}</SectionLabel>
          <ul className="m-0 list-none p-0">
            {detail.actionItems?.map((step, i) => (
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

      {sections.editorTake && (
        <section
          aria-label={t.editorTakeTitle}
          className="bg-surface-2 mt-7 rounded-r-lg py-3.5 pr-4 pl-4"
          style={{ borderLeft: '3px solid var(--accent)' }}
        >
          <h2 className="text-accent text-2xs m-0 mb-1.5 font-bold tracking-[0.08em] uppercase">
            {t.editorTakeTitle}
          </h2>
          <p className="m-0 text-[0.94rem] leading-relaxed">{detail.editorTake}</p>
        </section>
      )}

      {sections.communityReactions && (
        <section aria-label={t.communityTitle}>
          <SectionLabel>{t.communityTitle}</SectionLabel>
          <ul className="m-0 list-none space-y-3 p-0">
            {detail.communityReactions?.map((reaction, i) => (
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
                    className="text-faint inline-flex min-h-[var(--touch-target-min)] items-center underline underline-offset-2 hover:text-[color:var(--text)]"
                  >
                    {reaction.author || 'anon'} {t.onHackerNews}
                  </a>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sections.tools && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {toolLinks.map((tool) =>
            tool.href ? (
              <Tag key={tool.name} href={tool.href} className="max-w-full whitespace-normal">
                #{tool.name}
              </Tag>
            ) : (
              <span
                key={tool.name}
                className="rounded-pill border-border bg-surface-2 text-muted text-2xs border px-2.5 py-1"
              >
                #{tool.name}
              </span>
            ),
          )}
        </div>
      )}

      {sections.citations && (
        <section aria-label={t.sourcesTitle}>
          <SectionLabel>{t.sourcesTitle}</SectionLabel>
          <ul className="m-0 list-none space-y-1.5 p-0">
            {detail.citations?.map((citation, i) => (
              <li key={i} className="text-[0.88rem]">
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text inline-flex min-h-[var(--touch-target-min)] items-center underline decoration-[color:var(--border)] underline-offset-2 hover:decoration-current"
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
