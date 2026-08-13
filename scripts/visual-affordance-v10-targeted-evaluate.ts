import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import {
  buildBlindPixelObservationInstructionV10,
  buildFormatIntegrityInstructionV10,
  buildHeadlinePairInstructionV10,
  buildVisualCriticResultV10,
  type BlindPixelObservationV10,
  type HeadlinePairEvidenceV10,
  type VisualIntegrityEvidenceV10,
} from '../src/lib/weekly-digest/visual-critic-v10';
import type {
  VisualAffordanceV10,
  VisualIntegrityProfileV10,
  VisualPropositionV10,
} from '../src/lib/weekly-digest/visual-affordance-v10';
import type { HoldoutStoryInput } from '../src/lib/weekly-digest/visual-auto-claim';
import type {
  OwnerReworkKindV10,
  OwnerReworkTreatmentV10,
} from '../src/lib/weekly-digest/visual-owner-rework-v10';

const ROOT =
  process.env.VISUAL_V10_TARGET_OUT_DIR?.trim() ||
  'artifacts/visual-affordance-v10-targeted';
const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY?.trim() || '';
const MODEL =
  process.env.VISUAL_V10_JUDGE_MODEL?.trim() || 'google/gemini-2.5-flash';

interface ManifestVariant {
  variantId: string;
  rank: number;
  story: HoldoutStoryInput;
  treatment: OwnerReworkTreatmentV10;
  pixelPath: string;
  finalPath: string;
  pixelCardPath: string;
  finalCardPath: string;
  prompt: string | null;
  provider: string;
  model: string;
  imageCalls: number;
  estimatedImageCostUsd: number;
  durationMs: number;
  geometryIssues: string[];
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
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}

interface EvaluationRow {
  variantId: string;
  rank: number;
  story: HoldoutStoryInput;
  treatment: OwnerReworkTreatmentV10;
  proposition: VisualPropositionV10;
  observation: BlindPixelObservationV10;
  integrity: VisualIntegrityEvidenceV10;
  headlinePair: HeadlinePairEvidenceV10;
  failures: string[];
  repairMode: string;
  eligibleForOwnerReview: boolean;
  automatedProductionPass: false;
  weightedScore: number;
  autoRankWithinStory: number | null;
  finalCardPath: string;
  pixelCardPath: string;
}

function assertEnvironment() {
  if (!OPEN_ROUTER_API_KEY) throw new Error('OPEN_ROUTER_API_KEY is required.');
}

function emptyUsage(): UsageTotals {
  return {
    calls: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUsd: 0,
  };
}

function addUsage(total: UsageTotals, usage: OpenRouterResponse['usage']) {
  total.calls += 1;
  total.promptTokens += usage?.prompt_tokens ?? 0;
  total.completionTokens += usage?.completion_tokens ?? 0;
  total.totalTokens += usage?.total_tokens ?? 0;
  total.costUsd += usage?.cost ?? 0;
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
    throw new Error(`Invalid judge JSON: ${clean.slice(0, 700)}`);
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
            'X-Title': 'AI Today Brief visual affordance v10 integrity evaluation',
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content }],
            temperature: 0,
            max_tokens: 2_000,
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
      console.warn(`[visual-v10-eval] attempt ${attempt} failed`, error);
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

function textArray(value: unknown, maxItems = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item, 220))
    .filter(Boolean)
    .slice(0, maxItems);
}

function score(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
}

function normalizeObservation(value: unknown): BlindPixelObservationV10 {
  const row = record(value);
  return {
    visibleObjects: textArray(row.visible_objects),
    visiblePeopleAndHands: textArray(row.visible_people_and_hands),
    visibleActions: textArray(row.visible_actions),
    visibleSourceTargetRelations: textArray(
      row.visible_source_target_relations,
    ),
    visibleOutcomes: textArray(row.visible_outcomes),
    visibleText: textArray(row.visible_text),
    ambiguousElements: textArray(row.ambiguous_elements),
  };
}

function normalizeIntegrity(value: unknown): VisualIntegrityEvidenceV10 {
  const row = record(value);
  return {
    contextVisible: bool(row.context_visible),
    actionVisible: bool(row.action_visible),
    outcomeVisible: bool(row.outcome_visible),
    visualThesisCoherent: bool(row.visual_thesis_coherent),
    generatedTextPresent: bool(row.generated_text_present),
    anatomyValid: bool(row.anatomy_valid),
    allHandsOwnedByVisiblePeople: bool(
      row.all_hands_owned_by_visible_people,
    ),
    objectsRemainSeparated: bool(row.objects_remain_separated),
    interactionsPhysicallyPlausible: bool(
      row.interactions_physically_plausible,
    ),
    allDirectedEffectsHaveVisibleSource: bool(
      row.all_directed_effects_have_visible_source,
    ),
    allDirectedEffectsHaveMeaningfulTarget: bool(
      row.all_directed_effects_have_meaningful_target,
    ),
    allPropsParticipateInTheClaim: bool(
      row.all_props_participate_in_the_claim,
    ),
    allArrowsConnected: bool(row.all_arrows_connected),
    directionUnambiguous: bool(row.direction_unambiguous),
    sameInputPreserved: bool(row.same_input_preserved),
    sameSystemPreserved: bool(row.same_system_preserved),
    chartOrMetricInterpretable: bool(row.chart_or_metric_interpretable),
    meaningVisibleWithoutLabels: bool(row.meaning_visible_without_labels),
    analogyMappingOneToOne: bool(row.analogy_mapping_one_to_one),
  };
}

function normalizeHeadlinePair(value: unknown): HeadlinePairEvidenceV10 {
  const row = record(value);
  return {
    headlineImagePairUnderstood: bool(row.headline_image_pair_understood),
    oneCoreClaimVisible: bool(row.one_core_claim_visible),
    certaintyPreserved: bool(row.certainty_preserved),
    approvedLabelsExact: bool(row.approved_labels_exact),
    labelsSupportedByPixels: bool(row.labels_supported_by_pixels),
    thumbnailReadable: bool(row.thumbnail_readable),
    misleading: bool(row.misleading),
    instantMeaning: score(row.instant_meaning),
    visualBeauty: score(row.visual_beauty),
    brandConsistency: score(row.brand_consistency),
    originality: score(row.originality),
    summary: text(row.summary, 420),
  };
}

async function imagePart(path: string): Promise<Record<string, unknown>> {
  const bytes = await sharp(path)
    .resize(760, 620, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 86 })
    .toBuffer();
  return {
    type: 'image_url',
    image_url: {
      url: `data:image/jpeg;base64,${bytes.toString('base64')}`,
    },
  };
}

function affordanceFor(kind: OwnerReworkKindV10): {
  affordance: VisualAffordanceV10;
  profile: VisualIntegrityProfileV10;
} {
  switch (kind) {
    case 'gemini_consistency':
      return { affordance: 'controlled_comparison', profile: 'diagram' };
    case 'claude_threshold_controls':
    case 'token_caching':
      return {
        affordance: 'deterministic_technical_hybrid',
        profile: 'diagram',
      };
    case 'fuzz_repair_loop':
      return { affordance: 'causal_process_sequence', profile: 'diagram' };
    case 'optical_context_compression':
      return {
        affordance: 'one_to_one_physical_analogy',
        profile: 'physical_analogy',
      };
    case 'deep_work_bounded_hint':
      return { affordance: 'cinematic_domain_scene', profile: 'generated_scene' };
  }
}

function propositionFor(variant: ManifestVariant): VisualPropositionV10 {
  const mapping = variant.treatment.expectedEvidence.map((evidence, index) => ({
    sourceElement:
      index === 0
        ? variant.story.summary
        : index === 1
          ? variant.story.why ?? variant.story.summary
          : variant.story.takeaway ?? variant.story.summary,
    visualElement: evidence,
    role: index === 0 ? ('context' as const) : index === 1 ? ('action' as const) : ('outcome' as const),
    required: true,
    evidenceSource: 'pixels' as const,
  }));
  while (mapping.length < 3) {
    mapping.push({
      sourceElement: variant.treatment.coreClaim,
      visualElement: variant.treatment.expectedEvidence[mapping.length - 1] ?? variant.treatment.coreClaim,
      role: mapping.length === 1 ? 'action' : 'outcome',
      required: true,
      evidenceSource: 'pixels',
    });
  }
  const routed = affordanceFor(variant.treatment.kind);
  return {
    id: `${variant.variantId}:${routed.affordance}`,
    storyId: variant.story.revision_item_id,
    affordance: routed.affordance,
    renderMode:
      variant.treatment.renderMode === 'generated_cinematic'
        ? 'generated_cinematic'
        : 'deterministic_hybrid',
    integrityProfile: routed.profile,
    title: variant.treatment.title,
    coreClaim: variant.treatment.coreClaim,
    rationale: variant.story.why ?? variant.treatment.title,
    mapping,
    approvedOverlays: variant.treatment.labels,
    forbiddenImplications: variant.treatment.forbiddenImplications,
    identityInvariant:
      routed.affordance === 'controlled_comparison' ||
      routed.affordance === 'causal_process_sequence'
        ? {
            subject: variant.story.title,
            mustRemainIdenticalAcrossStates: [
              'input or subject',
              'system identity',
              'camera and scale',
            ],
          }
        : null,
    geometry:
      routed.profile === 'diagram'
        ? {
            arrowsMustHaveVisibleSourceAndTarget: true,
            directionMustBeUnambiguous: true,
            labelsMayNotCarryRequiredEvidence: true,
            sameInputMustRemainIdentical:
              routed.affordance === 'controlled_comparison',
            sameSystemMustRemainIdentical:
              routed.affordance === 'controlled_comparison',
            maxStates: routed.affordance === 'causal_process_sequence' ? 3 : 3,
          }
        : null,
    priority: 100,
    expectedImageCalls: variant.treatment.imageCalls,
    ownerReviewRequired: true,
  };
}

async function observePixels(
  variant: ManifestVariant,
  usage: UsageTotals,
): Promise<BlindPixelObservationV10> {
  const raw = await callJudge<Record<string, unknown>>(
    [
      {
        type: 'text',
        text: buildBlindPixelObservationInstructionV10(),
      },
      await imagePart(resolve(ROOT, variant.pixelPath)),
    ],
    usage,
  );
  return normalizeObservation(raw);
}

async function judgeIntegrityAndCard(input: {
  variant: ManifestVariant;
  proposition: VisualPropositionV10;
  observation: BlindPixelObservationV10;
  usage: UsageTotals;
}): Promise<{
  integrity: VisualIntegrityEvidenceV10;
  headlinePair: HeadlinePairEvidenceV10;
}> {
  const integrityInstruction = buildFormatIntegrityInstructionV10({
    profile: input.proposition.integrityProfile,
    observation: input.observation,
  });
  const headlineInstruction = buildHeadlinePairInstructionV10({
    story: input.variant.story,
    proposition: input.proposition,
    observation: input.observation,
  });
  const raw = await callJudge<Record<string, unknown>>(
    [
      {
        type: 'text',
        text: [
          'IMAGE 1 is the labels-hidden pixel image. IMAGE 2 is the final feed card with the approved headline and deterministic labels.',
          integrityInstruction,
          headlineInstruction,
          'Return one JSON object: {"integrity":{all requested integrity booleans},"headline_pair":{all requested headline-pair fields}}.',
        ].join('\n\n'),
      },
      await imagePart(resolve(ROOT, input.variant.pixelPath)),
      await imagePart(resolve(ROOT, input.variant.finalCardPath)),
    ],
    input.usage,
  );
  return {
    integrity: normalizeIntegrity(raw.integrity),
    headlinePair: normalizeHeadlinePair(raw.headline_pair),
  };
}

function rankWithinStories(rows: EvaluationRow[]): EvaluationRow[] {
  const groups = new Map<string, EvaluationRow[]>();
  for (const row of rows) {
    const list = groups.get(row.story.revision_item_id) ?? [];
    list.push(row);
    groups.set(row.story.revision_item_id, list);
  }
  for (const group of groups.values()) {
    const ordered = [...group].sort((left, right) => {
      if (left.eligibleForOwnerReview !== right.eligibleForOwnerReview) {
        return left.eligibleForOwnerReview ? -1 : 1;
      }
      return right.weightedScore - left.weightedScore;
    });
    ordered.forEach((row, index) => {
      row.autoRankWithinStory = index + 1;
    });
  }
  return rows;
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function evaluatedSheet(rows: EvaluationRow[]): Promise<Buffer> {
  const ordered = [...rows].sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    return left.variantId.localeCompare(right.variantId);
  });
  const cardWidth = 620;
  const cardHeight = Math.round((579 / 720) * cardWidth);
  const margin = 30;
  const headerHeight = 82;
  const footerHeight = 98;
  const rowGap = 34;
  const rowHeight = headerHeight + cardHeight + footerHeight + rowGap;
  const width = margin * 2 + cardWidth;
  const height = margin + ordered.length * rowHeight;
  const layers: OverlayOptions[] = [];
  const labels = [
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`,
  ];
  for (const [index, row] of ordered.entries()) {
    const y = margin + index * rowHeight;
    const image = await sharp(resolve(ROOT, row.finalCardPath))
      .resize(cardWidth, cardHeight, { fit: 'fill' })
      .png()
      .toBuffer();
    layers.push({ input: image, left: margin, top: y + headerHeight });
    const state = row.eligibleForOwnerReview
      ? 'READY FOR OWNER REVIEW'
      : `REJECT • ${row.repairMode}`;
    labels.push(
      `<text x="${margin}" y="${y + 30}" font-family="DejaVu Sans,Arial,sans-serif" font-size="22" font-weight="900" fill="${row.eligibleForOwnerReview ? '#34D399' : '#FB7185'}">${xml(state)}</text>`,
      `<text x="${margin}" y="${y + 60}" font-family="DejaVu Sans,Arial,sans-serif" font-size="15" font-weight="700" fill="#CFFAFE">AUTO RANK ${row.autoRankWithinStory ?? '—'} • SCORE ${row.weightedScore.toFixed(1)} • OWNER DECISION REQUIRED</text>`,
    );
    const footerY = y + headerHeight + cardHeight + 30;
    labels.push(
      `<text x="${margin}" y="${footerY}" font-family="DejaVu Sans,Arial,sans-serif" font-size="16" font-weight="800" fill="#ECFEFF">${xml(`${row.rank}. ${row.story.title}`)}</text>`,
      `<text x="${margin}" y="${footerY + 26}" font-family="DejaVu Sans,Arial,sans-serif" font-size="13" fill="#94A3B8">${xml(`failures: ${row.failures.length ? row.failures.join(', ') : 'none'}`)}</text>`,
      `<text x="${margin}" y="${footerY + 49}" font-family="DejaVu Sans,Arial,sans-serif" font-size="12" fill="#64748B">${xml(row.headlinePair.summary.slice(0, 180))}</text>`,
    );
  }
  labels.push('</svg>');
  return sharp({
    create: { width, height, channels: 3, background: '#03070D' },
  })
    .composite([
      ...layers,
      { input: Buffer.from(labels.join('')), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

function report(rows: EvaluationRow[], usage: UsageTotals): string {
  const ready = rows.filter((row) => row.eligibleForOwnerReview).length;
  const generated = rows.filter(
    (row) => row.treatment.renderMode === 'generated_cinematic',
  );
  const deterministic = rows.filter(
    (row) => row.treatment.renderMode === 'deterministic_hybrid',
  );
  const average =
    rows.reduce((sum, row) => sum + row.weightedScore, 0) / rows.length;
  const lines = [
    '# Visual Affordance v10 — blind integrity evaluation',
    '',
    `Variants: **${rows.length}**; ready for owner review: **${ready}/${rows.length}**.`,
    `Generated candidates: **${generated.length}**; deterministic candidates: **${deterministic.length}**.`,
    `Average ranking score: **${average.toFixed(1)}**.`,
    `Vision calls: **${usage.calls}**; tokens: **${usage.totalTokens}**; reported cost: **$${usage.costUsd.toFixed(4)}**.`,
    '',
    '**No row receives automated production acceptance.** A clean row is only eligible for owner review.',
    '',
    '| # | Story | Variant | Affordance | Integrity | Repair | Score | Auto rank |',
    '|---:|---|---|---|---|---|---:|---:|',
  ];
  for (const row of [...rows].sort((a, b) => a.rank - b.rank)) {
    lines.push(
      `| ${row.rank} | ${row.story.title.replace(/\|/g, '\\|')} | \`${row.variantId}\` | \`${row.proposition.affordance}\` | ${row.eligibleForOwnerReview ? 'owner-review ready' : row.failures.join(', ')} | \`${row.repairMode}\` | ${row.weightedScore.toFixed(1)} | ${row.autoRankWithinStory ?? '—'} |`,
    );
  }
  lines.push('', '## Deep Work automatic ranking', '');
  for (const row of rows
    .filter((candidate) => candidate.treatment.kind === 'deep_work_bounded_hint')
    .sort((left, right) => (left.autoRankWithinStory ?? 99) - (right.autoRankWithinStory ?? 99))) {
    lines.push(
      `- **${row.variantId}** — rank ${row.autoRankWithinStory}; ${row.eligibleForOwnerReview ? 'ready for owner inspection' : `blocked: ${row.failures.join(', ')}`}.`,
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  assertEnvironment();
  const manifest = JSON.parse(
    await readFile(join(ROOT, 'render-manifest.json'), 'utf8'),
  ) as ManifestVariant[];
  if (manifest.length !== 7) {
    throw new Error(`Expected seven rendered variants; received ${manifest.length}.`);
  }
  const usage = emptyUsage();
  const rows: EvaluationRow[] = [];
  for (const [index, variant] of manifest.entries()) {
    console.log(
      `[visual-v10-eval] ${index + 1}/${manifest.length} observe ${variant.variantId}`,
    );
    const proposition = propositionFor(variant);
    const observation = await observePixels(variant, usage);
    console.log(
      `[visual-v10-eval] ${index + 1}/${manifest.length} integrity + card`,
    );
    const judged = await judgeIntegrityAndCard({
      variant,
      proposition,
      observation,
      usage,
    });
    const result = buildVisualCriticResultV10({
      proposition,
      integrity: judged.integrity,
      headlinePair: judged.headlinePair,
      remainingImageCalls: 0,
    });
    rows.push({
      variantId: variant.variantId,
      rank: variant.rank,
      story: variant.story,
      treatment: variant.treatment,
      proposition,
      observation,
      integrity: judged.integrity,
      headlinePair: judged.headlinePair,
      failures: result.failures,
      repairMode: result.candidateDecision.repairMode,
      eligibleForOwnerReview:
        result.candidateDecision.eligibleForOwnerReview,
      automatedProductionPass: false,
      weightedScore: result.weightedScore,
      autoRankWithinStory: null,
      finalCardPath: variant.finalCardPath,
      pixelCardPath: variant.pixelCardPath,
    });
    await writeFile(
      join(ROOT, 'evaluation-progress.json'),
      `${JSON.stringify({ rows, usage }, null, 2)}\n`,
    );
  }
  rankWithinStories(rows);
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
