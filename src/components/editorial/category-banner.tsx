import type { CSSProperties } from 'react';
import { CategoryGlyph, PlayIcon, type IconKey } from '@/components/icons';
import { categoryArtColor, categoryMeta } from '@/lib/category-meta';
import { hashSeed } from '@/lib/hash-seed';
import styles from './editorial.module.css';

export interface CategoryBannerProps {
  /** Deterministic story/item ID used to calculate rotation tilt, groove shift, and dot placement. */
  id?: string | number | null;
  /** Editorial category slug (resolves to `--art-<key>` token). */
  slug: string | null | undefined;
  /** Category display name. */
  name?: string | null;
  /** DB color fallback if slug is unknown. */
  color?: string | null;
  /** Explicit icon override; defaults to categoryMeta(slug).icon. */
  icon?: IconKey;
  /** Presentation variant: 'card' (16/10), 'hero' (16/7), or 'thumb' (1/1). */
  variant?: 'card' | 'hero' | 'thumb';
  /** Whether the story features a video. */
  hasVideo?: boolean;
  /** Backwards compatibility alias for hasVideo. */
  videoBadge?: boolean;
  /** Localised video label (e.g. "Video" / "Відео"). */
  videoLabel?: string;
  /** Optional override for the category glyph size. */
  glyphSize?: number;
  /** Backwards compatibility motif index. */
  motif?: number;
  /** Additional CSS class names. */
  className?: string;
  /** Whether the banner is purely decorative (defaults to true). */
  ariaHidden?: boolean;
}

/**
 * After Hours CategoryBanner: deterministic brass grooves + category hue `--art-<key>` + signal dot.
 * Replaces both the old CategoryBanner motif and CategoryThumb placeholder.
 */
export function CategoryBanner({
  id,
  slug,
  name,
  color,
  icon,
  variant = 'card',
  hasVideo = false,
  videoBadge = false,
  videoLabel = 'Video',
  glyphSize,
  motif,
  className = '',
  ariaHidden = true,
}: CategoryBannerProps) {
  const art = categoryArtColor(slug, color);
  const iconKey = icon ?? categoryMeta(slug).icon;
  const showVideo = hasVideo || videoBadge;

  // Deterministic seed computation: guarantees the same id gives the exact same grooves and dot.
  const seed = hashSeed(id ?? motif ?? slug ?? name ?? 0);
  const tilt = (seed % 24) - 12;
  const shift = seed % 60;

  const grooves = Array.from({ length: 9 }, (_, i) => {
    const inset = i * 11;
    return `M${40 + inset + shift} 214 L${150 + shift} ${34 + inset * 1.6} L${260 - inset + shift} 214`;
  });

  const dotCx = 230 + (seed % 50);
  const dotCy = 40 + (seed % 30);

  const defaultGlyphSize = variant === 'hero' ? 44 : variant === 'thumb' ? 24 : 30;
  const resolvedGlyphSize = glyphSize ?? defaultGlyphSize;

  const variantClass =
    variant === 'hero'
      ? `${styles.catBannerHero} banner-hero`
      : variant === 'thumb'
        ? `${styles.catBannerThumb} banner-thumb`
        : '';

  return (
    <div
      role={ariaHidden ? undefined : 'img'}
      aria-label={ariaHidden ? undefined : `${name ?? 'Category'} banner`}
      aria-hidden={ariaHidden ? true : undefined}
      className={`cat-banner ${styles.catBanner} ${variantClass} ${className}`}
      style={{ '--art': art } as CSSProperties}
    >
      <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" focusable={false}>
        <g
          className={`cat-banner-grooves ${styles.catBannerGrooves}`}
          transform={`rotate(${tilt} 160 110)`}
        >
          {grooves.map((d, index) => (
            <path key={index} d={d} />
          ))}
        </g>
        <circle className={`cat-banner-dot ${styles.catBannerDot}`} cx={dotCx} cy={dotCy} r={5} />
      </svg>

      <span className={`cat-banner-glyph ${styles.catBannerGlyph}`}>
        <CategoryGlyph icon={iconKey} size={resolvedGlyphSize} />
      </span>

      {showVideo && (
        <span className={`cat-banner-badge ${styles.catBannerBadge}`}>
          <PlayIcon size={12} />
          <span>{videoLabel}</span>
        </span>
      )}
    </div>
  );
}
