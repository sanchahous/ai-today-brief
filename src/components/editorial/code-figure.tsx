'use client';

import type { Lang } from '@/lib/site';
import { useToast } from '@/components/ui/toast';
import { getStrings } from '@/lib/i18n';

export function CodeFigure({
  lang,
  code,
  language,
  caption,
}: {
  lang: Lang;
  code: string;
  language?: string;
  caption?: string;
}) {
  const t = getStrings(lang);
  const { toast } = useToast();

  const handleCopy = () => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(code).then(() => {
        toast({ message: t.codeCopied ?? 'Copied ✓', tone: 'success' });
      }).catch(() => {
        toast({ message: lang === 'uk' ? 'Помилка копіювання' : 'Failed to copy', tone: 'error' });
      });
    } else {
      toast({ message: lang === 'uk' ? 'Буфер обміну недоступний' : 'Clipboard unavailable', tone: 'info' });
    }
  };

  return (
    <figure className="my-6">
      <div className="relative group overflow-hidden rounded-xl border border-line bg-raised">
        <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2">
          <span className="text-xs font-mono text-muted uppercase tracking-wider">
            {language || 'text'}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs font-medium text-muted hover:text-text transition-colors flex items-center justify-center min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] -mx-2 -my-2"
          >
            {t.copyCode ?? 'Copy'}
          </button>
        </div>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={caption || 'Code block'}>
          <pre className="p-4 text-[13px] leading-relaxed sm:text-[14px]">
            <code>{code}</code>
          </pre>
        </div>
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
