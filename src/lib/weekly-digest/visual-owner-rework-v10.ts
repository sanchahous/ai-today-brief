import type { HoldoutStoryInput } from './visual-auto-claim';

export const OWNER_REWORK_KINDS_V10 = [
  'gemini_consistency',
  'claude_threshold_controls',
  'deep_work_bounded_hint',
  'token_caching',
  'fuzz_repair_loop',
  'optical_context_compression',
] as const;

export type OwnerReworkKindV10 = (typeof OWNER_REWORK_KINDS_V10)[number];

export interface OwnerReworkTreatmentV10 {
  id: string;
  kind: OwnerReworkKindV10;
  title: string;
  coreClaim: string;
  labels: string[];
  expectedEvidence: string[];
  forbiddenImplications: string[];
  renderMode: 'deterministic_hybrid' | 'generated_cinematic';
  imageCalls: 0 | 2;
}

export interface DeterministicNodeV10 {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DeterministicArrowV10 {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

export interface DeterministicGeometryV10 {
  nodes: DeterministicNodeV10[];
  arrows: DeterministicArrowV10[];
}

const COLORS = {
  background: '#02060C',
  backgroundAlt: '#071522',
  panel: '#07141F',
  panelAlt: '#0A1D2B',
  cyan: '#22D3EE',
  cyanLight: '#CFFAFE',
  violet: '#A78BFA',
  green: '#34D399',
  amber: '#FB923C',
  rose: '#FB7185',
  white: '#ECFEFF',
  muted: '#64748B',
};

function clean(value: string, maxLength: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function defs(): string {
  return `<defs>
    <linearGradient id="v10-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#02060C"/><stop offset="0.52" stop-color="#071827"/><stop offset="1" stop-color="#11182B"/></linearGradient>
    <linearGradient id="v10-panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#07111B"/><stop offset="1" stop-color="#0B2232"/></linearGradient>
    <linearGradient id="v10-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#94A3B8"/><stop offset="0.35" stop-color="#1E293B"/><stop offset="1" stop-color="#475569"/></linearGradient>
    <radialGradient id="v10-cyan-glow"><stop offset="0" stop-color="${COLORS.cyan}" stop-opacity="0.34"/><stop offset="1" stop-color="${COLORS.cyan}" stop-opacity="0"/></radialGradient>
    <radialGradient id="v10-warm-glow"><stop offset="0" stop-color="${COLORS.amber}" stop-opacity="0.42"/><stop offset="1" stop-color="${COLORS.amber}" stop-opacity="0"/></radialGradient>
    <filter id="v10-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000814" flood-opacity="0.84"/></filter>
    <filter id="v10-soft"><feGaussianBlur stdDeviation="12"/></filter>
    <marker id="v10-arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0 0 12 6 0 12Z" fill="${COLORS.cyanLight}"/></marker>
    <clipPath id="v10-lens-clip"><circle cx="1052" cy="350" r="126"/></clipPath>
  </defs>`;
}

function background(width: number, height: number): string {
  const grid = Array.from({ length: 8 }, (_, index) => {
    const x = Math.round(((index + 1) * width) / 9);
    return `<path d="M${x} 0V${height}" stroke="${COLORS.white}" stroke-opacity="0.022"/>`;
  }).join('');
  return `<rect width="${width}" height="${height}" fill="url(#v10-bg)"/>
    <ellipse cx="${width * 0.53}" cy="${height * 0.5}" rx="${width * 0.49}" ry="${height * 0.44}" fill="url(#v10-cyan-glow)" opacity="0.28"/>
    ${grid}`;
}

function panel(
  node: DeterministicNodeV10,
  options: { warm?: boolean; dashed?: boolean; opacity?: number } = {},
): string {
  return `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="30" fill="url(#v10-panel)" fill-opacity="${options.opacity ?? 0.96}" stroke="${options.warm ? COLORS.amber : COLORS.cyan}" stroke-opacity="0.44" stroke-width="3"${options.dashed ? ' stroke-dasharray="14 11"' : ''} filter="url(#v10-shadow)"/>`;
}

function arrow(value: DeterministicArrowV10): string {
  const midX = (value.sourceX + value.targetX) / 2;
  return `<path d="M${value.sourceX} ${value.sourceY}C${midX} ${value.sourceY},${midX} ${value.targetY},${value.targetX} ${value.targetY}" fill="none" stroke="${COLORS.cyanLight}" stroke-width="8" stroke-linecap="round" marker-end="url(#v10-arrow)"/>`;
}

function pill(text: string, x: number, y: number, primary = false): string {
  const fontSize = text.length > 23 ? 15 : 17;
  const width = Math.max(
    116,
    Math.min(330, Math.round(text.length * fontSize * 0.62 + 40)),
  );
  return `<g><rect x="${x}" y="${y}" width="${width}" height="40" rx="20" fill="${primary ? COLORS.cyanLight : '#083344'}" fill-opacity="0.98" stroke="${COLORS.cyan}" stroke-width="1.5"/><text x="${x + 18}" y="${y + 26}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="800" fill="${primary ? '#083344' : COLORS.white}">${xml(text)}</text></g>`;
}

function codeCard(
  x: number,
  y: number,
  width: number,
  height: number,
  mode: 'input' | 'modular' | 'fragmented' | 'failure' | 'patched',
): string {
  const lineColor =
    mode === 'failure'
      ? COLORS.rose
      : mode === 'patched'
        ? COLORS.green
        : COLORS.cyanLight;
  const lines = Array.from({ length: 5 }, (_, index) => {
    const lineWidth =
      mode === 'fragmented'
        ? width * (index % 2 ? 0.28 : 0.62)
        : width * (0.52 + (index % 3) * 0.1);
    const offset =
      mode === 'fragmented' && index % 2 ? width * 0.35 : width * 0.13;
    return `<rect x="${x + offset}" y="${y + 28 + index * 24}" width="${lineWidth}" height="7" rx="3.5" fill="${lineColor}" fill-opacity="${0.3 + index * 0.1}"/>`;
  }).join('');
  const modules =
    mode === 'modular'
      ? `<rect x="${x + width * 0.12}" y="${y + height - 58}" width="${width * 0.2}" height="28" rx="8" fill="${COLORS.green}" fill-opacity="0.36"/><rect x="${x + width * 0.4}" y="${y + height - 58}" width="${width * 0.2}" height="28" rx="8" fill="${COLORS.green}" fill-opacity="0.36"/><rect x="${x + width * 0.68}" y="${y + height - 58}" width="${width * 0.2}" height="28" rx="8" fill="${COLORS.green}" fill-opacity="0.36"/>`
      : mode === 'fragmented'
        ? `<path d="M${x + width * 0.15} ${y + height - 34}l35-42 34 50 42-58 38 48 32-35" fill="none" stroke="${COLORS.amber}" stroke-width="7" stroke-linecap="round"/>`
        : mode === 'failure'
          ? `<path d="M${x + width * 0.28} ${y + height - 38}l28-36 31 42 29-55 33 48" fill="none" stroke="${COLORS.rose}" stroke-width="8" stroke-linecap="round"/><circle cx="${x + width * 0.78}" cy="${y + height - 50}" r="18" fill="${COLORS.rose}" fill-opacity="0.28" stroke="${COLORS.rose}" stroke-width="5"/>`
          : mode === 'patched'
            ? `<path d="M${x + width * 0.2} ${y + height - 50}l24 22 51-58" fill="none" stroke="${COLORS.green}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`
            : '';
  return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="20" fill="#06121C" stroke="${mode === 'failure' ? COLORS.rose : mode === 'patched' ? COLORS.green : COLORS.cyan}" stroke-width="3"/>${lines}${modules}</g>`;
}

function processor(cx: number, cy: number, size: number): string {
  const x = cx - size / 2;
  const y = cy - size / 2;
  const pins = [0.2, 0.4, 0.6, 0.8]
    .map(
      (fraction) =>
        `<path d="M${x - 16} ${y + size * fraction}h16M${x + size} ${y + size * fraction}h16M${x + size * fraction} ${y - 16}v16M${x + size * fraction} ${y + size}v16" stroke="${COLORS.cyanLight}" stroke-width="4" stroke-linecap="round"/>`,
    )
    .join('');
  return `<g>${pins}<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="20" fill="url(#v10-metal)" stroke="${COLORS.cyan}" stroke-width="5"/><rect x="${x + size * 0.28}" y="${y + size * 0.28}" width="${size * 0.44}" height="${size * 0.44}" rx="10" fill="${COLORS.cyan}" fill-opacity="0.5"/></g>`;
}

function meter(
  cx: number,
  cy: number,
  radius: number,
  level: number,
  positive: boolean,
): string {
  const angle = Math.PI + Math.PI * Math.max(0.06, Math.min(0.94, level));
  const needleX = cx + Math.cos(angle) * radius * 0.74;
  const needleY = cy + Math.sin(angle) * radius * 0.74;
  return `<g><path d="M${cx - radius} ${cy}A${radius} ${radius} 0 0 1 ${cx + radius} ${cy}" fill="none" stroke="${COLORS.white}" stroke-opacity="0.2" stroke-width="17" stroke-linecap="round"/><path d="M${cx} ${cy} ${needleX} ${needleY}" stroke="${COLORS.cyanLight}" stroke-width="7" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="10" fill="${positive ? COLORS.green : COLORS.amber}"/></g>`;
}

function repeatedBlocks(
  x: number,
  y: number,
  width: number,
  count: number,
  compact = false,
): string {
  return Array.from({ length: count }, (_, index) => {
    const h = compact ? 19 : 28;
    const gap = compact ? 8 : 10;
    return `<rect x="${x}" y="${y + index * (h + gap)}" width="${width - index * (compact ? 8 : 4)}" height="${h}" rx="${h / 2}" fill="${index % 2 ? COLORS.violet : COLORS.cyan}" fill-opacity="${0.24 + index * 0.055}" stroke="${COLORS.cyanLight}" stroke-opacity="0.34" stroke-width="2"/>`;
  }).join('');
}

function geminiScene(): {
  geometry: DeterministicGeometryV10;
  body: string;
  labels: Array<[string, number, number, boolean]>;
} {
  const nodes: DeterministicNodeV10[] = [
    { id: 'task', x: 60, y: 176, width: 258, height: 360 },
    { id: 'model', x: 435, y: 214, width: 300, height: 282 },
    { id: 'run-a', x: 870, y: 102, width: 342, height: 244 },
    { id: 'run-b', x: 870, y: 386, width: 342, height: 244 },
  ];
  const arrows: DeterministicArrowV10[] = [
    {
      id: 'task-model',
      sourceNodeId: 'task',
      targetNodeId: 'model',
      sourceX: 318,
      sourceY: 356,
      targetX: 435,
      targetY: 356,
    },
    {
      id: 'model-run-a',
      sourceNodeId: 'model',
      targetNodeId: 'run-a',
      sourceX: 735,
      sourceY: 288,
      targetX: 870,
      targetY: 224,
    },
    {
      id: 'model-run-b',
      sourceNodeId: 'model',
      targetNodeId: 'run-b',
      sourceX: 735,
      sourceY: 422,
      targetX: 870,
      targetY: 508,
    },
  ];
  const task = nodes[0]!;
  const model = nodes[1]!;
  const runA = nodes[2]!;
  const runB = nodes[3]!;
  const body = `${panel(task)}${panel(model)}${panel(runA)}${panel(runB, { warm: true })}
    ${codeCard(task.x + 32, task.y + 74, task.width - 64, 210, 'input')}
    <path d="M${task.x + task.width * 0.5} ${task.y + 305}v34" stroke="${COLORS.cyanLight}" stroke-width="7" stroke-linecap="round"/>
    <path d="M${task.x + task.width * 0.5 - 48} ${task.y + 339}h96" stroke="${COLORS.cyanLight}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="${model.x + model.width / 2}" cy="${model.y + model.height / 2}" r="106" fill="${COLORS.cyan}" fill-opacity="0.08" stroke="${COLORS.cyan}" stroke-width="5"/>
    ${processor(model.x + model.width / 2, model.y + model.height / 2, 116)}
    <path d="M${model.x + 55} ${model.y + 68}h190" stroke="${COLORS.cyanLight}" stroke-opacity="0.34" stroke-width="6" stroke-linecap="round"/>
    <path d="M${model.x + 55} ${model.y + model.height - 68}h190" stroke="${COLORS.cyanLight}" stroke-opacity="0.34" stroke-width="6" stroke-linecap="round"/>
    ${codeCard(runA.x + 30, runA.y + 28, runA.width - 60, runA.height - 56, 'modular')}
    ${codeCard(runB.x + 30, runB.y + 28, runB.width - 60, runB.height - 56, 'fragmented')}
    ${arrows.map(arrow).join('')}`;
  return {
    geometry: { nodes, arrows },
    body,
    labels: [
      ['SAME TASK', 76, 116, true],
      ['SAME MODEL', 470, 150, false],
      ['RUN A', 896, 54, false],
      ['RUN B', 896, 338, false],
    ],
  };
}

function thresholdScene(): {
  geometry: DeterministicGeometryV10;
  body: string;
  labels: Array<[string, number, number, boolean]>;
} {
  const nodes: DeterministicNodeV10[] = [
    { id: 'unbounded', x: 48, y: 128, width: 282, height: 480 },
    { id: 'controls', x: 408, y: 128, width: 330, height: 480 },
    { id: 'bounded', x: 832, y: 128, width: 392, height: 480 },
  ];
  const arrows: DeterministicArrowV10[] = [
    {
      id: 'unbounded-controls',
      sourceNodeId: 'unbounded',
      targetNodeId: 'controls',
      sourceX: 330,
      sourceY: 368,
      targetX: 408,
      targetY: 368,
    },
    {
      id: 'controls-bounded',
      sourceNodeId: 'controls',
      targetNodeId: 'bounded',
      sourceX: 738,
      sourceY: 368,
      targetX: 832,
      targetY: 368,
    },
  ];
  const [unbounded, controls, bounded] = nodes;
  const controlRows = [
    { cy: 236, accent: COLORS.cyan, symbol: '↻' },
    { cy: 366, accent: COLORS.violet, symbol: '⋮' },
    { cy: 496, accent: COLORS.green, symbol: '◉' },
  ]
    .map(
      (row) =>
        `<g><circle cx="${controls!.x + 78}" cy="${row.cy}" r="48" fill="${row.accent}" fill-opacity="0.14" stroke="${row.accent}" stroke-width="5"/><text x="${controls!.x + 78}" y="${row.cy + 15}" text-anchor="middle" font-family="DejaVu Sans,Arial,sans-serif" font-size="44" font-weight="900" fill="${COLORS.cyanLight}">${row.symbol}</text><path d="M${controls!.x + 150} ${row.cy}h118" stroke="${row.accent}" stroke-width="8" stroke-linecap="round"/></g>`,
    )
    .join('');
  const body = `${panel(unbounded!, { warm: true })}${panel(controls!)}${panel(bounded!)}
    <ellipse cx="${unbounded!.x + unbounded!.width / 2}" cy="${unbounded!.y + unbounded!.height / 2}" rx="190" ry="260" fill="url(#v10-warm-glow)" opacity="0.52"/>
    ${repeatedBlocks(unbounded!.x + 45, unbounded!.y + 62, unbounded!.width - 90, 9)}
    <path d="M${unbounded!.x + 35} ${unbounded!.y + 355}h${unbounded!.width - 70}" stroke="${COLORS.rose}" stroke-width="6" stroke-dasharray="14 10"/>
    <path d="M${unbounded!.x + 42} ${unbounded!.y + 388}C${unbounded!.x + 96} ${unbounded!.y + 355},${unbounded!.x + 166} ${unbounded!.y + 430},${unbounded!.x + 238} ${unbounded!.y + 378}" fill="none" stroke="${COLORS.amber}" stroke-width="8" stroke-linecap="round"/>
    ${controlRows}
    <path d="M${bounded!.x + 42} ${bounded!.y + 112}h${bounded!.width - 84}" stroke="${COLORS.rose}" stroke-width="6" stroke-dasharray="14 10"/>
    ${repeatedBlocks(bounded!.x + 48, bounded!.y + 185, bounded!.width * 0.35, 4, true)}
    ${repeatedBlocks(bounded!.x + bounded!.width * 0.57, bounded!.y + 185, bounded!.width * 0.31, 4, true)}
    <path d="M${bounded!.x + 42} ${bounded!.y + 398}C${bounded!.x + 132} ${bounded!.y + 344},${bounded!.x + 216} ${bounded!.y + 432},${bounded!.x + 348} ${bounded!.y + 352}" fill="none" stroke="${COLORS.green}" stroke-width="8" stroke-linecap="round"/>
    ${meter(bounded!.x + bounded!.width / 2, bounded!.y + 440, 74, 0.36, true)}
    ${arrows.map(arrow).join('')}`;
  return {
    geometry: { nodes, arrows },
    body,
    labels: [
      ['LONG SESSION', 64, 74, true],
      ['CACHE • SPLIT • MONITOR', 438, 74, false],
      ['BOUNDED CONTINUATION', 862, 74, false],
    ],
  };
}

function cachingScene(): {
  geometry: DeterministicGeometryV10;
  body: string;
  labels: Array<[string, number, number, boolean]>;
} {
  const nodes: DeterministicNodeV10[] = [
    { id: 'repeated', x: 52, y: 130, width: 350, height: 470 },
    { id: 'cache', x: 490, y: 210, width: 258, height: 310 },
    { id: 'reuse', x: 836, y: 130, width: 390, height: 470 },
  ];
  const arrows: DeterministicArrowV10[] = [
    {
      id: 'repeated-cache',
      sourceNodeId: 'repeated',
      targetNodeId: 'cache',
      sourceX: 402,
      sourceY: 365,
      targetX: 490,
      targetY: 365,
    },
    {
      id: 'cache-reuse',
      sourceNodeId: 'cache',
      targetNodeId: 'reuse',
      sourceX: 748,
      sourceY: 365,
      targetX: 836,
      targetY: 365,
    },
  ];
  const [repeated, cache, reuse] = nodes;
  const body = `${panel(repeated!, { warm: true })}${panel(cache!)}${panel(reuse!)}
    <ellipse cx="${repeated!.x + repeated!.width / 2}" cy="${repeated!.y + repeated!.height / 2}" rx="210" ry="260" fill="url(#v10-warm-glow)" opacity="0.45"/>
    ${repeatedBlocks(repeated!.x + 42, repeated!.y + 58, repeated!.width - 84, 7)}
    ${processor(repeated!.x + repeated!.width / 2, repeated!.y + 365, 98)}
    ${meter(repeated!.x + repeated!.width / 2, repeated!.y + 438, 68, 0.82, false)}
    <rect x="${cache!.x + 48}" y="${cache!.y + 52}" width="${cache!.width - 96}" height="${cache!.height - 104}" rx="32" fill="#082F49" stroke="${COLORS.cyan}" stroke-width="5"/>
    <path d="M${cache!.x + 82} ${cache!.y + 98}h${cache!.width - 164}v112h-${cache!.width - 164}Z" fill="${COLORS.cyan}" fill-opacity="0.15" stroke="${COLORS.cyanLight}" stroke-opacity="0.44" stroke-width="4"/>
    ${repeatedBlocks(reuse!.x + 40, reuse!.y + 62, reuse!.width * 0.34, 3, true)}
    ${repeatedBlocks(reuse!.x + reuse!.width * 0.54, reuse!.y + 62, reuse!.width * 0.33, 3, true)}
    <path d="M${reuse!.x + 54} ${reuse!.y + 250}h${reuse!.width - 108}" stroke="${COLORS.green}" stroke-width="8" stroke-linecap="round"/>
    ${processor(reuse!.x + reuse!.width / 2, reuse!.y + 336, 92)}
    ${meter(reuse!.x + reuse!.width / 2, reuse!.y + 438, 68, 0.24, true)}
    ${arrows.map(arrow).join('')}`;
  return {
    geometry: { nodes, arrows },
    body,
    labels: [
      ['REPEATED CONTEXT', 70, 76, true],
      ['CACHE ONCE', 520, 156, false],
      ['REUSE • LOWER COST', 868, 76, false],
    ],
  };
}

function fuzzScene(): {
  geometry: DeterministicGeometryV10;
  body: string;
  labels: Array<[string, number, number, boolean]>;
} {
  const nodes: DeterministicNodeV10[] = [
    { id: 'fuzz', x: 44, y: 150, width: 350, height: 450 },
    { id: 'fail', x: 465, y: 150, width: 350, height: 450 },
    { id: 'repair', x: 886, y: 150, width: 350, height: 450 },
  ];
  const arrows: DeterministicArrowV10[] = [
    {
      id: 'fuzz-fail',
      sourceNodeId: 'fuzz',
      targetNodeId: 'fail',
      sourceX: 394,
      sourceY: 375,
      targetX: 465,
      targetY: 375,
    },
    {
      id: 'fail-repair',
      sourceNodeId: 'fail',
      targetNodeId: 'repair',
      sourceX: 815,
      sourceY: 375,
      targetX: 886,
      targetY: 375,
    },
  ];
  const [fuzz, fail, repair] = nodes;
  const testShapes = Array.from({ length: 14 }, (_, index) => {
    const cx = fuzz!.x + 58 + ((index * 47) % 240);
    const cy = fuzz!.y + 80 + ((index * 71) % 190);
    const size = 12 + (index % 4) * 5;
    return index % 3 === 0
      ? `<rect x="${cx}" y="${cy}" width="${size * 1.5}" height="${size}" rx="${size / 3}" fill="${COLORS.violet}" fill-opacity="0.55" stroke="${COLORS.cyanLight}" stroke-opacity="0.5"/>`
      : `<circle cx="${cx}" cy="${cy}" r="${size / 1.6}" fill="${index % 2 ? COLORS.cyan : COLORS.amber}" fill-opacity="0.55"/>`;
  }).join('');
  const body = `${panel(fuzz!)}${panel(fail!, { warm: true })}${panel(repair!)}
    ${testShapes}
    <path d="M${fuzz!.x + 58} ${fuzz!.y + 318}C${fuzz!.x + 132} ${fuzz!.y + 268},${fuzz!.x + 218} ${fuzz!.y + 350},${fuzz!.x + 292} ${fuzz!.y + 296}" fill="none" stroke="${COLORS.cyanLight}" stroke-width="7" stroke-linecap="round"/>
    ${codeCard(fail!.x + 48, fail!.y + 68, fail!.width - 96, fail!.height - 136, 'failure')}
    <path d="M${fail!.x + 118} ${fail!.y + 332}l74-112 58 93" fill="none" stroke="${COLORS.rose}" stroke-width="8" stroke-linecap="round"/>
    ${codeCard(repair!.x + 48, repair!.y + 68, repair!.width - 96, repair!.height - 136, 'patched')}
    <path d="M${repair!.x + 80} ${repair!.y + 335}h190" stroke="${COLORS.green}" stroke-width="9" stroke-linecap="round"/>
    ${arrows.map(arrow).join('')}`;
  return {
    geometry: { nodes, arrows },
    body,
    labels: [
      ['FUZZ EDGE CASES', 64, 92, true],
      ['VISIBLE FAILURE', 485, 92, false],
      ['PATCH • VERIFY', 906, 92, false],
    ],
  };
}

function opticalScene(): {
  geometry: DeterministicGeometryV10;
  body: string;
  labels: Array<[string, number, number, boolean]>;
} {
  const nodes: DeterministicNodeV10[] = [
    { id: 'full', x: 46, y: 150, width: 320, height: 440 },
    { id: 'press', x: 450, y: 150, width: 330, height: 440 },
    { id: 'lens', x: 872, y: 150, width: 356, height: 440 },
  ];
  const arrows: DeterministicArrowV10[] = [
    {
      id: 'full-press',
      sourceNodeId: 'full',
      targetNodeId: 'press',
      sourceX: 366,
      sourceY: 370,
      targetX: 450,
      targetY: 370,
    },
    {
      id: 'press-lens',
      sourceNodeId: 'press',
      targetNodeId: 'lens',
      sourceX: 780,
      sourceY: 370,
      targetX: 872,
      targetY: 370,
    },
  ];
  const [full, press, lens] = nodes;
  const pages = Array.from({ length: 9 }, (_, index) => {
    const y = full!.y + 72 + index * 28;
    return `<rect x="${full!.x + 48 + index * 2}" y="${y}" width="${full!.width - 96 - index * 4}" height="18" rx="5" fill="${index % 2 ? COLORS.violet : COLORS.cyan}" fill-opacity="${0.22 + index * 0.045}" stroke="${COLORS.cyanLight}" stroke-opacity="0.34"/>`;
  }).join('');
  const microPattern = Array.from({ length: 13 }, (_, row) =>
    Array.from({ length: 16 }, (_, col) => {
      const x = 944 + col * 14;
      const y = 270 + row * 13;
      const on = (row * 7 + col * 11) % 5 !== 0;
      return `<rect x="${x}" y="${y}" width="8" height="7" rx="2" fill="${on ? COLORS.cyanLight : COLORS.violet}" fill-opacity="${on ? 0.7 : 0.32}"/>`;
    }).join(''),
  ).join('');
  const body = `${panel(full!)}${panel(press!, { warm: true })}${panel(lens!)}
    ${pages}
    <path d="M${press!.x + 76} ${press!.y + 80}h178v88h-178Z" fill="url(#v10-metal)" stroke="${COLORS.cyanLight}" stroke-width="5"/>
    <path d="M${press!.x + 165} ${press!.y + 44}v112" stroke="${COLORS.amber}" stroke-width="18" stroke-linecap="round"/>
    <path d="M${press!.x + 54} ${press!.y + 260}h222" stroke="${COLORS.amber}" stroke-width="18" stroke-linecap="round"/>
    <rect x="${press!.x + 104}" y="${press!.y + 294}" width="122" height="54" rx="10" fill="${COLORS.cyan}" fill-opacity="0.28" stroke="${COLORS.cyanLight}" stroke-width="4"/>
    <path d="M${press!.x + 165} ${press!.y + 350}v48" stroke="${COLORS.green}" stroke-width="8" stroke-linecap="round"/>
    <rect x="${press!.x + 119}" y="${press!.y + 398}" width="92" height="18" rx="9" fill="${COLORS.green}" fill-opacity="0.55"/>
    <line x1="${press!.x + 211}" y1="${press!.y + 407}" x2="932" y2="350" stroke="${COLORS.cyanLight}" stroke-width="6" stroke-linecap="round"/>
    <circle cx="1052" cy="350" r="132" fill="#06121C" stroke="${COLORS.cyanLight}" stroke-width="12" filter="url(#v10-shadow)"/>
    <g clip-path="url(#v10-lens-clip)"><rect x="920" y="218" width="264" height="264" fill="#082F49"/>${microPattern}</g>
    <path d="M1140 442l88 88" stroke="${COLORS.cyanLight}" stroke-width="24" stroke-linecap="round"/>
    ${arrows.map(arrow).join('')}`;
  return {
    geometry: { nodes, arrows },
    body,
    labels: [
      ['FULL CONTEXT', 64, 92, true],
      ['OPTICAL COMPRESS', 472, 92, false],
      ['DENSE DATA PRESERVED', 894, 92, false],
    ],
  };
}

function sceneFor(kind: Exclude<OwnerReworkKindV10, 'deep_work_bounded_hint'>) {
  switch (kind) {
    case 'gemini_consistency':
      return geminiScene();
    case 'claude_threshold_controls':
      return thresholdScene();
    case 'token_caching':
      return cachingScene();
    case 'fuzz_repair_loop':
      return fuzzScene();
    case 'optical_context_compression':
      return opticalScene();
  }
}

export function ownerReworkTreatmentV10(
  kind: OwnerReworkKindV10,
): OwnerReworkTreatmentV10 {
  switch (kind) {
    case 'gemini_consistency':
      return {
        id: kind,
        kind,
        title: 'Same task, same model, different code artifacts',
        coreClaim:
          'The same coding task run through the same model twice can produce visibly different outputs.',
        labels: ['SAME TASK', 'RUN A', 'RUN B'],
        expectedEvidence: [
          'one identical input task',
          'one shared model chamber',
          'two structurally different code artifacts',
        ],
        forbiddenImplications: [
          'two different tasks',
          'two different models',
          'a generic line chart',
        ],
        renderMode: 'deterministic_hybrid',
        imageCalls: 0,
      };
    case 'claude_threshold_controls':
      return {
        id: kind,
        kind,
        title: 'Bound a long agent session before hidden limits',
        coreClaim:
          'Long high-volume sessions need cache, split and monitoring controls before they reach hidden operational limits.',
        labels: ['LONG SESSION', 'CACHE • SPLIT • MONITOR', 'BOUNDED CONTINUATION'],
        expectedEvidence: [
          'an overloaded long session stream',
          'three visible control operations',
          'continued work stays below a risk boundary',
        ],
        forbiddenImplications: [
          'an exact undocumented limit',
          'a generic dashboard',
          'the session always fails',
        ],
        renderMode: 'deterministic_hybrid',
        imageCalls: 0,
      };
    case 'deep_work_bounded_hint':
      return {
        id: kind,
        kind,
        title: 'A bounded AI hint with a visible physical source',
        coreClaim:
          'A visible AI device gives one bounded hint while the person keeps thinking and doing all of the work.',
        labels: ['ACTIVE THINKING', 'ONE BOUNDED HINT'],
        expectedEvidence: [
          'one person with exactly two clearly owned hands',
          'one small physical AI projector with a visible origin',
          'one narrow beam reaches one specific target',
          'the person remains actively engaged in the task',
        ],
        forbiddenImplications: [
          'an extra hand or limb',
          'a beam from outside the frame',
          'a floating holographic avatar or interface',
          'AI completes the task',
        ],
        renderMode: 'generated_cinematic',
        imageCalls: 2,
      };
    case 'token_caching':
      return {
        id: kind,
        kind,
        title: 'Cache static context once, reuse it across calls',
        coreClaim:
          'Prompt caching avoids repeatedly processing the same static context and lowers model cost.',
        labels: ['REPEATED CONTEXT', 'CACHE ONCE', 'REUSE • LOWER COST'],
        expectedEvidence: [
          'the same context is repeatedly processed on the expensive side',
          'one connected cache stores the static context',
          'the reuse side sends much less repeated context and has a lower meter',
        ],
        forbiddenImplications: [
          'a broken arrow',
          'cache creates new model capability',
          'labels are the only sign of lower cost',
        ],
        renderMode: 'deterministic_hybrid',
        imageCalls: 0,
      };
    case 'fuzz_repair_loop':
      return {
        id: kind,
        kind,
        title: 'Fuzz, expose the failure, patch and verify',
        coreClaim:
          'Fuzzing creates edge cases, exposes a failure, drives a patch and verifies the repaired result.',
        labels: ['FUZZ EDGE CASES', 'VISIBLE FAILURE', 'PATCH • VERIFY'],
        expectedEvidence: [
          'varied test inputs are generated',
          'the same code artifact visibly fails',
          'the same artifact is patched and verified',
        ],
        forbiddenImplications: [
          'a generic block factory',
          'unrelated robots moving objects',
          'no visible failure state',
        ],
        renderMode: 'deterministic_hybrid',
        imageCalls: 0,
      };
    case 'optical_context_compression':
      return {
        id: kind,
        kind,
        title: 'Compress the context and reveal preserved dense information',
        coreClaim:
          'Optical compression makes context physically smaller while inspection reveals that dense information remains preserved.',
        labels: ['FULL CONTEXT', 'OPTICAL COMPRESS', 'DENSE DATA PRESERVED'],
        expectedEvidence: [
          'a large context stack enters a physical press',
          'a much smaller transparent artifact exits',
          'a connected magnifier visibly reveals dense preserved information inside it',
        ],
        forbiddenImplications: [
          'a disconnected magnifying glass',
          'compression destroys the information',
          'a map or unrelated paper card',
        ],
        renderMode: 'deterministic_hybrid',
        imageCalls: 0,
      };
  }
}

export function deterministicGeometryV10(
  kind: Exclude<OwnerReworkKindV10, 'deep_work_bounded_hint'>,
): DeterministicGeometryV10 {
  return sceneFor(kind).geometry;
}

function pointInsideExpandedNode(
  node: DeterministicNodeV10,
  x: number,
  y: number,
  tolerance = 3,
): boolean {
  return (
    x >= node.x - tolerance &&
    x <= node.x + node.width + tolerance &&
    y >= node.y - tolerance &&
    y <= node.y + node.height + tolerance
  );
}

export function validateDeterministicGeometryV10(
  kind: Exclude<OwnerReworkKindV10, 'deep_work_bounded_hint'>,
): string[] {
  const geometry = deterministicGeometryV10(kind);
  const issues: string[] = [];
  const nodes = new Map(geometry.nodes.map((node) => [node.id, node]));
  for (const value of geometry.arrows) {
    const source = nodes.get(value.sourceNodeId);
    const target = nodes.get(value.targetNodeId);
    if (!source) {
      issues.push(`${value.id}: missing source node ${value.sourceNodeId}`);
      continue;
    }
    if (!target) {
      issues.push(`${value.id}: missing target node ${value.targetNodeId}`);
      continue;
    }
    if (!pointInsideExpandedNode(source, value.sourceX, value.sourceY)) {
      issues.push(`${value.id}: arrow source is disconnected`);
    }
    if (!pointInsideExpandedNode(target, value.targetX, value.targetY)) {
      issues.push(`${value.id}: arrow target is disconnected`);
    }
    if (
      Math.hypot(value.targetX - value.sourceX, value.targetY - value.sourceY) <
      24
    ) {
      issues.push(`${value.id}: arrow is too short to communicate direction`);
    }
  }
  return issues;
}

export function renderOwnerReworkSvgV10(input: {
  kind: Exclude<OwnerReworkKindV10, 'deep_work_bounded_hint'>;
  width?: number;
  height?: number;
  includeLabels?: boolean;
}): Buffer {
  const width = Math.max(960, Math.round(input.width ?? 1280));
  const height = Math.max(540, Math.round(input.height ?? 720));
  if (width !== 1280 || height !== 720) {
    throw new Error('Owner rework v10 SVGs currently use a fixed 1280×720 geometry.');
  }
  const scene = sceneFor(input.kind);
  const labels = input.includeLabels
    ? scene.labels
        .slice(0, 3)
        .map(([label, x, y, primary]) => pill(label, x, y, primary))
        .join('')
    : '';
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${defs()}${background(width, height)}${scene.body}${labels}<rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="28" fill="none" stroke="${COLORS.cyan}" stroke-opacity="0.28" stroke-width="3"/></svg>`,
  );
}

export function buildDeepWorkPromptsV10(
  story: HoldoutStoryInput,
): string[] {
  const source = clean(
    [story.title, story.summary, story.why ?? '', story.takeaway ?? '']
      .filter(Boolean)
      .join('. '),
    620,
  );
  const shared = [
    'Premium cinematic editorial photograph for a serious technology magazine, one continuous 16:9 scene.',
    `Approved story context: ${source}`,
    'Show exactly one adult person at a clean precision workbench, deeply focused on solving a difficult physical reasoning task.',
    'Exactly two human hands are visible, both anatomically correct, both clearly attached to that same visible person, both actively manipulating the task. No other person, arm, hand, finger or reflection of a hand anywhere.',
    'A small physical tabletop AI projector is fully visible on the left side of the workbench. The device itself is the unmistakable source of exactly one narrow cyan guidance beam.',
    'The beam begins at the visible projector lens, ends on exactly one small component in the task, and illuminates only that component. The source, target and effect must all be visible in the same frame.',
    'The AI device does not touch the task, move any object or complete any step. The person performs all physical work.',
    'Behind frosted acoustic glass, distraction appears only as soft defocused colored light and motion blur, never as boxes, icons, screens or interface shapes.',
    'Believable anatomy, believable optics, believable physics, strong focal hierarchy, premium materials, dramatic but natural available light, restrained cyan accent.',
    'No text, letters, numbers, labels, logos, watermark, UI, floating hologram, robot, extra limb, duplicate hand, disembodied hand, beam from outside the frame, or unexplained glowing object.',
  ];
  return [
    [
      ...shared,
      'The reasoning task is a compact brass mechanical logic assembly with one misaligned gear tooth. The person uses both hands to align the mechanism while the projector highlights only that one tooth.',
      'Camera: waist-up three-quarter view wide enough to show the person, both complete forearms and hands, the projector lens, the full beam path and the target component.',
    ].join(' '),
    [
      ...shared,
      'The reasoning task is a tabletop wooden geometric linkage puzzle with one ambiguous joint. The person uses both hands to test the linkage while the projector highlights only that one joint.',
      'Camera: over-table three-quarter view wide enough to show the person, both complete forearms and hands, the projector lens, the full beam path and the target joint.',
    ].join(' '),
  ];
}

export function renderDeepWorkOverlaySvgV10(
  width = 1280,
  height = 720,
): Buffer {
  const treatment = ownerReworkTreatmentV10('deep_work_bounded_hint');
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="v10-overlay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020617" stop-opacity="0.36"/><stop offset="0.23" stop-color="#020617" stop-opacity="0"/><stop offset="1" stop-color="#020617" stop-opacity="0.24"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#v10-overlay)"/>${pill(treatment.labels[0]!, 34, 34, true)}${pill(treatment.labels[1]!, 34, 82, false)}<rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="28" fill="none" stroke="${COLORS.cyan}" stroke-opacity="0.3" stroke-width="3"/></svg>`,
  );
}
