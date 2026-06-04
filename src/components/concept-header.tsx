import { CategoryGlyph } from '@/components/icons';
import type { ConceptDetail } from '@/lib/concepts';
import type { IconKey } from '@/components/icons';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';

export function ConceptHeader({
  lang,
  concept,
  icon,
  storyCount,
}: {
  lang: Lang;
  concept: ConceptDetail;
  icon: IconKey;
  storyCount: number;
}) {
  const t = getStrings(lang);
  const accent = '#f0c040';

  return (
    <header className="mb-8 max-w-[720px]">
      <div className="mb-3 flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border"
          style={{
            color: accent,
            background: 'rgba(240,192,64,0.12)',
            borderColor: 'rgba(240,192,64,0.35)',
          }}
        >
          <CategoryGlyph icon={icon} size={26} strokeWidth={1.6} />
        </span>
        <div>
          <p className="text-accent m-0 mb-1 text-xs font-bold tracking-[0.14em] uppercase">
            {t.landing.trendingEyebrow}
          </p>
          <h1 className="m-0 text-[clamp(1.7rem,4vw,2.4rem)] leading-[1.1]">{concept.name}</h1>
        </div>
      </div>
      {concept.description && (
        <p className="text-muted m-0 text-base leading-relaxed">{concept.description}</p>
      )}
      {concept.officialUrl && (
        <p className="mt-4 text-sm">
          <a
            className="text-accent font-medium hover:underline"
            href={concept.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.officialSite} ↗
          </a>
        </p>
      )}
      <p className="text-faint mt-4 text-sm">
        {t.conceptStories} · {storyCount}
      </p>
    </header>
  );
}
