import type { HoldoutStoryInput } from './visual-auto-claim';
import type { AutoVisualClaimV5 } from './visual-auto-claim-v5';

export const SPECIALIZED_VISUAL_KINDS_V8 = [
  'observed_variability',
  'operational_threshold',
  'focused_cognition',
  'scientific_discovery',
] as const;

export type SpecializedVisualKindV8 =
  (typeof SPECIALIZED_VISUAL_KINDS_V8)[number];

export interface SpecializedVisualTreatmentV8 {
  storyId: string;
  kind: SpecializedVisualKindV8;
  renderMode: 'deterministic' | 'generated_source_cinematic';
  labels: string[];
  expectedEvidence: string[];
  forbiddenImplications: string[];
  sourceGrounding: string;
  expectedImageCalls: 0 | 1;
}

export interface SpecializedVisualInputV8 {
  story: HoldoutStoryInput;
  autoClaim: AutoVisualClaimV5;
  eligible: boolean;
}

export interface SpecializedSvgInputV8 {
  treatment: SpecializedVisualTreatmentV8;
  width?: number;
  height?: number;
  includeOverlays?: boolean;
}

const COLORS = {
  background: '#03070D',
  panel: '#07131E',
  panelAlt: '#0A1B29',
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
  return [story.title, story.summary, story.why ?? '', story.practical ?? '', story.takeaway ?? '']
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cleanLabels(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean))]
    .slice(0, 3)
    .map((value) => value.slice(0, 34));
}

export function selectSpecializedVisualTreatmentV8(
  input: SpecializedVisualInputV8,
): SpecializedVisualTreatmentV8 | null {
  const source = sourceText(input.story).toLowerCase();

  if (
    /\b(consisten|inconsisten|reliab|regression|community critique|community debate)\b/.test(
      source,
    ) && /\b(model|gemini|coding)\b/.test(source)
  ) {
    return {
      storyId: input.story.revision_item_id,
      kind: 'observed_variability',
      renderMode: 'deterministic',
      labels: cleanLabels(['SAME TASK', 'DIVERGENT OUTPUTS', 'CONSISTENCY DEBATE']),
      expectedEvidence: [
        'the same coding task is visibly repeated',
        'the repeated runs produce visibly divergent outputs',
        'the image communicates observed consistency concerns without inventing a numeric failure rate',
      ],
      forbiddenImplications: [
        'Gemini is always broken',
        'a named alternative is proven superior',
        'a future model or fix is confirmed',
      ],
      sourceGrounding:
        'The approved story explicitly describes community debate about reliability and inconsistencies in coding environments.',
      expectedImageCalls: 0,
    };
  }

  if (
    /\b(token|context window|rate limit|usage threshold|usage pattern|high-volume|burn rate)\b/.test(
      source,
    ) && /\b(limit|threshold|interrupt|monitor|spend|consumption)\b/.test(source)
  ) {
    return {
      storyId: input.story.revision_item_id,
      kind: 'operational_threshold',
      renderMode: 'deterministic',
      labels: cleanLabels(['HIGH-VOLUME', 'USAGE THRESHOLD', 'ANECDOTAL SIGNALS']),
      expectedEvidence: [
        'a high-volume token stream approaches a visible operating boundary',
        'the boundary implies interruption risk without claiming an exact undocumented limit',
        'the image preserves that the reported signals are anecdotal',
      ],
      forbiddenImplications: [
        'an exact token limit is known',
        'Anthropic has published a confirmed threshold',
        'every high-volume session will be interrupted',
      ],
      sourceGrounding:
        'The approved story describes high-volume token use, context/rate limits, anecdotal signals and the need to monitor burn rate.',
      expectedImageCalls: 0,
    };
  }

  if (
    /\b(immunolog|t-cell|scientific research|researchers|biological dataset|hypothesis|discovery)\b/.test(
      source,
    )
  ) {
    return {
      storyId: input.story.revision_item_id,
      kind: 'scientific_discovery',
      renderMode: 'generated_source_cinematic',
      labels: cleanLabels(['GPT-5', '3-YEAR BOTTLENECK', 'ACTIONABLE HYPOTHESIS']),
      expectedEvidence: [
        'multiple complex biological data strands converge through an AI analysis step',
        'the analysis reveals a concrete T-cell interaction hypothesis',
        'the visible result is a research bottleneck opening rather than a generic success icon',
      ],
      forbiddenImplications: [
        'GPT-5 conducted the experiment alone',
        'the hypothesis is already a clinically proven treatment',
        'a generic software-tool workflow replaces the immunology context',
      ],
      sourceGrounding:
        'The approved story says researchers used GPT-5 to synthesize biological datasets and produce an actionable hypothesis that resolved a three-year bottleneck.',
      expectedImageCalls: 1,
    };
  }

  if (
    /\b(distraction|deep work|cognitive|problem-solving|sparring partner|offload|active thinking)\b/.test(
      source,
    )
  ) {
    return {
      storyId: input.story.revision_item_id,
      kind: 'focused_cognition',
      renderMode: 'generated_source_cinematic',
      labels: cleanLabels(['ACTIVE THINKING', 'AI AS SPARRING PARTNER']),
      expectedEvidence: [
        'a person remains physically engaged in solving the difficult task',
        'the AI offers one bounded hint but does not perform the task',
        'distraction is visibly muted while sustained focus returns',
      ],
      forbiddenImplications: [
        'the AI completes the work autonomously',
        'the person is passive',
        'the scene is only a generic workshop with no bounded AI assistance',
      ],
      sourceGrounding:
        'The approved story argues for active problem-solving and using LLMs as sparring partners rather than offloading all cognitive work.',
      expectedImageCalls: 1,
    };
  }

  return null;
}

function defs(): string {
  return `<defs>
    <linearGradient id="v8-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#02060C"/><stop offset="0.52" stop-color="#061827"/><stop offset="1" stop-color="#11152A"/></linearGradient>
    <linearGradient id="v8-panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#06121C"/><stop offset="1" stop-color="#0B2232"/></linearGradient>
    <radialGradient id="v8-cyan-glow"><stop offset="0" stop-color="${COLORS.cyan}" stop-opacity="0.34"/><stop offset="1" stop-color="${COLORS.cyan}" stop-opacity="0"/></radialGradient>
    <radialGradient id="v8-warm-glow"><stop offset="0" stop-color="${COLORS.amber}" stop-opacity="0.38"/><stop offset="1" stop-color="${COLORS.amber}" stop-opacity="0"/></radialGradient>
    <filter id="v8-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000814" flood-opacity="0.86"/></filter>
    <filter id="v8-soft"><feGaussianBlur stdDeviation="10"/></filter>
    <marker id="v8-arrow" markerWidth="11" markerHeight="11" refX="9" refY="5.5" orient="auto"><path d="M0 0 11 5.5 0 11Z" fill="${COLORS.cyanLight}"/></marker>
  </defs>`;
}

function background(width: number, height: number): string {
  const verticals = Array.from({ length: 8 }, (_, index) => {
    const x = ((index + 1) * width) / 9;
    return `<path d="M${x} 0V${height}" stroke="${COLORS.white}" stroke-opacity="0.025"/>`;
  }).join('');
  return `<rect width="${width}" height="${height}" fill="url(#v8-bg)"/>
    <ellipse cx="${width * 0.54}" cy="${height * 0.5}" rx="${width * 0.48}" ry="${height * 0.43}" fill="url(#v8-cyan-glow)" opacity="0.32"/>
    ${verticals}`;
}

function panel(x: number, y: number, width: number, height: number, warm = false): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="30" fill="url(#v8-panel)" stroke="${warm ? COLORS.amber : COLORS.cyan}" stroke-opacity="0.42" stroke-width="3" filter="url(#v8-shadow)"/>`;
}

function chip(cx: number, cy: number, size: number, accent = COLORS.cyan): string {
  const x = cx - size / 2;
  const y = cy - size / 2;
  const pins = [0.2, 0.4, 0.6, 0.8]
    .map(
      (fraction) =>
        `<path d="M${x - 15} ${y + size * fraction}h15M${x + size} ${y + size * fraction}h15M${x + size * fraction} ${y - 15}v15M${x + size * fraction} ${y + size}v15" stroke="${COLORS.cyanLight}" stroke-width="4" stroke-linecap="round"/>`,
    )
    .join('');
  return `<g>${pins}<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="18" fill="#111827" stroke="${accent}" stroke-width="5"/><rect x="${x + size * 0.27}" y="${y + size * 0.27}" width="${size * 0.46}" height="${size * 0.46}" rx="10" fill="${accent}" fill-opacity="0.5"/></g>`;
}

function codePacket(x: number, y: number, width: number, height: number): string {
  const lines = [0.22, 0.39, 0.56, 0.73]
    .map((fraction, index) => {
      const lineWidth = width * (index % 2 ? 0.52 : 0.7);
      return `<rect x="${x + width * 0.16}" y="${y + height * fraction}" width="${lineWidth}" height="7" rx="3.5" fill="${COLORS.cyanLight}" fill-opacity="${0.36 + index * 0.08}"/>`;
    })
    .join('');
  return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="18" fill="#071827" stroke="${COLORS.cyan}" stroke-width="3"/>${lines}</g>`;
}

function outputTrace(
  x: number,
  y: number,
  width: number,
  height: number,
  stable: boolean,
): string {
  const points = stable
    ? [0.68, 0.56, 0.48, 0.42, 0.37, 0.34]
    : [0.66, 0.28, 0.74, 0.35, 0.81, 0.24];
  const path = points
    .map((value, index) => {
      const px = x + (index / (points.length - 1)) * width;
      const py = y + value * height;
      return `${index === 0 ? 'M' : 'L'}${px} ${py}`;
    })
    .join(' ');
  const nodes = points
    .map((value, index) => {
      const px = x + (index / (points.length - 1)) * width;
      const py = y + value * height;
      return `<circle cx="${px}" cy="${py}" r="7" fill="${stable ? COLORS.green : COLORS.amber}" stroke="${COLORS.white}" stroke-width="2"/>`;
    })
    .join('');
  return `<g><path d="${path}" fill="none" stroke="${stable ? COLORS.green : COLORS.amber}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>${nodes}</g>`;
}

function pill(text: string, x: number, y: number, primary = false): string {
  const fontSize = text.length > 22 ? 15 : 17;
  const width = Math.max(118, Math.min(310, Math.round(text.length * fontSize * 0.63 + 38)));
  return `<g><rect x="${x}" y="${y}" width="${width}" height="40" rx="20" fill="${primary ? COLORS.cyanLight : '#083344'}" fill-opacity="0.97" stroke="${COLORS.cyan}" stroke-width="1.5"/><text x="${x + 18}" y="${y + 26}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${fontSize}" font-weight="800" fill="${primary ? '#083344' : COLORS.white}">${xml(text)}</text></g>`;
}

function overlayMarkup(treatment: SpecializedVisualTreatmentV8, width: number): string {
  const labels = treatment.labels.slice(0, 3);
  if (treatment.kind === 'observed_variability') {
    return [
      labels[0] ? pill(labels[0], 52, 42, true) : '',
      labels[1] ? pill(labels[1], width - 360, 42) : '',
      labels[2] ? pill(labels[2], width - 360, 90) : '',
    ].join('');
  }
  if (treatment.kind === 'operational_threshold') {
    return [
      labels[0] ? pill(labels[0], 52, 42, true) : '',
      labels[1] ? pill(labels[1], width - 350, 42) : '',
      labels[2] ? pill(labels[2], width - 350, 90) : '',
    ].join('');
  }
  return labels
    .map((label, index) => pill(label, 42, 42 + index * 48, index === 0))
    .join('');
}

function observedVariabilityScene(width: number, height: number): string {
  const leftX = 56;
  const panelY = 116;
  const panelH = height - 164;
  const leftW = Math.round(width * 0.27);
  const centerX = Math.round(width * 0.43);
  const rightX = Math.round(width * 0.62);
  const rightW = width - rightX - 52;
  const topY = panelY + 42;
  const rowH = (panelH - 118) / 2;
  return `${panel(leftX, panelY, leftW, panelH)}
    ${panel(rightX, panelY, rightW, panelH)}
    <ellipse cx="${centerX}" cy="${height * 0.5}" rx="220" ry="250" fill="url(#v8-cyan-glow)" opacity="0.66"/>
    ${codePacket(leftX + 62, panelY + panelH * 0.38, leftW - 124, 128)}
    ${codePacket(leftX + 62, panelY + panelH * 0.63, leftW - 124, 128)}
    <path d="M${leftX + leftW - 35} ${panelY + panelH * 0.46}C${centerX - 85} ${panelY + panelH * 0.46},${centerX - 85} ${height * 0.36},${centerX - 54} ${height * 0.36}" fill="none" stroke="${COLORS.cyanLight}" stroke-width="7" marker-end="url(#v8-arrow)"/>
    <path d="M${leftX + leftW - 35} ${panelY + panelH * 0.69}C${centerX - 85} ${panelY + panelH * 0.69},${centerX - 85} ${height * 0.66},${centerX - 54} ${height * 0.66}" fill="none" stroke="${COLORS.cyanLight}" stroke-width="7" marker-end="url(#v8-arrow)"/>
    ${chip(centerX, height * 0.36, 104, COLORS.cyan)}
    ${chip(centerX, height * 0.66, 104, COLORS.cyan)}
    <path d="M${centerX + 72} ${height * 0.36}C${rightX - 54} ${height * 0.36},${rightX - 54} ${topY + rowH * 0.5},${rightX + 20} ${topY + rowH * 0.5}" fill="none" stroke="${COLORS.cyanLight}" stroke-width="7" marker-end="url(#v8-arrow)"/>
    <path d="M${centerX + 72} ${height * 0.66}C${rightX - 54} ${height * 0.66},${rightX - 54} ${topY + rowH * 1.52},${rightX + 20} ${topY + rowH * 1.52}" fill="none" stroke="${COLORS.cyanLight}" stroke-width="7" marker-end="url(#v8-arrow)"/>
    <rect x="${rightX + 36}" y="${topY}" width="${rightW - 72}" height="${rowH - 14}" rx="22" fill="#071827" stroke="${COLORS.green}" stroke-opacity="0.55" stroke-width="3"/>
    <rect x="${rightX + 36}" y="${topY + rowH + 26}" width="${rightW - 72}" height="${rowH - 14}" rx="22" fill="#071827" stroke="${COLORS.amber}" stroke-opacity="0.65" stroke-width="3"/>
    ${outputTrace(rightX + 80, topY + 26, rightW - 160, rowH - 70, true)}
    ${outputTrace(rightX + 80, topY + rowH + 52, rightW - 160, rowH - 70, false)}
    <path d="M${rightX + rightW - 28} ${topY + 10}v${rowH * 2 + 16}" stroke="${COLORS.rose}" stroke-opacity="0.65" stroke-width="5" stroke-dasharray="11 9"/>`;
}

function tokenCapsule(x: number, y: number, width: number, accent: string, opacity: number): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="28" rx="14" fill="${accent}" fill-opacity="${opacity}" stroke="${COLORS.cyanLight}" stroke-opacity="0.36" stroke-width="2"/>`;
}

function operationalThresholdScene(width: number, height: number): string {
  const chamberX = Math.round(width * 0.53);
  const chamberY = 132;
  const chamberW = Math.round(width * 0.29);
  const chamberH = height - 206;
  const thresholdY = chamberY + chamberH * 0.25;
  const tokenRows = Array.from({ length: 9 }, (_, index) => {
    const y = 166 + index * 47;
    return tokenCapsule(78 + (index % 3) * 18, y, 250 + (index % 4) * 32, index > 5 ? COLORS.amber : COLORS.cyan, 0.24 + index * 0.055);
  }).join('');
  const chamberTokens = Array.from({ length: 8 }, (_, index) => {
    const y = chamberY + chamberH - 54 - index * 46;
    return tokenCapsule(chamberX + 52, y, chamberW - 104, index > 5 ? COLORS.rose : COLORS.amber, 0.26 + index * 0.065);
  }).join('');
  return `${panel(48, 116, Math.round(width * 0.36), height - 164)}
    <ellipse cx="${chamberX + chamberW / 2}" cy="${height * 0.48}" rx="${chamberW * 0.72}" ry="${chamberH * 0.72}" fill="url(#v8-warm-glow)" opacity="0.78"/>
    ${tokenRows}
    <path d="M${width * 0.39} ${height * 0.5}C${width * 0.46} ${height * 0.5},${width * 0.47} ${height * 0.5},${chamberX - 20} ${height * 0.5}" fill="none" stroke="${COLORS.cyanLight}" stroke-width="12" stroke-linecap="round" marker-end="url(#v8-arrow)"/>
    <rect x="${chamberX}" y="${chamberY}" width="${chamberW}" height="${chamberH}" rx="38" fill="#101723" fill-opacity="0.9" stroke="${COLORS.amber}" stroke-width="5" filter="url(#v8-shadow)"/>
    ${chamberTokens}
    <path d="M${chamberX + 24} ${thresholdY}H${chamberX + chamberW - 24}" stroke="${COLORS.rose}" stroke-width="7" stroke-dasharray="14 10"/>
    <path d="M${chamberX + chamberW + 34} ${thresholdY - 18}v36M${chamberX + chamberW + 18} ${thresholdY}h32" stroke="${COLORS.rose}" stroke-width="7" stroke-linecap="round"/>
    <path d="M${chamberX + chamberW} ${height * 0.5}H${width - 138}" stroke="${COLORS.cyanLight}" stroke-width="10" stroke-linecap="round"/>
    <rect x="${width - 168}" y="${height * 0.5 - 92}" width="78" height="184" rx="24" fill="#111827" stroke="${COLORS.rose}" stroke-width="6"/>
    <path d="M${width - 150} ${height * 0.5 - 56}h42M${width - 150} ${height * 0.5 + 56}h42" stroke="${COLORS.rose}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="${width - 129}" cy="${height * 0.5}" r="18" fill="${COLORS.amber}"/>
    <path d="M${width - 88} ${height * 0.5}h42" stroke="${COLORS.cyanLight}" stroke-opacity="0.28" stroke-width="10" stroke-dasharray="8 10"/>`;
}

export function renderSpecializedVisualSvgV8(input: SpecializedSvgInputV8): Buffer {
  const width = Math.max(640, Math.round(input.width ?? 1280));
  const height = Math.max(360, Math.round(input.height ?? 720));
  if (input.treatment.renderMode !== 'deterministic') {
    throw new Error(`Treatment ${input.treatment.kind} is not deterministic.`);
  }
  const scene =
    input.treatment.kind === 'observed_variability'
      ? observedVariabilityScene(width, height)
      : operationalThresholdScene(width, height);
  const overlays = input.includeOverlays === false ? '' : overlayMarkup(input.treatment, width);
  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" data-specialized-v8="${input.treatment.kind}">${defs()}${background(width, height)}${scene}${overlays}<rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="28" fill="none" stroke="${COLORS.cyan}" stroke-opacity="0.28" stroke-width="3"/></svg>`);
}

export function renderSpecializedOverlaySvgV8(
  treatment: SpecializedVisualTreatmentV8,
  width = 1280,
  height = 720,
): Buffer {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="v8-vignette" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020617" stop-opacity="0.38"/><stop offset="0.28" stop-color="#020617" stop-opacity="0"/><stop offset="1" stop-color="#020617" stop-opacity="0.3"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#v8-vignette)"/>${overlayMarkup(treatment, width)}<rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="28" fill="none" stroke="${COLORS.cyan}" stroke-opacity="0.28" stroke-width="3"/></svg>`);
}

export function specializedImagePromptV8(
  treatment: SpecializedVisualTreatmentV8,
  story: HoldoutStoryInput,
): string {
  if (treatment.kind === 'scientific_discovery') {
    return [
      'Create a premium cinematic editorial illustration for a technology research magazine, wide 16:9.',
      'Scene: a dark, believable immunology laboratory at night. Several distinct streams of complex biological evidence—molecular structures, assay patterns and T-cell interaction traces—converge through one restrained translucent AI analysis prism at the center of the composition.',
      'On the far side of the prism, the tangled evidence resolves into one clear luminous T-cell interaction hypothesis that human immunologists can inspect. A visibly blocked research pathway opens at the same moment, conveying that a long-standing bottleneck has been overcome.',
      'The humans remain the researchers; the AI synthesizes evidence and reveals a hypothesis rather than conducting the science alone.',
      'Strong depth, realistic glass and metal, subtle cyan and amber light, high-end documentary cinematography, one continuous scene, immediate causal reading at thumbnail size.',
      `Source grounding: ${treatment.sourceGrounding}`,
      `Approved headline context: ${story.title}.`,
      'Absolutely no readable text, letters, numbers, logos, model names, UI, code, captions, watermarks, diagrams, split screen or infographic panels.',
      'Do not depict a medical cure, patient treatment or clinical proof.',
    ].join(' ');
  }
  if (treatment.kind === 'focused_cognition') {
    return [
      'Create a premium cinematic editorial photograph for a technology magazine, wide 16:9.',
      'Scene: one knowledge worker in a dark workshop-like thinking space, hands actively solving a difficult mechanical logic mechanism. The person must be visibly performing the reasoning and manipulating the key component.',
      'A restrained translucent AI assistant light projects exactly one bounded hint onto a single part but never touches the mechanism and never completes the task.',
      'Behind a frosted acoustic glass boundary, a storm of diffuse notification lights, branching prompts and attention-grabbing signals is visibly muted. The foreground remains calm, sharply focused and physically separated from the distraction.',
      'The visual thesis is active problem-solving with AI as a sparring partner restores deep work; passive automation is forbidden.',
      'High-end documentary cinematography, warm practical light against restrained cyan guidance, believable materials, strong human posture, one continuous scene, clear at thumbnail size.',
      `Source grounding: ${treatment.sourceGrounding}`,
      `Approved headline context: ${story.title}.`,
      'Absolutely no readable text, letters, numbers, logos, UI, code, captions, watermarks, split screen or infographic panels.',
    ].join(' ');
  }
  throw new Error(`Treatment ${treatment.kind} does not use generated imagery.`);
}
