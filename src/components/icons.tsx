/**
 * Self-contained inline SVG icon set (ported from the prototype).
 *
 * Dependency-free on purpose: these editorial surfaces must render identically
 * with no icon-package version drift, and the category glyphs (CategoryGlyph)
 * aren't in any off-the-shelf set. Every glyph is a 24×24 stroke path that
 * inherits `currentColor`, so it tints to the category colour for free.
 *
 * Pure presentational components — safe to import into Server Components.
 */
import { useId } from 'react';
import type { CSSProperties, ReactElement, SVGProps } from 'react';
import { MARK_COLOR, MARK_COLOR_DEEP, MARK_COLOR_CORE } from '@/lib/site';

/** Category icon keys — one glyph per editorial category. */
export type IconKey =
  | 'tools'
  | 'agents'
  | 'tutorials'
  | 'vibe'
  | 'models'
  | 'optimization'
  | 'creative'
  | 'local'
  | 'career';

type IconProps = {
  size?: number;
  strokeWidth?: number;
  style?: CSSProperties;
  className?: string;
};

function base(size: number, sw: number, style?: CSSProperties, className?: string): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: sw,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
    style,
    className,
  };
}

// ── category glyphs ──
function Tools({ size = 24, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M14.6 6.4a3.9 3.9 0 0 0-5.3 5l-5.1 5.2V20h3.3l5.2-5.2a3.9 3.9 0 0 0 5-5.3l-2.4 2.4-2.2-.4-.4-2.1z" />
    </svg>
  );
}
function Agents({ size = 24, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <circle cx="12" cy="5.5" r="2.3" />
      <circle cx="5.5" cy="18" r="2.3" />
      <circle cx="18.5" cy="18" r="2.3" />
      <path d="M11 7.6 6.6 15.9M13 7.6l4.4 8.3M7.8 18h8.4" />
    </svg>
  );
}
function Tutorials({ size = 24, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M3 5.6c2.6-1 5.6-1 9 1 3.4-2 6.4-2 9-1v13c-2.6-1-5.6-1-9 1-3.4-2-6.4-2-9-1z" />
      <path d="M12 6.6v13" />
    </svg>
  );
}
function Vibe({ size = 24, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M12 3c.8 4.2 2.8 6.2 7 7-4.2.8-6.2 2.8-7 7-.8-4.2-2.8-6.2-7-7 4.2-.8 6.2-2.8 7-7z" />
      <path d="M19 15.5v4M17 17.5h4" />
    </svg>
  );
}
function Models({ size = 24, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <ellipse cx="12" cy="12" rx="9" ry="3.6" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" />
      <circle cx="12" cy="12" r="1.1" />
    </svg>
  );
}
function Optimization({ size = 24, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M13 2.5 4.5 14h7l-1 7.5 8.5-11.5h-7z" />
    </svg>
  );
}
function Creative({ size = 24, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M4 20c1-3 2.4-4.6 5-5l7.6-9.6a2.1 2.1 0 0 1 3 3L10 16c-.5 2.6-2 4-6 4z" />
    </svg>
  );
}
function Local({ size = 24, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx=".6" />
      <path d="M9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5" />
    </svg>
  );
}
function Career({ size = 24, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12.5h18" />
    </svg>
  );
}

const MAP: Record<IconKey, (p: IconProps) => ReactElement> = {
  tools: Tools,
  agents: Agents,
  tutorials: Tutorials,
  vibe: Vibe,
  models: Models,
  optimization: Optimization,
  creative: Creative,
  local: Local,
  career: Career,
};

export function CategoryGlyph({ icon, ...rest }: IconProps & { icon: IconKey }) {
  const Cmp = MAP[icon] ?? Tools;
  return <Cmp {...rest} />;
}

// ── UI glyphs ──
export function SearchIcon({ size = 18, strokeWidth = 1.8, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}
export function ArrowRight({ size = 18, strokeWidth = 1.8, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
export function PlayIcon({ size = 18, strokeWidth = 1.7, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5 16 12l-6 3.5v-7Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
export function ClockIcon({ size = 16, strokeWidth = 1.7, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
export function CheckIcon({ size = 16, strokeWidth = 2, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M5 12.5 9.5 17 19 7" />
    </svg>
  );
}
export function MailIcon({ size = 18, strokeWidth = 1.7, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}
export function SparkleIcon({ size = 18, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M12 3c.5 3.5 1.5 4.5 5 5-3.5.5-4.5 1.5-5 5-.5-3.5-1.5-4.5-5-5 3.5-.5 4.5-1.5 5-5Z" />
      <path d="M18.5 14c.25 1.75.75 2.25 2.5 2.5-1.75.25-2.25.75-2.5 2.5-.25-1.75-.75-2.25-2.5-2.5 1.75-.25 2.25-.75 2.5-2.5Z" />
    </svg>
  );
}
export function Bookmark({
  size = 18,
  strokeWidth = 1.7,
  style,
  className,
  filled,
}: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(size, strokeWidth, style, className)} fill={filled ? 'currentColor' : 'none'}>
      <path d="M6 4h12v16l-6-4-6 4V4Z" />
    </svg>
  );
}
export function ShareIcon({ size = 18, strokeWidth = 1.7, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
    </svg>
  );
}
export function CommentIcon({ size = 18, strokeWidth = 1.7, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M4 5h16v11H9l-4 3v-3H4V5Z" />
    </svg>
  );
}
export function SlidersIcon({ size = 18, strokeWidth = 1.8, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5" />
      <circle cx="16" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="8" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="13" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
export function CloseIcon({ size = 20, strokeWidth = 1.8, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}
export function MenuIcon({ size = 20, strokeWidth = 1.8, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function SunIcon({ size = 18, strokeWidth = 1.7, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon({ size = 18, strokeWidth = 1.7, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </svg>
  );
}

export function ExternalLinkIcon({ size = 15, strokeWidth = 1.7, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

// ── brand mark ──
/**
 * Compact "ascend" mark — three rounded squares stepping up, the inline
 * companion to the full bloom mark used for the favicon/app icons (see
 * src/lib/brand-mark.ts). Used before the SITE_NAME wordmark in the header
 * and footer.
 */
export function BrandMark({ size = 24, className }: { size?: number; className?: string }) {
  const gradientId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      aria-hidden
      focusable={false}
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={MARK_COLOR} />
          <stop offset="100%" stopColor={MARK_COLOR_DEEP} />
        </linearGradient>
      </defs>
      <rect x="1" y="20" width="6" height="6" rx="1.7" fill={`url(#${gradientId})`} />
      <rect x="9" y="11" width="8" height="8" rx="2.2" fill={`url(#${gradientId})`} />
      <rect x="18" y="1" width="10" height="10" rx="2.8" fill={`url(#${gradientId})`} />
    </svg>
  );
}

/**
 * Full "bloom" mark — the standalone icon used for the favicon/app icons
 * (see src/lib/brand-mark.ts, BRAND_MARK_SVG — keep the two in sync). Used
 * on its own wherever the header/UI needs the brand identifiable without
 * the wordmark alongside it.
 */
export function BrandBloom({ size = 32, className }: { size?: number; className?: string }) {
  const gradientId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      focusable={false}
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="6%" y1="6%" x2="94%" y2="94%">
          <stop offset="0%" stopColor="#8DF3E6" />
          <stop offset="50%" stopColor={MARK_COLOR} />
          <stop offset="100%" stopColor={MARK_COLOR_DEEP} />
        </linearGradient>
      </defs>
      <rect x="4" y="16" width="8" height="8" rx="2.2" fill={MARK_COLOR} opacity="0.3" />
      <rect x="11" y="8" width="10" height="10" rx="2.6" fill={MARK_COLOR} opacity="0.55" />
      <rect x="20" y="1" width="27" height="27" rx="7.5" fill={`url(#${gradientId})`} />
      <rect x="37" y="18" width="27" height="27" rx="7.5" fill={`url(#${gradientId})`} />
      <rect x="20" y="35" width="27" height="27" rx="7.5" fill={`url(#${gradientId})`} />
      <rect x="24.5" y="24.5" width="15" height="15" rx="4.2" fill={MARK_COLOR_CORE} />
    </svg>
  );
}
