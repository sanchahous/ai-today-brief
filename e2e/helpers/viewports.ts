export const VIEWPORTS = {
  phone320: { width: 320, height: 568 },
  phone375: { width: 375, height: 812 },
  phone390: { width: 390, height: 844 },
  tablet768: { width: 768, height: 1024 },
  tablet834: { width: 834, height: 1112 },
  layout900: { width: 900, height: 1000 },
  layout960: { width: 960, height: 800 },
  header1023: { width: 1023, height: 800 },
  header1024: { width: 1024, height: 800 },
  desktop1280: { width: 1280, height: 720 },
  desktop1440: { width: 1440, height: 900 },
} as const;

/**
 * Breakpoint contract (ADR D5, variant A; tokens `--breakpoint-*` in globals.css, docs §7.10).
 *
 * Target: header and discovery switch together at `--breakpoint-tablet` = 60rem = 960px, so
 * 959px is the last "compact" width and 960px the first "wide" one (instead of today's 1023 / 1024).
 *
 * Today NOTHING moves: header and the news layout still switch at Tailwind `lg` (1024px) and the
 * suites keep using `header1023` / `header1024`. The behaviour changes in AH-3.3 (header) and
 * AH-4.3 (discovery), and those PRs swap their specs to `NAV_COMPACT_LAST` / `NAV_WIDE_FIRST`.
 */
export const NAV_BREAKPOINT_REM = 60;
export const NAV_COMPACT_LAST = { width: 959, height: 800 } as const;
export const NAV_WIDE_FIRST = VIEWPORTS.layout960;

export type ViewportName = keyof typeof VIEWPORTS;
export type ViewportSize = (typeof VIEWPORTS)[ViewportName];

export const BREAKPOINT_CONTRACT_WIDTHS = [
  VIEWPORTS.tablet768,
  VIEWPORTS.tablet834,
  VIEWPORTS.layout900,
  NAV_COMPACT_LAST,
  NAV_WIDE_FIRST,
  VIEWPORTS.header1024,
] as const;

export const HEADER_LAYOUT_WIDTHS = [
  NAV_WIDE_FIRST,
  VIEWPORTS.desktop1280,
  VIEWPORTS.desktop1440,
] as const;

export const MOBILE_MENU_WIDTHS = [
  VIEWPORTS.phone320,
  VIEWPORTS.phone375,
  VIEWPORTS.phone390,
  VIEWPORTS.tablet768,
  NAV_COMPACT_LAST,
] as const;

export const FILTER_DRAWER_WIDTHS = [
  VIEWPORTS.phone320,
  VIEWPORTS.phone390,
  VIEWPORTS.tablet768,
] as const;

export const HORIZONTAL_OVERFLOW_WIDTHS = [
  VIEWPORTS.phone320,
  VIEWPORTS.phone375,
  VIEWPORTS.phone390,
  VIEWPORTS.tablet768,
  NAV_WIDE_FIRST,
  VIEWPORTS.desktop1440,
] as const;
