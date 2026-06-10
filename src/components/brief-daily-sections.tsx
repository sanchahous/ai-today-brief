import Link from 'next/link';
import type { BriefItemCard, BriefPackSection } from '@/lib/briefs';
import { formatPackUpdateLabel } from '@/lib/briefs';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { CategoryBadge } from '@/components/home/category-badge';
import { Reveal } from '@/components/reveal';
import { ArrowRight } from '@/components/icons';

export function BriefDailySections({
  lang,
  packs,
  totalItems,
}: {
  lang: Lang;
  packs: BriefPackSection[];
  totalItems: number;
}) {
  const t = getStrings(lang);
  const openFull = t.news.openFull;

  const sections = packs.reduce<{ pack: BriefPackSection; startIndex: number }[]>((acc, pack) => {
    const startIndex = acc.length === 0 ? 0 : acc[acc.length - 1]!.startIndex + acc[acc.length - 1]!.pack.items.length;
    acc.push({ pack, startIndex });
    return acc;
  }, []);

  return (
    <div className="max-w-[760px]">
      <p className="text-faint m-0 mb-4 text-[0.72rem] font-bold tracking-[0.1em] uppercase">
        {t.briefItemsLabel} · {totalItems}
      </p>

      {sections.map(({ pack, startIndex }, packIdx) => (
        <section key={pack.slug} className={packIdx > 0 ? 'mt-10' : ''}>
          {packIdx > 0 && (
            <header className="mb-4">
              <p className="text-accent m-0 mb-2 text-xs font-bold tracking-[0.14em] uppercase">
                {formatPackUpdateLabel(lang, pack.publishedAt)}
              </p>
              {pack.intro && (
                <p className="text-muted m-0 text-[1.05rem] leading-relaxed">{pack.intro}</p>
              )}
            </header>
          )}

          <ol className="m-0 grid list-none gap-4 p-0">
            {pack.items.map((item, itemIdx) => (
              <BriefItemRow
                key={item.id}
                lang={lang}
                briefSlug={pack.slug}
                item={item}
                displayIndex={startIndex + itemIdx}
                openFull={openFull}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function BriefItemRow({
  lang,
  briefSlug,
  item,
  displayIndex,
  openFull,
}: {
  lang: Lang;
  briefSlug: string;
  item: BriefItemCard;
  displayIndex: number;
  openFull: string;
}) {
  const href = item.slug ? `/${lang}/${briefSlug}/${item.slug}` : `/${lang}/news`;

  return (
    <Reveal delayMs={displayIndex * 50}>
      <li>
        <Link
          href={href}
          className="card-hover rounded-card border-border bg-surface flex cursor-pointer gap-4 border p-4 no-underline transition sm:p-5"
        >
          <span
            aria-hidden
            className="text-faint font-serif min-w-[30px] text-[1.6rem] leading-none font-bold"
          >
            {displayIndex + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-2">
              <CategoryBadge name={item.categoryName} color={item.categoryColor} />
            </div>
            <h3 className="mb-2 text-[1.15rem] leading-snug text-[color:inherit]">{item.title}</h3>
            <p className="text-muted mb-2 text-[0.92rem] leading-relaxed">{item.summary}</p>
            <span className="text-accent inline-flex items-center gap-1 text-[0.8rem] font-semibold">
              {openFull}
              <ArrowRight size={14} />
            </span>
          </div>
        </Link>
      </li>
    </Reveal>
  );
}
