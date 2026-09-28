import { PRIMITIVES, SEMANTIC_TOKENS } from '../src/lib/design-system/tokens';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

export function runContrastAudit(): { pass: boolean; reports: string[] } {
  const reports: string[] = [];
  let pass = true;

  // Night Theme Checks
  const night = SEMANTIC_TOKENS.night;
  const nightTextRatio = contrastRatio(night.text, night.bg);
  const nightMutedRatio = contrastRatio(night.muted, night.bg);
  const nightAccentRatio = contrastRatio(night.accent, night.bg);
  const nightOnAccentRatio = contrastRatio(night.onAccent, night.accent);

  reports.push(`[Night] Text on Bg: ${nightTextRatio.toFixed(2)}:1 (Min 4.5:1 required)`);
  if (nightTextRatio < 4.5) pass = false;

  reports.push(`[Night] Muted on Bg: ${nightMutedRatio.toFixed(2)}:1 (Min 4.5:1 required)`);
  if (nightMutedRatio < 4.5) pass = false;

  reports.push(`[Night] Accent on Bg: ${nightAccentRatio.toFixed(2)}:1 (Min 3:1 for UI elements)`);
  if (nightAccentRatio < 3.0) pass = false;

  reports.push(`[Night] OnAccent on Accent: ${nightOnAccentRatio.toFixed(2)}:1 (Min 4.5:1 required)`);
  if (nightOnAccentRatio < 4.5) pass = false;

  // Day Theme Checks
  const day = SEMANTIC_TOKENS.day;
  const dayTextRatio = contrastRatio(day.text, day.bg);
  const dayMutedRatio = contrastRatio(day.muted, day.bg);
  const dayAccentRatio = contrastRatio(day.accent, day.bg);
  const dayOnAccentRatio = contrastRatio(day.onAccent, day.accent);

  reports.push(`[Day] Text on Bg: ${dayTextRatio.toFixed(2)}:1 (Min 4.5:1 required)`);
  if (dayTextRatio < 4.5) pass = false;

  reports.push(`[Day] Muted on Bg: ${dayMutedRatio.toFixed(2)}:1 (Min 4.5:1 required)`);
  if (dayMutedRatio < 4.5) pass = false;

  reports.push(`[Day] Accent on Bg: ${dayAccentRatio.toFixed(2)}:1 (Min 3:1 for UI elements)`);
  if (dayAccentRatio < 3.0) pass = false;

  reports.push(`[Day] OnAccent on Accent: ${dayOnAccentRatio.toFixed(2)}:1 (Min 4.5:1 required)`);
  if (dayOnAccentRatio < 4.5) pass = false;

  // Touch Target Minimum
  reports.push(`[WCAG AA] Touch target minimum: ${PRIMITIVES.touchTargetMin}px (Min 44px required)`);
  if (PRIMITIVES.touchTargetMin < 44) pass = false;

  return { pass, reports };
}

if (process.argv[1]?.endsWith('check-design-tokens.ts')) {
  const result = runContrastAudit();
  for (const line of result.reports) {
    console.log(line);
  }
  if (!result.pass) {
    console.error('FAIL: Design tokens contrast check failed.');
    process.exit(1);
  } else {
    console.log('PASS: All design token contrast checks meet WCAG 2.2 AA standards.');
  }
}
