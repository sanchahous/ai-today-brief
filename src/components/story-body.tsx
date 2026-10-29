import { categoryColor } from '@/lib/category-meta';
import { Tag } from '@/components/ui/tag';
import { Callout } from '@/components/editorial/callout';
import { Takeaways } from '@/components/editorial/takeaways';
import { KeyFacts } from '@/components/editorial/key-facts';
import { WhenGrid } from '@/components/editorial/when-grid';
import { ActionList } from '@/components/editorial/action-list';
import { CodePanel } from '@/components/editorial/code-panel';
import { SectionLabel } from '@/components/editorial/section-label';
import articleStyles from '@/components/editorial/article-blocks.module.css';
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
  // Every article block reads the story's category colour through this var and
  // falls back to the brand accent when a category has none.
  const accentStyle = { '--article-accent': color } as CSSProperties;
  const sections = selectStorySections(detail, toolLinks.length);
  const factsVisual = buildFactsVisual(detail.facts ?? []);

  return (
    <div className={articleStyles.block} style={accentStyle}>
      {sections.why && (
        <Callout lang={lang} variant="why-it-matters" title={t.whyItMatters} headingLevel={2}>
          <p className="m-0">{detail.why}</p>
        </Callout>
      )}

      {sections.takeaways && (
        <Takeaways lang={lang} title={t.tldrLabel} items={detail.takeaways ?? []} headingLevel={2} />
      )}

      {sections.facts && (
        <KeyFacts
          lang={lang}
          title={t.factsTitle}
          headingLevel={2}
          facts={(detail.facts ?? []).map((fact) => ({ term: fact.label, definition: fact.value }))}
          // Stat tiles already show the values big; only comparison bars add information.
          visual={
            factsVisual?.kind === 'comparison' ? (
              <FactsVisualBlock visual={factsVisual} color="var(--article-accent)" />
            ) : undefined
          }
        />
      )}

      {sections.body &&
        (detail.bodyMd?.trim() ? (
          <MarkdownBody markdown={detail.bodyMd} lang={lang} />
        ) : (
          <div className={`reading-copy ${articleStyles.prose}`}>
            {paragraphs(detail.deepDive ?? '').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        ))}

      {sections.codeSnippet && detail.codeSnippet && (
        <section aria-label={t.tryItTitle}>
          <SectionLabel>{t.tryItTitle}</SectionLabel>
          <CodePanel
            code={detail.codeSnippet.code}
            language={detail.codeSnippet.language}
            label={t.tryItTitle}
            className="!mt-0"
          />
        </section>
      )}

      {(sections.whenToUse || sections.whenNotToUse) && (
        <WhenGrid
          lang={lang}
          headingLevel={2}
          useTitle={t.whenToUseTitle}
          avoidTitle={t.whenNotToUseTitle}
          useCases={sections.whenToUse ? (detail.whenToUse ?? []) : []}
          avoidCases={sections.whenNotToUse ? (detail.whenNotToUse ?? []) : []}
        />
      )}

      {sections.actionItems && (
        <ActionList
          lang={lang}
          title={t.actionItemsToday}
          headingLevel={2}
          items={(detail.actionItems ?? []).map((step, i) => ({ id: String(i), title: step }))}
        />
      )}

      {sections.editorTake && (
        <Callout lang={lang} variant="editor-take" title={t.editorTakeTitle} headingLevel={2}>
          <p className="m-0">{detail.editorTake}</p>
        </Callout>
      )}

      {sections.communityReactions && (
        <section aria-label={t.communityTitle}>
          <SectionLabel>{t.communityTitle}</SectionLabel>
          <ul className={articleStyles.quotes}>
            {detail.communityReactions?.map((reaction, i) => (
              <li key={i}>
                <blockquote className={articleStyles.quote}>{reaction.quote}</blockquote>
                <p className={articleStyles.quoteBy}>
                  —{' '}
                  <a href={reaction.url} target="_blank" rel="noopener noreferrer">
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
                className="rounded-pill border-line bg-raised text-muted text-2xs border px-2.5 py-1"
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
          <ol className={articleStyles.sources}>
            {detail.citations?.map((citation, i) => (
              <li key={i} className={articleStyles.source}>
                <a href={citation.url} target="_blank" rel="noopener noreferrer">
                  {citation.title || citation.url}
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
