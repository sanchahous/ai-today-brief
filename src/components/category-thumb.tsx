import { CategoryGlyph, type IconKey } from '@/components/icons';

export function CategoryThumb({
  name,
  color,
  icon,
  size = 92,
}: {
  name: string;
  color: string;
  icon: IconKey;
  size?: number;
}) {
  const c = color || '#888888';
  return (
    <div
      role="img"
      aria-label={name}
      className="grid aspect-square w-full place-items-center rounded-[10px]"
      style={{
        maxWidth: size,
        color: c,
        background: `linear-gradient(140deg, ${c}33, ${c}14)`,
        border: `1px solid ${c}44`,
      }}
    >
      <CategoryGlyph icon={icon} size={Math.round(size * 0.34)} strokeWidth={1.5} />
    </div>
  );
}
