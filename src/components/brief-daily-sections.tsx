import type { BriefPackSection } from '@/lib/briefs';
import { formatPackUpdateLabel } from '@/lib/briefs';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { DailyItem } from '@/components/daily/daily-item';

function packOffsets(packs: readonly BriefPackSection[]): { pack: BriefPackSection; startIndex: number }[] {
  const sections: { pack: BriefPackSection; startIndex: number }[] = [];
  let startIndex = 0;
  for (const pack of packs) {
    sections.push({ pack, startIndex });
    startIndex += pack.items.length;
  }
  return sections;
}

export function BriefDailySections({
  lang,
  packs,
}: {
  lang: Lang;
  packs: BriefPackSection[];
}) {
  const t = getStrings(lang);
  const sections = packOffsets(packs);

  return (
    <div>
      {sections.map(({ pack, startIndex }, packIdx) => (
        <section key={pack.slug} className={packIdx > 0 ? 'mt-10' : ''} aria-labelledby={packIdx > 0 ? `pack-${pack.slug}` : undefined}>
          {packIdx > 0 ? (
            <header className="mb-4">
              <h2 id={`pack-${pack.slug}`} className="text-accent m-0 text-xs font-bold tracking-[0.14em] uppercase">
                {formatPackUpdateLabel(lang, pack.publishedAt)}
              </h2>
              {pack.intro ? <p className="text-muted m-0 mt-2 text-base leading-relaxed">{pack.intro}</p> : null}
            </header>
          ) : null}

          <ol className="m-0 grid list-none gap-4 p-0" start={startIndex + 1}>
            {pack.items.map((item, itemIdx) => (
              <DailyItem
                key={item.id}
                lang={lang}
                item={item}
                index={startIndex + itemIdx + 1}
                showReadToggle
              />
            ))}
          </ol>
        </section>
      ))}
      {sections.length === 0 ? (
        <p className="text-muted m-0 text-sm">{t.noResults}</p>
      ) : null}
    </div>
  );
}
