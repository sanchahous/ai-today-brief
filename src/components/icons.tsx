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
import type { CSSProperties, ReactElement, SVGProps } from 'react';

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
      <path d="M14.5 5.5a3.5 3.5 0 0 1-4.7 4.6l-5.1 5.1a1.8 1.8 0 1 0 2.6 2.6l5.1-5.1a3.5 3.5 0 0 0 4.6-4.7l-2.1 2.1-2-2 2.1-2.1Z" />
      <path d="m15.5 13.5 3.8 3.8a1.5 1.5 0 0 1-2.1 2.1l-3.8-3.8" />
    </svg>
  );
}
function Agents({ size = 24, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <rect x="5" y="9" width="14" height="9" rx="2.5" />
      <path d="M12 6V9M9.5 3.5 12 6l2.5-2.5" />
      <circle cx="9.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
      <path d="M3 12v3M21 12v3" />
    </svg>
  );
}
function Tutorials({ size = 24, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M3 6.5A2 2 0 0 1 5 5h5a2 2 0 0 1 2 2v12a1.7 1.7 0 0 0-1.5-1H4a1 1 0 0 1-1-1V6.5Z" />
      <path d="M21 6.5A2 2 0 0 0 19 5h-5a2 2 0 0 0-2 2v12a1.7 1.7 0 0 1 1.5-1H20a1 1 0 0 0 1-1V6.5Z" />
    </svg>
  );
}
function Vibe({ size = 24, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="m9 8-4 4 4 4M15 8l4 4-4 4" />
      <path d="m13 6-2 12" />
    </svg>
  );
}
function Models({ size = 24, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M12 3a4 4 0 0 0-4 4 3.5 3.5 0 0 0-1 6.8V17a3 3 0 0 0 5 2.2A3 3 0 0 0 17 17v-3.2A3.5 3.5 0 0 0 16 7a4 4 0 0 0-4-4Z" />
      <path d="M12 3v16" />
    </svg>
  );
}
function Optimization({ size = 24, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M12 21a8 8 0 1 1 8-8" />
      <path d="m12 13 4-4" />
      <path d="M18.5 13.5 21 11M16 18l2 2 4-4.5" />
    </svg>
  );
}
function Creative({ size = 24, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M12 3a9 9 0 1 0 0 18c1.3 0 2-1 2-2 0-.6-.3-1-.7-1.4-.4-.4-.8-.8-.8-1.4 0-.8.7-1.4 1.5-1.4H16a5 5 0 0 0 5-5c0-3.9-4-6.4-9-6.4Z" />
      <circle cx="8" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function Local({ size = 24, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <rect x="3" y="5" width="18" height="6" rx="1.5" />
      <rect x="3" y="13" width="18" height="6" rx="1.5" />
      <path d="M7 8h.01M7 16h.01" />
    </svg>
  );
}
function Career({ size = 24, strokeWidth = 1.6, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
      <path d="M3 12h18" />
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
export function ExternalLinkIcon({ size = 15, strokeWidth = 1.7, style, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style, className)}>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </svg>
  );
}
