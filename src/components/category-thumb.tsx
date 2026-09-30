import type { CSSProperties } from 'react';
import { categoryColor } from '@/lib/category-meta';
import { CategoryGlyph, type IconKey } from '@/components/icons';

export function CategoryThumb({
  name,
  slug,
  color,
  icon,
  size = 92,
}: {
  name: string;
  slug: string | null;
  color: string | null;
  icon: IconKey;
  size?: number;
}) {
  const c = categoryColor(slug, color);
  return (
    <div
      role="img"
      aria-label={name}
      className="cat-thumb grid aspect-square w-full place-items-center rounded-[10px]"
      style={{ '--cat-color': c, maxWidth: size } as CSSProperties}
    >
      <CategoryGlyph icon={icon} size={Math.round(size * 0.34)} strokeWidth={1.5} />
    </div>
  );
}
