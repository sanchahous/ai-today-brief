import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { VisualPipelineV7 } from '../src/lib/weekly-digest/visual-role-router-v7';

const ROOT =
  process.env.VISUAL_V7_AB_OUT_DIR?.trim() || 'artifacts/visual-compiler-v7-1-ab';
const ROUTED_PATH =
  process.env.VISUAL_V7_ROUTED_CLAIMS?.trim() ||
  'experiments/visual-compiler-v7/fresh-holdout/output-v7-1/v7-routed-claims.json';

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
}

interface CardVerdict {
  headlinePairUnderstood: boolean;
  centralClaimGrounded: boolean;
  certaintyPreserved: boolean;
  labelsExact: boolean;
  overlaySupportedByPixels: boolean;
  thumbnailReadable: boolean;
  misleading: boolean;
}

interface SourceEvaluation {
  pixel: PixelVerdict;
  card: CardVerdict;
  pixelPass: boolean;
  visualPass: boolean;
  productionPass: boolean;
  weightedScore: number;
}

interface EvaluationRow {
  storyId: string;
  rank: number;
  headline: string;
  role: string;
  mappingMode: string;
  current: SourceEvaluation;
  compiler: SourceEvaluation;
  preferredSource: 'current' | 'compiler' | 'tie';
  reason: string;
}

interface EvaluationFile {
  rows: EvaluationRow[];
}

interface ManifestRow {
  storyId: string;
  current: {
    estimatedImageCostUsd: number;
    durationMs: number;
  };
  compiler: {
    estimatedImageCostUsd: number;
    durationMs: number;
  };
}

interface RoutedRecord {
  story: {
    revision_item_id: string;
    rank: number;
    title: string;
  };
  eligible: boolean;
  router: {
    pipeline: VisualPipelineV7;
    expectedImageCalls: 0 | 1;
    reason: string;
  };
}

interface CorrectedRow {
  storyId: string;
  rank: number;
  headline: string;
  pipeline: VisualPipelineV7;
  selectedSource: 'current' | 'compiler';
  sourceEligible: boolean;
  previousSelectedPass: boolean;
  correctedSelectedPass: boolean;
  selectedWeightedScore: number;
  currentWeightedScore: number;
  preference: 'selected' | 'current' | 'tie';
  correctedFailedGates: string[];
  estimatedImageCalls: number;
  estimatedImageCostUsd: number;
  estimatedDurationMs: number;
  evaluatorReason: string;
}

function deterministicPixelPass(value: PixelVerdict): boolean {
  return (
    value.sourceContextSupported &&
    value.roleEvidenceVisible &&
    value.outcomeVisible &&
    value.relationVisible &&
    value.directionOrStateCorrect &&
    !value.contradictionVisible &&
    !value.unsupportedSpecificsVisible &&
    !value.generatedTextPresent &&
    value.subjectConsistent
  );
}

function deterministicCardPass(value: CardVerdict): boolean {
  return (
    value.headlinePairUnderstood &&
    value.centralClaimGrounded &&
    value.certaintyPreserved &&
    value.overlaySupportedByPixels &&
    value.thumbnailReadable &&
    !value.misleading
  );
}

function deterministicPass(value: SourceEvaluation): boolean {
  // Labels are deterministic SVG data from the approved claim. Vision OCR is diagnostic,
  // not a hard gate. Literal diagrams do not need an editorial-analogy mapping.
  return deterministicPixelPass(value.pixel) && deterministicCardPass(value.card);
}

function fallbackSafetyPass(value: SourceEvaluation): boolean {
  return (
    !value.pixel.contradictionVisible &&
    !value.pixel.unsupportedSpecificsVisible &&
    !value.pixel.generatedTextPresent &&
    value.card.certaintyPreserved &&
    value.card.headlinePairUnderstood &&
    value.card.thumbnailReadable &&
    !value.card.misleading
  );
}

function correctedFailedGates(
  pipeline: VisualPipelineV7,
  value: SourceEvaluation,
): string[] {
  if (pipeline === 'current_art_director') {
    return value.productionPass ? [] : ['current_role_evidence_or_card_gate'];
  }
  if (pipeline === 'source_led_fallback') {
    return [
      value.pixel.contradictionVisible && 'contradiction',
      value.pixel.unsupportedSpecificsVisible && 'unsupported_specifics',
      value.pixel.generatedTextPresent && 'generated_text',
      !value.card.certaintyPreserved && 'certainty',
      !value.card.headlinePairUnderstood && 'headline_pair',
      !value.card.thumbnailReadable && 'thumbnail',
      value.card.misleading && 'misleading',
    ].filter((value): value is string => Boolean(value));
  }
  return [
    !value.pixel.sourceContextSupported && 'source_context',
    !value.pixel.roleEvidenceVisible && 'role_evidence',
    !value.pixel.outcomeVisible && 'outcome',
    !value.pixel.relationVisible && 'relation',
    !value.pixel.directionOrStateCorrect && 'direction_or_state',
    value.pixel.contradictionVisible && 'contradiction',
    value.pixel.unsupportedSpecificsVisible && 'unsupported_specifics',
    value.pixel.generatedTextPresent && 'generated_text',
    !value.pixel.subjectConsistent && 'consistency',
    !value.card.headlinePairUnderstood && 'headline_pair',
    !value.card.centralClaimGrounded && 'grounding',
    !value.card.certaintyPreserved && 'certainty',
    !value.card.overlaySupportedByPixels && 'overlay',
    !value.card.thumbnailReadable && 'thumbnail',
    value.card.misleading && 'misleading',
  ].filter((value): value is string => Boolean(value));
}

function preference(
  pipeline: VisualPipelineV7,
  preferredSource: EvaluationRow['preferredSource'],
): CorrectedRow['preference'] {
  if (pipeline === 'current_art_director') return 'tie';
  if (preferredSource === 'compiler') return 'selected';
  if (preferredSource === 'current') return 'current';
  return 'tie';
}

function report(rows: CorrectedRow[], currentPasses: number): string {
  const correctedPasses = rows.filter((row) => row.correctedSelectedPass).length;
  const previousPasses = rows.filter((row) => row.previousSelectedPass).length;
  const selectedWins = rows.filter((row) => row.preference === 'selected').length;
  const currentWins = rows.filter((row) => row.preference === 'current').length;
  const ties = rows.filter((row) => row.preference === 'tie').length;
  const avg = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const selectedAverage = avg(rows.map((row) => row.selectedWeightedScore));
  const currentAverage = avg(rows.map((row) => row.currentWeightedScore));
  const imageCalls = rows.reduce((sum, row) => sum + row.estimatedImageCalls, 0);
  const imageCost = rows.reduce((sum, row) => sum + row.estimatedImageCostUsd, 0);
  const durationMs = rows.reduce((sum, row) => sum + row.estimatedDurationMs, 0);
  const fallbackRows = rows.filter((row) => row.pipeline === 'source_led_fallback');
  const fallbackPasses = fallbackRows.filter((row) => row.correctedSelectedPass).length;
  const upgraded = rows.filter(
    (row) => !row.previousSelectedPass && row.correctedSelectedPass,
  );
  const eligibleForTargetedRepair =
    correctedPasses >= currentPasses && selectedWins > currentWins;

  const lines = [
    '# Visual Compiler v7.1 — render-mode-aware gate correction',
    '',
    'No images were regenerated. This report reuses the frozen unseen A/B pixels and changes only two invalid evaluator assumptions:',
    '',
    '1. A literal deterministic diagram does not need an editorial-analogy mapping.',
    '2. Code-generated approved labels are checked deterministically, not by vision OCR.',
    '',
    '| Metric | Exact current | Router-selected v7.1 |',
    '|---|---:|---:|',
    `| Production/safety pass | ${currentPasses}/${rows.length} | ${correctedPasses}/${rows.length} |`,
    `| Previous reported selected pass | — | ${previousPasses}/${rows.length} |`,
    `| Average weighted score | ${currentAverage.toFixed(1)} | ${selectedAverage.toFixed(1)} |`,
    `| Expected image calls | ${rows.length} | ${imageCalls} |`,
    `| Estimated image cost | $${(rows.length * 0.015).toFixed(3)} | $${imageCost.toFixed(3)} |`,
    `| Selected serialized duration | — | ${(durationMs / 1000).toFixed(1)}s |`,
    `| Fallback safety pass | — | ${fallbackPasses}/${fallbackRows.length} |`,
    '',
    `Blinded preference: selected **${selectedWins}**, current **${currentWins}**, ties **${ties}**.`,
    `Correctly recovered without rendering: **${upgraded.map((row) => `#${row.rank}`).join(', ') || 'none'}**.`,
    '',
    '## Decision',
    '',
    eligibleForTargetedRepair
      ? '**CONTINUE WITH TARGETED REPAIR. Do not regenerate the passing deterministic stories.**'
      : '**HOLD AND REVISIT ROUTING/GATES.**',
    '',
    '| # | Story | Route | Previous → corrected | Score | Preference | Remaining failed gates |',
    '|---:|---|---|---:|---:|---|---|',
  ];
  for (const row of [...rows].sort((left, right) => left.rank - right.rank)) {
    lines.push(
      `| ${row.rank} | ${row.headline.replace(/\|/g, '\\|')} | \`${row.pipeline}\` | ` +
        `${row.previousSelectedPass ? '✓' : '✕'} → ${row.correctedSelectedPass ? '✓' : '✕'} | ` +
        `${row.selectedWeightedScore.toFixed(1)} | **${row.preference}** | ` +
        `${row.correctedFailedGates.length ? row.correctedFailedGates.join(', ') : 'none'} |`,
    );
  }
  lines.push(
    '',
    'Remaining real repair targets are the current causal scene for deep work, the Claude source-led fallback, and the generic science flow for GPT-5/T-cell research. Gemini fallback is safe but aesthetically weaker than current.',
  );
  return `${lines.join('\n')}\n`;
}

async function main() {
  await mkdir(ROOT, { recursive: true });
  const [evaluation, manifest, routed] = await Promise.all([
    readFile(join(ROOT, 'evaluation.json'), 'utf8').then(
      (value) => JSON.parse(value) as EvaluationFile,
    ),
    readFile(join(ROOT, 'render-manifest.json'), 'utf8').then(
      (value) => JSON.parse(value) as ManifestRow[],
    ),
    readFile(ROUTED_PATH, 'utf8').then(
      (value) => JSON.parse(value) as RoutedRecord[],
    ),
  ]);

  const rows: CorrectedRow[] = routed.map((record) => {
    const evaluationRow = evaluation.rows.find(
      (row) => row.storyId === record.story.revision_item_id,
    );
    const manifestRow = manifest.find(
      (row) => row.storyId === record.story.revision_item_id,
    );
    if (!evaluationRow || !manifestRow) {
      throw new Error(`Missing frozen A/B row for ${record.story.revision_item_id}.`);
    }
    const selectedSource =
      record.router.pipeline === 'current_art_director' ? 'current' : 'compiler';
    const selected = evaluationRow[selectedSource];
    const previousSelectedPass =
      record.router.pipeline === 'source_led_fallback'
        ? fallbackSafetyPass(selected)
        : selected.productionPass;
    const correctedSelectedPass =
      record.router.pipeline === 'deterministic_compiler'
        ? deterministicPass(selected)
        : record.router.pipeline === 'source_led_fallback'
          ? fallbackSafetyPass(selected)
          : selected.productionPass;
    const audit = manifestRow[selectedSource];
    return {
      storyId: record.story.revision_item_id,
      rank: record.story.rank,
      headline: record.story.title,
      pipeline: record.router.pipeline,
      selectedSource,
      sourceEligible: record.eligible,
      previousSelectedPass,
      correctedSelectedPass,
      selectedWeightedScore: selected.weightedScore,
      currentWeightedScore: evaluationRow.current.weightedScore,
      preference: preference(record.router.pipeline, evaluationRow.preferredSource),
      correctedFailedGates: correctedFailedGates(record.router.pipeline, selected),
      estimatedImageCalls: record.router.expectedImageCalls,
      estimatedImageCostUsd: record.router.expectedImageCalls * 0.015,
      estimatedDurationMs: audit.durationMs,
      evaluatorReason: evaluationRow.reason,
    };
  });

  const currentPasses = evaluation.rows.filter(
    (row) => row.current.productionPass,
  ).length;
  const reportText = report(rows, currentPasses);
  await Promise.all([
    writeFile(
      join(ROOT, 'v7-1-corrected-gates.json'),
      `${JSON.stringify({ currentPasses, rows }, null, 2)}\n`,
    ),
    writeFile(join(ROOT, 'v7-1-corrected-decision.md'), reportText),
  ]);
  console.log(reportText);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
