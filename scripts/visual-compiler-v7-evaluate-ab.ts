import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import { weightedVisualScore, type VisualQualityScores } from '../src/lib/weekly-digest/visual-compiler';
import type {
  AutoVisualClaimV5,
  VisualExplanatoryRole,
  VisualMappingMode,
} from '../src/lib/weekly-digest/visual-auto-claim-v5';
import type { HoldoutStoryInput } from '../src/lib/weekly-digest/visual-auto-claim';

const ROOT =
  process.env.VISUAL_V7_AB_OUT_DIR?.trim() || 'artifacts/visual-compiler-v7-fresh-ab';
const CLAIMS_PATH =
  process.env.VISUAL_V7_ROUTED_CLAIMS?.trim() ||
  'experiments/visual-compiler-v7/fresh-holdout/output/v7-routed-claims.json';
const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY?.trim() || '';
const MODEL =
  process.env.VISUAL_V5_JUDGE_MODEL?.trim() || 'google/gemini-2.5-flash';

type Source = 'current' | 'compiler';
type Side = 'X' | 'Y';

interface ClaimAudit {
  storyId: string;
  passed: boolean;
  issues: string[];
  rationale: string;
}

interface ClaimRecord {
  story: HoldoutStoryInput;
  autoClaim: AutoVisualClaimV5;
  plan: { overlays: Array<{ text: string }> };
  finalAudit: ClaimAudit;
  repaired: boolean;
eligible: boolean;
router: {
  pipeline: 'current_art_director' | 'deterministic_compiler' | 'source_led_fallback';
  expectedImageCalls: 0 | 1;
  reason: string;
};
}

interface ManifestRow {
  storyId: string;
  rank: number;
  headline: string;
  role: VisualExplanatoryRole;
  certainty: string;
  mappingMode: VisualMappingMode;
  format: string;
  renderMode: string;
  claimEligible: boolean;
  baselineImagePath: string;
  compilerPixelPath: string;
  compilerFinalPath: string;
  blindXCardPath: string;
  blindYCardPath: string;
  blindXSource: Source;
  blindYSource: Source;
  current: { imageCalls: number; estimatedImageCostUsd: number; durationMs: number };
  compiler: { imageCalls: number; estimatedImageCostUsd: number; durationMs: number };
}

interface PixelVerdict {
  sourceContextSupported: boolean;
  roleEvidenceVisible: boolean;
  outcomeVisible: boolean;
  relationVisible: boolean;
  directionOrStateCorrect: boolean;
  contradictionVisible: boolean;
  unsupportedSpecificsVisible: boolean;
  generatedTextPresent: boolean;
  subjectConsistent: boolean;
  analogyMappingValid: boolean;
  roleEvidence: string;
  outcomeEvidence: string;
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
  visualPass: boolean;
  safePass: boolean;
  productionPass: boolean;
  weightedScore: number;
}

interface EvaluationRow {
  storyId: string;
  rank: number;
  headline: string;
  role: VisualExplanatoryRole;
  certainty: string;
  mappingMode: VisualMappingMode;
  format: string;
  renderMode: string;
  claimEligible: boolean;
  claimAudit: ClaimAudit;
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
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, calls: 0 };
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
    throw new Error(`Invalid judge JSON: ${clean.slice(0, 600)}`);
  }
}

async function callJudge<T>(content: Array<Record<string, unknown>>, usage: UsageTotals): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPEN_ROUTER_API_KEY}`,
          'content-type': 'application/json',
          'HTTP-Referer': 'https://aitodaybrief.com',
          'X-Title': 'AI Today Brief v7 route-aware visual evaluation',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content }],
          temperature: 0,
          max_tokens: 1_800,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(150_000),
      });
      if (!response.ok) {
        throw new Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 900)}`);
      }
      const payload = (await response.json()) as OpenRouterResponse;
      addUsage(usage, payload.usage);
      const text = responseText(payload);
      if (!text) throw new Error('Judge returned no content.');
      return parseJson<T>(text);
    } catch (error) {
      lastError = error;
      console.warn(`[v7-eval] attempt ${attempt} failed`, error);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 1_500));
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
    sourceContextSupported: bool(row.source_context_supported),
    roleEvidenceVisible: bool(row.role_evidence_visible),
    outcomeVisible: bool(row.outcome_visible),
    relationVisible: bool(row.relation_visible),
    directionOrStateCorrect: bool(row.direction_or_state_correct),
    contradictionVisible: bool(row.contradiction_visible),
    unsupportedSpecificsVisible: bool(row.unsupported_specifics_visible),
    generatedTextPresent: bool(row.generated_text_present),
    subjectConsistent: bool(row.subject_consistent),
    analogyMappingValid: bool(row.analogy_mapping_valid),
    roleEvidence: text(row.role_evidence, 280),
    outcomeEvidence: text(row.outcome_evidence, 280),
    ambiguity: text(row.ambiguity, 280),
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

function roleRule(role: VisualExplanatoryRole): string {
  switch (role) {
    case 'causal_mechanism':
      return 'A source-grounded action/process and its resulting effect must be visible.';
    case 'architecture_transformation':
      return 'The supported layers/components/stages and the visible structural transformation must be shown.';
    case 'state_transition':
      return 'The before/after or multi-state physical delta must be visible; labels alone cannot create the transition.';
    case 'quantitative_result':
      return 'The reported baseline and result must be visibly contrasted in the correct increase/decrease direction. Do not require an unstated cause.';
    case 'benchmark_comparison':
      return 'The evaluation/result and named comparison target must be visible with the correct winner, rank, cost or score relationship. The benchmark is context, not a cause.';
    case 'capability_access':
      return 'A supported access path or release boundary and the bounded capability it enables must be visible.';
    case 'policy_control':
      return 'An external policy boundary must visibly allow or block the action before execution.';
    case 'uncertainty_announcement':
      return 'The future/planned/expected state must remain visibly unconfirmed and must not look currently available or proven.';
  }
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
    image_url: { url: `data:image/jpeg;base64,${bytes.toString('base64')}` },
  };
}

async function evaluatePixels(
  manifest: ManifestRow,
  claim: ClaimRecord,
  usage: UsageTotals,
) {
  const compilerIsX = seed(`v5-pixel:${manifest.storyId}`) % 2 === 0;
  const order: Record<Side, Source> = compilerIsX
    ? { X: 'compiler', Y: 'current' }
    : { X: 'current', Y: 'compiler' };
  const path = (source: Source) =>
    resolve(ROOT, source === 'compiler' ? manifest.compilerPixelPath : manifest.baselineImagePath);
  const raw = await callJudge<Record<string, unknown>>(
    [
      {
        type: 'text',
        text: [
          'Compare IMAGE X and IMAGE Y using pixels only. The headline card, labels, source names, prompts and rendering methods are hidden.',
          'The original approved story is the only factual ground truth.',
          sourceText(claim.story),
          `PRIMARY EXPLANATORY ROLE: ${manifest.role}`,
          `ROLE-SPECIFIC REQUIREMENT: ${roleRule(manifest.role)}`,
          'A one-to-one editorial analogy may pass when its physical action and physical result faithfully mirror the source action/result and the headline would resolve the mapping. Generic AI mood or an unrelated metaphor fails.',
          'For each image assess:',
          '- source_context_supported: visible objects/actions are specific enough for the story rather than generic AI decoration;',
          '- role_evidence_visible: the role-specific required evidence is visible;',
          '- outcome_visible: a source-grounded benefit, harm, trade-off, result or uncertainty state is visible;',
          '- relation_visible: the action/comparison/transformation/state relation connects the evidence to outcome;',
          '- direction_or_state_correct: metric direction, winner/target, blocked/allowed state, layer change or before/after delta is correct; true when no directional/state claim applies;',
          '- contradiction_visible: pixels imply the opposite of the source;',
          '- unsupported_specifics_visible: pixels assert availability, certainty, UI details, mechanism or factual specifics absent from the source;',
          '- generated_text_present: unintended letters, words, numbers, code, fake UI copy, logos or gibberish are inside the pixels;',
          '- subject_consistent: the causal/comparison story maintains coherent subjects/states;',
          '- analogy_mapping_valid: literal evidence is valid, or a one-to-one physical analogy preserves the same relation and result.',
          'Return JSON only: {"X":{source_context_supported,role_evidence_visible,outcome_visible,relation_visible,direction_or_state_correct,contradiction_visible,unsupported_specifics_visible,generated_text_present,subject_consistent,analogy_mapping_valid,role_evidence,outcome_evidence,ambiguity},"Y":{same}}.',
        ].join('\n'),
      },
      { type: 'text', text: 'IMAGE X' },
      await imagePart(path(order.X)),
      { type: 'text', text: 'IMAGE Y' },
      await imagePart(path(order.Y)),
    ],
    usage,
  );
  return {
    X: normalizePixel(raw.X),
    Y: normalizePixel(raw.Y),
    order,
  };
}

async function evaluateCards(
  manifest: ManifestRow,
  claim: ClaimRecord,
  usage: UsageTotals,
): Promise<CardComparison> {
  const raw = await callJudge<Record<string, unknown>>(
    [
      {
        type: 'text',
        text: [
          'Compare CARD X and CARD Y as a blinded AI Today Brief visual editor at realistic feed size.',
          'The original approved story is the only ground truth. Do not assume the extracted plan or either image is correct.',
          sourceText(claim.story),
          `EXPLANATORY ROLE TO TEST: ${manifest.role}`,
          `ROLE-SPECIFIC REQUIREMENT: ${roleRule(manifest.role)}`,
          'The headline supplies named identity. The image should add one central, source-grounded meaning. A source-led fallback may intentionally add no explanatory assertion when the source claim failed audit; such a card is safe only when it stays neutral and introduces no unsupported detail.',
          'A clear editorial analogy may pass if the headline makes its one-to-one action/result mapping intuitive. Do not require literal product UI.',
          'For each card assess:',
          '- headline_pair_understood: one central meaning is understood in about three seconds;',
          '- central_claim_grounded: the communicated claim is supported by the source and does not invent why a metric happened;',
          '- certainty_preserved: reported/claimed/planned/expected/up-to language has not been upgraded;',
          '- labels_exact: every visible number and comparison target is exact; true if no explanatory labels exist;',
          '- overlay_supported_by_pixels: labels do not merely state evidence absent from pixels;',
          '- thumbnail_readable: focal action/comparison and labels survive this displayed size;',
          '- misleading: the card implies a materially different mechanism, result, target, availability or certainty;',
          '- scores 0–100: instant_meaning, visual_beauty, brand_consistency, originality.',
          'Choose preferred X, Y or tie. Hard fidelity rules override beauty. Among faithful cards use weights 45% meaning, 30% beauty, 15% brand consistency, 10% originality.',
          'Return JSON only: {"X":{headline_pair_understood,central_claim_grounded,certainty_preserved,labels_exact,overlay_supported_by_pixels,thumbnail_readable,misleading,instant_meaning,visual_beauty,brand_consistency,originality,summary},"Y":{same},"preferred":"X"|"Y"|"tie","confidence":0..1,"reason":string}.',
        ].join('\n'),
      },
      { type: 'text', text: 'CARD X' },
      await imagePart(resolve(ROOT, manifest.blindXCardPath)),
      { type: 'text', text: 'CARD Y' },
      await imagePart(resolve(ROOT, manifest.blindYCardPath)),
    ],
    usage,
  );
  const preferredRaw = raw.preferred;
  return {
    X: normalizeCard(raw.X),
    Y: normalizeCard(raw.Y),
    preferred: preferredRaw === 'X' || preferredRaw === 'Y' ? preferredRaw : 'tie',
    confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0)),
    reason: text(raw.reason, 440),
  };
}

function mapBySource<T>(order: Record<Side, Source>, values: { X: T; Y: T }): Record<Source, T> {
  return order.X === 'current'
    ? { current: values.X, compiler: values.Y }
    : { current: values.Y, compiler: values.X };
}

function pixelPass(value: PixelVerdict): boolean {
  return (
    value.sourceContextSupported &&
    value.roleEvidenceVisible &&
    value.outcomeVisible &&
    value.relationVisible &&
    value.directionOrStateCorrect &&
    !value.contradictionVisible &&
    !value.unsupportedSpecificsVisible &&
    !value.generatedTextPresent &&
    value.subjectConsistent &&
    value.analogyMappingValid
  );
}

function visualPass(pixel: PixelVerdict, card: CardVerdict): boolean {
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

function scores(value: CardVerdict): VisualQualityScores {
  return {
    instantMeaning: value.instantMeaning,
    visualBeauty: value.visualBeauty,
    brandConsistency: value.brandConsistency,
    originality: value.originality,
  };
}

function sourceEvaluation(
  source: Source,
  pixel: PixelVerdict,
  card: CardVerdict,
  claimEligible: boolean,
  pipeline: string,
): SourceEvaluation {
  const visual = visualPass(pixel, card);
  const safe =
    !pixel.contradictionVisible &&
    !pixel.unsupportedSpecificsVisible &&
    !pixel.generatedTextPresent &&
    pixel.subjectConsistent &&
    card.centralClaimGrounded &&
    card.certaintyPreserved &&
    card.labelsExact &&
    card.thumbnailReadable &&
    !card.misleading;
  const production =
    source === 'current'
      ? visual
      : pipeline === 'source_led_fallback'
        ? safe
        : visual && claimEligible;
  return {
    pixel,
    card,
    pixelPass: pixelPass(pixel),
    visualPass: visual,
    safePass: safe,
    productionPass: production,
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

function report(rows: EvaluationRow[], usage: UsageTotals): string {
  const count = rows.length;
  const metric = (source: Source, key: 'pixelPass' | 'visualPass' | 'safePass' | 'productionPass') =>
    rows.filter((row) => row[source][key]).length;
  const currentWins = rows.filter((row) => row.preferredSource === 'current').length;
  const compilerWins = rows.filter((row) => row.preferredSource === 'compiler').length;
  const ties = rows.filter((row) => row.preferredSource === 'tie').length;
  const lines = [
    '# Visual Compiler v7 unseen route-aware A/B evaluation',
    '',
    `Stories: **${count}**; judge: \`${MODEL}\`; two blinded vision calls per story.`,
    `Eligible explanatory claims before routing: **${rows.filter((row) => row.claimEligible).length}/${count}**.`,
    '',
    '| Metric | Current | V7 selected |',
    '|---|---:|---:|',
    `| Pixel role-evidence pass | ${metric('current', 'pixelPass')}/${count} (${percent(metric('current', 'pixelPass'), count)}) | ${metric('compiler', 'pixelPass')}/${count} (${percent(metric('compiler', 'pixelPass'), count)}) |`,
    `| Visual headline-paired pass | ${metric('current', 'visualPass')}/${count} (${percent(metric('current', 'visualPass'), count)}) | ${metric('compiler', 'visualPass')}/${count} (${percent(metric('compiler', 'visualPass'), count)}) |`,
    `| Route-safe pass | ${metric('current', 'safePass')}/${count} (${percent(metric('current', 'safePass'), count)}) | ${metric('compiler', 'safePass')}/${count} (${percent(metric('compiler', 'safePass'), count)}) |`,
    `| Production pass incl. claim gate | ${metric('current', 'productionPass')}/${count} (${percent(metric('current', 'productionPass'), count)}) | ${metric('compiler', 'productionPass')}/${count} (${percent(metric('compiler', 'productionPass'), count)}) |`,
    `| Average weighted score | ${average(rows.map((row) => row.current.weightedScore)).toFixed(1)} | ${average(rows.map((row) => row.compiler.weightedScore)).toFixed(1)} |`,
    `| Generated-text-free pixels | ${rows.filter((row) => !row.current.pixel.generatedTextPresent).length}/${count} | ${rows.filter((row) => !row.compiler.pixel.generatedTextPresent).length}/${count} |`,
    '',
    `Blinded preference: V7 **${compilerWins}**, current **${currentWins}**, ties **${ties}**.`,
    `V7 preference excluding ties: **${percent(compilerWins, compilerWins + currentWins)}**.`,
    `Vision calls: ${usage.calls}; tokens: ${usage.totalTokens}; reported cost $${usage.costUsd.toFixed(4)}.`,
    '',
    '| # | Story | Role | Route | Claim | Current P/V/Prod/Score | V7 P/V/Prod/Score | Preferred | Reason |',
    '|---:|---|---|---|---:|---|---|---|---|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.rank} | ${row.headline.replace(/\|/g, '\\|')} | \`${row.role}\` | \`${row.renderMode}\` | ${row.claimEligible ? '✓' : '✕'} | ${mark(row.current.pixelPass)}/${mark(row.current.visualPass)}/${mark(row.current.productionPass)}/${row.current.weightedScore.toFixed(1)} | ${mark(row.compiler.pixelPass)}/${mark(row.compiler.visualPass)}/${mark(row.compiler.productionPass)}/${row.compiler.weightedScore.toFixed(1)} | **${row.preferredSource}** | ${row.reason.replace(/\|/g, '\\|')} |`,
    );
  }
  lines.push('', '## Failure diagnosis', '');
  for (const row of rows) {
    const details: string[] = [];
    if (!row.claimEligible) details.push(`claim: ${row.claimAudit.issues.join('; ') || 'claim gate failed'}`);
    for (const source of ['current', 'compiler'] as const) {
      const value = row[source];
      const codes = [
        !value.pixel.sourceContextSupported && 'context',
        !value.pixel.roleEvidenceVisible && 'role-evidence',
        !value.pixel.outcomeVisible && 'outcome',
        !value.pixel.relationVisible && 'relation',
        !value.pixel.directionOrStateCorrect && 'direction/state',
        value.pixel.contradictionVisible && 'contradiction',
        value.pixel.unsupportedSpecificsVisible && 'unsupported-specifics',
        value.pixel.generatedTextPresent && 'generated-text',
        !value.pixel.subjectConsistent && 'consistency',
        !value.pixel.analogyMappingValid && 'analogy-map',
        !value.card.headlinePairUnderstood && 'headline-pair',
        !value.card.centralClaimGrounded && 'grounding',
        !value.card.certaintyPreserved && 'certainty',
        !value.card.labelsExact && 'labels',
        !value.card.overlaySupportedByPixels && 'overlay',
        !value.card.thumbnailReadable && 'thumbnail',
        value.card.misleading && 'misleading',
      ].filter(Boolean);
      if (codes.length) details.push(`${source}: ${codes.join(', ')}`);
    }
    if (details.length) lines.push(`- #${row.rank}: ${details.join(' | ')}`);
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

async function evaluatedSheet(rows: EvaluationRow[], manifest: ManifestRow[]): Promise<Buffer> {
  const thumbW = 560;
  const cardH = 451;
  const margin = 28;
  const headerH = 74;
  const footerH = 72;
  const rowH = headerH + cardH + footerH + 22;
  const width = margin * 3 + thumbW * 2;
  const height = margin + rows.length * rowH;
  const imageLayers: OverlayOptions[] = [];
  const labels = [`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`];
  for (const [index, row] of rows.entries()) {
    const item = manifest.find((candidate) => candidate.storyId === row.storyId)!;
    const y = margin + index * rowH;
    for (const [column, source] of (['current', 'compiler'] as const).entries()) {
      const x = margin + column * (thumbW + margin);
      const path = item.blindXSource === source ? resolve(ROOT, item.blindXCardPath) : resolve(ROOT, item.blindYCardPath);
      const bytes = await sharp(path).resize(thumbW, cardH, { fit: 'fill' }).png().toBuffer();
      imageLayers.push({ input: bytes, left: x, top: y + headerH });
      const evaluation = row[source];
      const preferred = row.preferredSource === source;
      labels.push(
        `<text x="${x}" y="${y + 28}" font-family="DejaVu Sans,Arial,sans-serif" font-size="22" font-weight="900" fill="${preferred ? '#A7F3D0' : '#67E8F9'}">${source === 'compiler' ? 'V7 SELECTED' : 'CURRENT'}${preferred ? ' • PREFERRED' : ''}</text>`,
        `<text x="${x}" y="${y + 57}" font-family="DejaVu Sans,Arial,sans-serif" font-size="15" font-weight="700" fill="#CFFAFE">pixel ${evaluation.pixelPass ? 'PASS' : 'FAIL'} • visual ${evaluation.visualPass ? 'PASS' : 'FAIL'} • production ${evaluation.productionPass ? 'PASS' : 'FAIL'} • ${evaluation.weightedScore.toFixed(1)}</text>`,
      );
    }
    labels.push(
      `<text x="${margin}" y="${y + headerH + cardH + 34}" font-family="DejaVu Sans,Arial,sans-serif" font-size="14" fill="#94A3B8">${xml(row.reason.slice(0, 150))}</text>`,
      `<text x="${margin}" y="${y + headerH + cardH + 58}" font-family="DejaVu Sans,Arial,sans-serif" font-size="13" fill="${row.claimEligible ? '#6EE7B7' : '#FDA4AF'}">claim ${row.claimEligible ? 'PASS' : 'FALLBACK'} • ${xml(row.role)} • ${xml(row.renderMode)}</text>`,
    );
  }
  labels.push('</svg>');
  return sharp({ create: { width, height, channels: 3, background: '#03070D' } })
    .composite([...imageLayers, { input: Buffer.from(labels.join('')), left: 0, top: 0 }])
    .png()
    .toBuffer();
}

async function main() {
  assertEnvironment();
  await mkdir(ROOT, { recursive: true });
  const [manifest, claims] = await Promise.all([
    readFile(join(ROOT, 'render-manifest.json'), 'utf8').then((value) => JSON.parse(value) as ManifestRow[]),
    readFile(CLAIMS_PATH, 'utf8').then((value) => JSON.parse(value) as ClaimRecord[]),
  ]);
  if (manifest.length !== 7 || claims.length !== 7) {
    throw new Error(`Expected 7 manifest and claim rows; got ${manifest.length}/${claims.length}.`);
  }
  const claimById = new Map(claims.map((claim) => [claim.story.revision_item_id, claim] as const));
  const rows: EvaluationRow[] = [];
  const usage = emptyUsage();

  for (const [index, item] of [...manifest].sort((a, b) => a.rank - b.rank).entries()) {
    const claim = claimById.get(item.storyId);
    if (!claim) throw new Error(`Missing claim for ${item.storyId}.`);
    console.log(`[v7-eval] ${index + 1}/${manifest.length} pixels: ${item.headline}`);
    const pixels = await evaluatePixels(item, claim, usage);
    console.log(`[v7-eval] ${index + 1}/${manifest.length} cards`);
    const cards = await evaluateCards(item, claim, usage);
    const pixelBySource = mapBySource(pixels.order, { X: pixels.X, Y: pixels.Y });
    const cardOrder: Record<Side, Source> = { X: item.blindXSource, Y: item.blindYSource };
    const cardBySource = mapBySource(cardOrder, { X: cards.X, Y: cards.Y });
    rows.push({
      storyId: item.storyId,
      rank: item.rank,
      headline: item.headline,
      role: item.role,
      certainty: item.certainty,
      mappingMode: item.mappingMode,
      format: item.format,
      renderMode: item.renderMode,
      claimEligible: claim.eligible,
      claimAudit: claim.finalAudit,
      current: sourceEvaluation(
      'current',
      pixelBySource.current,
      cardBySource.current,
      claim.eligible,
      'current_art_director',
    ),
    compiler: sourceEvaluation(
      'compiler',
      pixelBySource.compiler,
      cardBySource.compiler,
      claim.eligible,
      claim.router.pipeline,
    ),
      preferredSource: cards.preferred === 'tie' ? 'tie' : cardOrder[cards.preferred],
      confidence: cards.confidence,
      reason: cards.reason,
      pixelOrder: pixels.order,
      cardOrder,
    });
    await writeFile(join(ROOT, 'evaluation-progress.json'), `${JSON.stringify({ rows, usage }, null, 2)}\n`);
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
