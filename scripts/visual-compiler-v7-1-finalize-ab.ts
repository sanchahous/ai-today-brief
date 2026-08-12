import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
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
  certainty: string;
  mappingMode: string;
  format: string;
  renderMode: string;
  claimEligible: boolean;
  current: SourceEvaluation;
  compiler: SourceEvaluation;
  preferredSource: 'current' | 'compiler' | 'tie';
  confidence: number;
  reason: string;
}

interface EvaluationFile {
  rows: EvaluationRow[];
  usage?: Record<string, unknown>;
}

interface ManifestAudit {
  imageCalls: number;
  estimatedImageCostUsd: number;
  durationMs: number;
}

interface ManifestRow {
  storyId: string;
  rank: number;
  headline: string;
  current: ManifestAudit;
  compiler: ManifestAudit;
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
    reason: string;
    expectedImageCalls: 0 | 1;
    requiredGuards: string[];
  };
}

type Source = 'current' | 'compiler';

interface SelectedRow {
  storyId: string;
  rank: number;
  headline: string;
  pipeline: VisualPipelineV7;
  sourceEligible: boolean;
  selectedSource: Source;
  selectedPass: boolean;
  selectedSafetyPass: boolean;
  selectedWeightedScore: number;
  currentWeightedScore: number;
  preferred: 'selected' | 'current' | 'tie';
  generatedTextFree: boolean;
  unsupportedSpecificsFree: boolean;
  contradictionFree: boolean;
  certaintyPreserved: boolean;
  misleading: boolean;
  expectedImageCalls: number;
  estimatedImageCostUsd: number;
  estimatedDurationMs: number;
  routerReason: string;
  evaluatorReason: string;
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeName(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80);
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

function routeSelectedSource(pipeline: VisualPipelineV7): Source {
  return pipeline === 'current_art_director' ? 'current' : 'compiler';
}

function relativePreference(
  selectedSource: Source,
  preferredSource: EvaluationRow['preferredSource'],
): SelectedRow['preferred'] {
  if (selectedSource === 'current') return 'tie';
  if (preferredSource === 'compiler') return 'selected';
  if (preferredSource === 'current') return 'current';
  return 'tie';
}

function selectedCardPath(record: RoutedRecord, source: Source): string {
  const label = `${record.story.rank}-${safeName(record.story.revision_item_id)}`;
  return resolve(ROOT, 'cards', `${label}-${source}.png`);
}

function summarize(rows: SelectedRow[], evaluations: EvaluationRow[], manifest: ManifestRow[]) {
  const selectedPasses = rows.filter((row) => row.selectedPass).length;
  const fallbackRows = rows.filter((row) => row.pipeline === 'source_led_fallback');
  const fallbackPasses = fallbackRows.filter((row) => row.selectedSafetyPass).length;
  const currentProductionPasses = evaluations.filter((row) => row.current.productionPass).length;
  const selectedWins = rows.filter((row) => row.preferred === 'selected').length;
  const currentWins = rows.filter((row) => row.preferred === 'current').length;
  const ties = rows.filter((row) => row.preferred === 'tie').length;
  const average = (values: number[]) =>
    values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const selectedAverage = average(rows.map((row) => row.selectedWeightedScore));
  const currentAverage = average(rows.map((row) => row.currentWeightedScore));
  const currentCost = manifest.reduce(
    (sum, row) => sum + row.current.estimatedImageCostUsd,
    0,
  );
  const selectedCost = rows.reduce((sum, row) => sum + row.estimatedImageCostUsd, 0);
  const currentDurationMs = manifest.reduce((sum, row) => sum + row.current.durationMs, 0);
  const selectedDurationMs = rows.reduce((sum, row) => sum + row.estimatedDurationMs, 0);
  const safetyClean = rows.every(
    (row) =>
      row.generatedTextFree &&
      row.unsupportedSpecificsFree &&
      row.contradictionFree &&
      row.certaintyPreserved &&
      !row.misleading,
  );
  const eligibleForOwnerReview =
    rows.length === 7 &&
    selectedPasses >= currentProductionPasses &&
    fallbackPasses === fallbackRows.length &&
    safetyClean &&
    selectedCost <= 0.1 * rows.length;

  return {
    stories: rows.length,
    selectedPasses,
    fallbackPasses,
    fallbackStories: fallbackRows.length,
    currentProductionPasses,
    selectedWins,
    currentWins,
    ties,
    selectedAverage,
    currentAverage,
    currentCost,
    selectedCost,
    currentDurationMs,
    selectedDurationMs,
    expectedImageCalls: rows.reduce((sum, row) => sum + row.expectedImageCalls, 0),
    generatedTextFree: rows.filter((row) => row.generatedTextFree).length,
    safetyClean,
    eligibleForOwnerReview,
  };
}

function report(rows: SelectedRow[], summary: ReturnType<typeof summarize>): string {
  const costReduction =
    summary.currentCost > 0
      ? ((summary.currentCost - summary.selectedCost) / summary.currentCost) * 100
      : 0;
  const durationReduction =
    summary.currentDurationMs > 0
      ? ((summary.currentDurationMs - summary.selectedDurationMs) /
          summary.currentDurationMs) *
        100
      : 0;
  const lines = [
    '# Visual Compiler v7.1 — router-selected unseen A/B decision',
    '',
    `Stories: **${summary.stories}**.`,
    '',
    '| Metric | Exact current | Router-selected v7.1 |',
    '|---|---:|---:|',
    `| Production/safety pass | ${summary.currentProductionPasses}/${summary.stories} | ${summary.selectedPasses}/${summary.stories} |`,
    `| Average weighted score | ${summary.currentAverage.toFixed(1)} | ${summary.selectedAverage.toFixed(1)} |`,
    `| Estimated image calls | ${summary.stories} | ${summary.expectedImageCalls} |`,
    `| Estimated image cost | $${summary.currentCost.toFixed(3)} | $${summary.selectedCost.toFixed(3)} |`,
    `| Serialized render duration | ${(summary.currentDurationMs / 1000).toFixed(1)}s | ${(summary.selectedDurationMs / 1000).toFixed(1)}s |`,
    `| Generated-text-free selected pixels | — | ${summary.generatedTextFree}/${summary.stories} |`,
    '',
    `Estimated image-cost reduction: **${costReduction.toFixed(0)}%**.`,
    `Estimated serialized render-time reduction: **${durationReduction.toFixed(0)}%**.`,
    `Fallback safety pass: **${summary.fallbackPasses}/${summary.fallbackStories}**.`,
    `Blinded preference relative to current: selected **${summary.selectedWins}**, current **${summary.currentWins}**, ties **${summary.ties}**.`,
    '',
    '## Automated decision',
    '',
    summary.eligibleForOwnerReview
      ? '**PASS TO OWNER-BLINDED SHADOW REVIEW. Do not replace production automatically.**'
      : '**HOLD. Keep the current production pipeline and inspect failed routes before any shadow rollout.**',
    '',
    '| # | Story | Route | Eligible | Selected pass | Score current → selected | Preference | Safety |',
    '|---:|---|---|---:|---:|---:|---|---|',
  ];
  for (const row of [...rows].sort((left, right) => left.rank - right.rank)) {
    lines.push(
      `| ${row.rank} | ${row.headline.replace(/\|/g, '\\|')} | \`${row.pipeline}\` | ` +
        `${row.sourceEligible ? '✓' : '✕'} | ${row.selectedPass ? '✓' : '✕'} | ` +
        `${row.currentWeightedScore.toFixed(1)} → ${row.selectedWeightedScore.toFixed(1)} | ` +
        `**${row.preferred}** | ${
          row.generatedTextFree &&
          row.unsupportedSpecificsFree &&
          row.contradictionFree &&
          row.certaintyPreserved &&
          !row.misleading
            ? 'clean'
            : 'review'
        } |`,
    );
  }
  lines.push(
    '',
    'Fallback cards are judged as safe editorial placeholders: they must preserve certainty and avoid unsupported assertions, but they are not required to invent mechanism or outcome evidence.',
  );
  return `${lines.join('\n')}\n`;
}

async function titleStrip(input: {
  width: number;
  height: number;
  leftLabel: string;
  rightLabel: string;
  status: string;
}): Promise<Buffer> {
  const svg = `<svg width="${input.width}" height="${input.height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#020617"/>
    <text x="28" y="42" font-family="DejaVu Sans,Arial,sans-serif" font-size="24" font-weight="800" fill="#E2E8F0">${xml(input.leftLabel)}</text>
    <text x="${input.width / 2 + 28}" y="42" font-family="DejaVu Sans,Arial,sans-serif" font-size="24" font-weight="800" fill="#CFFAFE">${xml(input.rightLabel)}</text>
    <text x="${input.width - 28}" y="42" text-anchor="end" font-family="DejaVu Sans,Arial,sans-serif" font-size="18" font-weight="700" fill="#94A3B8">${xml(input.status)}</text>
  </svg>`;
  return Buffer.from(svg);
}

async function selectedSheet(
  routed: RoutedRecord[],
  rows: SelectedRow[],
  blind = false,
): Promise<{ bytes: Buffer; key: Array<Record<string, string>> }> {
  const cardWidth = 720;
  const cardHeight = 579;
  const gap = 24;
  const stripHeight = 64;
  const rowHeight = stripHeight + cardHeight + 24;
  const width = cardWidth * 2 + gap + 48;
  const height = rowHeight * routed.length + 24;
  const layers: OverlayOptions[] = [];
  const key: Array<Record<string, string>> = [];

  for (const [index, record] of [...routed].sort((a, b) => a.story.rank - b.story.rank).entries()) {
    const row = rows.find((candidate) => candidate.storyId === record.story.revision_item_id);
    if (!row) throw new Error(`Missing selected evaluation for ${record.story.revision_item_id}.`);
    const currentPath = selectedCardPath(record, 'current');
    const selectedPath = selectedCardPath(record, row.selectedSource);
    const swap = blind && ((record.story.rank * 2654435761) >>> 0) % 2 === 0;
    const leftPath = swap ? selectedPath : currentPath;
    const rightPath = swap ? currentPath : selectedPath;
    const leftSource = swap ? 'selected' : 'current';
    const rightSource = swap ? 'current' : 'selected';
    const top = 24 + index * rowHeight;
    const strip = await titleStrip({
      width,
      height: stripHeight,
      leftLabel: blind ? 'X' : 'CURRENT',
      rightLabel: blind ? 'Y' : `V7.1 · ${row.pipeline}`,
      status: blind ? `STORY ${record.story.rank}` : `${row.selectedPass ? 'PASS' : 'HOLD'} · ${row.preferred}`,
    });
    layers.push({ input: strip, left: 0, top });
    const [left, right] = await Promise.all([
      sharp(leftPath).resize(cardWidth, cardHeight, { fit: 'cover' }).png().toBuffer(),
      sharp(rightPath).resize(cardWidth, cardHeight, { fit: 'cover' }).png().toBuffer(),
    ]);
    layers.push({ input: left, left: 24, top: top + stripHeight });
    layers.push({ input: right, left: 24 + cardWidth + gap, top: top + stripHeight });
    key.push({
      storyId: record.story.revision_item_id,
      rank: String(record.story.rank),
      X: blind ? leftSource : 'current',
      Y: blind ? rightSource : 'selected',
      pipeline: row.pipeline,
    });
  }

  const bytes = await sharp({
    create: { width, height, channels: 3, background: '#020617' },
  })
    .composite(layers)
    .png()
    .toBuffer();
  return { bytes, key };
}

async function main() {
  await mkdir(ROOT, { recursive: true });
  const [evaluationFile, manifest, routed] = await Promise.all([
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
  if (evaluationFile.rows.length !== 7 || manifest.length !== 7 || routed.length !== 7) {
    throw new Error(
      `Expected seven rows; evaluation=${evaluationFile.rows.length}, manifest=${manifest.length}, routed=${routed.length}.`,
    );
  }

  const selectedRows: SelectedRow[] = routed.map((record) => {
    const evaluation = evaluationFile.rows.find(
      (row) => row.storyId === record.story.revision_item_id,
    );
    const render = manifest.find(
      (row) => row.storyId === record.story.revision_item_id,
    );
    if (!evaluation || !render) {
      throw new Error(`Missing A/B data for ${record.story.revision_item_id}.`);
    }
    const selectedSource = routeSelectedSource(record.router.pipeline);
    const selected = evaluation[selectedSource];
    const selectedAudit = render[selectedSource];
    const safetyPass = fallbackSafetyPass(selected);
    const selectedPass =
      record.router.pipeline === 'source_led_fallback'
        ? safetyPass
        : selected.productionPass;
    return {
      storyId: record.story.revision_item_id,
      rank: record.story.rank,
      headline: record.story.title,
      pipeline: record.router.pipeline,
      sourceEligible: record.eligible,
      selectedSource,
      selectedPass,
      selectedSafetyPass: safetyPass,
      selectedWeightedScore: selected.weightedScore,
      currentWeightedScore: evaluation.current.weightedScore,
      preferred: relativePreference(selectedSource, evaluation.preferredSource),
      generatedTextFree: !selected.pixel.generatedTextPresent,
      unsupportedSpecificsFree: !selected.pixel.unsupportedSpecificsVisible,
      contradictionFree: !selected.pixel.contradictionVisible,
      certaintyPreserved: selected.card.certaintyPreserved,
      misleading: selected.card.misleading,
      expectedImageCalls: record.router.expectedImageCalls,
      estimatedImageCostUsd: record.router.expectedImageCalls * 0.015,
      estimatedDurationMs:
        record.router.pipeline === 'current_art_director'
          ? render.current.durationMs
          : selectedAudit.durationMs,
      routerReason: record.router.reason,
      evaluatorReason: evaluation.reason,
    };
  });
  const summary = summarize(selectedRows, evaluationFile.rows, manifest);
  const reportText = report(selectedRows, summary);
  const [labeled, blind] = await Promise.all([
    selectedSheet(routed, selectedRows, false),
    selectedSheet(routed, selectedRows, true),
  ]);
  await Promise.all([
    writeFile(
      join(ROOT, 'v7-1-selected-evaluation.json'),
      `${JSON.stringify({ rows: selectedRows, summary }, null, 2)}\n`,
    ),
    writeFile(join(ROOT, 'v7-1-decision.md'), reportText),
    writeFile(join(ROOT, 'v7-1-selected-contact-sheet.png'), labeled.bytes),
    writeFile(join(ROOT, 'v7-1-owner-blind-contact-sheet.png'), blind.bytes),
    writeFile(join(ROOT, 'v7-1-owner-blind-key.json'), `${JSON.stringify(blind.key, null, 2)}\n`),
  ]);
  console.log(reportText);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
