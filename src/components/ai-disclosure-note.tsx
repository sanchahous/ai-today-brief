import Link from 'next/link';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { SparkleIcon } from '@/components/icons';

/** Quiet AI Act art. 50 disclosure chip — links to the full disclosure page. */
export function AiDisclosureNote({ lang, variant = 'pill' }: { lang: Lang; variant?: 'pill' | 'inline' }) {
  const t = getStrings(lang);
  
  if (variant === 'inline') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="text-accent inline-flex">
          <SparkleIcon size={14} />
        </span>
        <Link className="text-text hover:text-accent font-medium underline decoration-[color:var(--border)] underline-offset-2 hover:decoration-current transition-colors" href={`/${lang}/ai-disclosure`}>
          {t.aiNoteLabel}
        </Link>
      </span>
    );
  }

  return (
    <div className="border-border bg-surface text-muted inline-flex flex-wrap items-center gap-2 rounded-pill border px-2.5 py-1.5 text-[0.76rem]">
      <span aria-hidden className="text-accent inline-flex">
        <SparkleIcon size={14} />
      </span>
      <span>{t.aiNoteLabel}</span>
      <span aria-hidden className="text-faint">
        ·
      </span>
      <Link className="text-accent font-semibold no-underline hover:underline" href={`/${lang}/ai-disclosure`}>
        {t.aiNoteLink}
      </Link>
    </div>
  );
}
