import type { HoldoutStoryInput } from './visual-auto-claim';
import type { AutoVisualClaimV5 } from './visual-auto-claim-v5';
import {
  planVisualAffordancesV10,
  type VisualAffordancePlanV10,
} from './visual-affordance-router-v10';

export const AFFORDANCE_TREATMENT_KINDS_V10 = [
  'same_system_output_variability',
  'controlled_session_workflow',
  'bounded_assistance',
] as const;

export type AffordanceTreatmentKindV10 =
  (typeof AFFORDANCE_TREATMENT_KINDS_V10)[number];

export interface AffordanceTreatmentV10 {
  storyId: string;
  kind: AffordanceTreatmentKindV10;
  grammar: VisualAffordancePlanV10['candidates'][number]['grammar'];
  renderMode: 'deterministic' | 'generated_source_cinematic';
  labels: string[];
  expectedEvidence: string[];
  forbiddenImplications: string[];
  sourceGrounding: string;
  expectedImageCalls: 0 | 1;
}

export interface AffordanceTreatmentInputV10 {
  story: HoldoutStoryInput;
  autoClaim: AutoVisualClaimV5;
  eligible: boolean;
}

export interface AffordanceSvgInputV10 {
  treatment: AffordanceTreatmentV10;
  width?: number;
  height?: number;
  includeOverlays?: boolean;
}

const COLORS = {
  bg0: '#02060C',
  bg1: '#071827',
  bg2: '#11152A',
  panel: '#07131E',
  panelAlt: '#0B2131',
  cyan: '#22D3EE',
  cyanLight: '#CFFAFE',
  violet: '#A78BFA',
  green: '#34D399',
  amber: '#FB923C',
  rose: '#FB7185',
  white: '#ECFEFF',
  muted: '#64748B',
};

function sourceText(story: HoldoutStoryInput): string {
  return [
    story.title,
    story.summary,
    story.why ?? '',
    story.practical ?? '',
    story.takeaway ?? '',
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanLabels(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .slice(0, 3)
    .map((value) => value.slice(0, 28));
}

export function selectAffordanceTreatmentV10(
  input: AffordanceTreatmentInputV10,
): AffordanceTreatmentV10 | null {
  const source = sourceText(input.story).toLowerCase();
  const directComparison =
    /\b(?:consistency|inconsistency|inconsistencies|inconsistent|reliability|community critique|community debate)\b/.test(source) &&
    /\b(?:gemini|model|coding|developer community)\b/.test(source);
  const directSessionWorkflow =
    /\b(?:token|context window|rate limit|usage threshold|high-volume|burn rate|session)\b/.test(source) &&
    /\b(?:cache|caching|split|monitor|limit|threshold|interrupt|consumption)\b/.test(source);
  const plan = input.eligible ? planVisualAffordancesV10(input) : null;
  const primary = plan?.candidates[0]?.grammar;

  if (primary === 'controlled_comparison' || directComparison) {
    return {
      storyId: input.story.revision_item_id,
      kind: 'same_system_output_variability',
      grammar: 'controlled_comparison',
      renderMode: 'deterministic',
      labels: cleanLabels(['SAME TASK', 'RUN A', 'RUN B']),
      expectedEvidence: [
        'one identical task enters one identical model chamber',
        'the same model chamber visibly branches into run A and run B',
        'two output artifacts are visibly different in structure without implying a numeric failure rate',
      ],
      forbiddenImplications: [
        'two different models were compared',
        'two different prompts caused the difference',
        'one output is proven universally better',
        'the labels create divergence that the output artifacts do not show',
      ],
      sourceGrounding:
        'The source describes repeated use of the same coding task and system with inconsistent or divergent outputs.',
      expectedImageCalls: 0,
    };
  }

  if (
    (primary === 'causal_process_sequence' || directSessionWorkflow) &&
    /\b(token|context|session|cache|caching|threshold|rate limit|monitor|split)\b/.test(
      source,
    )
  ) {
    return {
      storyId: input.story.revision_item_id,
      kind: 'controlled_session_workflow',
      grammar: 'causal_process_sequence',
      renderMode: 'deterministic',
      labels: cleanLabels(['CACHE', 'SPLIT', 'MONITOR']),
      expectedEvidence: [
        'one oversized continuous session visibly approaches an operational risk boundary',
        'a cache and checkpoint control divides the stream into bounded continuation segments',
        'a visible monitor shows the bounded sessions remaining below the risk boundary without claiming an exact undocumented limit',
      ],
      forbiddenImplications: [
        'an exact token threshold is known',
        'caching alone guarantees no interruption',
        'the process is merely a generic bar chart',
        'the labels carry the workflow while pixels show no transformation',
      ],
      sourceGrounding:
        'The source recommends operational controls for high-volume sessions: cache stable context, split long runs and monitor token burn.',
      expectedImageCalls: 0,
    };
  }

  if (
    input.eligible &&
    primary === 'cinematic_domain_scene' &&
    /\b(deep work|active thinking|problem-solving|sparring partner|bounded hint|distraction|cognitive)\b/.test(
      source,
    )
  ) {
    return {
      storyId: input.story.revision_item_id,
      kind: 'bounded_assistance',
      grammar: primary,
      renderMode: 'generated_source_cinematic',
      labels: cleanLabels(['ACTIVE THINKING', 'BOUNDED HINT']),
      expectedEvidence: [
        'one visible adult remains actively engaged in the difficult reasoning task',
        'one small visible AI device provides exactly one bounded hint to one specific part of the work',
        'the person performs the work with exactly two anatomically connected hands while background distraction remains muted',
      ],
      forbiddenImplications: [
        'an extra or unowned hand appears',
        'the hint beam begins off-screen',
        'the AI completes the task',
        'the person is passive',
        'a generic gear workshop replaces the cognitive-work context',
      ],
      sourceGrounding:
        'The source argues that AI should act as a bounded sparring partner while the human retains active problem-solving and deep focus.',
      expectedImageCalls: 1,
    };
  }

  return null;
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
    <linearGradient id="v10-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${COLORS.bg0}"/><stop offset="0.55" stop-color="${COLORS.bg1}"/><stop offset="1" stop-color="${COLORS.bg2}"/></linearGradient>
    <linearGradient id="v10-panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#06121C"/><stop offset="1" stop-color="#0B2232"/></linearGradient>
    <radialGradient id="v10-cyan"><stop offset="0" stop-color="${COLORS.cyan}" stop-opacity="0.34"/><stop offset="1" stop-color="${COLORS.cyan}" stop-opacity="0"/></radialGradient>
    <radialGradient id="v10-warm"><stop offset="0" stop-color="${COLORS.amber}" stop-opacity="0.34"/><stop offset="1" stop-color="${COLORS.amber}" stop-opacity="0"/></radialGradient>
    <filter id="v10-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#000814" flood-opacity="0.86"/></filter>
    <marker id="v10-arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0 0 12 6 0 12Z" fill="${COLORS.cyanLight}"/></marker>
  </defs>`;
}

function background(width: number, height: number): string {
  const grid = Array.from({ length: 8 }, (_, index) => {
    const x = ((index + 1) * width) / 9;
    return `<path d="M${x} 0V${height}" stroke="${COLORS.white}" stroke-opacity="0.024"/>`;
  }).join('');
  return `<rect width="${width}" height="${height}" fill="url(#v10-bg)"/><ellipse cx="${width * 0.53}" cy="${height * 0.5}" rx="${width * 0.48}" ry="${height * 0.43}" fill="url(#v10-cyan)" opacity="0.28"/>${grid}`;
}

function panel(
  x: number,
  y: number,
  width: number,
  height: number,
  accent = COLORS.cyan,
): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="28" fill="url(#v10-panel)" stroke="${accent}" stroke-opacity="0.48" stroke-width="3" filter="url(#v10-shadow)"/>`;
}

function arrow(x1: number, y1: number, x2: number, y2: number): string {
  const mid = (x1 + x2) / 2;
  return `<path d="M${x1} ${y1}C${mid} ${y1},${mid} ${y2},${x2} ${y2}" fill="none" stroke="${COLORS.cyanLight}" stroke-width="7" stroke-linecap="round" marker-end="url(#v10-arrow)"/>`;
}

function chip(cx: number, cy: number, size: number): string {
  const x = cx - size / 2;
  const y = cy - size / 2;
  const pins = [0.2, 0.4, 0.6, 0.8]
    .map(
      (fraction) =>
        `<path d="M${x - 14} ${y + size * fraction}h14M${x + size} ${y + size * fraction}h14M${x + size * fraction} ${y - 14}v14M${x + size * fraction} ${y + size}v14" stroke="${COLORS.cyanLight}" stroke-width="4" stroke-linecap="round"/>`,
    )
    .join('');
  return `<g>${pins}<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="18" fill="#0F172A" stroke="${COLORS.cyan}" stroke-width="5"/><rect x="${x + size * 0.28}" y="${y + size * 0.28}" width="${size * 0.44}" height="${size * 0.44}" rx="10" fill="${COLORS.cyan}" fill-opacity="0.5"/></g>`;
}

function taskCard(x: number, y: number, width: number, height: number): string {
  const lines = [0.23, 0.42, 0.61]
    .map((fraction, index) => {
      const lineWidth = width * (index === 1 ? 0.5 : 0.68);
      return `<rect x="${x + width * 0.16}" y="${y + height * fraction}" width="${lineWidth}" height="8" rx="4" fill="${COLORS.cyanLight}" fill-opacity="${0.38 + index * 0.12}"/>`;
    })
    .join('');
  return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="20" fill="#071827" stroke="${COLORS.cyan}" stroke-width="3"/>${lines}</g>`;
}

function modularArtifact(x: number, y: number, width: number, height: number): string {
  const nodeW = width * 0.22;
  const nodeH = height * 0.18;
  const nodes = [
    [x + width * 0.13, y + height * 0.14],
    [x + width * 0.63, y + height * 0.14],
    [x + width * 0.13, y + height * 0.63],
    [x + width * 0.63, y + height * 0.63],
  ];
  const boxes = nodes
    .map(
      ([nx, ny], index) =>
        `<rect x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}" rx="12" fill="${index % 2 ? COLORS.violet : COLORS.cyan}" fill-opacity="0.25" stroke="${COLORS.cyanLight}" stroke-width="2"/>`,
    )
    .join('');
  return `<g>${boxes}<path d="M${x + width * 0.35} ${y + height * 0.23}H${x + width * 0.63}M${x + width * 0.24} ${y + height * 0.32}V${y + height * 0.63}M${x + width * 0.74} ${y + height * 0.32}V${y + height * 0.63}M${x + width * 0.35} ${y + height * 0.72}H${x + width * 0.63}" stroke="${COLORS.cyanLight}" stroke-opacity="0.58" stroke-width="4"/></g>`;
}

function layeredArtifact(x: number, y: number, width: number, height: number): string {
  const rows = Array.from({ length: 5 }, (_, index) => {
    const inset = index % 2 ? width * 0.16 : width * 0.07;
    return `<rect x="${x + inset}" y="${y + height * (0.1 + index * 0.17)}" width="${width - inset * 2}" height="${height * 0.11}" rx="11" fill="${index % 2 ? COLORS.amber : COLORS.rose}" fill-opacity="${0.18 + index * 0.06}" stroke="${index % 2 ? COLORS.amber : COLORS.rose}" stroke-width="2"/>`;
  }).join('');
  return `<g>${rows}<path d="M${x + width * 0.25} ${y + height * 0.15}L${x + width * 0.72} ${y + height * 0.78}" stroke="${COLORS.cyanLight}" stroke-opacity="0.46" stroke-width="4"/><path d="M${x + width * 0.7} ${y + height * 0.15}L${x + width * 0.3} ${y + height * 0.78}" stroke="${COLORS.cyanLight}" stroke-opacity="0.28" stroke-width="4"/></g>`;
}

function sameSystemOutputVariabilityScene(
  width: number,
  height: number,
): string {
  const taskX = width * 0.045;
  const taskY = height * 0.34;
  const taskW = width * 0.22;
  const taskH = height * 0.28;
  const modelCx = width * 0.47;
  const modelCy = height * 0.5;
  const modelSize = Math.min(width, height) * 0.145;
  const outputX = width * 0.69;
  const outputW = width * 0.265;
  const outputH = height * 0.31;
  const topY = height * 0.105;
  const bottomY = height * 0.585;
  const artifactX = outputX + outputW * 0.06;
  const artifactW = outputW * 0.88;
  const artifactH = outputH * 0.82;
  const nodeW = artifactW * 0.2;
  const nodeH = artifactH * 0.18;
  const bottomNodes = [
    [artifactX + artifactW * 0.12, bottomY + outputH * 0.12],
    [artifactX + artifactW * 0.62, bottomY + outputH * 0.12],
    [artifactX + artifactW * 0.12, bottomY + outputH * 0.61],
    [artifactX + artifactW * 0.62, bottomY + outputH * 0.61],
  ] as const;
  const bottomBoxes = bottomNodes
    .map(
      ([x, y], index) =>
        `<rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="11" fill="${index % 2 ? COLORS.violet : COLORS.cyan}" fill-opacity="0.25" stroke="${COLORS.cyanLight}" stroke-width="2"/>`,
    )
    .join('');
  const bottomLinks = `<path d="M${bottomNodes[0][0] + nodeW} ${bottomNodes[0][1] + nodeH / 2}L${bottomNodes[3][0]} ${bottomNodes[3][1] + nodeH / 2}M${bottomNodes[1][0]} ${bottomNodes[1][1] + nodeH}L${bottomNodes[2][0] + nodeW} ${bottomNodes[2][1]}M${bottomNodes[0][0] + nodeW / 2} ${bottomNodes[0][1] + nodeH}V${bottomNodes[2][1]}" fill="none" stroke="${COLORS.amber}" stroke-width="4" stroke-linecap="round"/>`;
  return `${panel(width * 0.025, height * 0.16, width * 0.27, height * 0.68)}
    ${panel(width * 0.36, height * 0.23, width * 0.22, height * 0.54, COLORS.violet)}
    ${panel(outputX, topY, outputW, outputH, COLORS.green)}
    ${panel(outputX, bottomY, outputW, outputH, COLORS.amber)}
    ${taskCard(taskX, taskY, taskW, taskH)}
    ${chip(modelCx, modelCy, modelSize)}
    ${arrow(taskX + taskW, taskY + taskH / 2, modelCx - modelSize * 0.72, modelCy)}
    ${arrow(modelCx + modelSize * 0.72, modelCy - modelSize * 0.16, outputX - width * 0.018, topY + outputH / 2)}
    ${arrow(modelCx + modelSize * 0.72, modelCy + modelSize * 0.16, outputX - width * 0.018, bottomY + outputH / 2)}
    <circle cx="${modelCx + modelSize * 0.92}" cy="${modelCy - modelSize * 0.38}" r="11" fill="${COLORS.green}" stroke="${COLORS.cyanLight}" stroke-width="3"/>
    <circle cx="${modelCx + modelSize * 0.92}" cy="${modelCy + modelSize * 0.38}" r="11" fill="${COLORS.amber}" stroke="${COLORS.cyanLight}" stroke-width="3"/>
    <g data-run-output="A">${modularArtifact(artifactX, topY + outputH * 0.08, artifactW, artifactH)}</g>
    <g data-run-output="B">${bottomBoxes}${bottomLinks}</g>`;
}

function streamBlocks(
  x: number,
  y: number,
  width: number,
  count: number,
  gap: number,
  compact = false,
): string {
  return Array.from({ length: count }, (_, index) => {
    const blockH = compact ? 17 : 25;
    const blockW = width * (0.62 + ((index * 19) % 31) / 100);
    return `<rect x="${x}" y="${y + index * (blockH + gap)}" width="${blockW}" height="${blockH}" rx="${blockH / 2}" fill="${index > count * 0.62 ? COLORS.amber : COLORS.cyan}" fill-opacity="${0.25 + index * 0.045}" stroke="${COLORS.cyanLight}" stroke-opacity="0.28"/>`;
  }).join('');
}

function monitorGauge(cx: number, cy: number, radius: number): string {
  return `<g><path d="M${cx - radius} ${cy}A${radius} ${radius} 0 0 1 ${cx + radius} ${cy}" fill="none" stroke="${COLORS.white}" stroke-opacity="0.22" stroke-width="15" stroke-linecap="round"/><path d="M${cx - radius} ${cy}A${radius} ${radius} 0 0 1 ${cx + radius * 0.15} ${cy - radius * 0.98}" fill="none" stroke="${COLORS.green}" stroke-width="9" stroke-linecap="round"/><path d="M${cx} ${cy}L${cx + radius * 0.1} ${cy - radius * 0.72}" stroke="${COLORS.cyanLight}" stroke-width="7" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="9" fill="${COLORS.cyan}"/></g>`;
}

function controlledSessionWorkflowScene(width: number, height: number): string {
  const leftX = width * 0.025;
  const leftY = height * 0.15;
  const leftW = width * 0.27;
  const leftH = height * 0.7;
  const cacheX = width * 0.35;
  const cacheY = height * 0.12;
  const cacheW = width * 0.21;
  const cacheH = height * 0.27;
  const splitCx = width * 0.47;
  const splitCy = height * 0.65;
  const rightX = width * 0.665;
  const rightY = height * 0.08;
  const rightW = width * 0.31;
  const rightH = height * 0.84;
  const thresholdY = leftY + leftH * 0.79;
  const sessionX = rightX + rightW * 0.1;
  const sessionW = rightW * 0.76;
  const sessionH = rightH * 0.16;
  const sessionYs = [0.1, 0.36, 0.62].map(
    (fraction) => rightY + rightH * fraction,
  );
  const cacheBlocks = [0, 1, 2]
    .map(
      (index) =>
        `<rect x="${cacheX + cacheW * 0.19}" y="${cacheY + cacheH * (0.27 + index * 0.2)}" width="${cacheW * 0.62}" height="${cacheH * 0.12}" rx="10" fill="${COLORS.cyan}" fill-opacity="${0.32 + index * 0.13}" stroke="${COLORS.cyanLight}" stroke-opacity="0.5" stroke-width="2"/>`,
    )
    .join('');
  const sessionCards = sessionYs
    .map((y, index) => {
      const cachedY = y + sessionH * 0.18;
      return `<g data-bounded-session="${index + 1}"><rect x="${sessionX}" y="${y}" width="${sessionW}" height="${sessionH}" rx="18" fill="#071827" stroke="${COLORS.green}" stroke-opacity="${0.55 + index * 0.1}" stroke-width="3"/><rect x="${sessionX + sessionW * 0.08}" y="${cachedY}" width="${sessionW * 0.36}" height="${sessionH * 0.18}" rx="8" fill="${COLORS.cyan}" fill-opacity="0.52" stroke="${COLORS.cyanLight}" stroke-opacity="0.44"/><rect x="${sessionX + sessionW * 0.08}" y="${cachedY + sessionH * 0.29}" width="${sessionW * 0.58}" height="${sessionH * 0.18}" rx="8" fill="${COLORS.amber}" fill-opacity="0.45"/><rect x="${sessionX + sessionW * 0.08}" y="${cachedY + sessionH * 0.57}" width="${sessionW * 0.47}" height="${sessionH * 0.18}" rx="8" fill="${COLORS.amber}" fill-opacity="0.32"/></g>`;
    })
    .join('');
  const splitBranches = sessionYs
    .map(
      (y) =>
        `<path d="M${splitCx + width * 0.035} ${splitCy}C${width * 0.58} ${splitCy},${width * 0.61} ${y + sessionH / 2},${sessionX - width * 0.012} ${y + sessionH / 2}" fill="none" stroke="${COLORS.cyanLight}" stroke-width="5" stroke-linecap="round" marker-end="url(#v10-arrow)"/>`,
    )
    .join('');
  const cacheRail = sessionYs
    .map(
      (y) =>
        `<path d="M${cacheX + cacheW} ${cacheY + cacheH * 0.5}C${width * 0.61} ${cacheY + cacheH * 0.5},${width * 0.62} ${y + sessionH * 0.25},${sessionX + sessionW * 0.07} ${y + sessionH * 0.25}" fill="none" stroke="${COLORS.cyan}" stroke-opacity="0.58" stroke-width="3"/>`,
    )
    .join('');
  return `${panel(leftX, leftY, leftW, leftH, COLORS.amber)}
    ${panel(cacheX, cacheY, cacheW, cacheH, COLORS.cyan)}
    ${panel(width * 0.37, height * 0.48, width * 0.2, height * 0.34, COLORS.violet)}
    ${panel(rightX, rightY, rightW, rightH, COLORS.green)}
    ${streamBlocks(leftX + leftW * 0.1, leftY + leftH * 0.06, leftW * 0.78, 10, 8)}
    <path d="M${leftX + leftW * 0.08} ${thresholdY}H${leftX + leftW * 0.92}" stroke="${COLORS.rose}" stroke-width="6" stroke-dasharray="14 10"/>
    ${arrow(leftX + leftW, leftY + leftH * 0.29, cacheX - width * 0.015, cacheY + cacheH * 0.5)}
    ${arrow(leftX + leftW, leftY + leftH * 0.68, splitCx - width * 0.055, splitCy)}
    <g data-cache-reservoir="true"><ellipse cx="${cacheX + cacheW * 0.5}" cy="${cacheY + cacheH * 0.22}" rx="${cacheW * 0.32}" ry="${cacheH * 0.1}" fill="#0F172A" stroke="${COLORS.cyan}" stroke-width="4"/><rect x="${cacheX + cacheW * 0.18}" y="${cacheY + cacheH * 0.22}" width="${cacheW * 0.64}" height="${cacheH * 0.6}" rx="18" fill="#0F172A" stroke="${COLORS.cyan}" stroke-width="4"/>${cacheBlocks}</g>
    <g data-session-splitter="true"><circle cx="${splitCx}" cy="${splitCy}" r="${Math.min(width, height) * 0.055}" fill="#0F172A" stroke="${COLORS.violet}" stroke-width="5"/><path d="M${splitCx - 24} ${splitCy}H${splitCx + 2}M${splitCx + 2} ${splitCy}L${splitCx + 30} ${splitCy - 30}M${splitCx + 2} ${splitCy}L${splitCx + 30} ${splitCy}M${splitCx + 2} ${splitCy}L${splitCx + 30} ${splitCy + 30}" fill="none" stroke="${COLORS.cyanLight}" stroke-width="7" stroke-linecap="round"/></g>
    ${sessionCards}${splitBranches}${cacheRail}
    ${monitorGauge(rightX + rightW * 0.52, rightY + rightH * 0.92, rightW * 0.16)}`;
}

function pill(text: string, x: number, y: number, primary = false): string {
  const fontSize = text.length > 18 ? 15 : 17;
  const width = Math.max(112, Math.min(270, Math.round(text.length * fontSize * 0.63 + 36)));
  return `<g><rect x="${x}" y="${y}" width="${width}" height="39" rx="19.5" fill="${primary ? COLORS.cyanLight : '#083344'}" stroke="${COLORS.cyan}" stroke-width="1.5"/><text x="${x + 17}" y="${y + 25}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="800" fill="${primary ? '#083344' : COLORS.white}">${xml(text)}</text></g>`;
}

function overlays(
  treatment: AffordanceTreatmentV10,
  width: number,
  height: number,
): string {
  const labels = treatment.labels.slice(0, 3);
  if (treatment.kind === 'same_system_output_variability') {
    return [
      labels[0] ? pill(labels[0], 46, 38, true) : '',
      labels[1] ? pill(labels[1], width * 0.69, 38) : '',
      labels[2] ? pill(labels[2], width * 0.69, height * 0.54) : '',
    ].join('');
  }
  if (treatment.kind === 'controlled_session_workflow') {
    return [
      labels[0] ? pill(labels[0], width * 0.35, height * 0.055, true) : '',
      labels[1] ? pill(labels[1], width * 0.425, height * 0.43) : '',
      labels[2] ? pill(labels[2], width * 0.76, height * 0.8) : '',
    ].join('');
  }
  return labels
    .map((label, index) =>
      pill(label, 42, 42 + index * 47, index === 0),
    )
    .join('');
}

export function renderAffordanceVisualSvgV10(
  input: AffordanceSvgInputV10,
): Buffer {
  const width = Math.max(640, Math.round(input.width ?? 1280));
  const height = Math.max(360, Math.round(input.height ?? 720));
  if (input.treatment.renderMode !== 'deterministic') {
    throw new Error(
      `Treatment ${input.treatment.kind} requires generated pixels.`,
    );
  }
  const scene =
    input.treatment.kind === 'same_system_output_variability'
      ? sameSystemOutputVariabilityScene(width, height)
      : controlledSessionWorkflowScene(width, height);
  return Buffer.from(
    `<svg data-affordance-v10="${input.treatment.kind}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${defs()}${background(width, height)}${scene}${input.includeOverlays ? overlays(input.treatment, width, height) : ''}<rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="28" fill="none" stroke="${COLORS.cyan}" stroke-opacity="0.24" stroke-width="3"/></svg>`,
  );
}

export function renderAffordanceOverlaySvgV10(
  treatment: AffordanceTreatmentV10,
  width = 1280,
  height = 720,
): Buffer {
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="v10-vignette" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020617" stop-opacity="0.38"/><stop offset="0.25" stop-color="#020617" stop-opacity="0"/><stop offset="1" stop-color="#020617" stop-opacity="0.26"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#v10-vignette)"/>${overlays(treatment, width, height)}<rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="28" fill="none" stroke="${COLORS.cyan}" stroke-opacity="0.24" stroke-width="3"/></svg>`,
  );
}

export function affordanceImagePromptV10(
  treatment: AffordanceTreatmentV10,
  story: HoldoutStoryInput,
): string {
  if (treatment.kind !== 'bounded_assistance') {
    throw new Error(`Treatment ${treatment.kind} is deterministic.`);
  }
  return [
    'Premium cinematic editorial photograph for a technology magazine, wide 16:9 composition, coherent realistic lighting, natural materials, restrained cyan accent, one readable visual idea.',
    `Approved story context: ${story.title}. ${story.summary}`,
    'Show exactly one adult knowledge worker in deep concentration at a large tactile logic board made of blank interlocking geometric tiles. The face, eyes, upper torso and both forearms are visible.',
    'Exactly two human hands are visible, both anatomically correct and visibly attached to this same person. One hand places one dark geometric tile into the board; the other hand steadies the board. No other person, arm, hand, reflection or partial body is present.',
    'A small physical AI assistance device is clearly visible on the table at frame left. The device is the unmistakable source of one narrow cyan cone of light aimed at exactly one empty socket and one candidate tile. The light starts at the device, ends on that one bounded target and does nothing else.',
    'Most of the logic board has already been assembled by the person. The person remains physically engaged and chooses where to place the tile; the AI device does not move objects, write, type or complete the puzzle.',
    'Behind a frosted glass divider, distraction is represented only by diffuse defocused colored light and motion blur, never boxes, icons, screens, diagrams or interface shapes.',
    'The foreground must communicate sustained concentration, active human thinking and one bounded hint. It must not resemble a generic gear workshop or passive automation.',
    'All tiles and surfaces are blank and unmarked. No paper, document, monitor, code or diagram appears in the foreground.',
    'Absolutely no readable text, letters, numbers, symbols, logos, captions, UI, watermark, extra fingers, extra limbs, extra hands, detached hands, fused objects, off-screen laser source or impossible anatomy.',
    'Passive automation is forbidden. A beam without a visible physical source and visible target is forbidden.',
  ].join(' ');
}
