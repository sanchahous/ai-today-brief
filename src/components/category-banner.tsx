import { CategoryGlyph, PlayIcon, type IconKey } from '@/components/icons';
/**
 * 16:9 category hero banner (glyph watermark + decorative motif).
 * Ported from the prototype — pure CSS/SVG, no motion deps.
 */
export function CategoryBanner({
  name,
  color,
  icon,
  variant = 'hero',
  motif = 0,
  videoBadge = false,
  videoLabel,
}: {
  name: string;
  color: string;
  icon: IconKey;
  variant?: 'card' | 'hero';
  motif?: number;
  videoBadge?: boolean;
  videoLabel?: string;
}) {
  const c = color || '#888888';
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
        background: `linear-gradient(135deg, ${c}cc 0%, ${c}55 60%, ${c}22 100%)`,
        border: `1px solid ${c}55`,
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
            <circle cx="320" cy="180" r="60" fill="none" stroke={`${c}66`} strokeWidth="1" />
            <circle cx="320" cy="180" r="110" fill="none" stroke={`${c}55`} strokeWidth="1" />
            <circle cx="320" cy="180" r="170" fill="none" stroke={`${c}33`} strokeWidth="1" />
          </>
        )}
        {m === 1 && (
          <>
            <line x1="0" y1="40" x2="320" y2="-20" stroke={`${c}55`} strokeWidth="1" />
            <line x1="0" y1="90" x2="320" y2="30" stroke={`${c}44`} strokeWidth="1" />
            <line x1="0" y1="140" x2="320" y2="80" stroke={`${c}33`} strokeWidth="1" />
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
              stroke={`${c}33`}
              strokeWidth="1"
            />
          ))}
        <rect x="0" y="0" width="320" height="180" fill={`url(#${patternId})`} />
      </svg>

      <div
        aria-hidden
        className={`absolute text-white/20 ${variant === 'hero' ? 'right-5 bottom-5' : 'right-3 bottom-3'}`}
      >
        <CategoryGlyph icon={icon} size={glyphSize} strokeWidth={1.2} />
      </div>

      {variant === 'hero' && (
        <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2">
          <span className="font-serif text-lg font-semibold text-white drop-shadow-sm">{name}</span>
          {videoBadge && videoLabel && (
            <span
              className="pulse inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[0.72rem] font-semibold"
              style={{ background: `${c}ee`, color: '#141414' }}
            >
              <PlayIcon size={13} /> {videoLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
