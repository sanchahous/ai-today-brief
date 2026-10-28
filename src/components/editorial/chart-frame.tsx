import { useId, type ReactNode } from 'react';

export function ChartFrame({
  chart,
  title,
  sourceLine,
  description,
  children,
}: {
  chart: 'comparison' | 'metrics' | 'key-numbers';
  title: string;
  sourceLine: string;
  description: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const descId = useId();

  return (
    <figure
      data-chart={chart}
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="border-line bg-surface my-6 min-w-0 max-w-full overflow-x-clip rounded-[var(--radius-md)] border px-4 py-4"
    >
      <figcaption
        id={titleId}
        className="text-accent m-0 font-mono text-2xs font-medium tracking-[var(--tracking-eyebrow)] uppercase"
      >
        {title}
      </figcaption>
      <p className="text-muted mt-1 mb-3 text-xs leading-normal break-words">{sourceLine}</p>
      <p id={descId} className="sr-only">
        {description}
      </p>
      {children}
    </figure>
  );
}
