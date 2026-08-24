import Link from 'next/link';
import type { WeeklyDigestItemView } from '@/lib/digests';
import type { Lang } from '@/lib/site';
import { WEEKLY_COPY } from './copy';

/** Keeps the board scannable: past five rows it reads like a second digest. */
const MAX_ACTIONS = 5;

export function weeklyActionItems(items: WeeklyDigestItemView[]) {
  return items.filter((item) => item.practicalExample.trim()).slice(0, MAX_ACTIONS);
}

/**
 * Issue-level answer to "what do I do with this week?".
 *
 * The stories already carry a practical example each, but until this board the
 * only way to find them was to read the whole issue top to bottom. Nothing is
 * generated here -- the copy is the story's own approved `practical` field.
 */
export function WeeklyActionBoard({
  items,
  lang,
}: {
  items: WeeklyDigestItemView[];
  lang: Lang;
}) {
  const copy = WEEKLY_COPY[lang];
  const actions = weeklyActionItems(items);
  if (!actions.length) return null;

  return (
    <section
      aria-labelledby="weekly-actions-title"
      data-digest-event="action_board_view"
      className="border-accent/35 bg-surface rounded-card mt-12 border border-l-4 p-6 sm:p-8"
    >
      <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">
        {copy.actionBoardEyebrow}
      </p>
      <h2 id="weekly-actions-title" className="mt-2 text-2xl sm:text-3xl">
        {copy.actionBoard}
      </h2>
      <p className="text-muted mt-2 max-w-2xl leading-7">{copy.actionBoardNote}</p>

      <ol className="mt-6 grid gap-5">
        {actions.map((item, index) => (
          <li
            key={item.id}
            className="border-border-soft grid grid-cols-[2rem_minmax(0,1fr)] gap-4 border-t pt-5 first:border-t-0 first:pt-0"
          >
            <span
              aria-hidden
              className="text-accent font-serif text-2xl leading-none font-semibold"
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="leading-7">{item.practicalExample}</p>
              <Link
                href={`#story-${item.rank}`}
                data-digest-event="action_board_jump"
                className="text-accent mt-2 inline-block text-sm font-semibold no-underline hover:underline"
              >
                {copy.actionBoardJump} <span aria-hidden>↓</span>
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
