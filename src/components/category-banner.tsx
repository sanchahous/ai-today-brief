import { CategoryGlyph, PlayIcon, type IconKey } from '@/components/icons';
import { categoryArtColor } from '@/lib/category-meta';
/**
 * 16:9 category hero banner (glyph watermark + decorative motif).
 * Ported from the prototype — pure CSS/SVG, no motion deps.
 */
export function CategoryBanner({
  name,
  slug,
  color,
  icon,
  variant = 'hero',
  motif = 0,
  videoBadge = false,
  videoLabel,
}: {
  name: string;
  slug: string | null;
  color: string | null;
  icon: IconKey;
  variant?: 'card' | 'hero';
  motif?: number;
  videoBadge?: boolean;
  videoLabel?: string;
}) {
  const c = categoryArtColor(slug, color);
  const m = (((motif % 3) + 3) % 3) as 0 | 1 | 2;
  const patternId = `banner-dots-${icon}-${m}`;
  const glyphSize = variant === 'hero' ? 88 : 60;

  return (
    <div
      role="img"
      aria-label={`${name} banner`}
      className={`relative w-full overflow-hidden ${variant === 'hero' ? 'rounded-card' : 'rounded-[10px]'}`}
      style={{
        aspectRatio: '16 / 9',
        background: `linear-gradient(135deg, color-mix(in srgb, ${c} 12%, var(--art-stage)), var(--art-stage))`,
        border: `1px solid color-mix(in srgb, ${c} 33%, var(--art-stage))`,
      }}
    >
      <svg
        aria-hidden
        viewBox="0 0 320 180"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <pattern id={patternId} width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.1" fill={c} fillOpacity="0.22" />
          </pattern>
        </defs>
        {m === 0 && (
          <>
            <circle cx="320" cy="180" r="60" fill="none" stroke={c} strokeOpacity="0.4" strokeWidth="1" />
            <circle cx="320" cy="180" r="110" fill="none" stroke={c} strokeOpacity="0.33" strokeWidth="1" />
            <circle cx="320" cy="180" r="170" fill="none" stroke={c} strokeOpacity="0.2" strokeWidth="1" />
          </>
        )}
        {m === 1 && (
          <>
            <line x1="0" y1="40" x2="320" y2="-20" stroke={c} strokeOpacity="0.33" strokeWidth="1" />
            <line x1="0" y1="90" x2="320" y2="30" stroke={c} strokeOpacity="0.27" strokeWidth="1" />
            <line x1="0" y1="140" x2="320" y2="80" stroke={c} strokeOpacity="0.2" strokeWidth="1" />
          </>
        )}
        {m === 2 &&
          Array.from({ length: 6 }).map((_, i) => (
            <line
              key={i}
              x1={50 + i * 50}
              y1={-10}
              x2={20 + i * 50}
              y2={190}
              stroke={c}
              strokeOpacity="0.2"
              strokeWidth="1"
            />
          ))}
        <rect x="0" y="0" width="320" height="180" fill={`url(#${patternId})`} />
      </svg>

      <div
        aria-hidden
        style={{ color: c, opacity: 0.2 }}
        className={`absolute ${variant === 'hero' ? 'right-5 bottom-5' : 'right-3 bottom-3'}`}
      >
        <CategoryGlyph icon={icon} size={glyphSize} strokeWidth={1.2} />
      </div>

      {variant === 'hero' && (
        <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2">
          <span className="font-serif text-lg font-semibold" style={{ color: 'var(--art-text)' }}>{name}</span>
          {videoBadge && videoLabel && (
            <span
              className="pulse inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-2xs font-semibold"
              style={{ background: c, color: 'var(--art-stage)' }}
            >
              <PlayIcon size={13} /> {videoLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
