'use client';

import type { Lang } from '@/lib/site';
import { useToast } from '@/components/ui/toast';
import { getStrings } from '@/lib/i18n';
import { CodePanel } from './code-panel';

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
      void navigator.clipboard
        .writeText(code)
        .then(() => {
          toast({ message: t.codeCopied ?? 'Copied ✓', tone: 'success' });
        })
        .catch(() => {
          toast({ message: lang === 'uk' ? 'Помилка копіювання' : 'Failed to copy', tone: 'error' });
        });
    } else {
      toast({
        message: lang === 'uk' ? 'Буфер обміну недоступний' : 'Clipboard unavailable',
        tone: 'info',
      });
    }
  };

  return (
    <figure className="my-6">
      <CodePanel
        code={code}
        language={language}
        label={caption || 'Code block'}
        className="!my-0"
        action={
          <button
            type="button"
            onClick={handleCopy}
            className="-mx-2 -my-2 flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center font-mono text-2xs tracking-[0.1em] text-[var(--code-ink-muted)] uppercase transition-colors hover:text-[var(--code-ink)]"
          >
            {t.copyCode ?? 'Copy'}
          </button>
        }
      />
      {caption && <figcaption className="text-muted mt-2 text-center text-sm">{caption}</figcaption>}
    </figure>
  );
}
