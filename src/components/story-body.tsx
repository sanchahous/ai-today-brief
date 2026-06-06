import Link from 'next/link';
import type { CSSProperties } from 'react';
import { getStrings } from '@/lib/i18n';
import type { BriefItemDetail } from '@/lib/items';
import type { Lang } from '@/lib/site';

export type ToolLink = { name: string; href: string | null };

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Shared analysis body: why-it-matters, deep dive, takeaways, tool chips. */
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

  return (
    <div>
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

      {paragraphs(detail.deepDive).map((para, i) => (
        <p key={i} className="mb-3.5 text-[0.96rem] leading-[1.75] last:mb-0">
          {para}
        </p>
      ))}

      {detail.takeaways.length > 0 && (
        <>
          <p className="text-accent m-0 mt-5 mb-2.5 text-[0.74rem] font-bold tracking-[0.08em] uppercase">
            {t.keyTakeaways}
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
        </>
      )}

      {toolLinks.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5">
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
    </div>
  );
}
