import Link from 'next/link';
import type { BriefItemCard, BriefSummary } from '@/lib/briefs';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { CategoryBadge } from '@/components/home/category-badge';
import { Reveal } from '@/components/reveal';
import { ArrowRight } from '@/components/icons';

export function BriefItemsList({
  lang,
  brief,
}: {
  lang: Lang;
  brief: BriefSummary;
}) {
  const t = getStrings(lang);
  const openFull = getStrings(lang).news.openFull;

  return (
    <section className="max-w-[760px]">
      <p className="text-faint m-0 mb-4 text-[0.72rem] font-bold tracking-[0.1em] uppercase">
        {t.briefItemsLabel} · {brief.items.length}
      </p>
      <ol className="m-0 grid list-none gap-4 p-0">
        {brief.items.map((item, i) => (
          <BriefItemRow key={item.id} lang={lang} item={item} index={i} openFull={openFull} />
        ))}
      </ol>
    </section>
  );
}

function BriefItemRow({
  lang,
  item,
  index,
  openFull,
}: {
  lang: Lang;
  item: BriefItemCard;
  index: number;
  openFull: string;
}) {
  const href =
    item.slug && item.categorySlug ? `/${lang}/news/${item.categorySlug}/${item.slug}` : `/${lang}/news`;

  return (
    <Reveal delayMs={index * 50}>
      <li>
        <Link
          href={href}
          className="card-hover rounded-card border-border bg-surface flex cursor-pointer gap-4 border p-4 no-underline transition sm:p-5"
        >
          <span
            aria-hidden
            className="text-faint font-serif min-w-[30px] text-[1.6rem] leading-none font-bold"
          >
            {index + 1}
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
