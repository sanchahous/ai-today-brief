import type { Lang } from '@/lib/site';
import { ChartFrame } from './chart-frame';
import type { SourcedNumber } from './story-visuals';
import { sourceLine, valuesDescription, visualCopy } from './visual-copy';

export function KeyNumbers({
  lang,
  items,
  sourceName,
}: {
  lang: Lang;
  items: SourcedNumber[];
  sourceName: string;
}) {
  if (items.length < 1) return null;
  const copy = visualCopy(lang);
  const labels = items.map((item) => item.label);

  return (
    <ChartFrame
      chart="key-numbers"
      title={copy.keyNumbersTitle}
      sourceLine={sourceLine(lang, sourceName, labels)}
      description={valuesDescription(lang, sourceName, items, copy.keyNumbersNote)}
    >
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
        {items.map((item, index) => (
          <li
            key={`${item.label}:${item.display}:${index}`}
            className="bg-raised min-w-0 rounded-[var(--radius-sm)] px-3 py-3"
          >
            <span className="text-faint block font-mono text-2xs font-medium tracking-[var(--tracking-eyebrow)] uppercase break-words">
              {item.label}
            </span>
            <strong className="text-accent mt-2 block font-serif text-2xl leading-tight font-normal break-words tabular-nums">
              {item.display}
            </strong>
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}
