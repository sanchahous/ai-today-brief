import type { BriefSummary } from '@/lib/briefs';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { DailyItem } from '@/components/daily/daily-item';

export function BriefItemsList({
  lang,
  brief,
}: {
  lang: Lang;
  brief: BriefSummary;
}) {
  const t = getStrings(lang);

  return (
    <section>
      <p className="text-faint m-0 mb-4 text-2xs font-bold tracking-[0.1em] uppercase">
        {t.briefItemsLabel} · {brief.items.length}
      </p>
      <ol className="m-0 grid list-none gap-4 p-0">
        {brief.items.map((item, i) => (
          <DailyItem key={item.id} lang={lang} item={item} index={i + 1} />
        ))}
      </ol>
    </section>
  );
}
