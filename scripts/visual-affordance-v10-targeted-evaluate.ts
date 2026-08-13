import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import { weightedVisualScore } from '../src/lib/weekly-digest/visual-compiler';
import type { HoldoutStoryInput } from '../src/lib/weekly-digest/visual-auto-claim';
import type { AffordanceTreatmentV10 } from '../src/lib/weekly-digest/visual-affordance-treatment-v10';
import {
  evaluateVisualIntegrityV10,
  type VisualIntegrityObservationV10,
} from '../src/lib/weekly-digest/visual-integrity-v10';

const ROOT =
  process.env.VISUAL_V10_OUT_DIR?.trim() ||
  'artifacts/visual-affordance-v10-targeted';
const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY?.trim() || '';
const MODEL =
  process.env.VISUAL_V10_JUDGE_MODEL?.trim() || 'google/gemini-2.5-flash';

type Source = 'v8' | 'v10';
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
  treatment: AffordanceTreatmentV10;
  baselinePixelPath: string;
  baselineFinalPath: string;
  candidatePixelPath: string;
  candidateFinalPath: string;
  blindXCardPath: string;
  blindYCardPath: string;
  blindXSource: Source;
  blindYSource: Source;
  baseline: VariantAudit;
  candidate: VariantAudit;
}

interface BlindImageObservation {
  literalDescription: string;
  visibleObjects: string[];
  visibleActions: string[];
  visibleOutcomes: string[];
  generatedTextPresent: boolean;
  extraLimbVisible: boolean;
  unownedHandVisible: boolean;
  objectFusionVisible: boolean;
  impossibleInteractionVisible: boolean;
  beamPresent: boolean;
  beamSourceVisible: boolean;
  beamTargetVisible: boolean;
  beamPurposeClear: boolean;
  disconnectedPropVisible: boolean;
  brokenArrowVisible: boolean;
  directionUnambiguous: boolean;
  inputInvariantPreserved: boolean;
  systemInvariantPreserved: boolean;
  chartMetricDefined: boolean;
  coreActionVisible: boolean;
  outcomeVisible: boolean;
  causalRelationVisible: boolean;
  domainContextVisible: boolean;
}

interface CardVerdict {
  headlinePairUnderstood: boolean;
  sourceGrounded: boolean;
  certaintyPreserved: boolean;
  unsupportedSpecificVisible: boolean;
  mappingComplete: boolean;
  pixelActionSupportsClaim: boolean;
  pixelOutcomeSupportsClaim: boolean;
  pixelRelationSupportsClaim: boolean;
  domainContextSupported: boolean;
  inputInvariantSupported: boolean;
  systemInvariantSupported: boolean;
  beamPurposeSupportsClaim: boolean;
  labelsSupportedByPixels: boolean;
  labelsCarryClaim: boolean;
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
  blindObservation: BlindImageObservation;
  card: CardVerdict;
  integrityPassed: boolean;
  integrityBlockers: string[];
  headlinePairPassed: boolean;
  ownerApprovalRequired: true;
  automatedPublicationAllowed: false;
  weightedScore: number;
}

interface EvaluationRow {
  storyId: string;
  rank: number;
  headline: string;
  treatment: AffordanceTreatmentV10;
  v8: SourceEvaluation;
  v10: SourceEvaluation;
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
            'X-Title': 'AI Today Brief owner-grounded v10 visual evaluation',
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content }],
            temperature: 0,
            max_tokens: 2_200,
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
      const output = responseText(payload);
      if (!output) throw new Error('Judge returned no content.');
      return parseJson<T>(output);
    } catch (error) {
      lastError = error;
      console.warn(`[v10-eval] attempt ${attempt} failed`, error);
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

function strings(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function score(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
}

function normalizeBlindObservation(value: unknown): BlindImageObservation {
  const row = record(value);
  return {
    literalDescription: text(row.literal_description, 500),
    visibleObjects: strings(row.visible_objects, 10, 100),
    visibleActions: strings(row.visible_actions, 8, 120),
    visibleOutcomes: strings(row.visible_outcomes, 6, 120),
    generatedTextPresent: bool(row.generated_text_present),
    extraLimbVisible: bool(row.extra_limb_visible),
    unownedHandVisible: bool(row.unowned_hand_visible),
    objectFusionVisible: bool(row.object_fusion_visible),
    impossibleInteractionVisible: bool(row.impossible_interaction_visible),
    beamPresent: bool(row.beam_present),
    beamSourceVisible: bool(row.beam_source_visible),
    beamTargetVisible: bool(row.beam_target_visible),
    beamPurposeClear: bool(row.beam_purpose_clear),
    disconnectedPropVisible: bool(row.disconnected_prop_visible),
    brokenArrowVisible: bool(row.broken_arrow_visible),
    directionUnambiguous: bool(row.direction_unambiguous),
    inputInvariantPreserved: bool(row.input_invariant_preserved),
    systemInvariantPreserved: bool(row.system_invariant_preserved),
    chartMetricDefined: bool(row.chart_metric_defined),
    coreActionVisible: bool(row.core_action_visible),
    outcomeVisible: bool(row.outcome_visible),
    causalRelationVisible: bool(row.causal_relation_visible),
    domainContextVisible: bool(row.domain_context_visible),
  };
}

function normalizeCard(value: unknown): CardVerdict {
  const row = record(value);
  return {
    headlinePairUnderstood: bool(row.headline_pair_understood),
    sourceGrounded: bool(row.source_grounded),
    certaintyPreserved: bool(row.certainty_preserved),
    unsupportedSpecificVisible: bool(row.unsupported_specific_visible),
    mappingComplete: bool(row.mapping_complete),
    pixelActionSupportsClaim: bool(row.pixel_action_supports_claim),
    pixelOutcomeSupportsClaim: bool(row.pixel_outcome_supports_claim),
    pixelRelationSupportsClaim: bool(row.pixel_relation_supports_claim),
    domainContextSupported: bool(row.domain_context_supported),
    inputInvariantSupported: bool(row.input_invariant_supported),
    systemInvariantSupported: bool(row.system_invariant_supported),
    beamPurposeSupportsClaim: bool(row.beam_purpose_supports_claim),
    labelsSupportedByPixels: bool(row.labels_supported_by_pixels),
    labelsCarryClaim: bool(row.labels_carry_claim),
    thumbnailReadable: bool(row.thumbnail_readable),
    misleading: bool(row.misleading),
    instantMeaning: score(row.instant_meaning),
    visualBeauty: score(row.visual_beauty),
    brandConsistency: score(row.brand_consistency),
    originality: score(row.originality),
    summary: text(row.summary, 400),
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

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

async function observePixels(
  manifest: ManifestRow,
  usage: UsageTotals,
): Promise<{
  order: Record<Side, Source>;
  X: BlindImageObservation;
  Y: BlindImageObservation;
}> {
  const v10IsX = hash(`v10-pixels:${manifest.storyId}`) % 2 === 0;
  const order: Record<Side, Source> = v10IsX
    ? { X: 'v10', Y: 'v8' }
    : { X: 'v8', Y: 'v10' };
  const pathFor = (source: Source) =>
    resolve(
      ROOT,
      source === 'v10'
        ? manifest.candidatePixelPath
        : manifest.baselinePixelPath,
    );
  const raw = await callJudge<Record<string, unknown>>(
    [
      {
        type: 'text',
        text: [
          'Inspect IMAGE X and IMAGE Y using pixels only.',
          'You do not know the headline, story, intended meaning, labels, prompt or rendering method. Do not infer hidden intent.',
          'Describe literally what is visible and identify craft, anatomy, physics and diagram defects.',
          'For a beam or light path, mark source/target/purpose true only when each is visibly unambiguous in the pixels.',
          'For a comparison, input_invariant_preserved means the pixels visibly reuse one identical input; system_invariant_preserved means one identical system/actor is visibly reused. Do not use labels because labels are hidden.',
          'chart_metric_defined means the chart or meter has a visually interpretable quantity or operational state, not merely decorative curves.',
          'List only literal visible actions and outcomes. Do not decide whether they support the hidden story at this stage.',
          'Return JSON only: {"X":{literal_description:string,visible_objects:string[],visible_actions:string[],visible_outcomes:string[],generated_text_present:boolean,extra_limb_visible:boolean,unowned_hand_visible:boolean,object_fusion_visible:boolean,impossible_interaction_visible:boolean,beam_present:boolean,beam_source_visible:boolean,beam_target_visible:boolean,beam_purpose_clear:boolean,disconnected_prop_visible:boolean,broken_arrow_visible:boolean,direction_unambiguous:boolean,input_invariant_preserved:boolean,system_invariant_preserved:boolean,chart_metric_defined:boolean,core_action_visible:boolean,outcome_visible:boolean,causal_relation_visible:boolean,domain_context_visible:boolean},"Y":{same fields}}.',
        ].join('\n'),
      },
      await imagePart(pathFor(order.X)),
      await imagePart(pathFor(order.Y)),
    ],
    usage,
  );
  return {
    order,
    X: normalizeBlindObservation(raw.X),
    Y: normalizeBlindObservation(raw.Y),
  };
}

async function evaluateCards(
  manifest: ManifestRow,
  observations: Record<Source, BlindImageObservation>,
  usage: UsageTotals,
): Promise<CardComparison> {
  const raw = await callJudge<Record<string, unknown>>(
    [
      {
        type: 'text',
        text: [
          'Compare CARD X and CARD Y at real feed size. The same approved headline is visible on both cards.',
          sourceText(manifest.story),
          `TARGET VISUAL GRAMMAR: ${manifest.treatment.grammar}`,
          `OWNER-GROUNDED REQUIRED EVIDENCE: ${manifest.treatment.expectedEvidence.join('; ')}`,
          `HARD FORBIDDEN IMPLICATIONS: ${manifest.treatment.forbiddenImplications.join('; ')}`,
          `APPROVED LABELS: ${JSON.stringify(manifest.treatment.labels)}`,
          'The first-stage image-only observations were produced before the story was revealed:',
          `V8 observation: ${JSON.stringify(observations.v8)}`,
          `V10 observation: ${JSON.stringify(observations.v10)}`,
          'Do not excuse a defect merely because you understand the intended prompt. A label cannot rescue missing action, outcome or relation in the pixels.',
          'mapping_complete means the visible objects/actions/outcome map one-to-one to the approved source claim without unexplained props.',
          'pixel_action_supports_claim, pixel_outcome_supports_claim and pixel_relation_supports_claim must be grounded in the first-stage literal observation, not inferred from labels or the intended prompt.',
          'domain_context_supported means the pixels visibly anchor the real domain or human situation needed by this story.',
          'input_invariant_supported means the literal observation shows one identical input reused across compared runs; system_invariant_supported means one identical model, actor or chamber is reused. Judge these after the story reveals which invariants matter.',
          'beam_purpose_supports_claim means a visible beam or light has a source-grounded function once the story is known. Source and target still come only from the blind observation.',
          'labels_carry_claim is true when the central meaning would disappear after hiding the labels.',
          'unsupported_specific_visible is true when the image asserts a detail not supported by the approved story.',
          'For each card return headline_pair_understood, source_grounded, certainty_preserved, unsupported_specific_visible, mapping_complete, pixel_action_supports_claim, pixel_outcome_supports_claim, pixel_relation_supports_claim, domain_context_supported, input_invariant_supported, system_invariant_supported, beam_purpose_supports_claim, labels_supported_by_pixels, labels_carry_claim, thumbnail_readable, misleading, instant_meaning, visual_beauty, brand_consistency, originality and summary.',
          'All four numeric scores must be 0 to 100. Preference weights: instant meaning 45%, visual beauty 30%, brand consistency 15%, originality 10%; any misleading, anatomy, physics, broken-arrow or labels-only defect must outweigh beauty.',
          'Return JSON only: {"X":{headline_pair_understood:boolean,source_grounded:boolean,certainty_preserved:boolean,unsupported_specific_visible:boolean,mapping_complete:boolean,pixel_action_supports_claim:boolean,pixel_outcome_supports_claim:boolean,pixel_relation_supports_claim:boolean,domain_context_supported:boolean,input_invariant_supported:boolean,system_invariant_supported:boolean,beam_purpose_supports_claim:boolean,labels_supported_by_pixels:boolean,labels_carry_claim:boolean,thumbnail_readable:boolean,misleading:boolean,instant_meaning:number,visual_beauty:number,brand_consistency:number,originality:number,summary:string},"Y":{same fields},"preferred":"X"|"Y"|"tie","confidence":number,"reason":string}.',
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
    reason: text(raw.reason, 900),
  };
}

function combinedObservation(
  blind: BlindImageObservation,
  card: CardVerdict,
): VisualIntegrityObservationV10 {
  return {
    generatedTextPresent: blind.generatedTextPresent,
    extraLimbVisible: blind.extraLimbVisible,
    unownedHandVisible: blind.unownedHandVisible,
    objectFusionVisible: blind.objectFusionVisible,
    impossibleInteractionVisible: blind.impossibleInteractionVisible,
    beamPresent: blind.beamPresent,
    beamSourceVisible: blind.beamSourceVisible,
    beamTargetVisible: blind.beamTargetVisible,
    beamPurposeClear: card.beamPurposeSupportsClaim,
    disconnectedPropVisible: blind.disconnectedPropVisible,
    brokenArrowVisible: blind.brokenArrowVisible,
    directionUnambiguous: blind.directionUnambiguous,
    inputInvariantPreserved: card.inputInvariantSupported,
    systemInvariantPreserved: card.systemInvariantSupported,
    chartMetricDefined: blind.chartMetricDefined,
    labelsCarryClaim: card.labelsCarryClaim,
    mappingComplete: card.mappingComplete,
    coreActionVisible: card.pixelActionSupportsClaim,
    outcomeVisible: card.pixelOutcomeSupportsClaim,
    causalRelationVisible: card.pixelRelationSupportsClaim,
    domainContextVisible: card.domainContextSupported,
    unsupportedSpecificVisible: card.unsupportedSpecificVisible,
    certaintyPreserved: card.certaintyPreserved,
  };
}

function sourceEvaluation(
  manifest: ManifestRow,
  blind: BlindImageObservation,
  card: CardVerdict,
): SourceEvaluation {
  const integrity = evaluateVisualIntegrityV10(
    manifest.treatment.grammar,
    combinedObservation(blind, card),
  );
  const headlinePairPassed =
    card.headlinePairUnderstood &&
    card.sourceGrounded &&
    card.certaintyPreserved &&
    card.pixelActionSupportsClaim &&
    card.pixelOutcomeSupportsClaim &&
    card.pixelRelationSupportsClaim &&
    card.labelsSupportedByPixels &&
    card.thumbnailReadable &&
    !card.misleading;
  return {
    blindObservation: blind,
    card,
    integrityPassed: integrity.passed,
    integrityBlockers: integrity.blockers,
    headlinePairPassed,
    ownerApprovalRequired: true,
    automatedPublicationAllowed: false,
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

function wrap(value: string, max = 150): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

async function evaluatedSheet(
  rows: EvaluationRow[],
): Promise<Buffer> {
  const cardW = 540;
  const cardH = 433;
  const margin = 28;
  const headerH = 76;
  const footerH = 116;
  const rowGap = 34;
  const rowH = headerH + cardH + footerH + rowGap;
  const width = margin * 3 + cardW * 2;
  const height = margin + rows.length * rowH;
  const layers: OverlayOptions[] = [];
  const textParts = [
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`,
  ];
  for (const [index, row] of rows.entries()) {
    const y = margin + index * rowH;
    const entries: Array<{
      source: Source;
      path: string;
      evaluation: SourceEvaluation;
      x: number;
    }> = [
      {
        source: 'v8',
        path: join(ROOT, 'cards', `${row.rank}-${row.storyId}-v8.png`),
        evaluation: row.v8,
        x: margin,
      },
      {
        source: 'v10',
        path: join(ROOT, 'cards', `${row.rank}-${row.storyId}-v10.png`),
        evaluation: row.v10,
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
        `<text x="${entry.x}" y="${y + 28}" font-family="DejaVu Sans,Arial,sans-serif" font-size="22" font-weight="900" fill="${preferred ? '#34D399' : '#67E8F9'}">${entry.source.toUpperCase()}${preferred ? ' • PREFERRED' : ''}</text>`,
        `<text x="${entry.x}" y="${y + 56}" font-family="DejaVu Sans,Arial,sans-serif" font-size="14" font-weight="700" fill="#CFFAFE">integrity ${entry.evaluation.integrityPassed ? 'PASS' : 'FAIL'} • headline ${entry.evaluation.headlinePairPassed ? 'PASS' : 'FAIL'} • ${entry.evaluation.weightedScore.toFixed(1)} • OWNER REVIEW</text>`,
      );
    }
    const footerY = y + headerH + cardH + 28;
    textParts.push(
      `<text x="${margin}" y="${footerY}" font-family="DejaVu Sans,Arial,sans-serif" font-size="15" font-weight="800" fill="#ECFEFF">${xml(wrap(row.headline, 110))}</text>`,
      `<text x="${margin}" y="${footerY + 26}" font-family="DejaVu Sans,Arial,sans-serif" font-size="13" fill="#94A3B8">${xml(wrap(`${row.treatment.kind} • ${row.treatment.grammar} • preferred ${row.preferredSource}`, 170))}</text>`,
      `<text x="${margin}" y="${footerY + 50}" font-family="DejaVu Sans,Arial,sans-serif" font-size="13" fill="#94A3B8">${xml(wrap(`V8 blockers: ${row.v8.integrityBlockers.join(', ') || 'none'} | V10 blockers: ${row.v10.integrityBlockers.join(', ') || 'none'}`, 185))}</text>`,
      `<text x="${margin}" y="${footerY + 74}" font-family="DejaVu Sans,Arial,sans-serif" font-size="13" fill="#94A3B8">${xml(wrap(row.reason, 185))}</text>`,
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
  const v8Integrity = rows.filter((row) => row.v8.integrityPassed).length;
  const v10Integrity = rows.filter((row) => row.v10.integrityPassed).length;
  const v8Headline = rows.filter((row) => row.v8.headlinePairPassed).length;
  const v10Headline = rows.filter((row) => row.v10.headlinePairPassed).length;
  const v8Average =
    rows.reduce((sum, row) => sum + row.v8.weightedScore, 0) / total;
  const v10Average =
    rows.reduce((sum, row) => sum + row.v10.weightedScore, 0) / total;
  const v8Wins = rows.filter((row) => row.preferredSource === 'v8').length;
  const v10Wins = rows.filter((row) => row.preferredSource === 'v10').length;
  const ties = rows.filter((row) => row.preferredSource === 'tie').length;
  const decided = v8Wins + v10Wins;
  const lines = [
    '# Visual Affordance v10 targeted evaluation — owner review required',
    '',
    `Stories: **${total}**; judge: \`${MODEL}\`; first-stage observation was image-only and intent-blind.`,
    '',
    '| Metric | V8 baseline | V10 candidate |',
    '|---|---:|---:|',
    `| Hard visual integrity pass | ${v8Integrity}/${total} (${percent(v8Integrity, total)}) | ${v10Integrity}/${total} (${percent(v10Integrity, total)}) |`,
    `| Headline-paired grounded pass | ${v8Headline}/${total} (${percent(v8Headline, total)}) | ${v10Headline}/${total} (${percent(v10Headline, total)}) |`,
    `| Average weighted score | ${v8Average.toFixed(1)} | ${v10Average.toFixed(1)} |`,
    '',
    `Blinded preference: V10 **${v10Wins}**, V8 **${v8Wins}**, ties **${ties}**.`,
    `V10 preference excluding ties: **${percent(v10Wins, decided)}**.`,
    `Vision calls: ${usage.calls}; tokens: ${usage.totalTokens}; reported cost: $${usage.costUsd.toFixed(4)}.`,
    '',
    '**No automated production pass is emitted. Every candidate requires owner approval.**',
    '',
    '| # | Story | Treatment | V8 integrity/headline/score | V10 integrity/headline/score | Preferred | V10 blockers |',
    '|---:|---|---|---|---|---|---|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.rank} | ${row.headline.replace(/\|/g, '\\|')} | \`${row.treatment.kind}\` | ${row.v8.integrityPassed ? '✓' : '✕'}/${row.v8.headlinePairPassed ? '✓' : '✕'}/${row.v8.weightedScore.toFixed(1)} | ${row.v10.integrityPassed ? '✓' : '✕'}/${row.v10.headlinePairPassed ? '✓' : '✕'}/${row.v10.weightedScore.toFixed(1)} | **${row.preferredSource}** | ${row.v10.integrityBlockers.join(', ') || 'none'} |`,
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
    console.log(`[v10-eval] ${index + 1}/${manifests.length} image-only observation: ${manifest.headline}`);
    const blind = await observePixels(manifest, usage);
    const blindBySource = {
      [blind.order.X]: blind.X,
      [blind.order.Y]: blind.Y,
    } as Record<Source, BlindImageObservation>;
    console.log(`[v10-eval] ${index + 1}/${manifests.length} headline-paired comparison`);
    const cards = await evaluateCards(manifest, blindBySource, usage);
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
      v8: sourceEvaluation(
        manifest,
        blindBySource.v8,
        cardBySource.v8,
      ),
      v10: sourceEvaluation(
        manifest,
        blindBySource.v10,
        cardBySource.v10,
      ),
      preferredSource,
      confidence: cards.confidence,
      reason: cards.reason,
      pixelOrder: blind.order,
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
      await evaluatedSheet(rows),
    ),
  ]);
  console.log(markdown);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
