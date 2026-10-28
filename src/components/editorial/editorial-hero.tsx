import type { ReactNode } from 'react';

export function BannerHeroFrame({
  art,
  children,
  className = '',
  id,
  testId,
}: {
  art: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  testId?: string;
}) {
  return (
    <figure
      id={id}
      data-testid={testId}
      className={`banner-hero-frame ${className}`.trim()}
    >
      <div className="banner-hero-art">{art}</div>
      <div aria-hidden className="banner-hero-scrim" />
      <div className="banner-hero-copy">{children}</div>
    </figure>
  );
}

export function BannerHeroCopy({
  eyebrow,
  title,
  dek,
  meta,
  footer,
  titleLevel = 1,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  dek?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  titleLevel?: 1 | 2 | 3;
}) {
  const TitleTag = titleLevel === 1 ? 'h1' : titleLevel === 2 ? 'h2' : 'h3';

  return (
    <>
      {eyebrow ? <div className="banner-hero-eyebrow">{eyebrow}</div> : null}
      <TitleTag className="banner-hero-title">{title}</TitleTag>
      {dek ? <div className="banner-hero-dek">{dek}</div> : null}
      {meta ? <div className="banner-hero-meta">{meta}</div> : null}
      {footer ? <div className="mt-3">{footer}</div> : null}
    </>
  );
}

export function EditorialHero({
  eyebrow,
  title,
  dek,
  meta,
  cta,
  level = 1,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  dek?: ReactNode;
  meta?: ReactNode;
  cta?: ReactNode;
  level?: 1 | 2 | 3;
}) {
  return (
    <header className="mx-auto max-w-[800px] px-4 py-12 text-center sm:px-6 md:py-16 lg:px-8">
      {eyebrow && (
        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-accent">
          {eyebrow}
        </div>
      )}

      {level === 1 && (
        <h1 className="mb-6 font-serif text-3xl font-bold tracking-tight text-text sm:text-4xl md:text-5xl lg:text-6xl text-balance">
          {title}
        </h1>
      )}
      {level === 2 && (
        <h2 className="mb-6 font-serif text-3xl font-bold tracking-tight text-text sm:text-4xl md:text-5xl lg:text-6xl text-balance">
          {title}
        </h2>
      )}
      {level === 3 && (
        <h3 className="mb-6 font-serif text-3xl font-bold tracking-tight text-text sm:text-4xl md:text-5xl lg:text-6xl text-balance">
          {title}
        </h3>
      )}

      {dek && (
        <div className="mx-auto mb-8 max-w-[600px] text-lg text-muted sm:text-xl text-balance">
          {dek}
        </div>
      )}

      {meta && (
        <div className="mb-8 flex flex-wrap items-center justify-center gap-3 text-sm text-muted">
          {meta}
        </div>
      )}

      {cta && <div className="flex justify-center">{cta}</div>}
    </header>
  );
}
