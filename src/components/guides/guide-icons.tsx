import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  strokeWidth?: number;
};

function base(size: number, sw: number, props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
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
    ...props,
  };
}

export function CalendarIcon({ size = 20, strokeWidth = 1.7, ...rest }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, rest)}>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

export function LayersIcon({ size = 20, strokeWidth = 1.7, ...rest }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, rest)}>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}

export function FileTextIcon({ size = 20, strokeWidth = 1.7, ...rest }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, rest)}>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 13h6M10 17h6" />
    </svg>
  );
}

export function CompassIcon({ size = 24, strokeWidth = 1.7, ...rest }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, rest)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </svg>
  );
}

export function EyeIcon({ size = 24, strokeWidth = 1.7, ...rest }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, rest)}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function BoltIcon({ size = 24, strokeWidth = 1.7, ...rest }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, rest)}>
      <path d="M13 2.5 4.5 14h7l-1 7.5 8.5-11.5h-7z" />
    </svg>
  );
}

export function ShieldIcon({ size = 24, strokeWidth = 1.7, ...rest }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, rest)}>
      <path d="M12 2.5 4 6v6c0 5.5 3.5 10.5 8 12 4.5-1.5 8-6.5 8-12V6z" />
    </svg>
  );
}

export function CheckIcon({ size = 16, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, rest)}>
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}

export function ArrowRight({ size = 18, strokeWidth = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, rest)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowLeft({ size = 18, strokeWidth = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, rest)}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}

export function LinkIcon({ size = 16, strokeWidth = 1.8, ...rest }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, rest)}>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
    </svg>
  );
}
