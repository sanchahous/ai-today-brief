import Link from 'next/link';
import type { CSSProperties } from 'react';
import { CategoryGlyph } from '@/components/icons';
import type { CategoryHubView } from '@/lib/categories';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';

export function CategoryHeader({ lang, hub }: { lang: Lang; hub: CategoryHubView }) {
  const t = getStrings(lang);
  const color = hub.color ?? '#888888';
  const catStyle = { '--cat-color': color } as CSSProperties;
  const countLabel = t.landing.categoryArticles;

  return (
    <header
      className="cat-header rounded-card mb-8 flex items-start gap-4 p-5 sm:p-6"
      style={catStyle}
    >
      <span
        aria-hidden
        className="cat-icon-box grid h-14 w-14 shrink-0 place-items-center rounded-[14px]"
        style={catStyle}
      >
        <CategoryGlyph icon={hub.icon} size={30} strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <h1 className="mb-1 text-[clamp(1.7rem,4vw,2.4rem)] leading-[1.15]">{hub.name}</h1>
        <p className="cat-fg m-0 mb-2 text-[0.95rem] font-medium" style={catStyle}>
          {hub.tagline} · {hub.items.length} {countLabel}
        </p>
        {hub.description && (
          <p className="text-muted m-0 max-w-[620px] text-[0.95rem] leading-relaxed">{hub.description}</p>
        )}
        {hub.subtopics.length > 0 && (
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <span className="text-faint text-[0.78rem]">{t.subtopicsLabel}:</span>
            {hub.subtopics.map((st) => (
              <Link
                key={st}
                href={`/${lang}/news?q=${encodeURIComponent(st)}`}
                className="cat-chip rounded-pill bg-surface text-text hover:border-accent border px-3 py-1 text-[0.8rem] no-underline transition"
                style={catStyle}
              >
                {st}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
