import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  chooseVisualRepair,
  evaluateFinalGate,
  evaluatePixelGate,
  weightedVisualScore,
  type FinalGateEvidence,
  type VisualPlan,
  type VisualQualityScores,
} from '../src/lib/weekly-digest/visual-compiler';

const ROOT =
  process.env.VISUAL_COMPILER_OUT_DIR?.trim() || 'artifacts/visual-compiler-shadow';
const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY?.trim() || '';
const MODEL =
  process.env.VISUAL_COMPILER_JUDGE_MODEL?.trim() || 'google/gemini-2.5-flash';

interface PlanRecord {
  rank: number;
  headline: string;
  plan: VisualPlan;
}

interface RenderedRecord {
  rank: number;
  headline: string;
  storyId: string;
  format: VisualPlan['format'];
  pixelOnlyPath: string;
  finalPath: string;
  assetPaths: string[];
  imageCalls: number;
  estimatedCostUsd: number;
}

interface BlindObservation {
  objects: string[];
  actions: string[];
  causal_chain: string;
  visible_outcome: string;
  generated_text_present: boolean;
  generated_text_quality: 'none' | 'clean' | 'gibberish' | 'mixed';
  text_clue: string;
  subject_consistent: boolean;
  ambiguity: string;
}

interface PairedVerdict {
  identity_visible: boolean;
  mechanism_visible: boolean;
  outcome_visible: boolean;
  causal_relation_visible: boolean;
  contradictory_action: boolean;
  subject_consistent: boolean;
  labels_approved_and_exact: boolean;
  overlays_supported_by_pixels: boolean;
  headline_image_pair_understood: boolean;
  thumbnail_readable: boolean;
  instant_meaning: number;
  visual_beauty: number;
  brand_consistency: number;
  originality: number;
  notes: string;
}

interface EvaluatedRecord {
  rank: number;
  headline: string;
  storyId: string;
  format: VisualPlan['format'];
  observation: BlindObservation;
  verdict: PairedVerdict;
  pixelGate: ReturnType<typeof evaluatePixelGate>;
  finalGate: ReturnType<typeof evaluateFinalGate>;
  weightedScore: number;
  repair: ReturnType<typeof chooseVisualRepair>;
  finalPath: string;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function extractJson(text: string): Record<string, unknown> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error(`Judge returned invalid JSON: ${cleaned.slice(0, 500)}`);
  }
}

async function callJudge(
  content: Array<Record<string, unknown>>,
  responseFormat: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!OPEN_ROUTER_API_KEY) throw new Error('OPEN_ROUTER_API_KEY is required.');
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPEN_ROUTER_API_KEY}`,
          'content-type': 'application/json',
          'HTTP-Referer': 'https://aitodaybrief.com',
          'X-Title': 'AI Today Brief Visual Compiler shadow evaluation',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content }],
          temperature: 0,
          max_tokens: 850,
          response_format: responseFormat,
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) {
        throw new Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 800)}`);
      }
      const data = (await response.json()) as {
        choices?: Array<{
          message?: { content?: string | Array<{ text?: string }> };
        }>;
      };
      const raw = data.choices?.[0]?.message?.content;
      const text = Array.isArray(raw)
        ? raw.map((part) => part.text ?? '').join('')
        : typeof raw === 'string'
          ? raw
          : '';
      if (!text) throw new Error('Vision judge returned no content.');
      return extractJson(text);
    } catch (error) {
      lastError = error;
      console.warn(`[visual-compiler-judge] attempt ${attempt} failed`, error);
      await sleep(attempt * 2_000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

const observationFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'visual_compiler_blind_observation',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        objects: {
          type: 'array',
          maxItems: 5,
          items: { type: 'string', maxLength: 55 },
        },
        actions: {
          type: 'array',
          maxItems: 4,
          items: { type: 'string', maxLength: 65 },
        },
        causal_chain: { type: 'string', maxLength: 180 },
        visible_outcome: { type: 'string', maxLength: 130 },
        generated_text_present: { type: 'boolean' },
        generated_text_quality: {
          type: 'string',
          enum: ['none', 'clean', 'gibberish', 'mixed'],
        },
        text_clue: { type: 'string', maxLength: 55 },
        subject_consistent: { type: 'boolean' },
        ambiguity: { type: 'string', maxLength: 150 },
      },
      required: [
        'objects',
        'actions',
        'causal_chain',
        'visible_outcome',
        'generated_text_present',
        'generated_text_quality',
        'text_clue',
        'subject_consistent',
        'ambiguity',
      ],
    },
  },
};

const verdictFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'visual_compiler_paired_verdict',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        identity_visible: { type: 'boolean' },
        mechanism_visible: { type: 'boolean' },
        outcome_visible: { type: 'boolean' },
        causal_relation_visible: { type: 'boolean' },
        contradictory_action: { type: 'boolean' },
        subject_consistent: { type: 'boolean' },
        labels_approved_and_exact: { type: 'boolean' },
        overlays_supported_by_pixels: { type: 'boolean' },
        headline_image_pair_understood: { type: 'boolean' },
        thumbnail_readable: { type: 'boolean' },
        instant_meaning: { type: 'number', minimum: 0, maximum: 100 },
        visual_beauty: { type: 'number', minimum: 0, maximum: 100 },
        brand_consistency: { type: 'number', minimum: 0, maximum: 100 },
        originality: { type: 'number', minimum: 0, maximum: 100 },
        notes: { type: 'string', maxLength: 240 },
      },
      required: [
        'identity_visible',
        'mechanism_visible',
        'outcome_visible',
        'causal_relation_visible',
        'contradictory_action',
        'subject_consistent',
        'labels_approved_and_exact',
        'overlays_supported_by_pixels',
        'headline_image_pair_understood',
        'thumbnail_readable',
        'instant_meaning',
        'visual_beauty',
        'brand_consistency',
        'originality',
        'notes',
      ],
    },
  },
};

async function imageData(path: string): Promise<string> {
  const bytes = await sharp(path)
    .resize(640, 360, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 84 })
    .toBuffer();
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
}

async function observePixels(path: string): Promise<BlindObservation> {
  const result = await callJudge(
    [
      {
        type: 'text',
        text:
          'Inspect only the attached pixels. You do not know the headline, story, intended prompt or labels. Fill the exact schema using visible evidence only. Keep arrays short. Do not infer product names. For repeated or malformed text, never transcribe every occurrence: set generated_text_quality and provide one short clue.',
      },
      { type: 'image_url', image_url: { url: await imageData(path) } },
    ],
    observationFormat,
  );
  return result as unknown as BlindObservation;
}

async function judgePaired(input: {
  plan: VisualPlan;
  headline: string;
  observation: BlindObservation;
  finalPath: string;
}): Promise<PairedVerdict> {
  const overlays = input.plan.overlays.map((overlay) => ({
    text: overlay.text,
    region: overlay.regionId,
  }));
  const result = await callJudge(
    [
      {
        type: 'text',
        text:
          'Evaluate a real headline-paired editorial card. IMPORTANT: decide identity_visible, mechanism_visible, outcome_visible, causal_relation_visible, contradictory_action and subject_consistent from BLIND_OBSERVATION only; the headline and deterministic labels may not rescue missing pixels. Inspect the attached final composite only for exact approved labels, overlay support, headline pairing, thumbnail readability and craft scores. overlays_supported_by_pixels must be false when a label claims an action or outcome contradicted or absent in the blind observation. One image should communicate one core claim. HEADLINE=' +
          JSON.stringify(input.headline) +
          ' CORE_CLAIM=' +
          JSON.stringify(input.plan.claim.coreClaim) +
          ' REQUIRED_MECHANISM=' +
          JSON.stringify(input.plan.claim.mechanism) +
          ' REQUIRED_OUTCOME=' +
          JSON.stringify(input.plan.claim.primaryOutcome) +
          ' FORBIDDEN_CONTRADICTIONS=' +
          JSON.stringify(input.plan.forbiddenContradictions) +
          ' APPROVED_OVERLAYS=' +
          JSON.stringify(overlays) +
          ' BLIND_OBSERVATION=' +
          JSON.stringify(input.observation),
      },
      { type: 'image_url', image_url: { url: await imageData(input.finalPath) } },
    ],
    verdictFormat,
  );
  return result as unknown as PairedVerdict;
}

function gateEvidence(
  observation: BlindObservation,
  verdict: PairedVerdict,
): FinalGateEvidence {
  return {
    identityVisible: verdict.identity_visible,
    mechanismVisible: verdict.mechanism_visible,
    outcomeVisible: verdict.outcome_visible,
    causalRelationVisible: verdict.causal_relation_visible,
    contradictoryAction: verdict.contradictory_action,
    generatedTextPresent: observation.generated_text_present,
    subjectConsistent: observation.subject_consistent && verdict.subject_consistent,
    labelsApprovedAndExact: verdict.labels_approved_and_exact,
    overlaysSupportedByPixels: verdict.overlays_supported_by_pixels,
    headlineImagePairUnderstood: verdict.headline_image_pair_understood,
    thumbnailReadable: verdict.thumbnail_readable,
  };
}

function qualityScores(verdict: PairedVerdict): VisualQualityScores {
  return {
    instantMeaning: verdict.instant_meaning,
    visualBeauty: verdict.visual_beauty,
    brandConsistency: verdict.brand_consistency,
    originality: verdict.originality,
  };
}

async function evaluateOne(
  planRecord: PlanRecord,
  rendered: RenderedRecord,
): Promise<EvaluatedRecord> {
  console.log(`[observe] ${planRecord.rank}/${rendered.storyId}`);
  const observation = await observePixels(rendered.pixelOnlyPath);
  console.log(`[paired] ${planRecord.rank}/${rendered.storyId}`);
  const verdict = await judgePaired({
    plan: planRecord.plan,
    headline: planRecord.headline,
    observation,
    finalPath: rendered.finalPath,
  });
  const evidence = gateEvidence(observation, verdict);
  const pixelGate = evaluatePixelGate(evidence);
  const finalGate = evaluateFinalGate(evidence);
  return {
    rank: planRecord.rank,
    headline: planRecord.headline,
    storyId: rendered.storyId,
    format: planRecord.plan.format,
    observation,
    verdict,
    pixelGate,
    finalGate,
    weightedScore: weightedVisualScore(qualityScores(verdict)),
    repair: chooseVisualRepair(finalGate.failures),
    finalPath: rendered.finalPath,
  };
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

function mark(value: boolean): string {
  return value ? '✓' : '✕';
}

function report(records: EvaluatedRecord[]): string {
  const passed = records.filter((record) => record.finalGate.passed).length;
  const pixelPassed = records.filter((record) => record.pixelGate.passed).length;
  const average =
    records.reduce((sum, record) => sum + record.weightedScore, 0) /
    Math.max(1, records.length);
  const lines = [
    '# Visual Compiler seven-story evaluation',
    '',
    `Pixel-only pass: **${pixelPassed}/${records.length}**  `,
    `Final headline-paired pass: **${passed}/${records.length}**  `,
    `Average eligible-ranking score: **${average.toFixed(1)}**`,
    '',
    '| # | Story | Format | Identity | Mechanism | Outcome | Cause→effect | No contradiction | No generated text | Labels exact | Overlay supported | Headline pair | Thumbnail | Score | Final | Repair |',
    '|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|',
  ];
  for (const record of records) {
    const evidence = gateEvidence(record.observation, record.verdict);
    lines.push(
      `| ${record.rank} | ${escapeCell(record.headline)} | \`${record.format}\` | ${mark(
        evidence.identityVisible,
      )} | ${mark(evidence.mechanismVisible)} | ${mark(evidence.outcomeVisible)} | ${mark(
        evidence.causalRelationVisible,
      )} | ${mark(!evidence.contradictoryAction)} | ${mark(
        !evidence.generatedTextPresent,
      )} | ${mark(evidence.labelsApprovedAndExact)} | ${mark(
        evidence.overlaysSupportedByPixels,
      )} | ${mark(evidence.headlineImagePairUnderstood)} | ${mark(
        evidence.thumbnailReadable,
      )} | ${record.weightedScore.toFixed(1)} | ${mark(record.finalGate.passed)} | \`${
        record.repair
      }\` |`,
    );
  }
  lines.push('', '## Notes', '');
  for (const record of records) {
    lines.push(
      `### ${record.rank}. ${record.storyId}`,
      '',
      `- Blind causal chain: ${record.observation.causal_chain}`,
      `- Blind outcome: ${record.observation.visible_outcome}`,
      `- Ambiguity: ${record.observation.ambiguity}`,
      `- Verdict: ${record.verdict.notes}`,
      `- Failures: ${record.finalGate.failures.join(', ') || 'none'}`,
      '',
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const plans = JSON.parse(await readFile(join(ROOT, 'plans.json'), 'utf8')) as PlanRecord[];
  const manifest = JSON.parse(
    await readFile(join(ROOT, 'render-manifest.json'), 'utf8'),
  ) as RenderedRecord[];
  const records: EvaluatedRecord[] = [];
  for (const plan of plans) {
    const rendered = manifest.find((candidate) => candidate.storyId === plan.plan.claim.storyId);
    if (!rendered) throw new Error(`Missing rendered image for ${plan.plan.claim.storyId}.`);
    records.push(await evaluateOne(plan, rendered));
  }
  await Promise.all([
    writeFile(join(ROOT, 'evaluation.json'), `${JSON.stringify(records, null, 2)}\n`),
    writeFile(join(ROOT, 'evaluation.md'), report(records)),
  ]);
  console.log(report(records));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
