/**
 * Category name as a coloured pill. The colour comes from the DB row (dynamic),
 * so it lives in an inline style — the only thing Tailwind utilities can't
 * express here. Renders nothing without a name (legacy items).
 */
export function CategoryBadge({
  name,
  color,
  size = 'sm',
}: {
  name: string | null;
  color: string | null;
  size?: 'sm' | 'md';
}) {
  if (!name) return null;
  const c = color ?? '#888888';
  const sizeClasses = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[0.68rem]';
  return (
    <span
      className={`rounded-pill inline-flex items-center font-semibold tracking-wide whitespace-nowrap uppercase ${sizeClasses}`}
      style={{ color: c, background: `${c}1f`, border: `1px solid ${c}55` }}
    >
      {name}
    </span>
  );
}
