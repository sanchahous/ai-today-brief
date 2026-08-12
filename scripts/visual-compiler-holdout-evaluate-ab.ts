import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import { weightedVisualScore, type VisualQualityScores } from '../src/lib/weekly-digest/visual-compiler';
import type { AutoVisualClaim } from '../src/lib/weekly-digest/visual-auto-claim';

const ROOT =
  process.env.VISUAL_HOLDOUT_AB_OUT_DIR?.trim() || 'artifacts/visual-compiler-holdout-ab';
const SELECTION_PATH =
  process.env.VISUAL_HOLDOUT_SELECTION?.trim() ||
  'artifacts/visual-compiler-holdout/render-selection.json';
const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY?.trim() || '';
const MODEL =
  process.env.VISUAL_HOLDOUT_JUDGE_MODEL?.trim() || 'google/gemini-2.5-flash';

type Source = 'current' | 'compiler';
type BlindSide = 'X' | 'Y';

interface RenderManifestRow {
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
  current: {
    provider: string;
    model: string;
    imageCalls: number;
    estimatedImageCostUsd: number;
    scene?: string;
    prompt?: string;
  };
  compiler: {
    provider: string;
    model: string;
    imageCalls: number;
    estimatedImageCostUsd: number;
    prompt?: string;
  };
}

interface SelectionRow {
  story: { revision_item_id: string; title: string; summary: string; why?: string | null };
  autoClaim: AutoVisualClaim;
  plan: { overlays: Array<{ text: string }> };
}

interface PixelVariantVerdict {
  mechanism_visible: boolean;
  outcome_visible: boolean;
  causal_relation_visible: boolean;
  contradiction_visible: boolean;
  generated_text_present: boolean;
  subject_consistent: boolean;
  mechanism_evidence: string;
  outcome_evidence: string;
  ambiguity: string;
}

interface PixelComparisonVerdict {
  X: PixelVariantVerdict;
  Y: PixelVariantVerdict;
}

interface PairedVariantVerdict {
  headline_pair_understood: boolean;
  overlay_supported_by_pixels: boolean;
  thumbnail_readable: boolean;
  misleading: boolean;
  instant_meaning: number;
  visual_beauty: number;
  brand_consistency: number;
  originality: number;
  summary: string;
}

interface PairedComparisonVerdict {
  X: PairedVariantVerdict;
  Y: PairedVariantVerdict;
  preferred: BlindSide | 'tie';
  confidence: number;
  reason: string;
}

interface SourceEvaluation {
  pixel: PixelVariantVerdict;
  paired: PairedVariantVerdict;
  pixelPass: boolean;
  finalPass: boolean;
  weightedScore: number;
}

interface EvaluationRow {
  storyId: string;
  weekStart: string;
  rank: number;
  headline: string;
  format: string;
  renderMode: string;
  current: SourceEvaluation;
  compiler: SourceEvaluation;
  blindPreferred: BlindSide | 'tie';
  preferredSource: Source | 'tie';
  confidence: number;
  reason: string;
  pixelOrder: { X: Source; Y: Source };
  cardOrder: { X: Source; Y: Source };
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
}

function assertEnvironment() {
  if (!OPEN_ROUTER_API_KEY) throw new Error('OPEN_ROUTER_API_KEY is required.');
}

function seedFromString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sleep(milliseconds: number) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function responseText(value: OpenRouterResponse): string {
  const content = value.choices?.[0]?.message?.content;
  if (Array.isArray(content)) return content.map((part) => part.text ?? '').join('');
  return typeof content === 'string' ? content : '';
}

function parseJson<T>(text: string): T {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(clean) as T;
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1)) as T;
    throw new Error(`Invalid judge JSON: ${clean.slice(0, 500)}`);
  }
}

async function callJudge<T>(content: Array<Record<string, unknown>>): Promise<{ value: T; usage?: OpenRouterResponse['usage'] }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPEN_ROUTER_API_KEY}`,
          'content-type': 'application/json',
          'HTTP-Referer': 'https://aitodaybrief.com',
          'X-Title': 'AI Today Brief unseen visual holdout evaluation',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content }],
          temperature: 0,
          max_tokens: 1_500,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(150_000),
      });
      if (!response.ok) {
        throw new Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 900)}`);
      }
      const payload = (await response.json()) as OpenRouterResponse;
      const text = responseText(payload);
      if (!text) throw new Error('Judge returned no text.');
      return { value: parseJson<T>(text), usage: payload.usage };
    } catch (error) {
      lastError = error;
      console.warn(`[holdout-eval] attempt ${attempt} failed`, error);
      await sleep(attempt * 1_500);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function imagePart(path: string): Promise<Record<string, unknown>> {
  const bytes = await sharp(path)
    .resize(720, 520, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 84 })
    .toBuffer();
  return {
    type: 'image_url',
    image_url: { url: `data:image/jpeg;base64,${bytes.toString('base64')}` },
  };
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeScore(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 0;
}

function normalizePixel(value: unknown): PixelVariantVerdict {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    mechanism_visible: normalizeBoolean(row.mechanism_visible),
    outcome_visible: normalizeBoolean(row.outcome_visible),
    causal_relation_visible: normalizeBoolean(row.causal_relation_visible),
    contradiction_visible: normalizeBoolean(row.contradiction_visible),
    generated_text_present: normalizeBoolean(row.generated_text_present),
    subject_consistent: normalizeBoolean(row.subject_consistent),
    mechanism_evidence: typeof row.mechanism_evidence === 'string' ? row.mechanism_evidence.slice(0, 240) : '',
    outcome_evidence: typeof row.outcome_evidence === 'string' ? row.outcome_evidence.slice(0, 240) : '',
    ambiguity: typeof row.ambiguity === 'string' ? row.ambiguity.slice(0, 240) : '',
  };
}

function normalizePaired(value: unknown): PairedVariantVerdict {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    headline_pair_understood: normalizeBoolean(row.headline_pair_understood),
    overlay_supported_by_pixels: normalizeBoolean(row.overlay_supported_by_pixels),
    thumbnail_readable: normalizeBoolean(row.thumbnail_readable),
    misleading: normalizeBoolean(row.misleading),
    instant_meaning: normalizeScore(row.instant_meaning),
    visual_beauty: normalizeScore(row.visual_beauty),
    brand_consistency: normalizeScore(row.brand_consistency),
    originality: normalizeScore(row.originality),
    summary: typeof row.summary === 'string' ? row.summary.slice(0, 260) : '',
  };
}

function pixelPass(value: PixelVariantVerdict): boolean {
  return (
    value.mechanism_visible &&
    value.outcome_visible &&
    value.causal_relation_visible &&
    !value.contradiction_visible &&
    !value.generated_text_present &&
    value.subject_consistent
  );
}

function finalPass(pixel: PixelVariantVerdict, paired: PairedVariantVerdict): boolean {
  return (
    pixelPass(pixel) &&
    paired.headline_pair_understood &&
    paired.overlay_supported_by_pixels &&
    paired.thumbnail_readable &&
    !paired.misleading
  );
}

function scores(value: PairedVariantVerdict): VisualQualityScores {
  return {
    instantMeaning: value.instant_meaning,
    visualBeauty: value.visual_beauty,
    brandConsistency: value.brand_consistency,
    originality: value.originality,
  };
}

function sourceEvaluation(pixel: PixelVariantVerdict, paired: PairedVariantVerdict): SourceEvaluation {
  return {
    pixel,
    paired,
    pixelPass: pixelPass(pixel),
    finalPass: finalPass(pixel, paired),
    weightedScore: weightedVisualScore(scores(paired)),
  };
}

async function evaluatePixels(
  row: RenderManifestRow,
  claim: AutoVisualClaim,
): Promise<{ verdict: PixelComparisonVerdict; order: { X: Source; Y: Source }; usage?: OpenRouterResponse['usage'] }> {
  const compilerIsX = seedFromString(`pixel:${row.storyId}`) % 2 === 0;
  const order: { X: Source; Y: Source } = compilerIsX
    ? { X: 'compiler', Y: 'current' }
    : { X: 'current', Y: 'compiler' };
  const pathFor = (source: Source) =>
    resolve(ROOT, source === 'compiler' ? row.compilerPixelPath : row.baselineImagePath);
  const result = await callJudge<Record<string, unknown>>([
    {
      type: 'text',
      text: [
        'You are a strict visual-semantics evaluator. Compare IMAGE X and IMAGE Y using pixels only.',
        'The headline, labels, source names and rendering methods are hidden. Do not reward compatibility: a field passes only when the expected mechanism or outcome is visibly depicted.',
        `EXPECTED CORE CLAIM: ${claim.claim.coreClaim}`,
        `EXPECTED MECHANISM: ${claim.claim.mechanism}`,
        `EXPECTED OUTCOME: ${claim.claim.primaryOutcome}`,
        `FORBIDDEN CONTRADICTIONS: ${(claim.claim.forbiddenContradictions ?? []).join(' | ') || 'none specified'}`,
        'Generated text means unintended letters, words, numbers, pseudo-code, fake UI copy, logos or gibberish inside the pixels. Abstract blank marks do not count.',
        'subject_consistent is false only when the visual changes identity/state in a way that breaks its own cause-to-effect narrative.',
        'Return JSON only with keys X and Y. Each must contain exactly: mechanism_visible, outcome_visible, causal_relation_visible, contradiction_visible, generated_text_present, subject_consistent, mechanism_evidence, outcome_evidence, ambiguity.',
      ].join('\n'),
    },
    { type: 'text', text: 'IMAGE X' },
    await imagePart(pathFor(order.X)),
    { type: 'text', text: 'IMAGE Y' },
    await imagePart(pathFor(order.Y)),
  ]);
  return {
    verdict: {
      X: normalizePixel(result.value.X),
      Y: normalizePixel(result.value.Y),
    },
    order,
    usage: result.usage,
  };
}

async function evaluateCards(
  row: RenderManifestRow,
  claim: AutoVisualClaim,
): Promise<{ verdict: PairedComparisonVerdict; usage?: OpenRouterResponse['usage'] }> {
  const result = await callJudge<Record<string, unknown>>([
    {
      type: 'text',
      text: [
        'You are the blinded visual editor for AI Today Brief. Compare CARD X and CARD Y at realistic feed size.',
        `HEADLINE: ${row.headline}`,
        `CORE CLAIM THE IMAGE SHOULD ADD: ${claim.claim.coreClaim}`,
        `MECHANISM: ${claim.claim.mechanism}`,
        `OUTCOME: ${claim.claim.primaryOutcome}`,
        `APPROVED FACT LABELS: ${(claim.claim.approvedLabels ?? []).join(' | ') || 'none'}`,
        'The headline always supplies named product/company identity. Do not penalize an image merely because pixels alone omit the proper name.',
        'headline_pair_understood: headline + image communicates the core claim quickly.',
        'overlay_supported_by_pixels: any visible label/number is exact and supported by the depicted action; if the card has no overlay, set true unless generated text is misleading.',
        'thumbnail_readable: focal action and important labels survive this displayed size.',
        'misleading: the card implies a materially different mechanism, result or certainty than the source claim.',
        'Score 0-100: instant_meaning, visual_beauty, brand_consistency, originality. Apply editorial weights mentally: 45/30/15/10.',
        'Choose preferred X, Y or tie. Prefer the card that best combines immediate factual meaning and visual quality, not the one with more text.',
        'Return JSON only: {X:{headline_pair_understood,overlay_supported_by_pixels,thumbnail_readable,misleading,instant_meaning,visual_beauty,brand_consistency,originality,summary},Y:{same},preferred:"X"|"Y"|"tie",confidence:0..1,reason:string}.',
      ].join('\n'),
    },
    { type: 'text', text: 'CARD X' },
    await imagePart(resolve(ROOT, row.blindXCardPath)),
    { type: 'text', text: 'CARD Y' },
    await imagePart(resolve(ROOT, row.blindYCardPath)),
  ]);
  const preferredRaw = result.value.preferred;
  const preferred: BlindSide | 'tie' = preferredRaw === 'X' || preferredRaw === 'Y' ? preferredRaw : 'tie';
  return {
    verdict: {
      X: normalizePaired(result.value.X),
      Y: normalizePaired(result.value.Y),
      preferred,
      confidence: Math.min(1, Math.max(0, Number(result.value.confidence) || 0)),
      reason: typeof result.value.reason === 'string' ? result.value.reason.slice(0, 360) : '',
    },
    usage: result.usage,
  };
}

function mapSide<T>(order: { X: Source; Y: Source }, value: { X: T; Y: T }): Record<Source, T> {
  return order.X === 'current'
    ? { current: value.X, compiler: value.Y }
    : { current: value.Y, compiler: value.X };
}

function cardOrder(row: RenderManifestRow): { X: Source; Y: Source } {
  return { X: row.blindXSource, Y: row.blindYSource };
}

function preferenceSource(preferred: BlindSide | 'tie', order: { X: Source; Y: Source }): Source | 'tie' {
  return preferred === 'tie' ? 'tie' : order[preferred];
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percentage(value: number, total: number): string {
  return `${Math.round((value / Math.max(1, total)) * 100)}%`;
}

function mark(value: boolean): string {
  return value ? '✓' : '✕';
}

function report(rows: EvaluationRow[], usage: NonNullable<OpenRouterResponse['usage']>): string {
  const currentPixel = rows.filter((row) => row.current.pixelPass).length;
  const compilerPixel = rows.filter((row) => row.compiler.pixelPass).length;
  const currentFinal = rows.filter((row) => row.current.finalPass).length;
  const compilerFinal = rows.filter((row) => row.compiler.finalPass).length;
  const currentWins = rows.filter((row) => row.preferredSource === 'current').length;
  const compilerWins = rows.filter((row) => row.preferredSource === 'compiler').length;
  const ties = rows.filter((row) => row.preferredSource === 'tie').length;
  const lines = [
    '# Unseen 12-story current vs Visual Compiler evaluation',
    '',
    `Judge: \`${MODEL}\`; two bounded vision calls per story.`,
    '',
    '| Metric | Current | Compiler |',
    '|---|---:|---:|',
    `| Pixel semantic pass | ${currentPixel}/${rows.length} (${percentage(currentPixel, rows.length)}) | ${compilerPixel}/${rows.length} (${percentage(compilerPixel, rows.length)}) |`,
    `| Final headline-paired pass | ${currentFinal}/${rows.length} (${percentage(currentFinal, rows.length)}) | ${compilerFinal}/${rows.length} (${percentage(compilerFinal, rows.length)}) |`,
    `| Average weighted score | ${average(rows.map((row) => row.current.weightedScore)).toFixed(1)} | ${average(rows.map((row) => row.compiler.weightedScore)).toFixed(1)} |`,
    `| Generated-text-free pixels | ${rows.filter((row) => !row.current.pixel.generated_text_present).length}/${rows.length} | ${rows.filter((row) => !row.compiler.pixel.generated_text_present).length}/${rows.length} |`,
    '',
    `Blinded preference: compiler **${compilerWins}**, current **${currentWins}**, ties **${ties}**.`,
    `Compiler preference excluding ties: **${percentage(compilerWins, compilerWins + currentWins)}**.`,
    `Vision usage: ${usage.total_tokens ?? 0} tokens; reported cost $${(usage.cost ?? 0).toFixed(4)}.`,
    '',
    '| Week | # | Story | Format | Current pixel/final/score | Compiler pixel/final/score | Preferred | Reason |',
    '|---|---:|---|---|---|---|---|---|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.weekStart} | ${row.rank} | ${row.headline.replace(/\|/g, '\\|')} | \`${row.format}\` | ${mark(row.current.pixelPass)}/${mark(row.current.finalPass)}/${row.current.weightedScore.toFixed(1)} | ${mark(row.compiler.pixelPass)}/${mark(row.compiler.finalPass)}/${row.compiler.weightedScore.toFixed(1)} | **${row.preferredSource}** | ${row.reason.replace(/\|/g, '\\|')} |`,
    );
  }
  lines.push('', '## Failure details', '');
  for (const row of rows) {
    const failures: string[] = [];
    for (const source of ['current', 'compiler'] as const) {
      const item = row[source];
      const codes = [
        !item.pixel.mechanism_visible && 'mechanism',
        !item.pixel.outcome_visible && 'outcome',
        !item.pixel.causal_relation_visible && 'cause-effect',
        item.pixel.contradiction_visible && 'contradiction',
        item.pixel.generated_text_present && 'generated-text',
        !item.pixel.subject_consistent && 'consistency',
        !item.paired.headline_pair_understood && 'headline-pair',
        !item.paired.overlay_supported_by_pixels && 'overlay',
        !item.paired.thumbnail_readable && 'thumbnail',
        item.paired.misleading && 'misleading',
      ].filter(Boolean);
      if (codes.length) failures.push(`${source}: ${codes.join(', ')}`);
    }
    if (failures.length) lines.push(`- ${row.weekStart} #${row.rank}: ${failures.join(' | ')}`);
  }
  return `${lines.join('\n')}\n`;
}

async function evaluatedSheet(rows: EvaluationRow[], manifest: RenderManifestRow[]): Promise<Buffer> {
  const thumbW = 560;
  const cardH = 451;
  const margin = 28;
  const headerH = 80;
  const footerH = 64;
  const rowH = headerH + cardH + footerH + 26;
  const width = margin * 3 + thumbW * 2;
  const height = margin + rows.length * rowH;
  const layers: OverlayOptions[] = [];
  const svg = [
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`,
    '<rect width="100%" height="100%" fill="#03070D"/>',
  ];
  for (const [index, row] of rows.entries()) {
    const render = manifest.find((item) => item.storyId === row.storyId)!;
    const y = margin + index * rowH;
    const sources: Source[] = ['current', 'compiler'];
    for (const [column, source] of sources.entries()) {
      const x = margin + column * (thumbW + margin);
      const cardPath =
        source === render.blindXSource
          ? resolve(ROOT, render.blindXCardPath)
          : resolve(ROOT, render.blindYCardPath);
      const bytes = await sharp(cardPath).resize(thumbW, cardH, { fit: 'fill' }).png().toBuffer();
      layers.push({ input: bytes, left: x, top: y + headerH });
      const evaluation = row[source];
      const preferred = row.preferredSource === source;
      svg.push(
        `<text x="${x}" y="${y + 30}" font-family="DejaVu Sans,Arial,sans-serif" font-size="22" font-weight="900" fill="${preferred ? '#A7F3D0' : '#67E8F9'}">${source.toUpperCase()}${preferred ? ' • PREFERRED' : ''}</text>`,
        `<text x="${x}" y="${y + 61}" font-family="DejaVu Sans,Arial,sans-serif" font-size="16" font-weight="700" fill="#CFFAFE">pixel ${evaluation.pixelPass ? 'PASS' : 'FAIL'} • final ${evaluation.finalPass ? 'PASS' : 'FAIL'} • ${evaluation.weightedScore.toFixed(1)}</text>`,
      );
    }
    svg.push(
      `<text x="${margin}" y="${y + headerH + cardH + 35}" font-family="DejaVu Sans,Arial,sans-serif" font-size="15" fill="#94A3B8">${xml(row.reason.slice(0, 135))}</text>`,
    );
  }
  svg.push('</svg>');
  layers.push({ input: Buffer.from(svg.join('')), left: 0, top: 0 });
  return sharp({ create: { width, height, channels: 3, background: '#03070D' } })
    .composite(layers)
    .png()
    .toBuffer();
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function main() {
  assertEnvironment();
  await mkdir(ROOT, { recursive: true });
  const [manifest, selection] = await Promise.all([
    readFile(join(ROOT, 'render-manifest.json'), 'utf8').then(
      (value) => JSON.parse(value) as RenderManifestRow[],
    ),
    readFile(SELECTION_PATH, 'utf8').then((value) => JSON.parse(value) as SelectionRow[]),
  ]);
  if (manifest.length !== 12) throw new Error(`Expected 12 render rows; received ${manifest.length}.`);
  const claimById = new Map(
    selection.map((row) => [row.story.revision_item_id, row.autoClaim] as const),
  );
  const rows: EvaluationRow[] = [];
  let usage: NonNullable<OpenRouterResponse['usage']> = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    cost: 0,
  };

  for (const [index, render] of manifest.entries()) {
    const claim = claimById.get(render.storyId);
    if (!claim) throw new Error(`Missing claim for ${render.storyId}.`);
    console.log(`[holdout-eval] ${index + 1}/${manifest.length} pixels: ${render.headline}`);
    const pixelResult = await evaluatePixels(render, claim);
    console.log(`[holdout-eval] ${index + 1}/${manifest.length} cards`);
    const pairedResult = await evaluateCards(render, claim);
    for (const item of [pixelResult.usage, pairedResult.usage]) {
      usage = {
        prompt_tokens: (usage.prompt_tokens ?? 0) + (item?.prompt_tokens ?? 0),
        completion_tokens: (usage.completion_tokens ?? 0) + (item?.completion_tokens ?? 0),
        total_tokens: (usage.total_tokens ?? 0) + (item?.total_tokens ?? 0),
        cost: (usage.cost ?? 0) + (item?.cost ?? 0),
      };
    }
    const pixelBySource = mapSide(pixelResult.order, pixelResult.verdict);
    const order = cardOrder(render);
    const pairedBySource = mapSide(order, {
      X: pairedResult.verdict.X,
      Y: pairedResult.verdict.Y,
    });
    rows.push({
      storyId: render.storyId,
      weekStart: render.weekStart,
      rank: render.rank,
      headline: render.headline,
      format: render.format,
      renderMode: render.renderMode,
      current: sourceEvaluation(pixelBySource.current, pairedBySource.current),
      compiler: sourceEvaluation(pixelBySource.compiler, pairedBySource.compiler),
      blindPreferred: pairedResult.verdict.preferred,
      preferredSource: preferenceSource(pairedResult.verdict.preferred, order),
      confidence: pairedResult.verdict.confidence,
      reason: pairedResult.verdict.reason,
      pixelOrder: pixelResult.order,
      cardOrder: order,
    });
    await writeFile(
      join(ROOT, 'evaluation-progress.json'),
      `${JSON.stringify({ rows, usage }, null, 2)}\n`,
    );
  }

  const reportText = report(rows, usage);
  await Promise.all([
    writeFile(join(ROOT, 'evaluation.json'), `${JSON.stringify({ rows, usage }, null, 2)}\n`),
    writeFile(join(ROOT, 'evaluation-report.md'), reportText),
    writeFile(join(ROOT, 'evaluated-contact-sheet.png'), await evaluatedSheet(rows, manifest)),
  ]);
  console.log(reportText);
}

main().catch(async (error) => {
  await mkdir(ROOT, { recursive: true });
  await writeFile(
    join(ROOT, 'evaluation-failure.txt'),
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
  );
  console.error(error);
  process.exitCode = 1;
});
