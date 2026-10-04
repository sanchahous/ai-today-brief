import type { ReactNode } from 'react';
import type { Lang } from '@/lib/site';

export type CalloutVariant = 'why-it-matters' | 'definition' | 'editor-take' | 'limits';

export function Callout({
  lang,
  variant,
  title,
  children,
}: {
  lang: Lang;
  variant: CalloutVariant;
  title?: string;
  children: ReactNode;
}) {
  const getIcon = () => {
    switch (variant) {
      case 'why-it-matters':
        return '💡';
      case 'definition':
        return '📖';
      case 'editor-take':
        return '✍️';
      case 'limits':
        return '⚠️';
    }
  };

  const getTitle = () => {
    if (title) return title;
    const isUk = lang === 'uk';
    switch (variant) {
      case 'why-it-matters':
        return isUk ? 'Чому це важливо' : 'Why it matters';
      case 'definition':
        return isUk ? 'Визначення' : 'Definition';
      case 'editor-take':
        return isUk ? 'Погляд редактора' : "Editor's take";
      case 'limits':
        return isUk ? 'Обмеження' : 'Limitations & Uncertainty';
    }
  };

  const isEditorTake = variant === 'editor-take';

  return (
    <aside className={`my-6 rounded-xl border p-4 sm:p-5 ${
      variant === 'limits' ? 'border-warning/30 bg-warning/5 text-warning-contrast' :
      variant === 'editor-take' ? 'border-accent/30 bg-accent/5' :
      'border-border bg-surface-2'
    }`}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-xl leading-none select-none mt-0.5">
          {getIcon()}
        </span>
        <div className="flex-1">
          <h4 className="font-serif text-lg font-semibold mb-2">
            {getTitle()}
          </h4>
          <div className="reading-copy text-[0.95em] opacity-90">
            {children}
          </div>
          {isEditorTake && (
            <div className="mt-3 text-xs font-mono text-muted uppercase tracking-wider">
              {lang === 'uk' ? 'Редакційна думка' : 'Opinion disclaimer'}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
