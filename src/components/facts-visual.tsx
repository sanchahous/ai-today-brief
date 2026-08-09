import type { CSSProperties } from 'react';
import type { FactsVisual } from '@/lib/facts-visual';

/**
 * Chart layer of the facts box (P12 iteration 2): comparison bars when the
 * values are genuinely comparable, big-number stat cards otherwise. Pure
 * presentation — the decision logic lives in `src/lib/facts-visual.ts`.
 * aria-hidden: the adjacent facts table carries the same data for readers.
 */
export function FactsVisualBlock({ visual, color }: { visual: FactsVisual; color: string }) {
  if (visual.kind === 'comparison') {
    return (
      <div aria-hidden className="border-border border-b px-4 py-3.5">
        <div className="grid gap-2">
          {visual.items.map((item) => (
            <div
              key={item.label}
              className="grid grid-cols-[minmax(96px,9rem)_minmax(0,1fr)_auto] items-center gap-3"
            >
              <span className="text-muted truncate text-[0.78rem]">{item.label}</span>
              <span className="bg-surface-2 h-2.5 overflow-hidden rounded-pill">
                <span
                  className="block h-full rounded-pill"
                  style={{
                    width: `${Math.max(6, item.ratio * 100)}%`,
                    background: `color-mix(in srgb, ${color} 75%, var(--text))`,
                  } as CSSProperties}
                />
              </span>
              <span className="text-[0.8rem] font-semibold tabular-nums">{item.display}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div aria-hidden className="border-border grid grid-cols-2 border-b sm:grid-cols-4">
      {visual.items.map((item, i) => (
        <div
          key={item.label}
          className={`flex flex-col gap-1 px-4 py-3.5 ${i > 0 ? 'border-border border-l' : ''}`}
        >
          <span
            className="font-serif text-xl leading-tight font-semibold"
            style={{ color: `color-mix(in srgb, ${color} 70%, var(--text))` }}
          >
            {item.display}
          </span>
          <span className="text-faint text-[0.72rem] leading-snug">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
