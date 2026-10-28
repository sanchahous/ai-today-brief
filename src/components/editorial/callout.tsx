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
  const accentBar =
    variant === 'limits'
      ? 'border-l-warning'
      : variant === 'editor-take'
        ? 'border-l-accent'
        : 'border-l-accent';

  return (
    <aside
      className={`border-line bg-surface my-6 min-w-0 max-w-full scroll-mt-[calc(var(--header-h,4rem)+2.5rem)] rounded-r-[var(--radius-md)] border border-l-[3px] py-5 pr-5 pl-[calc(1.25rem-3px)] sm:py-6 sm:pr-6 ${accentBar}`}
    >
      <div className="text-text font-serif text-lg font-semibold">{getTitle()}</div>
      <div className="reading-copy text-text mt-2 max-w-none text-[length:var(--text-lg)]">
        {children}
      </div>
      {isEditorTake && (
        <div className="text-muted mt-3 font-mono text-2xs tracking-[0.08em] uppercase">
          {lang === 'uk' ? 'Редакційна думка' : 'Opinion disclaimer'}
        </div>
      )}
    </aside>
  );
}
