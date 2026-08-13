import type { OverlayGroup, VisualPlan, VisualRegion } from './visual-compiler';
import type { AutoVisualClaimV5, VisualMetricDirection } from './visual-auto-claim-v5';
import { renderGenericVisualSvg } from './visual-generic-svg';

export interface GenericVisualSvgV5Input {
  autoClaim: AutoVisualClaimV5;
  plan: VisualPlan;
  width?: number;
  height?: number;
  includeOverlays?: boolean;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const COLORS = {
  background: '#040A11',
  panel: '#07131E',
  panelAlt: '#0B1B29',
  cyan: '#22D3EE',
  cyanLight: '#CFFAFE',
  violet: '#A78BFA',
  green: '#34D399',
  amber: '#FB923C',
  rose: '#FB7185',
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

function bounds(region: VisualRegion, width: number, height: number): Box {
  return {
    x: Math.round(region.bounds.x * width),
    y: Math.round(region.bounds.y * height),
    width: Math.max(1, Math.round(region.bounds.width * width)),
    height: Math.max(1, Math.round(region.bounds.height * height)),
  };
}

function defs(): string {
  return `<defs>
    <linearGradient id="v5-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#03070D"/><stop offset="0.55" stop-color="#071827"/><stop offset="1" stop-color="#101827"/></linearGradient>
    <linearGradient id="v5-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#64748B"/><stop offset="0.5" stop-color="#0F172A"/><stop offset="1" stop-color="#334155"/></linearGradient>
    <radialGradient id="v5-cyan-glow"><stop offset="0" stop-color="${COLORS.cyan}" stop-opacity="0.32"/><stop offset="1" stop-color="${COLORS.cyan}" stop-opacity="0"/></radialGradient>
    <radialGradient id="v5-warm-glow"><stop offset="0" stop-color="${COLORS.amber}" stop-opacity="0.38"/><stop offset="1" stop-color="${COLORS.amber}" stop-opacity="0"/></radialGradient>
    <filter id="v5-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="15" stdDeviation="14" flood-color="#000814" flood-opacity="0.82"/></filter>
    <marker id="v5-arrow" markerWidth="11" markerHeight="11" refX="9" refY="5.5" orient="auto"><path d="M0 0 11 5.5 0 11Z" fill="${COLORS.cyanLight}"/></marker>
  </defs>`;
}

function background(width: number, height: number): string {
  const grid = [1, 2, 3, 4, 5, 6, 7]
    .map((index) => {
      const x = Math.round((index * width) / 8);
      return `<path d="M${x} 0V${height}" stroke="${COLORS.white}" stroke-opacity="0.025"/>`;
    })
    .join('');
  return `<rect width="${width}" height="${height}" fill="url(#v5-bg)"/>
    <ellipse cx="${width * 0.52}" cy="${height * 0.48}" rx="${width * 0.48}" ry="${height * 0.43}" fill="url(#v5-cyan-glow)" opacity="0.24"/>
    ${grid}`;
}

function panel(box: Box, dashed = false, warm = false): string {
  return `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="28" fill="${COLORS.panel}" fill-opacity="0.95" stroke="${warm ? COLORS.amber : COLORS.cyan}" stroke-opacity="0.34" stroke-width="3"${
    dashed ? ' stroke-dasharray="13 11"' : ''
  } filter="url(#v5-shadow)"/>`;
}

function meter(
  cx: number,
  cy: number,
  radius: number,
  level: number,
  positive: boolean,
): string {
  const clamped = Math.max(0.05, Math.min(0.95, level));
  const start = Math.PI;
  const end = Math.PI + Math.PI * clamped;
  const x1 = cx + Math.cos(start) * radius;
  const y1 = cy + Math.sin(start) * radius;
  const x2 = cx + Math.cos(end) * radius;
  const y2 = cy + Math.sin(end) * radius;
  const needleAngle = Math.PI + Math.PI * clamped;
  const needleX = cx + Math.cos(needleAngle) * radius * 0.74;
  const needleY = cy + Math.sin(needleAngle) * radius * 0.74;
  return `<g>
    <path d="M${cx - radius} ${cy}A${radius} ${radius} 0 0 1 ${cx + radius} ${cy}" fill="none" stroke="${COLORS.white}" stroke-opacity="0.22" stroke-width="16" stroke-linecap="round"/>
    <path d="M${x1} ${y1}A${radius} ${radius} 0 0 1 ${x2} ${y2}" fill="none" stroke="${positive ? COLORS.green : COLORS.amber}" stroke-width="9" stroke-linecap="round"/>
    <path d="M${cx} ${cy} ${needleX} ${needleY}" stroke="${COLORS.cyanLight}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="10" fill="${COLORS.cyan}"/>
  </g>`;
}

function stack(
  x: number,
  baselineY: number,
  width: number,
  count: number,
  compact: boolean,
): string {
  const actual = Math.max(1, Math.min(8, count));
  return Array.from({ length: actual }, (_, index) => {
    const height = compact ? 18 : 28;
    const gap = compact ? 7 : 10;
    const y = baselineY - (index + 1) * (height + gap);
    const opacity = 0.2 + (index / actual) * 0.48;
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${index % 2 ? COLORS.violet : COLORS.cyan}" fill-opacity="${opacity}" stroke="${COLORS.cyanLight}" stroke-opacity="0.34" stroke-width="2"/>`;
  }).join('');
}

function chip(cx: number, cy: number, size: number, accent = COLORS.cyan): string {
  const x = cx - size / 2;
  const y = cy - size / 2;
  const pins = [0.22, 0.42, 0.62, 0.82]
    .map(
      (fraction) =>
        `<path d="M${x - 14} ${y + size * fraction}h14M${x + size} ${
          y + size * fraction
        }h14M${x + size * fraction} ${y - 14}v14M${x + size * fraction} ${
          y + size
        }v14" stroke="${COLORS.cyanLight}" stroke-width="4" stroke-linecap="round"/>`,
    )
    .join('');
  return `<g>${pins}<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.16}" fill="url(#v5-metal)" stroke="${accent}" stroke-width="5"/><rect x="${x + size * 0.28}" y="${y + size * 0.28}" width="${size * 0.44}" height="${size * 0.44}" rx="${size * 0.08}" fill="${accent}" fill-opacity="0.48"/></g>`;
}

function coins(cx: number, baselineY: number, scale: number, count: number): string {
  return Array.from({ length: Math.max(1, Math.min(6, count)) }, (_, index) => {
    const y = baselineY - index * 15 * scale;
    return `<ellipse cx="${cx}" cy="${y}" rx="${34 * scale}" ry="${11 * scale}" fill="${COLORS.amber}" fill-opacity="${0.22 + index * 0.07}" stroke="${COLORS.amber}" stroke-width="${3 * scale}"/>`;
  }).join('');
}

function trophy(cx: number, cy: number, scale = 1): string {
  return `<g transform="translate(${cx - 50 * scale} ${cy - 50 * scale}) scale(${scale})">
    <path d="M25 18h50v22c0 18-10 29-25 35-15-6-25-17-25-35Z" fill="${COLORS.amber}" fill-opacity="0.24" stroke="${COLORS.amber}" stroke-width="5"/>
    <path d="M25 26H12v12c0 13 8 20 22 20M75 26h13v12c0 13-8 20-22 20M50 75v13M30 90h40" fill="none" stroke="${COLORS.cyanLight}" stroke-width="6" stroke-linecap="round"/>
  </g>`;
}

function uncertaintyHalo(cx: number, cy: number, radius: number): string {
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${COLORS.violet}" fill-opacity="0.08" stroke="${COLORS.violet}" stroke-width="5" stroke-dasharray="12 11"/>
    <circle cx="${cx}" cy="${cy}" r="${radius * 0.58}" fill="none" stroke="${COLORS.cyan}" stroke-opacity="0.45" stroke-width="3" stroke-dasharray="7 9"/>
    <path d="M${cx} ${cy - radius * 0.33}c${radius * 0.25} 0 ${radius * 0.3} ${radius * 0.34} ${radius * 0.08} ${radius * 0.46}-${radius * 0.12} ${radius * 0.07}-${radius * 0.16} ${radius * 0.14}-${radius * 0.16} ${radius * 0.26}" fill="none" stroke="${COLORS.cyanLight}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy + radius * 0.35}" r="${radius * 0.06}" fill="${COLORS.cyanLight}"/>
  </g>`;
}

function arrow(fromX: number, fromY: number, toX: number, toY: number): string {
  const mid = (fromX + toX) / 2;
  return `<path d="M${fromX} ${fromY}C${mid} ${fromY - 28},${mid} ${toY + 28},${toX} ${toY}" fill="none" stroke="${COLORS.cyanLight}" stroke-width="7" stroke-linecap="round" marker-end="url(#v5-arrow)"/>`;
}

function pills(
  overlays: readonly OverlayGroup[],
  regions: readonly VisualRegion[],
  width: number,
  height: number,
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
      const x = box.x + 11;
      const y = box.y + 11 + index * 45;
      return `<g><rect x="${x}" y="${y}" width="${pillWidth}" height="37" rx="18.5" fill="${
        primary ? COLORS.cyanLight : '#083344'
      }" fill-opacity="0.97" stroke="${COLORS.cyan}" stroke-width="1.5"/><text x="${
        x + 17
      }" y="${y + 24.5}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="800" fill="${
        primary ? '#083344' : COLORS.white
      }">${xml(overlay.text)}</text></g>`;
    })
    .join('');
}

function isDecrease(direction: VisualMetricDirection): boolean {
  return direction === 'decrease' || direction === 'lower_is_better';
}

function quantitativeScene(
  input: GenericVisualSvgV5Input,
  width: number,
  height: number,
): string {
  const leftRegion = input.plan.regions.find((region) => region.id === 'baseline') ?? input.plan.regions[0]!;
  const rightRegion = input.plan.regions.find((region) => region.id === 'amplified') ?? input.plan.regions[1]!;
  const left = bounds(leftRegion, width, height);
  const right = bounds(rightRegion, width, height);
  const direction = input.autoClaim.semantics.metric?.direction ?? 'neutral';
  const decrease = isDecrease(direction);
  const benchmark = input.autoClaim.semantics.explanatoryRole === 'benchmark_comparison';
  const leftLevel = decrease ? 0.84 : 0.27;
  const rightLevel = decrease ? 0.27 : 0.84;
  const leftCenter = { x: left.x + left.width * 0.5, y: left.y + left.height * 0.54 };
  const rightCenter = { x: right.x + right.width * 0.5, y: right.y + right.height * 0.54 };
  const leftCount = decrease ? 7 : 2;
  const rightCount = decrease ? 2 : 7;
  const positiveRight = direction !== 'increase' || input.autoClaim.claim.outcomeKind !== 'harm';
  return `${panel(left, false, decrease)}${panel(right, false, !decrease)}
    <ellipse cx="${leftCenter.x}" cy="${leftCenter.y}" rx="${left.width * 0.42}" ry="${left.height * 0.43}" fill="${decrease ? 'url(#v5-warm-glow)' : 'url(#v5-cyan-glow)'}" opacity="0.65"/>
    <ellipse cx="${rightCenter.x}" cy="${rightCenter.y}" rx="${right.width * 0.42}" ry="${right.height * 0.43}" fill="${decrease ? 'url(#v5-cyan-glow)' : 'url(#v5-warm-glow)'}" opacity="0.65"/>
    ${benchmark ? coins(leftCenter.x, left.y + left.height * 0.74, 1.1, leftCount) : stack(left.x + left.width * 0.23, left.y + left.height * 0.77, left.width * 0.28, leftCount, decrease ? false : true)}
    ${benchmark ? coins(rightCenter.x, right.y + right.height * 0.74, 1.1, rightCount) : stack(right.x + right.width * 0.23, right.y + right.height * 0.77, right.width * 0.28, rightCount, decrease ? true : false)}
    ${chip(left.x + left.width * 0.68, left.y + left.height * 0.48, Math.min(left.width, left.height) * 0.26, decrease ? COLORS.amber : COLORS.cyan)}
    ${chip(right.x + right.width * 0.68, right.y + right.height * 0.48, Math.min(right.width, right.height) * 0.26, decrease ? COLORS.cyan : COLORS.amber)}
    ${meter(left.x + left.width * 0.69, left.y + left.height * 0.76, Math.min(left.width, left.height) * 0.13, leftLevel, !decrease)}
    ${meter(right.x + right.width * 0.69, right.y + right.height * 0.76, Math.min(right.width, right.height) * 0.13, rightLevel, positiveRight)}
    ${benchmark ? trophy(right.x + right.width * 0.82, right.y + right.height * 0.24, 0.62) : ''}
    ${arrow(left.x + left.width + 14, leftCenter.y, right.x - 14, rightCenter.y)}`;
}

function uncertaintyScene(
  input: GenericVisualSvgV5Input,
  width: number,
  height: number,
): string {
  const leftRegion = input.plan.regions.find((region) => region.id === 'left') ?? input.plan.regions[0]!;
  const rightRegion = input.plan.regions.find((region) => region.id === 'right') ?? input.plan.regions[1]!;
  const left = bounds(leftRegion, width, height);
  const right = bounds(rightRegion, width, height);
  const leftCenter = { x: left.x + left.width * 0.5, y: left.y + left.height * 0.55 };
  const rightCenter = { x: right.x + right.width * 0.5, y: right.y + right.height * 0.55 };
  return `${panel(left)}${panel(right, true)}
    ${chip(leftCenter.x, leftCenter.y, Math.min(left.width, left.height) * 0.36, COLORS.muted)}
    <path d="M${left.x + left.width * 0.24} ${left.y + left.height * 0.74}H${left.x + left.width * 0.76}" stroke="${COLORS.muted}" stroke-width="10" stroke-linecap="round"/>
    ${uncertaintyHalo(rightCenter.x, rightCenter.y, Math.min(right.width, right.height) * 0.29)}
    ${chip(rightCenter.x, rightCenter.y, Math.min(right.width, right.height) * 0.25, COLORS.violet)}
    ${arrow(left.x + left.width + 14, leftCenter.y, right.x - 14, rightCenter.y)}`;
}

export function renderGenericVisualSvgV5(input: GenericVisualSvgV5Input): Buffer {
  const width = Math.max(320, Math.round(input.width ?? 1280));
  const height = Math.max(180, Math.round(input.height ?? 720));
  const role = input.autoClaim.semantics.explanatoryRole;
  if (role !== 'quantitative_result' && role !== 'benchmark_comparison' && role !== 'uncertainty_announcement') {
    return renderGenericVisualSvg(input);
  }
  const scene =
    role === 'uncertainty_announcement'
      ? uncertaintyScene(input, width, height)
      : quantitativeScene(input, width, height);
  const overlays = input.includeOverlays
    ? pills(input.plan.overlays, input.plan.regions, width, height)
    : '';
  return Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${defs()}${background(
      width,
      height,
    )}${scene}${overlays}</svg>`,
  );
}
