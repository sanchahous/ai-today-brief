import type {
  AutoVisualClaim,
  VisualGlyph,
  VisualOutcomeSignal,
  VisualRelation,
} from './visual-auto-claim';
import type { OverlayGroup, VisualPlan, VisualRegion } from './visual-compiler';

export interface GenericVisualSvgInput {
  autoClaim: AutoVisualClaim;
  plan: VisualPlan;
  width?: number;
  height?: number;
  includeOverlays?: boolean;
}

interface PixelBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface GenericTheme {
  background: string;
  panel: string;
  panelAlt: string;
  cyan: string;
  cyanLight: string;
  violet: string;
  amber: string;
  rose: string;
  green: string;
  white: string;
  muted: string;
}

const DEFAULT_THEME: GenericTheme = {
  background: '#040A11',
  panel: '#07131E',
  panelAlt: '#0B1B29',
  cyan: '#22D3EE',
  cyanLight: '#CFFAFE',
  violet: '#A78BFA',
  amber: '#FB923C',
  rose: '#FB7185',
  green: '#34D399',
  white: '#ECFEFF',
  muted: '#64748B',
};

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function bounds(region: VisualRegion, width: number, height: number): PixelBounds {
  return {
    left: Math.round(region.bounds.x * width),
    top: Math.round(region.bounds.y * height),
    width: Math.max(1, Math.round(region.bounds.width * width)),
    height: Math.max(1, Math.round(region.bounds.height * height)),
  };
}

function center(box: PixelBounds): Point {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function defs(theme: GenericTheme): string {
  return `<defs>
    <linearGradient id="generic-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${theme.background}"/>
      <stop offset="0.55" stop-color="#071827"/>
      <stop offset="1" stop-color="#101827"/>
    </linearGradient>
    <linearGradient id="generic-metal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#475569"/><stop offset="0.5" stop-color="#0F172A"/><stop offset="1" stop-color="#334155"/>
    </linearGradient>
    <linearGradient id="generic-glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${theme.cyanLight}" stop-opacity="0.2"/>
      <stop offset="1" stop-color="${theme.cyan}" stop-opacity="0.03"/>
    </linearGradient>
    <radialGradient id="generic-cyan-glow"><stop offset="0" stop-color="${theme.cyan}" stop-opacity="0.32"/><stop offset="1" stop-color="${theme.cyan}" stop-opacity="0"/></radialGradient>
    <radialGradient id="generic-warm-glow"><stop offset="0" stop-color="${theme.amber}" stop-opacity="0.42"/><stop offset="1" stop-color="${theme.amber}" stop-opacity="0"/></radialGradient>
    <filter id="generic-shadow" x="-35%" y="-35%" width="170%" height="170%"><feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#000814" flood-opacity="0.82"/></filter>
    <filter id="generic-soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="22"/></filter>
    <marker id="generic-arrow" markerWidth="11" markerHeight="11" refX="9" refY="5.5" orient="auto"><path d="M0 0L11 5.5L0 11Z" fill="${theme.cyanLight}"/></marker>
    <marker id="generic-arrow-warm" markerWidth="11" markerHeight="11" refX="9" refY="5.5" orient="auto"><path d="M0 0L11 5.5L0 11Z" fill="${theme.amber}"/></marker>
  </defs>`;
}

function background(width: number, height: number, theme: GenericTheme): string {
  const vertical = Array.from({ length: 7 }, (_, index) => {
    const x = Math.round(((index + 1) * width) / 8);
    return `<path d="M${x} 0V${height}" stroke="${theme.white}" stroke-opacity="0.022"/>`;
  }).join('');
  const horizontal = Array.from({ length: 4 }, (_, index) => {
    const y = Math.round(((index + 1) * height) / 5);
    return `<path d="M0 ${y}H${width}" stroke="${theme.white}" stroke-opacity="0.025"/>`;
  }).join('');
  return `<rect width="${width}" height="${height}" fill="url(#generic-bg)"/>
    <ellipse cx="${Math.round(width * 0.5)}" cy="${Math.round(
      height * 0.48,
    )}" rx="${Math.round(width * 0.48)}" ry="${Math.round(
      height * 0.44,
    )}" fill="url(#generic-cyan-glow)" opacity="0.28"/>
    ${vertical}${horizontal}`;
}

function panel(box: PixelBounds, theme: GenericTheme, dashed = false): string {
  const radius = clamp(Math.round(Math.min(box.width, box.height) * 0.07), 18, 36);
  return `<rect x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" rx="${radius}" fill="${theme.panel}" fill-opacity="0.93" stroke="${theme.cyan}" stroke-opacity="0.28" stroke-width="2"${
    dashed ? ' stroke-dasharray="12 10"' : ''
  } filter="url(#generic-shadow)"/>`;
}

function glyphBody(glyph: VisualGlyph, theme: GenericTheme): string {
  const cyan = theme.cyan;
  const light = theme.cyanLight;
  const violet = theme.violet;
  const amber = theme.amber;
  const rose = theme.rose;
  const green = theme.green;

  switch (glyph) {
    case 'agent':
      return `<path d="M28 34h44l8 14v29H20V48Z" fill="url(#generic-metal)" stroke="${cyan}" stroke-width="4"/><circle cx="39" cy="55" r="6" fill="${light}"/><circle cx="61" cy="55" r="6" fill="${light}"/><path d="M38 69h24" stroke="${cyan}" stroke-width="4" stroke-linecap="round"/><path d="M50 20v14M43 20h14" stroke="${violet}" stroke-width="4" stroke-linecap="round"/>`;
    case 'human':
    case 'teacher':
    case 'student': {
      const accent = glyph === 'teacher' ? violet : glyph === 'student' ? green : cyan;
      return `<circle cx="50" cy="29" r="15" fill="${accent}" fill-opacity="0.86"/><path d="M29 82c2-23 12-35 21-35s19 12 21 35" fill="none" stroke="${light}" stroke-width="9" stroke-linecap="round"/><path d="M30 59 15 72M70 59l15 13" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>`;
    }
    case 'model_chip':
    case 'hardware_chip':
      return `<rect x="24" y="24" width="52" height="52" rx="12" fill="url(#generic-metal)" stroke="${glyph === 'hardware_chip' ? amber : cyan}" stroke-width="5"/><rect x="37" y="37" width="26" height="26" rx="6" fill="${glyph === 'hardware_chip' ? amber : violet}" fill-opacity="0.58"/><path d="M14 32h10M14 50h10M14 68h10M76 32h10M76 50h10M76 68h10M32 14v10M50 14v10M68 14v10M32 76v10M50 76v10M68 76v10" stroke="${light}" stroke-width="4" stroke-linecap="round"/>`;
    case 'package_box':
      return `<path d="M18 34 50 17l32 17v39L50 90 18 73Z" fill="${theme.panelAlt}" stroke="${amber}" stroke-width="4"/><path d="M18 34 50 52l32-18M50 52v38M35 25l32 18" fill="none" stroke="${light}" stroke-opacity="0.72" stroke-width="4"/>`;
    case 'sandbox':
      return `<path d="M17 27 50 12l33 15v47L50 90 17 74Z" fill="url(#generic-glass)" stroke="${cyan}" stroke-width="4"/><path d="M17 27 50 44l33-17M50 44v46" fill="none" stroke="${light}" stroke-opacity="0.58" stroke-width="3"/><circle cx="50" cy="56" r="10" fill="${violet}" fill-opacity="0.72"/>`;
    case 'network':
    case 'internet': {
      const outer = glyph === 'internet' ? amber : cyan;
      return `<circle cx="50" cy="50" r="35" fill="none" stroke="${outer}" stroke-width="4"/><path d="M15 50h70M50 15c14 12 20 23 20 35S64 73 50 85M50 15C36 27 30 38 30 50s6 23 20 35M23 30h54M23 70h54" fill="none" stroke="${light}" stroke-opacity="0.72" stroke-width="3"/>`;
    }
    case 'shield':
      return `<path d="M50 10 82 22v27c0 23-13 35-32 43-19-8-32-20-32-43V22Z" fill="${green}" fill-opacity="0.16" stroke="${green}" stroke-width="5"/><path d="m34 50 11 11 23-25" fill="none" stroke="${light}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'lock':
      return `<rect x="22" y="43" width="56" height="43" rx="10" fill="${theme.panelAlt}" stroke="${cyan}" stroke-width="5"/><path d="M34 43V32c0-22 32-22 32 0v11" fill="none" stroke="${light}" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="62" r="6" fill="${amber}"/><path d="M50 68v8" stroke="${amber}" stroke-width="5" stroke-linecap="round"/>`;
    case 'key':
      return `<circle cx="31" cy="43" r="18" fill="none" stroke="${amber}" stroke-width="7"/><path d="M46 53 82 79M68 68l9-9M75 75l9-9" stroke="${light}" stroke-width="7" stroke-linecap="round"/>`;
    case 'policy_gate':
      return `<path d="M25 15v70M75 15v70" stroke="${light}" stroke-width="7"/><path d="M25 30h50M25 50h50M25 70h50" stroke="${cyan}" stroke-width="5"/><path d="M50 9v82" stroke="${rose}" stroke-width="4" stroke-dasharray="7 6"/>`;
    case 'code_file':
    case 'document':
    case 'spreadsheet': {
      const stroke = glyph === 'spreadsheet' ? green : cyan;
      const inner =
        glyph === 'spreadsheet'
          ? `<path d="M30 42h40M30 57h40M30 72h40M43 32v49M57 32v49" stroke="${light}" stroke-opacity="0.58" stroke-width="3"/>`
          : `<path d="M31 43h38M31 57h30M31 71h35" stroke="${light}" stroke-opacity="0.68" stroke-width="5" stroke-linecap="round"/>`;
      return `<path d="M22 12h40l16 17v59H22Z" fill="${theme.panelAlt}" stroke="${stroke}" stroke-width="4"/><path d="M62 12v17h16" fill="none" stroke="${light}" stroke-width="4"/>${inner}`;
    }
    case 'folder':
      return `<path d="M12 29h31l9 10h36v43H12Z" fill="${amber}" fill-opacity="0.2" stroke="${amber}" stroke-width="5"/><path d="M12 43h76" stroke="${light}" stroke-width="4"/>`;
    case 'database':
      return `<ellipse cx="50" cy="24" rx="30" ry="12" fill="${theme.panelAlt}" stroke="${violet}" stroke-width="4"/><path d="M20 24v50c0 7 13 12 30 12s30-5 30-12V24M20 49c0 7 13 12 30 12s30-5 30-12M20 68c0 7 13 12 30 12s30-5 30-12" fill="${theme.panelAlt}" stroke="${violet}" stroke-width="4"/>`;
    case 'code_graph':
    case 'workflow': {
      const nodes = glyph === 'code_graph' ? [[20, 25], [52, 18], [80, 34], [34, 62], [72, 76]] : [[17, 50], [50, 24], [50, 76], [83, 50]];
      const lines = glyph === 'code_graph'
        ? `<path d="M20 25 52 18 80 34M20 25l14 37 38 14M80 34 72 76M34 62 52 18" fill="none" stroke="${light}" stroke-opacity="0.55" stroke-width="4"/>`
        : `<path d="M17 50 50 24M17 50l33 26M50 24l33 26M50 76l33-26" fill="none" stroke="${light}" stroke-opacity="0.62" stroke-width="5"/>`;
      return `${lines}${nodes
        .map(([x, y], index) => `<circle cx="${x}" cy="${y}" r="${index === 0 ? 9 : 7}" fill="${index === 0 ? amber : cyan}" stroke="${light}" stroke-width="2"/>`)
        .join('')}`;
    }
    case 'context_stack':
    case 'compiler_stack': {
      const accent = glyph === 'compiler_stack' ? violet : cyan;
      return `<path d="M18 26 50 12l32 14-32 14Z" fill="${accent}" fill-opacity="0.25" stroke="${accent}" stroke-width="4"/><path d="M18 45 50 31l32 14-32 14Z" fill="${accent}" fill-opacity="0.18" stroke="${accent}" stroke-width="4"/><path d="M18 64 50 50l32 14-32 14Z" fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-width="4"/><path d="M18 79 50 65l32 14-32 14Z" fill="${accent}" fill-opacity="0.08" stroke="${accent}" stroke-width="4"/>`;
    }
    case 'browser':
      return `<rect x="12" y="18" width="76" height="66" rx="10" fill="${theme.panelAlt}" stroke="${cyan}" stroke-width="4"/><path d="M12 35h76" stroke="${light}" stroke-width="4"/><circle cx="23" cy="27" r="4" fill="${rose}"/><circle cx="35" cy="27" r="4" fill="${amber}"/><circle cx="47" cy="27" r="4" fill="${green}"/><path d="M25 49h50M25 61h38M25 73h45" stroke="${light}" stroke-opacity="0.45" stroke-width="5" stroke-linecap="round"/>`;
    case 'terminal':
      return `<rect x="10" y="18" width="80" height="64" rx="11" fill="#020617" stroke="${green}" stroke-width="4"/><path d="m24 40 13 10-13 10M45 61h28" fill="none" stroke="${light}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'tool':
      return `<path d="M24 18c11-6 24 4 19 16l37 37-13 13-37-37C18 51 8 39 14 28l14 14 12-12Z" fill="${amber}" fill-opacity="0.24" stroke="${amber}" stroke-width="5" stroke-linejoin="round"/>`;
    case 'local_device':
      return `<rect x="18" y="13" width="64" height="55" rx="8" fill="${theme.panelAlt}" stroke="${cyan}" stroke-width="4"/><path d="M9 78h82l-9 10H18Z" fill="url(#generic-metal)" stroke="${light}" stroke-width="3"/><circle cx="50" cy="41" r="13" fill="${green}" fill-opacity="0.55"/><path d="M50 31v20M40 41h20" stroke="${light}" stroke-width="4" stroke-linecap="round"/>`;
    case 'cloud':
      return `<path d="M27 73h50c19 0 19-28 2-31C77 19 46 14 36 34 18 31 8 47 15 61c3 7 7 12 12 12Z" fill="${cyan}" fill-opacity="0.16" stroke="${cyan}" stroke-width="5"/>`;
    case 'microphone':
      return `<rect x="34" y="13" width="32" height="51" rx="16" fill="${theme.panelAlt}" stroke="${violet}" stroke-width="5"/><path d="M23 48c0 18 12 29 27 29s27-11 27-29M50 77v13M34 90h32" fill="none" stroke="${light}" stroke-width="5" stroke-linecap="round"/>`;
    case 'waveform':
      return `<path d="M10 52h11l7-24 12 49 12-60 11 50 8-29 8 14h11" fill="none" stroke="${violet}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'meeting':
      return `<circle cx="31" cy="34" r="11" fill="${cyan}"/><circle cx="69" cy="34" r="11" fill="${violet}"/><circle cx="50" cy="65" r="11" fill="${green}"/><path d="M20 82c2-13 7-20 11-20s9 7 11 20M58 82c2-13 7-20 11-20s9 7 11 20M39 94c2-13 7-20 11-20s9 7 11 20" fill="none" stroke="${light}" stroke-width="5" stroke-linecap="round"/>`;
    case 'benchmark':
    case 'leaderboard':
      return `<path d="M16 82h68" stroke="${light}" stroke-width="5"/><rect x="22" y="54" width="14" height="28" rx="4" fill="${cyan}"/><rect x="43" y="34" width="14" height="48" rx="4" fill="${violet}"/><rect x="64" y="17" width="14" height="65" rx="4" fill="${amber}"/><path d="M18 47 48 24l17 8 18-22" fill="none" stroke="${green}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'gauge':
    case 'speedometer':
      return `<path d="M18 72a35 35 0 0 1 64 0" fill="none" stroke="${light}" stroke-opacity="0.34" stroke-width="13" stroke-linecap="round"/><path d="M18 72a35 35 0 0 1 49-32" fill="none" stroke="${green}" stroke-width="7" stroke-linecap="round"/><path d="M50 72 69 39" stroke="${amber}" stroke-width="6" stroke-linecap="round"/><circle cx="50" cy="72" r="8" fill="${cyan}"/>`;
    case 'coins':
      return `<ellipse cx="37" cy="70" rx="24" ry="9" fill="${amber}" fill-opacity="0.3" stroke="${amber}" stroke-width="4"/><path d="M13 70V47c0 6 11 10 24 10s24-4 24-10v23M13 47c0-6 11-10 24-10s24 4 24 10" fill="${amber}" fill-opacity="0.12" stroke="${amber}" stroke-width="4"/><ellipse cx="68" cy="43" rx="20" ry="8" fill="${green}" fill-opacity="0.25" stroke="${green}" stroke-width="4"/><path d="M48 43V26c0 5 9 8 20 8s20-3 20-8v17M48 26c0-5 9-8 20-8s20 3 20 8" fill="${green}" fill-opacity="0.12" stroke="${green}" stroke-width="4"/>`;
    case 'component_grid':
      return Array.from({ length: 9 }, (_, index) => {
        const x = 12 + (index % 3) * 28;
        const y = 12 + Math.floor(index / 3) * 28;
        return `<rect x="${x}" y="${y}" width="20" height="20" rx="5" fill="${index % 2 ? violet : cyan}" fill-opacity="0.22" stroke="${index % 2 ? violet : cyan}" stroke-width="3"/>`;
      }).join('');
    case 'camera':
      return `<rect x="13" y="29" width="74" height="49" rx="10" fill="${theme.panelAlt}" stroke="${cyan}" stroke-width="4"/><path d="M31 29 38 18h24l7 11" fill="${theme.panelAlt}" stroke="${light}" stroke-width="4"/><circle cx="50" cy="54" r="16" fill="none" stroke="${violet}" stroke-width="6"/><circle cx="50" cy="54" r="6" fill="${light}"/>`;
    case 'maze':
      return `<path d="M12 12h76v76H12ZM26 12v26h20V25h25v22H56v25H33v16M12 53h21M71 47v26h17" fill="none" stroke="${cyan}" stroke-width="6" stroke-linejoin="round"/>`;
    case 'checkmark':
      return `<circle cx="50" cy="50" r="36" fill="${green}" fill-opacity="0.14" stroke="${green}" stroke-width="5"/><path d="m29 50 14 15 29-32" fill="none" stroke="${light}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'warning':
      return `<path d="M50 11 91 84H9Z" fill="${rose}" fill-opacity="0.15" stroke="${rose}" stroke-width="5" stroke-linejoin="round"/><path d="M50 35v24" stroke="${light}" stroke-width="8" stroke-linecap="round"/><circle cx="50" cy="72" r="5" fill="${light}"/>`;
  }
}

function glyph(
  visualGlyph: VisualGlyph,
  x: number,
  y: number,
  size: number,
  theme: GenericTheme,
  opacity = 1,
): string {
  return `<g transform="translate(${x} ${y}) scale(${size / 100})" opacity="${opacity}">${glyphBody(
    visualGlyph,
    theme,
  )}</g>`;
}

function signal(
  outcome: VisualOutcomeSignal,
  x: number,
  y: number,
  size: number,
  theme: GenericTheme,
): string {
  const positive = new Set<VisualOutcomeSignal>([
    'success',
    'safer',
    'private',
    'local',
    'faster',
    'lower_cost',
    'lower_tokens',
    'smaller',
    'more_accurate',
    'completed',
  ]);
  const negative = new Set<VisualOutcomeSignal>([
    'failure',
    'escaped',
    'slower',
    'higher_cost',
    'higher_tokens',
    'larger',
    'less_accurate',
  ]);
  if (outcome === 'blocked') {
    return `<g transform="translate(${x} ${y}) scale(${size / 100})"><circle cx="50" cy="50" r="34" fill="${theme.rose}" fill-opacity="0.12" stroke="${theme.rose}" stroke-width="6"/><path d="M27 73 73 27" stroke="${theme.rose}" stroke-width="8" stroke-linecap="round"/></g>`;
  }
  if (outcome === 'uncertain') {
    return `<g transform="translate(${x} ${y}) scale(${size / 100})"><circle cx="50" cy="50" r="33" fill="none" stroke="${theme.amber}" stroke-width="6" stroke-dasharray="8 8"/><circle cx="50" cy="50" r="9" fill="${theme.amber}"/><path d="M50 12v16M50 72v16M12 50h16M72 50h16" stroke="${theme.cyanLight}" stroke-width="5" stroke-linecap="round"/></g>`;
  }
  if (positive.has(outcome)) return glyph('checkmark', x, y, size, theme);
  if (negative.has(outcome)) return glyph('warning', x, y, size, theme);
  return glyph('checkmark', x, y, size, theme);
}

function connector(
  from: Point,
  to: Point,
  relation: VisualRelation,
  theme: GenericTheme,
): string {
  const warm = relation === 'escape' || relation === 'increase';
  const stroke = warm ? theme.amber : theme.cyanLight;
  const marker = warm ? 'generic-arrow-warm' : 'generic-arrow';
  const midX = (from.x + to.x) / 2;
  const curvature = Math.max(45, Math.abs(to.y - from.y) * 0.55);
  const path = Math.abs(to.y - from.y) < 40
    ? `M${from.x} ${from.y} C${midX} ${from.y - 24},${midX} ${to.y + 24},${to.x} ${to.y}`
    : `M${from.x} ${from.y} C${midX} ${from.y + (to.y > from.y ? curvature : -curvature)},${midX} ${to.y - (to.y > from.y ? curvature : -curvature)},${to.x} ${to.y}`;
  const dashed = relation === 'prune' || relation === 'remove' || relation === 'block';
  const base = `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="7" stroke-linecap="round"${
    dashed ? ' stroke-dasharray="13 10"' : ''
  } marker-end="url(#${marker})"/>`;
  if (relation === 'block') {
    const x = midX;
    const y = (from.y + to.y) / 2;
    return `${base}<path d="M${x - 5} ${y - 44}v88" stroke="${theme.rose}" stroke-width="12" stroke-linecap="round"/>`;
  }
  if (relation === 'loop') {
    const cx = midX;
    const cy = (from.y + to.y) / 2;
    return `<path d="M${cx - 55} ${cy}a55 55 0 1 1 38 52" fill="none" stroke="${stroke}" stroke-width="7" marker-end="url(#${marker})"/>`;
  }
  return base;
}

function overlayPills(
  overlays: readonly OverlayGroup[],
  regions: readonly VisualRegion[],
  width: number,
  height: number,
  theme: GenericTheme,
): string {
  const counts = new Map<string, number>();
  return overlays
    .map((overlay) => {
      const region = overlay.regionId
        ? regions.find((candidate) => candidate.id === overlay.regionId)
        : regions[0];
      if (!region) return '';
      const box = bounds(region, width, height);
      const index = counts.get(region.id) ?? 0;
      counts.set(region.id, index + 1);
      const primary = overlay.importance === 'primary';
      const fontSize = overlay.text.length > 24 ? 16 : 18;
      const pillWidth = Math.min(
        Math.max(112, Math.round(overlay.text.length * fontSize * 0.62 + 34)),
        Math.max(112, box.width - 20),
      );
      const x = box.left + 11;
      const y = box.top + 11 + index * 45;
      return `<g><rect x="${x}" y="${y}" width="${pillWidth}" height="37" rx="18.5" fill="${
        primary ? theme.cyanLight : '#083344'
      }" fill-opacity="0.97" stroke="${theme.cyan}" stroke-width="1.5"/><text x="${
        x + 17
      }" y="${y + 24.5}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="800" fill="${
        primary ? '#083344' : theme.white
      }">${xml(overlay.text)}</text></g>`;
    })
    .join('');
}

function regionGlyph(
  plan: VisualPlan,
  autoClaim: AutoVisualClaim,
  region: VisualRegion,
): VisualGlyph {
  const grammar = autoClaim.grammar;
  switch (plan.format) {
    case 'cinematic_sequence':
      return region.id === 'state-1'
        ? grammar.contextGlyph
        : region.id === 'state-2'
          ? grammar.mechanismGlyph
          : grammar.outcomeGlyph;
    case 'cinematic_split':
      return region.id === 'left' ? grammar.mechanismGlyph : grammar.outcomeGlyph;
    case 'cinematic_cutaway':
      return region.id === 'full-system'
        ? grammar.contextGlyph
        : region.id === 'removed-layers'
          ? grammar.mechanismGlyph
          : grammar.outcomeGlyph;
    case 'cinematic_data_contrast':
      return region.id === 'baseline' ? grammar.contextGlyph : grammar.mechanismGlyph;
    case 'cinematic_routing':
      if (region.id === 'route-source') return grammar.contextGlyph;
      if (region.id === 'route-a') return grammar.branchGlyphs?.[0] ?? grammar.mechanismGlyph;
      return grammar.branchGlyphs?.[1] ?? grammar.outcomeGlyph;
    case 'cinematic_single':
      return grammar.mechanismGlyph;
  }
}

function dataContrastScene(
  autoClaim: AutoVisualClaim,
  plan: VisualPlan,
  width: number,
  height: number,
  theme: GenericTheme,
): string {
  const left = bounds(plan.regions[0]!, width, height);
  const right = bounds(plan.regions[1]!, width, height);
  const leftSize = Math.min(left.width, left.height) * 0.42;
  const rightSize = Math.min(right.width, right.height) * 0.5;
  const leftCenter = center(left);
  const rightCenter = center(right);
  const repeated = Array.from({ length: 7 }, (_, index) => {
    const angle = (-120 + index * 40) * (Math.PI / 180);
    const x = rightCenter.x + Math.cos(angle) * right.width * 0.31;
    const y = rightCenter.y + Math.sin(angle) * right.height * 0.31;
    return glyph(autoClaim.grammar.contextGlyph, x - 24, y - 24, 48, theme, 0.62);
  }).join('');
  return `${panel(left, theme)}${panel(right, theme)}
    ${glyph(
      autoClaim.grammar.contextGlyph,
      leftCenter.x - leftSize / 2,
      leftCenter.y - leftSize / 2,
      leftSize,
      theme,
    )}
    ${signal('lower_tokens', left.left + left.width * 0.67, left.top + left.height * 0.64, 72, theme)}
    <ellipse cx="${rightCenter.x}" cy="${rightCenter.y}" rx="${right.width * 0.42}" ry="${right.height * 0.42}" fill="url(#generic-warm-glow)" filter="url(#generic-soft)"/>
    ${repeated}
    ${glyph(
      autoClaim.grammar.mechanismGlyph,
      rightCenter.x - rightSize / 2,
      rightCenter.y - rightSize / 2,
      rightSize,
      theme,
    )}
    ${signal(
      autoClaim.grammar.outcomeSignal,
      right.left + right.width * 0.67,
      right.top + right.height * 0.64,
      80,
      theme,
    )}
    ${connector(
      { x: left.left + left.width + 14, y: leftCenter.y },
      { x: right.left - 14, y: rightCenter.y },
      'compare',
      theme,
    )}`;
}

function cutawayScene(
  autoClaim: AutoVisualClaim,
  plan: VisualPlan,
  width: number,
  height: number,
  theme: GenericTheme,
): string {
  const full = bounds(plan.regions.find((region) => region.id === 'full-system')!, width, height);
  const removed = bounds(
    plan.regions.find((region) => region.id === 'removed-layers')!,
    width,
    height,
  );
  const core = bounds(
    plan.regions.find((region) => region.id === 'remaining-core')!,
    width,
    height,
  );
  const fullCenter = center(full);
  const coreCenter = center(core);
  const nested = Array.from({ length: 4 }, (_, index) => {
    const inset = index * 18;
    return `<rect x="${full.left + 36 + inset}" y="${full.top + 94 - inset * 0.35}" width="${
      full.width - 72 - inset * 2
    }" height="${full.height - 172 - inset * 0.6}" rx="24" fill="${
      index % 2 ? theme.panelAlt : theme.panel
    }" fill-opacity="${0.42 + index * 0.1}" stroke="${
      index % 2 ? theme.violet : theme.cyan
    }" stroke-opacity="${0.35 + index * 0.11}" stroke-width="3"/>`;
  }).join('');
  const removedSlices = Array.from({ length: 3 }, (_, index) => {
    const y = removed.top + removed.height * (0.25 + index * 0.25);
    return `<rect x="${removed.left + 13}" y="${y - 24}" width="${removed.width - 26}" height="48" rx="15" fill="${theme.cyan}" fill-opacity="0.07" stroke="${theme.cyanLight}" stroke-width="2" stroke-dasharray="10 8" transform="rotate(${index * 5 - 5} ${removed.left + removed.width / 2} ${y})"/>`;
  }).join('');
  const size = Math.min(core.width, core.height) * 0.45;
  return `${panel(full, theme)}${panel(removed, theme, true)}${panel(core, theme)}
    ${nested}
    ${glyph(autoClaim.grammar.contextGlyph, fullCenter.x - 66, fullCenter.y - 66, 132, theme)}
    ${removedSlices}
    ${glyph(
      autoClaim.grammar.mechanismGlyph,
      removed.left + removed.width / 2 - 42,
      removed.top + removed.height / 2 - 42,
      84,
      theme,
      0.82,
    )}
    ${glyph(
      autoClaim.grammar.outcomeGlyph,
      coreCenter.x - size / 2,
      coreCenter.y - size / 2,
      size,
      theme,
    )}
    ${signal(
      autoClaim.grammar.outcomeSignal,
      core.left + core.width * 0.64,
      core.top + core.height * 0.63,
      76,
      theme,
    )}
    ${connector(
      { x: full.left + full.width + 10, y: fullCenter.y },
      { x: removed.left - 8, y: center(removed).y },
      autoClaim.grammar.relation,
      theme,
    )}
    ${connector(
      { x: removed.left + removed.width + 8, y: center(removed).y },
      { x: core.left - 10, y: coreCenter.y },
      'flow',
      theme,
    )}`;
}

function routingScene(
  autoClaim: AutoVisualClaim,
  plan: VisualPlan,
  width: number,
  height: number,
  theme: GenericTheme,
): string {
  const sourceRegion = plan.regions.find((region) => region.id === 'route-source')!;
  const leftRegion = plan.regions.find((region) => region.id === 'route-a')!;
  const rightRegion = plan.regions.find((region) => region.id === 'route-b')!;
  const source = bounds(sourceRegion, width, height);
  const left = bounds(leftRegion, width, height);
  const right = bounds(rightRegion, width, height);
  const sourceCenter = center(source);
  const leftCenter = center(left);
  const rightCenter = center(right);
  const leftGlyph = autoClaim.grammar.branchGlyphs?.[0] ?? autoClaim.grammar.mechanismGlyph;
  const rightGlyph = autoClaim.grammar.branchGlyphs?.[1] ?? autoClaim.grammar.outcomeGlyph;
  return `${panel(left, theme)}${panel(right, theme)}${panel(source, theme)}
    ${glyph(autoClaim.grammar.contextGlyph, sourceCenter.x - 65, sourceCenter.y - 65, 130, theme)}
    ${glyph(leftGlyph, leftCenter.x - 82, leftCenter.y - 100, 164, theme)}
    ${glyph(rightGlyph, rightCenter.x - 82, rightCenter.y - 100, 164, theme)}
    ${signal(
      autoClaim.grammar.outcomeSignal,
      leftCenter.x - 43,
      left.top + left.height * 0.68,
      86,
      theme,
    )}
    ${signal(
      autoClaim.grammar.outcomeSignal,
      rightCenter.x - 43,
      right.top + right.height * 0.68,
      86,
      theme,
    )}
    ${connector(
      { x: source.left, y: sourceCenter.y },
      { x: left.left + left.width, y: leftCenter.y },
      'branch',
      theme,
    )}
    ${connector(
      { x: source.left + source.width, y: sourceCenter.y },
      { x: right.left, y: rightCenter.y },
      'branch',
      theme,
    )}`;
}

function standardRegionsScene(
  autoClaim: AutoVisualClaim,
  plan: VisualPlan,
  width: number,
  height: number,
  theme: GenericTheme,
): string {
  if (plan.format === 'cinematic_single') {
    const hero = bounds(plan.regions[0]!, width, height);
    const cy = hero.top + hero.height * 0.54;
    const size = Math.min(hero.width * 0.2, hero.height * 0.44);
    const leftX = hero.left + hero.width * 0.16;
    const middleX = hero.left + hero.width * 0.42;
    const rightX = hero.left + hero.width * 0.7;
    return `${panel(hero, theme)}
      ${glyph(autoClaim.grammar.contextGlyph, leftX, cy - size / 2, size, theme)}
      ${glyph(autoClaim.grammar.mechanismGlyph, middleX, cy - size / 2, size, theme)}
      ${glyph(autoClaim.grammar.outcomeGlyph, rightX, cy - size / 2, size, theme)}
      ${connector(
        { x: leftX + size + 8, y: cy },
        { x: middleX - 8, y: cy },
        autoClaim.grammar.relation,
        theme,
      )}
      ${connector(
        { x: middleX + size + 8, y: cy },
        { x: rightX - 8, y: cy },
        'flow',
        theme,
      )}
      ${signal(
        autoClaim.grammar.outcomeSignal,
        hero.left + hero.width * 0.84,
        hero.top + hero.height * 0.67,
        76,
        theme,
      )}`;
  }

  const boxes = new Map<string, PixelBounds>();
  const panels = plan.regions
    .map((region) => {
      const box = bounds(region, width, height);
      boxes.set(region.id, box);
      return panel(box, theme, region.role === 'mechanism' && plan.format === 'cinematic_sequence');
    })
    .join('');
  const icons = plan.regions
    .map((region) => {
      const box = boxes.get(region.id)!;
      const c = center(box);
      const visualGlyph = regionGlyph(plan, autoClaim, region);
      const size = Math.min(box.width, box.height) * (plan.format === 'cinematic_sequence' ? 0.46 : 0.42);
      const extra =
        region.role === 'outcome'
          ? signal(
              autoClaim.grammar.outcomeSignal,
              box.left + box.width * 0.63,
              box.top + box.height * 0.64,
              Math.min(76, box.width * 0.24),
              theme,
            )
          : region.role === 'mechanism' && plan.format === 'cinematic_sequence'
            ? signal('failure', box.left + box.width * 0.65, box.top + box.height * 0.64, 68, theme)
            : '';
      return `${glyph(visualGlyph, c.x - size / 2, c.y - size / 2, size, theme)}${extra}`;
    })
    .join('');
  const connectors = plan.transitions
    .map((transition) => {
      const from = boxes.get(transition.from);
      const to = boxes.get(transition.to);
      if (!from || !to) return '';
      const fromCenter = center(from);
      const toCenter = center(to);
      return connector(
        { x: from.left + from.width + 8, y: fromCenter.y },
        { x: to.left - 8, y: toCenter.y },
        transition.type === 'contrast' ? 'compare' : autoClaim.grammar.relation,
        theme,
      );
    })
    .join('');
  return `${panels}${connectors}${icons}`;
}

export function renderGenericVisualSvg(input: GenericVisualSvgInput): Buffer {
  const width = Math.max(320, Math.round(input.width ?? 1280));
  const height = Math.max(180, Math.round(input.height ?? 720));
  const theme = DEFAULT_THEME;
  const scene =
    input.plan.format === 'cinematic_data_contrast'
      ? dataContrastScene(input.autoClaim, input.plan, width, height, theme)
      : input.plan.format === 'cinematic_cutaway'
        ? cutawayScene(input.autoClaim, input.plan, width, height, theme)
        : input.plan.format === 'cinematic_routing'
          ? routingScene(input.autoClaim, input.plan, width, height, theme)
          : standardRegionsScene(input.autoClaim, input.plan, width, height, theme);
  const overlays = input.includeOverlays
    ? overlayPills(input.plan.overlays, input.plan.regions, width, height, theme)
    : '';
  return Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${defs(
      theme,
    )}${background(width, height, theme)}${scene}${overlays}</svg>`,
  );
}

export function approvedSvgText(input: GenericVisualSvgInput): string[] {
  return input.includeOverlays ? input.plan.overlays.map((overlay) => overlay.text) : [];
}
