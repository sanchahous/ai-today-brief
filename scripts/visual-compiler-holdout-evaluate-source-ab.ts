import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import { weightedVisualScore, type VisualQualityScores } from '../src/lib/weekly-digest/visual-compiler';
import type { ClaimFidelityVerdict } from './visual-compiler-holdout-audit-claims';

const ROOT =
  process.env.VISUAL_HOLDOUT_AB_OUT_DIR?.trim() || 'artifacts/visual-compiler-holdout-ab';
const SELECTION_PATH =
  process.env.VISUAL_HOLDOUT_SELECTION?.trim() ||
  'artifacts/visual-compiler-holdout/render-selection.json';
const CLAIM_AUDIT_PATH =
  process.env.VISUAL_HOLDOUT_CLAIM_AUDIT?.trim() || join(ROOT, 'claim-fidelity.json');
const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY?.trim() || '';
const MODEL =
  process.env.VISUAL_HOLDOUT_JUDGE_MODEL?.trim() || 'google/gemini-2.5-flash';

type Source = 'current' | 'compiler';
type Side = 'X' | 'Y';

interface StorySource {
  revision_item_id: string;
  title: string;
  summary: string;
  why: string | null;
  practical: string | null;
  takeaway: string | null;
}

interface SelectionRow {
  weekStart: string;
  rank: number;
  headline: string;
  story: StorySource;
  autoClaim: {
    claim: {
      coreClaim: string;
      mechanism: string;
      primaryOutcome: string;
      approvedLabels?: string[];
    };
  };
}

interface ManifestRow {
  storyId: string;
  weekStart: string;
  rank: number;
  headline: string;
  format: string;
  renderMode: string;
  baselineImagePath: string;
  compilerPixelPath: string;
  compilerFinalPath: string;
  blindXCardPath: string;
  blindYCardPath: string;
  blindXSource: Source;
  blindYSource: Source;
  current: { estimatedImageCostUsd: number; imageCalls: number };
  compiler: { estimatedImageCostUsd: number; imageCalls: number };
}

interface PixelVerdict {
  sourceContextSupported: boolean;
  mechanismVisible: boolean;
  outcomeVisible: boolean;
  causalRelationVisible: boolean;
  contradictionVisible: boolean;
  unsupportedSpecificsVisible: boolean;
  generatedTextPresent: boolean;
  subjectConsistent: boolean;
  mechanismEvidence: string;
  outcomeEvidence: string;
  ambiguity: string;
}

interface CardVerdict {
  headlinePairUnderstood: boolean;
  coreClaimGrounded: boolean;
  labelsExact: boolean;
  overlaySupportedByPixels: boolean;
  thumbnailReadable: boolean;
  misleading: boolean;
  instantMeaning: number;
  visualBeauty: number;
  brandConsistency: number;
  originality: number;
  summary: string;
}

interface PreferenceVerdict {
  X: CardVerdict;
  Y: CardVerdict;
  preferred: Side | 'tie';
  confidence: number;
  reason: string;
}

interface SourceEvaluation {
  pixel: PixelVerdict;
  card: CardVerdict;
  pixelPass: boolean;
  visualFinalPass: boolean;
  productionPass: boolean;
  weightedScore: number;
}

interface EvaluationRow {
  storyId: string;
  weekStart: string;
  rank: number;
  headline: string;
  format: string;
  renderMode: string;
  claimAudit: ClaimFidelityVerdict;
  current: SourceEvaluation;
  compiler: SourceEvaluation;
  preferredSource: Source | 'tie';
  confidence: number;
  reason: string;
  pixelOrder: Record<Side, Source>;
  cardOrder: Record<Side, Source>;
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
}

function assertEnvironment() {
  if (!OPEN_ROUTER_API_KEY) throw new Error('OPEN_ROUTER_API_KEY is required.');
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function bool(value: unknown): boolean {
  return value === true;
}

function score(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
}

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function responseText(value: OpenRouterResponse): string {
  const content = value.choices?.[0]?.message?.content;
  if (Array.isArray(content)) return content.map((part) => part.text ?? '').join('');
  return typeof content === 'string' ? content : '';
}

function parseJson<T>(value: string): T {
  const clean = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(clean) as T;
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1)) as T;
    throw new Error(`Invalid vision JSON: ${clean.slice(0, 500)}`);
  }
}

async function callJudge<T>(content: Array<Record<string, unknown>>) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPEN_ROUTER_API_KEY}`,
          'content-type': 'application/json',
          'HTTP-Referer': 'https://aitodaybrief.com',
          'X-Title': 'AI Today Brief source-grounded unseen visual evaluation',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content }],
          temperature: 0,
          max_tokens: 1_700,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(150_000),
      });
      if (!response.ok) {
        throw new Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 900)}`);
      }
      const payload = (await response.json()) as OpenRouterResponse;
      const raw = responseText(payload);
      if (!raw) throw new Error('Vision judge returned no content.');
      return { value: parseJson<T>(raw), usage: payload.usage, attempts: attempt };
    } catch (error) {
      lastError = error;
      console.warn(`[source-eval] attempt ${attempt} failed`, error);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 1_500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function imagePart(path: string): Promise<Record<string, unknown>> {
  const bytes = await sharp(path)
    .resize(720, 560, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 84 })
    .toBuffer();
  return {
    type: 'image_url',
    image_url: { url: `data:image/jpeg;base64,${bytes.toString('base64')}` },
  };
}

function seed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizePixel(value: unknown): PixelVerdict {
  const row = record(value);
  return {
    sourceContextSupported: bool(row.source_context_supported),
    mechanismVisible: bool(row.mechanism_visible),
    outcomeVisible: bool(row.outcome_visible),
    causalRelationVisible: bool(row.causal_relation_visible),
    contradictionVisible: bool(row.contradiction_visible),
    unsupportedSpecificsVisible: bool(row.unsupported_specifics_visible),
    generatedTextPresent: bool(row.generated_text_present),
    subjectConsistent: bool(row.subject_consistent),
    mechanismEvidence: text(row.mechanism_evidence, 260),
    outcomeEvidence: text(row.outcome_evidence, 260),
    ambiguity: text(row.ambiguity, 260),
  };
}

function normalizeCard(value: unknown): CardVerdict {
  const row = record(value);
  return {
    headlinePairUnderstood: bool(row.headline_pair_understood),
    coreClaimGrounded: bool(row.core_claim_grounded),
    labelsExact: bool(row.labels_exact),
    overlaySupportedByPixels: bool(row.overlay_supported_by_pixels),
    thumbnailReadable: bool(row.thumbnail_readable),
    misleading: bool(row.misleading),
    instantMeaning: score(row.instant_meaning),
    visualBeauty: score(row.visual_beauty),
    brandConsistency: score(row.brand_consistency),
    originality: score(row.originality),
    summary: text(row.summary, 300),
  };
}

function sourceText(story: StorySource): string {
  return [
    `HEADLINE: ${story.title}`,
    `SUMMARY: ${story.summary}`,
    story.why ? `WHY IT MATTERS: ${story.why}` : '',
    story.practical ? `PRACTICAL: ${story.practical}` : '',
    story.takeaway ? `TAKEAWAY: ${story.takeaway}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function evaluatePixels(row: ManifestRow, story: StorySource) {
  const compilerIsX = seed(`source-pixel:${row.storyId}`) % 2 === 0;
  const order: Record<Side, Source> = compilerIsX
    ? { X: 'compiler', Y: 'current' }
    : { X: 'current', Y: 'compiler' };
  const path = (source: Source) =>
    resolve(ROOT, source === 'compiler' ? row.compilerPixelPath : row.baselineImagePath);
  const result = await callJudge<Record<string, unknown>>([
    {
      type: 'text',
      text: [
        'Compare IMAGE X and IMAGE Y using pixels only. Source names, headline cards, prompts and rendering methods are hidden.',
        'The original approved story below is the only ground truth. Each image may choose a different single core claim, but that claim must be central and source-grounded.',
        sourceText(story),
        'For each image return:',
        '- source_context_supported: visible objects/actions plausibly belong to this specific story rather than only generic AI mood;',
        '- mechanism_visible: one important source-grounded causal process is visible;',
        '- outcome_visible: a source-grounded benefit, harm, trade-off or result is visible;',
        '- causal_relation_visible: pixels connect mechanism to outcome;',
        '- contradiction_visible: pixels imply the opposite of the source;',
        '- unsupported_specifics_visible: pixels assert a factual detail, product state or certainty not supported by the source;',
        '- generated_text_present: unintended letters, words, numbers, fake UI copy, code, logos or gibberish appear inside pixels;',
        '- subject_consistent: the image maintains a coherent subject/state across its own causal story.',
        'Do not count the separate headline card or deterministic labels because these are pixel-only images.',
        'Return JSON only: {"X":{source_context_supported,mechanism_visible,outcome_visible,causal_relation_visible,contradiction_visible,unsupported_specifics_visible,generated_text_present,subject_consistent,mechanism_evidence,outcome_evidence,ambiguity},"Y":{same}}.',
      ].join('\n'),
    },
    { type: 'text', text: 'IMAGE X' },
    await imagePart(path(order.X)),
    { type: 'text', text: 'IMAGE Y' },
    await imagePart(path(order.Y)),
  ]);
  return {
    X: normalizePixel(result.value.X),
    Y: normalizePixel(result.value.Y),
    order,
    usage: result.usage,
  };
}

async function evaluateCards(row: ManifestRow, story: StorySource) {
  const result = await callJudge<Record<string, unknown>>([
    {
      type: 'text',
      text: [
        'Compare CARD X and CARD Y as a blinded AI Today Brief visual editor at realistic feed size.',
        'The original approved story below is the only ground truth. Do not assume either visual plan is correct.',
        sourceText(story),
        'The headline always supplies product/company identity. The image should add one central mechanism, consequence, benefit, harm or trade-off.',
        'For each card return:',
        '- headline_pair_understood: headline + image communicates one coherent central claim in about three seconds;',
        '- core_claim_grounded: the communicated claim is supported by the story without certainty inflation;',
        '- labels_exact: every visible number/label is accurate and preserves its comparison target; true when there are no explanatory labels;',
        '- overlay_supported_by_pixels: labels do not merely state a mechanism/outcome absent from pixels;',
        '- thumbnail_readable: focal action and important labels survive displayed size;',
        '- misleading: the card implies a materially different mechanism, result, availability or certainty;',
        '- 0-100 scores for instant_meaning, visual_beauty, brand_consistency, originality.',
        'Choose preferred X, Y or tie. Weights are 45% instant meaning, 30% beauty, 15% brand consistency, 10% originality. Fidelity and non-misleading communication are hard requirements.',
        'Return JSON only: {"X":{headline_pair_understood,core_claim_grounded,labels_exact,overlay_supported_by_pixels,thumbnail_readable,misleading,instant_meaning,visual_beauty,brand_consistency,originality,summary},"Y":{same},"preferred":"X"|"Y"|"tie","confidence":0..1,"reason":string}.',
      ].join('\n'),
    },
    { type: 'text', text: 'CARD X' },
    await imagePart(resolve(ROOT, row.blindXCardPath)),
    { type: 'text', text: 'CARD Y' },
    await imagePart(resolve(ROOT, row.blindYCardPath)),
  ]);
  const preferredRaw = result.value.preferred;
  return {
    X: normalizeCard(result.value.X),
    Y: normalizeCard(result.value.Y),
    preferred: preferredRaw === 'X' || preferredRaw === 'Y' ? preferredRaw : 'tie',
    confidence: Math.min(1, Math.max(0, Number(result.value.confidence) || 0)),
    reason: text(result.value.reason, 420),
    usage: result.usage,
  } as const;
}

function mapBySource<T>(order: Record<Side, Source>, value: { X: T; Y: T }): Record<Source, T> {
  return order.X === 'current'
    ? { current: value.X, compiler: value.Y }
    : { current: value.Y, compiler: value.X };
}

function pixelPass(value: PixelVerdict): boolean {
  return (
    value.sourceContextSupported &&
    value.mechanismVisible &&
    value.outcomeVisible &&
    value.causalRelationVisible &&
    !value.contradictionVisible &&
    !value.unsupportedSpecificsVisible &&
    !value.generatedTextPresent &&
    value.subjectConsistent
  );
}

function cardPass(pixel: PixelVerdict, card: CardVerdict): boolean {
  return (
    pixelPass(pixel) &&
    card.headlinePairUnderstood &&
    card.coreClaimGrounded &&
    card.labelsExact &&
    card.overlaySupportedByPixels &&
    card.thumbnailReadable &&
    !card.misleading
  );
}

function scores(value: CardVerdict): VisualQualityScores {
  return {
    instantMeaning: value.instantMeaning,
    visualBeauty: value.visualBeauty,
    brandConsistency: value.brandConsistency,
    originality: value.originality,
  };
}

function buildEvaluation(
  source: Source,
  pixel: PixelVerdict,
  card: CardVerdict,
  audit: ClaimFidelityVerdict,
): SourceEvaluation {
  const visualFinalPass = cardPass(pixel, card);
  return {
    pixel,
    card,
    pixelPass: pixelPass(pixel),
    visualFinalPass,
    productionPass: visualFinalPass && (source === 'current' || audit.passed),
    weightedScore: weightedVisualScore(scores(card)),
  };
}

function mark(value: boolean): string {
  return value ? '✓' : '✕';
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percent(value: number, total: number): string {
  return `${Math.round((value / Math.max(1, total)) * 100)}%`;
}

function report(rows: EvaluationRow[], usage: NonNullable<OpenRouterResponse['usage']>) {
  const count = rows.length;
  const metric = (source: Source, key: 'pixelPass' | 'visualFinalPass' | 'productionPass') =>
    rows.filter((row) => row[source][key]).length;
  const compilerWins = rows.filter((row) => row.preferredSource === 'compiler').length;
  const currentWins = rows.filter((row) => row.preferredSource === 'current').length;
  const ties = rows.filter((row) => row.preferredSource === 'tie').length;
  const claimPass = rows.filter((row) => row.claimAudit.passed).length;
  const lines = [
    '# Source-grounded unseen 12-story A/B evaluation',
    '',
    `Judge: \`${MODEL}\`; source story is ground truth, not the extracted VisualClaim.`,
    `Compiler claim-fidelity pass: **${claimPass}/${count}**.`,
    '',
    '| Metric | Current | Compiler |',
    '|---|---:|---:|',
    `| Pixel semantic pass | ${metric('current', 'pixelPass')}/${count} (${percent(metric('current', 'pixelPass'), count)}) | ${metric('compiler', 'pixelPass')}/${count} (${percent(metric('compiler', 'pixelPass'), count)}) |`,
    `| Visual headline-paired pass | ${metric('current', 'visualFinalPass')}/${count} (${percent(metric('current', 'visualFinalPass'), count)}) | ${metric('compiler', 'visualFinalPass')}/${count} (${percent(metric('compiler', 'visualFinalPass'), count)}) |`,
    `| Production pass incl. claim fidelity | ${metric('current', 'productionPass')}/${count} (${percent(metric('current', 'productionPass'), count)}) | ${metric('compiler', 'productionPass')}/${count} (${percent(metric('compiler', 'productionPass'), count)}) |`,
    `| Average weighted score | ${average(rows.map((row) => row.current.weightedScore)).toFixed(1)} | ${average(rows.map((row) => row.compiler.weightedScore)).toFixed(1)} |`,
    `| Generated-text-free pixels | ${rows.filter((row) => !row.current.pixel.generatedTextPresent).length}/${count} | ${rows.filter((row) => !row.compiler.pixel.generatedTextPresent).length}/${count} |`,
    '',
    `Blinded preference: compiler **${compilerWins}**, current **${currentWins}**, ties **${ties}**.`,
    `Compiler preference excluding ties: **${percent(compilerWins, compilerWins + currentWins)}**.`,
    `Vision usage: ${usage.total_tokens ?? 0} tokens; reported cost $${(usage.cost ?? 0).toFixed(4)}.`,
    '',
    '| Week | # | Story | Format | Claim | Current P/V/Prod/Score | Compiler P/V/Prod/Score | Preferred | Reason |',
    '|---|---:|---|---|---:|---|---|---|---|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.weekStart} | ${row.rank} | ${row.headline.replace(/\|/g, '\\|')} | \`${row.format}\` | ${mark(row.claimAudit.passed)} | ${mark(row.current.pixelPass)}/${mark(row.current.visualFinalPass)}/${mark(row.current.productionPass)}/${row.current.weightedScore.toFixed(1)} | ${mark(row.compiler.pixelPass)}/${mark(row.compiler.visualFinalPass)}/${mark(row.compiler.productionPass)}/${row.compiler.weightedScore.toFixed(1)} | **${row.preferredSource}** | ${row.reason.replace(/\|/g, '\\|')} |`,
    );
  }
  lines.push('', '## Failure diagnosis', '');
  for (const row of rows) {
    const details: string[] = [];
    if (!row.claimAudit.passed) details.push(`claim: ${row.claimAudit.issues.join('; ') || 'source-fidelity failure'}`);
    for (const source of ['current', 'compiler'] as const) {
      const value = row[source];
      const codes = [
        !value.pixel.sourceContextSupported && 'context',
        !value.pixel.mechanismVisible && 'mechanism',
        !value.pixel.outcomeVisible && 'outcome',
        !value.pixel.causalRelationVisible && 'cause-effect',
        value.pixel.contradictionVisible && 'contradiction',
        value.pixel.unsupportedSpecificsVisible && 'unsupported-specifics',
        value.pixel.generatedTextPresent && 'generated-text',
        !value.pixel.subjectConsistent && 'consistency',
        !value.card.headlinePairUnderstood && 'headline-pair',
        !value.card.coreClaimGrounded && 'grounding',
        !value.card.labelsExact && 'labels',
        !value.card.overlaySupportedByPixels && 'overlay',
        !value.card.thumbnailReadable && 'thumbnail',
        value.card.misleading && 'misleading',
      ].filter(Boolean);
      if (codes.length) details.push(`${source}: ${codes.join(', ')}`);
    }
    if (details.length) lines.push(`- ${row.weekStart} #${row.rank}: ${details.join(' | ')}`);
  }
  return `${lines.join('\n')}\n`;
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function evaluatedSheet(rows: EvaluationRow[], manifest: ManifestRow[]) {
  const thumbW = 560;
  const cardH = 451;
  const margin = 28;
  const headerH = 74;
  const footerH = 70;
  const rowH = headerH + cardH + footerH + 22;
  const width = margin * 3 + thumbW * 2;
  const height = margin + rows.length * rowH;
  const imageLayers: OverlayOptions[] = [];
  const textSvg = [
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`,
  ];
  for (const [index, row] of rows.entries()) {
    const render = manifest.find((item) => item.storyId === row.storyId)!;
    const y = margin + index * rowH;
    for (const [column, source] of (['current', 'compiler'] as const).entries()) {
      const x = margin + column * (thumbW + margin);
      const path =
        render.blindXSource === source
          ? resolve(ROOT, render.blindXCardPath)
          : resolve(ROOT, render.blindYCardPath);
      const bytes = await sharp(path).resize(thumbW, cardH, { fit: 'fill' }).png().toBuffer();
      imageLayers.push({ input: bytes, left: x, top: y + headerH });
      const value = row[source];
      const preferred = row.preferredSource === source;
      textSvg.push(
        `<text x="${x}" y="${y + 28}" font-family="DejaVu Sans,Arial,sans-serif" font-size="22" font-weight="900" fill="${preferred ? '#A7F3D0' : '#67E8F9'}">${source.toUpperCase()}${preferred ? ' • PREFERRED' : ''}</text>`,
        `<text x="${x}" y="${y + 57}" font-family="DejaVu Sans,Arial,sans-serif" font-size="15" font-weight="700" fill="#CFFAFE">pixel ${value.pixelPass ? 'PASS' : 'FAIL'} • visual ${value.visualFinalPass ? 'PASS' : 'FAIL'} • production ${value.productionPass ? 'PASS' : 'FAIL'} • ${value.weightedScore.toFixed(1)}</text>`,
      );
    }
    textSvg.push(
      `<text x="${margin}" y="${y + headerH + cardH + 34}" font-family="DejaVu Sans,Arial,sans-serif" font-size="14" fill="#94A3B8">${xml(row.reason.slice(0, 150))}</text>`,
      `<text x="${margin}" y="${y + headerH + cardH + 57}" font-family="DejaVu Sans,Arial,sans-serif" font-size="13" fill="${row.claimAudit.passed ? '#6EE7B7' : '#FDA4AF'}">claim ${row.claimAudit.passed ? 'PASS' : 'FAIL'}${row.claimAudit.issues.length ? ` • ${xml(row.claimAudit.issues.join('; ').slice(0, 120))}` : ''}</text>`,
    );
  }
  textSvg.push('</svg>');
  const base = sharp({ create: { width, height, channels: 3, background: '#03070D' } });
  return base
    .composite([...imageLayers, { input: Buffer.from(textSvg.join('')), left: 0, top: 0 }])
    .png()
    .toBuffer();
}

async function main() {
  assertEnvironment();
  await mkdir(ROOT, { recursive: true });
  const [manifest, selection, claimAuditPayload] = await Promise.all([
    readFile(join(ROOT, 'render-manifest.json'), 'utf8').then((value) => JSON.parse(value) as ManifestRow[]),
    readFile(SELECTION_PATH, 'utf8').then((value) => JSON.parse(value) as SelectionRow[]),
    readFile(CLAIM_AUDIT_PATH, 'utf8').then(
      (value) => JSON.parse(value) as { audits: ClaimFidelityVerdict[] },
    ),
  ]);
  if (manifest.length !== 12 || selection.length !== 12) {
    throw new Error(`Expected 12 manifest and selection rows; got ${manifest.length}/${selection.length}.`);
  }
  const storyById = new Map(selection.map((row) => [row.story.revision_item_id, row.story] as const));
  const auditById = new Map(claimAuditPayload.audits.map((audit) => [audit.storyId, audit] as const));
  const rows: EvaluationRow[] = [];
  let usage: NonNullable<OpenRouterResponse['usage']> = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    cost: 0,
  };

  for (const [index, item] of manifest.entries()) {
    const story = storyById.get(item.storyId);
    const audit = auditById.get(item.storyId);
    if (!story || !audit) throw new Error(`Missing source/audit for ${item.storyId}.`);
    console.log(`[source-eval] ${index + 1}/${manifest.length} pixels: ${item.headline}`);
    const pixels = await evaluatePixels(item, story);
    console.log(`[source-eval] ${index + 1}/${manifest.length} cards`);
    const cards = await evaluateCards(item, story);
    for (const value of [pixels.usage, cards.usage]) {
      usage = {
        prompt_tokens: (usage.prompt_tokens ?? 0) + (value?.prompt_tokens ?? 0),
        completion_tokens: (usage.completion_tokens ?? 0) + (value?.completion_tokens ?? 0),
        total_tokens: (usage.total_tokens ?? 0) + (value?.total_tokens ?? 0),
        cost: (usage.cost ?? 0) + (value?.cost ?? 0),
      };
    }
    const pixelBySource = mapBySource(pixels.order, { X: pixels.X, Y: pixels.Y });
    const cardOrder: Record<Side, Source> = {
      X: item.blindXSource,
      Y: item.blindYSource,
    };
    const cardBySource = mapBySource(cardOrder, { X: cards.X, Y: cards.Y });
    const preferredSource: Source | 'tie' =
      cards.preferred === 'tie' ? 'tie' : cardOrder[cards.preferred];
    rows.push({
      storyId: item.storyId,
      weekStart: item.weekStart,
      rank: item.rank,
      headline: item.headline,
      format: item.format,
      renderMode: item.renderMode,
      claimAudit: audit,
      current: buildEvaluation('current', pixelBySource.current, cardBySource.current, audit),
      compiler: buildEvaluation('compiler', pixelBySource.compiler, cardBySource.compiler, audit),
      preferredSource,
      confidence: cards.confidence,
      reason: cards.reason,
      pixelOrder: pixels.order,
      cardOrder,
    });
    await writeFile(
      join(ROOT, 'source-evaluation-progress.json'),
      `${JSON.stringify({ rows, usage }, null, 2)}\n`,
    );
  }

  const reportText = report(rows, usage);
  await Promise.all([
    writeFile(join(ROOT, 'source-evaluation.json'), `${JSON.stringify({ rows, usage }, null, 2)}\n`),
    writeFile(join(ROOT, 'source-evaluation-report.md'), reportText),
    writeFile(join(ROOT, 'source-evaluated-contact-sheet.png'), await evaluatedSheet(rows, manifest)),
  ]);
  console.log(reportText);
}

main().catch(async (error) => {
  await mkdir(ROOT, { recursive: true });
  await writeFile(
    join(ROOT, 'source-evaluation-failure.txt'),
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  console.error(error);
  process.exitCode = 1;
});
