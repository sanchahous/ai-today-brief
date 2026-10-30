import type { Lang } from '@/lib/site';
import { ChartFrame } from './chart-frame';
import type { SourcedMetric } from './story-visuals';
import { sourceLine, valuesDescription, visualCopy } from './visual-copy';

/** Floor so a true zero still draws a sliver; the label stays the source string. */
function columnHeight(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return '8%';
  const height = Math.min(100, Math.max(8, ratio * 100));
  return `${height}%`;
}

function MiniColumns({ items }: { items: SourcedMetric[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap items-end gap-2 p-0" data-chart="metrics">
      {items.map((item, index) => (
        <li
          key={`${item.label}:${item.display}:${index}`}
          className="flex min-w-16 max-w-full flex-1 flex-col items-stretch gap-1"
        >
          <span className="text-text text-center text-xs font-semibold break-words tabular-nums">
            {item.display}
          </span>
          <span
            className="bg-chart-track flex h-16 items-end overflow-hidden rounded-[var(--radius-sm)]"
            aria-hidden="true"
          >
            <span className="bg-accent block w-full" style={{ height: columnHeight(item.ratio) }} />
          </span>
          <span className="text-muted text-center text-2xs leading-snug break-words">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

type MetricsMiniChartProps =
  | { items: SourcedMetric[]; embedded: true }
  | { items: SourcedMetric[]; embedded?: false; lang: Lang; sourceName: string };

export function MetricsMiniChart(props: MetricsMiniChartProps) {
  if (props.items.length < 2) return null;
  const columns = <MiniColumns items={props.items} />;
  if (props.embedded) return columns;

  const copy = visualCopy(props.lang);
  const labels = props.items.map((item) => item.label);
  return (
    <ChartFrame
      chart="metrics"
      title={copy.metricsTitle}
      sourceLine={sourceLine(props.lang, props.sourceName, labels)}
      description={valuesDescription(props.lang, props.sourceName, props.items, copy.chartNote)}
    >
      {columns}
    </ChartFrame>
  );
}
