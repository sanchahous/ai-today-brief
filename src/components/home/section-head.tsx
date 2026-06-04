/** Shared eyebrow + heading + subtitle block used by the home sections. */
export function SectionHead({
  id,
  eyebrow,
  title,
  subtitle,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <p className="text-accent text-xs font-bold tracking-[0.14em] uppercase">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-2xl sm:text-3xl">
        {title}
      </h2>
      {subtitle && <p className="text-muted mt-1 max-w-xl text-sm">{subtitle}</p>}
    </div>
  );
}
