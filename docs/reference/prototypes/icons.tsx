/**
 * Self-contained inline SVG icon set.
 *
 * We deliberately avoid a third-party icon package here: the prototype must
 * render identically wherever it's opened, with no risk of a missing export
 * or version drift. Every icon is a 24×24 stroke glyph that inherits
 * `currentColor`, so it tints to the category colour for free.
 */
import React from 'react';
import type { IconKey } from './data';

type IconProps = {
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
};

const base = (
  size: number,
  sw: number,
  style?: React.CSSProperties,
): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: sw,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
  style,
});

// ── category glyphs ──
function Tools({ size = 24, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M14.5 5.5a3.5 3.5 0 0 1-4.7 4.6l-5.1 5.1a1.8 1.8 0 1 0 2.6 2.6l5.1-5.1a3.5 3.5 0 0 0 4.6-4.7l-2.1 2.1-2-2 2.1-2.1Z" />
      <path d="m15.5 13.5 3.8 3.8a1.5 1.5 0 0 1-2.1 2.1l-3.8-3.8" />
    </svg>
  );
}
function Agents({ size = 24, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <rect x="5" y="9" width="14" height="9" rx="2.5" />
      <path d="M12 6V9M9.5 3.5 12 6l2.5-2.5" />
      <circle cx="9.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
      <path d="M3 12v3M21 12v3" />
    </svg>
  );
}
function Tutorials({ size = 24, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M3 6.5A2 2 0 0 1 5 5h5a2 2 0 0 1 2 2v12a1.7 1.7 0 0 0-1.5-1H4a1 1 0 0 1-1-1V6.5Z" />
      <path d="M21 6.5A2 2 0 0 0 19 5h-5a2 2 0 0 0-2 2v12a1.7 1.7 0 0 1 1.5-1H20a1 1 0 0 0 1-1V6.5Z" />
    </svg>
  );
}
function Vibe({ size = 24, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="m9 8-4 4 4 4M15 8l4 4-4 4" />
      <path d="m13 6-2 12" />
    </svg>
  );
}
function Models({ size = 24, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M12 3a4 4 0 0 0-4 4 3.5 3.5 0 0 0-1 6.8V17a3 3 0 0 0 5 2.2A3 3 0 0 0 17 17v-3.2A3.5 3.5 0 0 0 16 7a4 4 0 0 0-4-4Z" />
      <path d="M12 3v16" />
    </svg>
  );
}
function Optimization({ size = 24, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M12 21a8 8 0 1 1 8-8" />
      <path d="m12 13 4-4" />
      <path d="M18.5 13.5 21 11M16 18l2 2 4-4.5" />
    </svg>
  );
}
function Creative({ size = 24, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M12 3a9 9 0 1 0 0 18c1.3 0 2-1 2-2 0-.6-.3-1-.7-1.4-.4-.4-.8-.8-.8-1.4 0-.8.7-1.4 1.5-1.4H16a5 5 0 0 0 5-5c0-3.9-4-6.4-9-6.4Z" />
      <circle cx="8" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function Local({ size = 24, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <rect x="3" y="5" width="18" height="6" rx="1.5" />
      <rect x="3" y="13" width="18" height="6" rx="1.5" />
      <path d="M7 8h.01M7 16h.01" />
    </svg>
  );
}
function Career({ size = 24, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
      <path d="M3 12h18" />
    </svg>
  );
}

const MAP: Record<IconKey, React.FC<IconProps>> = {
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
export function SearchIcon({ size = 18, strokeWidth = 1.8, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}
export function ArrowRight({ size = 18, strokeWidth = 1.8, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
export function Bookmark({
  size = 18,
  strokeWidth = 1.7,
  style,
  filled,
}: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(size, strokeWidth, style)} fill={filled ? 'currentColor' : 'none'}>
      <path d="M6 4h12v16l-6-4-6 4V4Z" />
    </svg>
  );
}
export function ShareIcon({ size = 18, strokeWidth = 1.7, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
    </svg>
  );
}
export function CommentIcon({ size = 18, strokeWidth = 1.7, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M4 5h16v11H9l-4 3v-3H4V5Z" />
    </svg>
  );
}
export function PlayIcon({ size = 18, strokeWidth = 1.7, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5 16 12l-6 3.5v-7Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
export function ClockIcon({ size = 16, strokeWidth = 1.7, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
export function SunIcon({ size = 18, strokeWidth = 1.7, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
export function MoonIcon({ size = 18, strokeWidth = 1.7, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </svg>
  );
}
export function SlidersIcon({ size = 18, strokeWidth = 1.8, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="13" cy="18" r="2" />
    </svg>
  );
}
export function CloseIcon({ size = 20, strokeWidth = 1.8, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}
export function MenuIcon({ size = 20, strokeWidth = 1.8, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
export function MailIcon({ size = 18, strokeWidth = 1.7, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}
export function ExternalLinkIcon({ size = 15, strokeWidth = 1.7, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </svg>
  );
}
export function CheckIcon({ size = 18, strokeWidth = 2, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="m4 12 5 5 11-11" />
    </svg>
  );
}
export function ShieldIcon({ size = 18, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 9 4-1 7-4.5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
export function SparkleIcon({ size = 18, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M12 3c.5 3.5 1.5 4.5 5 5-3.5.5-4.5 1.5-5 5-.5-3.5-1.5-4.5-5-5 3.5-.5 4.5-1.5 5-5Z" />
      <path d="M18.5 14c.25 1.75.75 2.25 2.5 2.5-1.75.25-2.25.75-2.5 2.5-.25-1.75-.75-2.25-2.5-2.5 1.75-.25 2.25-.75 2.5-2.5Z" />
    </svg>
  );
}
export function BarChartIcon({ size = 18, strokeWidth = 1.7, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}
export function AlertTriangleIcon({ size = 18, strokeWidth = 1.7, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4M12 17.5h.01" />
    </svg>
  );
}
export function HeartPulseIcon({ size = 18, strokeWidth = 1.7, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M12 20S4 14.5 4 9a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 1.2-.4 2.4-1 3.5" />
      <path d="M13 12h3l1.5 2.5L20 12" />
    </svg>
  );
}
export function DatabaseIcon({ size = 18, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </svg>
  );
}
export function GaugeIcon({ size = 18, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M4 18a8 8 0 1 1 16 0" />
      <path d="m12 14 4-3" />
      <circle cx="12" cy="14" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
export function RssIcon({ size = 16, strokeWidth = 1.7, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M5 11a8 8 0 0 1 8 8M5 6a13 13 0 0 1 13 13" />
      <circle cx="5.5" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
export function TelegramIcon({ size = 16, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M21 5 3 12l5 2 2 5 3-3.5 4 3 4-13Z" />
      <path d="m8 14 8-6-6 7" />
    </svg>
  );
}
export function LinkedInIcon({ size = 16, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 0 1 4 0v4M11 10v7" />
    </svg>
  );
}
export function YouTubeIcon({ size = 16, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <rect x="2.5" y="6" width="19" height="12" rx="3" />
      <path d="m10 9.5 5 2.5-5 2.5v-5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
export function XIcon({ size = 16, strokeWidth = 1.7, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M4 4l16 16M20 4 4 20" />
    </svg>
  );
}
