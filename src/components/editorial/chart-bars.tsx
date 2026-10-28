import type { Lang } from '@/lib/site';
import { ChartFrame } from './chart-frame';
import { MetricsMiniChart } from './chart-metrics';
import type { SourcedMetric } from './story-visuals';
import { sourceLine, valuesDescription, visualCopy } from './visual-copy';

function barWidth(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return '6%';
  const width = Math.min(100, Math.max(6, ratio * 100));
  return `${width}%`;
}

export function ComparisonChart({
  lang,
  items,
  sourceName,
}: {
  lang: Lang;
  items: SourcedMetric[];
  sourceName: string;
}) {
  if (items.length < 2) return null;
  const copy = visualCopy(lang);
  const labels = items.map((item) => item.label);

  return (
    <ChartFrame
      chart="comparison"
      title={copy.comparisonTitle}
      sourceLine={sourceLine(lang, sourceName, labels)}
      description={valuesDescription(lang, sourceName, items, copy.chartNote)}
    >
      <p className="text-faint m-0 mb-2 font-mono text-2xs font-medium tracking-[var(--tracking-eyebrow)] uppercase">
        {copy.metricsTitle}
      </p>
      <MetricsMiniChart items={items} embedded />
      <ul className="m-0 mt-4 grid list-none gap-3 p-0">
        {items.map((item, index) => (
          <li key={`${item.label}:${item.display}:${index}`} className="grid min-w-0 gap-1">
            <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
              <span className="text-muted min-w-0 text-xs break-words">{item.label}</span>
              <span className="text-text text-xs font-semibold break-words tabular-nums">{item.display}</span>
            </span>
            <span className="bg-chart-track block h-2.5 overflow-hidden rounded-pill" aria-hidden="true">
              <span className="bg-accent block h-full rounded-pill" style={{ width: barWidth(item.ratio) }} />
            </span>
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}
