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

export type ViewportName = keyof typeof VIEWPORTS;
export type ViewportSize = (typeof VIEWPORTS)[ViewportName];

export const BREAKPOINT_CONTRACT_WIDTHS = [
  VIEWPORTS.tablet768,
  VIEWPORTS.tablet834,
  VIEWPORTS.layout900,
  VIEWPORTS.layout960,
  VIEWPORTS.header1023,
  VIEWPORTS.header1024,
] as const;

export const HEADER_LAYOUT_WIDTHS = [
  VIEWPORTS.header1024,
  VIEWPORTS.desktop1280,
  VIEWPORTS.desktop1440,
] as const;

export const MOBILE_MENU_WIDTHS = [
  VIEWPORTS.phone320,
  VIEWPORTS.phone375,
  VIEWPORTS.phone390,
  VIEWPORTS.tablet768,
  VIEWPORTS.header1023,
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
  VIEWPORTS.header1024,
  VIEWPORTS.desktop1440,
] as const;
