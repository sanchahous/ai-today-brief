import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import { weightedVisualScore } from '../src/lib/weekly-digest/visual-compiler';
import type { HoldoutStoryInput } from '../src/lib/weekly-digest/visual-auto-claim';
import type { SpecializedVisualTreatmentV8 } from '../src/lib/weekly-digest/visual-specialized-v8';

const ROOT =
  process.env.VISUAL_V8_OUT_DIR?.trim() ||
  'artifacts/visual-compiler-v8-targeted';
const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY?.trim() || '';
const MODEL =
  process.env.VISUAL_V8_JUDGE_MODEL?.trim() || 'google/gemini-2.5-flash';

type Source = 'current' | 'v8';
type Side = 'X' | 'Y';

interface VariantAudit {
  provider: string;
  model: string;
  imageCalls: number;
  estimatedImageCostUsd: number;
  durationMs: number;
}

interface ManifestRow {
  storyId: string;
  rank: number;
  headline: string;
  story: HoldoutStoryInput;
  treatment: SpecializedVisualTreatmentV8;
  baselineImagePath: string;
  candidatePixelPath: string;
  candidateFinalPath: string;
  blindXCardPath: string;
  blindYCardPath: string;
  blindXSource: Source;
  blindYSource: Source;
  current: VariantAudit;
  candidate: VariantAudit;
}

interface PixelVerdict {
  sourceGrounded: boolean;
  requiredEvidenceVisible: boolean;
  outcomeVisible: boolean;
  relationVisible: boolean;
  contradictionVisible: boolean;
  unsupportedSpecificsVisible: boolean;
  generatedTextPresent: boolean;
  subjectConsistent: boolean;
  evidence: string;
  ambiguity: string;
}

interface CardVerdict {
  headlinePairUnderstood: boolean;
  centralClaimGrounded: boolean;
  certaintyPreserved: boolean;
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

interface CardComparison {
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
  productionPass: boolean;
  weightedScore: number;
}

interface EvaluationRow {
  storyId: string;
  rank: number;
  headline: string;
  treatment: SpecializedVisualTreatmentV8;
  current: SourceEvaluation;
  v8: SourceEvaluation;
  preferredSource: Source | 'tie';
  confidence: number;
  reason: string;
  pixelOrder: Record<Side, Source>;
  cardOrder: Record<Side, Source>;
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: { content?: string | Array<{ text?: string }> };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
}

interface UsageTotals {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  calls: number;
}

function assertEnvironment() {
  if (!OPEN_ROUTER_API_KEY) throw new Error('OPEN_ROUTER_API_KEY is required.');
}

function emptyUsage(): UsageTotals {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    calls: 0,
  };
}

function addUsage(total: UsageTotals, usage: OpenRouterResponse['usage']) {
  total.promptTokens += usage?.prompt_tokens ?? 0;
  total.completionTokens += usage?.completion_tokens ?? 0;
  total.totalTokens += usage?.total_tokens ?? 0;
  total.costUsd += usage?.cost ?? 0;
  total.calls += 1;
}

function responseText(value: OpenRouterResponse): string {
  const content = value.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content.map((part) => part.text ?? '').join('');
  }
  return typeof content === 'string' ? content : '';
}

function parseJson<T>(value: string): T {
  const clean = value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  try {
    return JSON.parse(clean) as T;
  } catch {
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(clean.slice(start, end + 1)) as T;
    }
    throw new Error(`Invalid judge JSON: ${clean.slice(0, 600)}`);
  }
}

async function callJudge<T>(
  content: Array<Record<string, unknown>>,
  usage: UsageTotals,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPEN_ROUTER_API_KEY}`,
            'content-type': 'application/json',
            'HTTP-Referer': 'https://aitodaybrief.com',
            'X-Title': 'AI Today Brief v8 specialized visual evaluation',
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content }],
            temperature: 0,
            max_tokens: 1_700,
            response_format: { type: 'json_object' },
          }),
          signal: AbortSignal.timeout(150_000),
        },
      );
      if (!response.ok) {
        throw new Error(
          `OpenRouter ${response.status}: ${(await response.text()).slice(0, 900)}`,
        );
      }
      const payload = (await response.json()) as OpenRouterResponse;
      addUsage(usage, payload.usage);
      const text = responseText(payload);
      if (!text) throw new Error('Judge returned no content.');
      return parseJson<T>(text);
    } catch (error) {
      lastError = error;
      console.warn(`[v8-eval] attempt ${attempt} failed`, error);
      await new Promise((resolvePromise) =>
        setTimeout(resolvePromise, attempt * 1_500),
      );
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function bool(value: unknown): boolean {
  return value === true;
}

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function score(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
}

function normalizePixel(value: unknown): PixelVerdict {
  const row = record(value);
  return {
    sourceGrounded: bool(row.source_grounded),
    requiredEvidenceVisible: bool(row.required_evidence_visible),
    outcomeVisible: bool(row.outcome_visible),
    relationVisible: bool(row.relation_visible),
    contradictionVisible: bool(row.contradiction_visible),
    unsupportedSpecificsVisible: bool(row.unsupported_specifics_visible),
    generatedTextPresent: bool(row.generated_text_present),
    subjectConsistent: bool(row.subject_consistent),
    evidence: text(row.evidence, 320),
    ambiguity: text(row.ambiguity, 260),
  };
}

function normalizeCard(value: unknown): CardVerdict {
  const row = record(value);
  return {
    headlinePairUnderstood: bool(row.headline_pair_understood),
    centralClaimGrounded: bool(row.central_claim_grounded),
    certaintyPreserved: bool(row.certainty_preserved),
    labelsExact: bool(row.labels_exact),
    overlaySupportedByPixels: bool(row.overlay_supported_by_pixels),
    thumbnailReadable: bool(row.thumbnail_readable),
    misleading: bool(row.misleading),
    instantMeaning: score(row.instant_meaning),
    visualBeauty: score(row.visual_beauty),
    brandConsistency: score(row.brand_consistency),
    originality: score(row.originality),
    summary: text(row.summary, 320),
  };
}

function sourceText(story: HoldoutStoryInput): string {
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

function seed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function imagePart(path: string): Promise<Record<string, unknown>> {
  const bytes = await sharp(path)
    .resize(720, 560, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 84 })
    .toBuffer();
  return {
    type: 'image_url',
    image_url: {
      url: `data:image/jpeg;base64,${bytes.toString('base64')}`,
    },
  };
}

async function evaluatePixels(
  manifest: ManifestRow,
  usage: UsageTotals,
): Promise<{
  order: Record<Side, Source>;
  X: PixelVerdict;
  Y: PixelVerdict;
}> {
  const v8IsX = seed(`v8-pixels:${manifest.storyId}`) % 2 === 0;
  const order: Record<Side, Source> = v8IsX
    ? { X: 'v8', Y: 'current' }
    : { X: 'current', Y: 'v8' };
  const path = (source: Source) =>
    resolve(
      ROOT,
      source === 'v8'
        ? manifest.candidatePixelPath
        : manifest.baselineImagePath,
    );
  const raw = await callJudge<Record<string, unknown>>(
    [
      {
        type: 'text',
        text: [
          'Compare IMAGE X and IMAGE Y using pixels only. Headline, labels, prompts and rendering methods are hidden.',
          'The approved story below is the only factual ground truth.',
          sourceText(manifest.story),
          `SPECIALIZED VISUAL ROLE: ${manifest.treatment.kind}`,
          `SOURCE GROUNDING: ${manifest.treatment.sourceGrounding}`,
          `REQUIRED VISIBLE EVIDENCE: ${manifest.treatment.expectedEvidence.join('; ')}`,
          `FORBIDDEN IMPLICATIONS: ${manifest.treatment.forbiddenImplications.join('; ')}`,
          'For each image assess source_grounded, required_evidence_visible, outcome_visible, relation_visible, contradiction_visible, unsupported_specifics_visible, generated_text_present, subject_consistent, evidence and ambiguity.',
          'Do not reward beauty for missing evidence. Do not require a company logo or readable UI. A physical editorial analogy may pass only when its visible action and outcome map one-to-one to the approved story.',
          'Return JSON only: {"X":{source_grounded:boolean,required_evidence_visible:boolean,outcome_visible:boolean,relation_visible:boolean,contradiction_visible:boolean,unsupported_specifics_visible:boolean,generated_text_present:boolean,subject_consistent:boolean,evidence:string,ambiguity:string},"Y":{same fields}}.',
        ].join('\n'),
      },
      await imagePart(path(order.X)),
      await imagePart(path(order.Y)),
    ],
    usage,
  );
  return {
    order,
    X: normalizePixel(raw.X),
    Y: normalizePixel(raw.Y),
  };
}

async function evaluateCards(
  manifest: ManifestRow,
  usage: UsageTotals,
): Promise<CardComparison> {
  const raw = await callJudge<Record<string, unknown>>(
    [
      {
        type: 'text',
        text: [
          'Compare CARD X and CARD Y as actual AI Today Brief feed cards. The same approved headline is visible on both cards.',
          'The headline supplies named identity. The image should make one core claim easier to understand in roughly three seconds.',
          sourceText(manifest.story),
          `SPECIALIZED VISUAL ROLE: ${manifest.treatment.kind}`,
          `SOURCE GROUNDING: ${manifest.treatment.sourceGrounding}`,
          `REQUIRED VISIBLE EVIDENCE: ${manifest.treatment.expectedEvidence.join('; ')}`,
          `FORBIDDEN IMPLICATIONS: ${manifest.treatment.forbiddenImplications.join('; ')}`,
          `ONLY APPROVED OVERLAY LABELS FOR THE V8 TREATMENT: ${JSON.stringify(manifest.treatment.labels)}`,
          'For each card assess headline_pair_understood, central_claim_grounded, certainty_preserved, labels_exact, overlay_supported_by_pixels, thumbnail_readable, misleading, instant_meaning, visual_beauty, brand_consistency, originality and summary.',
          'Weights for preference: instant meaning 45%, visual beauty 30%, brand consistency 15%, originality 10%, but any misleading or unsupported card must lose regardless of weighted beauty.',
          'Return JSON only: {"X":{headline_pair_understood:boolean,central_claim_grounded:boolean,certainty_preserved:boolean,labels_exact:boolean,overlay_supported_by_pixels:boolean,thumbnail_readable:boolean,misleading:boolean,instant_meaning:number,visual_beauty:number,brand_consistency:number,originality:number,summary:string},"Y":{same fields},"preferred":"X"|"Y"|"tie","confidence":number,"reason":string}.',
        ].join('\n'),
      },
      await imagePart(resolve(ROOT, manifest.blindXCardPath)),
      await imagePart(resolve(ROOT, manifest.blindYCardPath)),
    ],
    usage,
  );
  const preferredRaw = text(raw.preferred, 10).toUpperCase();
  return {
    X: normalizeCard(raw.X),
    Y: normalizeCard(raw.Y),
    preferred:
      preferredRaw === 'X' || preferredRaw === 'Y'
        ? preferredRaw
        : 'tie',
    confidence: score(raw.confidence),
    reason: text(raw.reason, 700),
  };
}

function pixelPass(value: PixelVerdict): boolean {
  return (
    value.sourceGrounded &&
    value.requiredEvidenceVisible &&
    value.outcomeVisible &&
    value.relationVisible &&
    !value.contradictionVisible &&
    !value.unsupportedSpecificsVisible &&
    !value.generatedTextPresent &&
    value.subjectConsistent
  );
}

function productionPass(
  pixel: PixelVerdict,
  card: CardVerdict,
): boolean {
  return (
    pixelPass(pixel) &&
    card.headlinePairUnderstood &&
    card.centralClaimGrounded &&
    card.certaintyPreserved &&
    card.labelsExact &&
    card.overlaySupportedByPixels &&
    card.thumbnailReadable &&
    !card.misleading
  );
}

function sourceEvaluation(
  pixel: PixelVerdict,
  card: CardVerdict,
): SourceEvaluation {
  return {
    pixel,
    card,
    pixelPass: pixelPass(pixel),
    productionPass: productionPass(pixel, card),
    weightedScore: weightedVisualScore({
      instantMeaning: card.instantMeaning,
      visualBeauty: card.visualBeauty,
      brandConsistency: card.brandConsistency,
      originality: card.originality,
    }),
  };
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function evaluatedSheet(
  rows: EvaluationRow[],
  manifests: ManifestRow[],
): Promise<Buffer> {
  const cardW = 520;
  const cardH = 418;
  const margin = 28;
  const headerH = 76;
  const footerH = 92;
  const rowGap = 34;
  const rowH = headerH + cardH + footerH + rowGap;
  const width = margin * 3 + cardW * 2;
  const height = margin + rows.length * rowH;
  const layers: OverlayOptions[] = [];
  const textParts = [
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`,
  ];
  for (const [index, row] of rows.entries()) {
    const manifest = manifests.find((candidate) => candidate.storyId === row.storyId)!;
    const y = margin + index * rowH;
    const entries: Array<{
      source: Source;
      path: string;
      evaluation: SourceEvaluation;
      x: number;
    }> = [
      {
        source: 'current',
        path: join(ROOT, 'cards', `${row.rank}-${row.storyId}-current.png`),
        evaluation: row.current,
        x: margin,
      },
      {
        source: 'v8',
        path: join(ROOT, 'cards', `${row.rank}-${row.storyId}-v8.png`),
        evaluation: row.v8,
        x: margin * 2 + cardW,
      },
    ];
    for (const entry of entries) {
      const preferred = row.preferredSource === entry.source;
      const card = await sharp(entry.path)
        .resize(cardW, cardH, { fit: 'fill' })
        .png()
        .toBuffer();
      layers.push({ input: card, left: entry.x, top: y + headerH });
      textParts.push(
        `<text x="${entry.x}" y="${y + 28}" font-family="DejaVu Sans,Arial,sans-serif" font-size="22" font-weight="900" fill="${preferred ? '#34D399' : '#67E8F9'}">${entry.source === 'current' ? 'CURRENT' : 'V8 SPECIALIZED'}${preferred ? ' • PREFERRED' : ''}</text>`,
        `<text x="${entry.x}" y="${y + 56}" font-family="DejaVu Sans,Arial,sans-serif" font-size="15" font-weight="700" fill="#CFFAFE">pixel ${entry.evaluation.pixelPass ? 'PASS' : 'FAIL'} • production ${entry.evaluation.productionPass ? 'PASS' : 'FAIL'} • ${entry.evaluation.weightedScore.toFixed(1)}</text>`,
      );
    }
    const footerY = y + headerH + cardH + 30;
    textParts.push(
      `<text x="${margin}" y="${footerY}" font-family="DejaVu Sans,Arial,sans-serif" font-size="15" font-weight="700" fill="#ECFEFF">${xml(row.headline.slice(0, 110))}</text>`,
      `<text x="${margin}" y="${footerY + 26}" font-family="DejaVu Sans,Arial,sans-serif" font-size="13" fill="#94A3B8">${xml(`${manifest.treatment.kind} • preferred ${row.preferredSource} • ${row.reason}`.slice(0, 175))}</text>`,
    );
  }
  textParts.push('</svg>');
  return sharp({
    create: { width, height, channels: 3, background: '#03070D' },
  })
    .composite([
      ...layers,
      { input: Buffer.from(textParts.join('')), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

function percent(value: number, total: number): string {
  return total ? `${Math.round((value / total) * 100)}%` : '0%';
}

function report(rows: EvaluationRow[], usage: UsageTotals): string {
  const total = rows.length;
  const currentPixel = rows.filter((row) => row.current.pixelPass).length;
  const v8Pixel = rows.filter((row) => row.v8.pixelPass).length;
  const currentProduction = rows.filter(
    (row) => row.current.productionPass,
  ).length;
  const v8Production = rows.filter((row) => row.v8.productionPass).length;
  const currentAverage =
    rows.reduce((sum, row) => sum + row.current.weightedScore, 0) / total;
  const v8Average =
    rows.reduce((sum, row) => sum + row.v8.weightedScore, 0) / total;
  const currentWins = rows.filter(
    (row) => row.preferredSource === 'current',
  ).length;
  const v8Wins = rows.filter((row) => row.preferredSource === 'v8').length;
  const ties = rows.filter((row) => row.preferredSource === 'tie').length;
  const decided = currentWins + v8Wins;
  const lines = [
    '# Visual Compiler v8 targeted specialized evaluation',
    '',
    `Stories: **${total}**; judge: \`${MODEL}\`; two blinded vision calls per story.`,
    '',
    '| Metric | Current | V8 specialized |',
    '|---|---:|---:|',
    `| Pixel semantic pass | ${currentPixel}/${total} (${percent(currentPixel, total)}) | ${v8Pixel}/${total} (${percent(v8Pixel, total)}) |`,
    `| Production pass | ${currentProduction}/${total} (${percent(currentProduction, total)}) | ${v8Production}/${total} (${percent(v8Production, total)}) |`,
    `| Average weighted score | ${currentAverage.toFixed(1)} | ${v8Average.toFixed(1)} |`,
    '',
    `Blinded preference: V8 **${v8Wins}**, current **${currentWins}**, ties **${ties}**.`,
    `V8 preference excluding ties: **${percent(v8Wins, decided)}**.`,
    `Vision calls: ${usage.calls}; tokens: ${usage.totalTokens}; reported cost: $${usage.costUsd.toFixed(4)}.`,
    '',
    '| # | Story | Treatment | Current P/Prod/Score | V8 P/Prod/Score | Preferred | Reason |',
    '|---:|---|---|---|---|---|---|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.rank} | ${row.headline.replace(/\|/g, '\\|')} | \`${row.treatment.kind}\` | ${row.current.pixelPass ? '✓' : '✕'}/${row.current.productionPass ? '✓' : '✕'}/${row.current.weightedScore.toFixed(1)} | ${row.v8.pixelPass ? '✓' : '✕'}/${row.v8.productionPass ? '✓' : '✕'}/${row.v8.weightedScore.toFixed(1)} | **${row.preferredSource}** | ${row.reason.replace(/\|/g, '\\|')} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  assertEnvironment();
  const manifests = JSON.parse(
    await readFile(join(ROOT, 'render-manifest.json'), 'utf8'),
  ) as ManifestRow[];
  const usage = emptyUsage();
  const rows: EvaluationRow[] = [];

  for (const [index, manifest] of manifests.entries()) {
    console.log(
      `[v8-eval] ${index + 1}/${manifests.length} pixels: ${manifest.headline}`,
    );
    const pixels = await evaluatePixels(manifest, usage);
    console.log(`[v8-eval] ${index + 1}/${manifests.length} cards`);
    const cards = await evaluateCards(manifest, usage);
    const pixelBySource = {
      [pixels.order.X]: pixels.X,
      [pixels.order.Y]: pixels.Y,
    } as Record<Source, PixelVerdict>;
    const cardOrder: Record<Side, Source> = {
      X: manifest.blindXSource,
      Y: manifest.blindYSource,
    };
    const cardBySource = {
      [cardOrder.X]: cards.X,
      [cardOrder.Y]: cards.Y,
    } as Record<Source, CardVerdict>;
    const preferredSource: Source | 'tie' =
      cards.preferred === 'tie' ? 'tie' : cardOrder[cards.preferred];
    rows.push({
      storyId: manifest.storyId,
      rank: manifest.rank,
      headline: manifest.headline,
      treatment: manifest.treatment,
      current: sourceEvaluation(pixelBySource.current, cardBySource.current),
      v8: sourceEvaluation(pixelBySource.v8, cardBySource.v8),
      preferredSource,
      confidence: cards.confidence,
      reason: cards.reason,
      pixelOrder: pixels.order,
      cardOrder,
    });
    await writeFile(
      join(ROOT, 'evaluation-progress.json'),
      `${JSON.stringify({ rows, usage }, null, 2)}\n`,
    );
  }

  const markdown = report(rows, usage);
  await Promise.all([
    writeFile(
      join(ROOT, 'evaluation.json'),
      `${JSON.stringify({ rows, usage }, null, 2)}\n`,
    ),
    writeFile(join(ROOT, 'evaluation-report.md'), markdown),
    writeFile(
      join(ROOT, 'evaluated-contact-sheet.png'),
      await evaluatedSheet(rows, manifests),
    ),
  ]);
  console.log(markdown);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
