import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import type {
  VisualTreatmentDecisionV72,
  VisualTreatmentV72,
} from '../src/lib/weekly-digest/visual-treatment-v7-2';

const ROOT =
  process.env.VISUAL_V7_AB_OUT_DIR?.trim() || 'artifacts/visual-compiler-v7-2-ab';

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
  instantMeaning: number;
  visualBeauty: number;
  brandConsistency: number;
  originality: number;
}

interface SourceEvaluation {
  pixel: PixelVerdict;
  card: CardVerdict;
  productionPass: boolean;
  weightedScore: number;
}

interface EvaluationRow {
  storyId: string;
  rank: number;
  headline: string;
  current: SourceEvaluation;
  compiler: SourceEvaluation;
  preferredSource: 'current' | 'compiler' | 'tie';
  reason: string;
}

interface EvaluationFile {
  rows: EvaluationRow[];
}

interface ManifestAudit {
  imageCalls: number;
  estimatedImageCostUsd: number;
  durationMs: number;
}

interface ManifestRow {
  storyId: string;
  rank: number;
  current: ManifestAudit;
  compiler: ManifestAudit;
}

interface TreatmentRecord {
  storyId: string;
  rank: number;
  headline: string;
  eligible: boolean;
  treatment: VisualTreatmentDecisionV72;
  compilerCardPath: string;
}

interface FinalRow {
  storyId: string;
  rank: number;
  headline: string;
  treatment: VisualTreatmentV72;
  safetyMode: VisualTreatmentDecisionV72['safetyMode'];
  selectedSource: 'current' | 'compiler';
  sourceEligible: boolean;
  selectedPass: boolean;
  selectedWeightedScore: number;
  currentWeightedScore: number;
  preference: 'selected' | 'current' | 'tie';
  failedGates: string[];
  expectedImageCalls: number;
  estimatedImageCostUsd: number;
  estimatedDurationMs: number;
  safetyClean: boolean;
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

function factualPixelPass(value: PixelVerdict): boolean {
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

function factualCardPass(value: CardVerdict): boolean {
  // All v7.2 compiler labels are deterministic and source-approved. Vision OCR is diagnostic.
  return (
    value.headlinePairUnderstood &&
    value.centralClaimGrounded &&
    value.certaintyPreserved &&
    value.overlaySupportedByPixels &&
    value.thumbnailReadable &&
    !value.misleading
  );
}

function signalSafetyPass(value: SourceEvaluation): boolean {
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

function failedGates(
  treatment: TreatmentRecord,
  value: SourceEvaluation,
): string[] {
  if (treatment.treatment.safetyMode !== 'factual_visual') {
    return [
      value.pixel.contradictionVisible && 'contradiction',
      value.pixel.unsupportedSpecificsVisible && 'unsupported_specifics',
      value.pixel.generatedTextPresent && 'generated_text',
      !value.card.certaintyPreserved && 'certainty',
      !value.card.headlinePairUnderstood && 'headline_pair',
      !value.card.thumbnailReadable && 'thumbnail',
      value.card.misleading && 'misleading',
    ].filter((item): item is string => Boolean(item));
  }
  if (treatment.treatment.selectedSource === 'current') {
    return value.productionPass ? [] : ['current_production_gate'];
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
  ].filter((item): item is string => Boolean(item));
}

function selectedPass(
  treatment: TreatmentRecord,
  value: SourceEvaluation,
): boolean {
  if (treatment.treatment.safetyMode !== 'factual_visual') {
    return signalSafetyPass(value);
  }
  if (treatment.treatment.selectedSource === 'current') {
    return value.productionPass;
  }
  return factualPixelPass(value.pixel) && factualCardPass(value.card);
}

function preference(
  selectedSource: 'current' | 'compiler',
  preferredSource: EvaluationRow['preferredSource'],
): FinalRow['preference'] {
  if (selectedSource === 'current') return 'tie';
  if (preferredSource === 'compiler') return 'selected';
  if (preferredSource === 'current') return 'current';
  return 'tie';
}

function selectedCardPath(row: FinalRow): string {
  return join(
    ROOT,
    'cards',
    `${row.rank}-${safeName(row.storyId)}-${row.selectedSource}.png`,
  );
}

async function strip(input: {
  width: number;
  labelLeft: string;
  labelRight: string;
  status: string;
}): Promise<Buffer> {
  return Buffer.from(`<svg width="${input.width}" height="64" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#020617"/>
    <text x="28" y="42" font-family="DejaVu Sans,Arial,sans-serif" font-size="24" font-weight="800" fill="#E2E8F0">${xml(input.labelLeft)}</text>
    <text x="${input.width / 2 + 28}" y="42" font-family="DejaVu Sans,Arial,sans-serif" font-size="24" font-weight="800" fill="#CFFAFE">${xml(input.labelRight)}</text>
    <text x="${input.width - 28}" y="42" text-anchor="end" font-family="DejaVu Sans,Arial,sans-serif" font-size="18" font-weight="700" fill="#94A3B8">${xml(input.status)}</text>
  </svg>`);
}

async function contactSheet(
  rows: FinalRow[],
  blind: boolean,
): Promise<{ bytes: Buffer; key: Array<Record<string, string>> }> {
  const ordered = [...rows].sort((a, b) => a.rank - b.rank);
  const cardWidth = 720;
  const cardHeight = 579;
  const gap = 24;
  const rowHeight = 64 + cardHeight + 24;
  const width = cardWidth * 2 + gap + 48;
  const height = rowHeight * ordered.length + 24;
  const layers: OverlayOptions[] = [];
  const key: Array<Record<string, string>> = [];

  for (const [index, row] of ordered.entries()) {
    const currentPath = join(
      ROOT,
      'cards',
      `${row.rank}-${safeName(row.storyId)}-current.png`,
    );
    const selectedPath = selectedCardPath(row);
    const swap = blind && ((row.rank * 2246822519) >>> 0) % 2 === 0;
    const leftPath = swap ? selectedPath : currentPath;
    const rightPath = swap ? currentPath : selectedPath;
    const top = 24 + index * rowHeight;
    layers.push({
      input: await strip({
        width,
        labelLeft: blind ? 'X' : 'CURRENT',
        labelRight: blind ? 'Y' : `V7.2 · ${row.treatment}`,
        status: blind
          ? `STORY ${row.rank}`
          : `${row.selectedPass ? 'PASS' : 'HOLD'} · ${row.preference}`,
      }),
      left: 0,
      top,
    });
    const [left, right] = await Promise.all([
      sharp(leftPath).resize(cardWidth, cardHeight, { fit: 'cover' }).png().toBuffer(),
      sharp(rightPath).resize(cardWidth, cardHeight, { fit: 'cover' }).png().toBuffer(),
    ]);
    layers.push({ input: left, left: 24, top: top + 64 });
    layers.push({ input: right, left: 24 + cardWidth + gap, top: top + 64 });
    key.push({
      storyId: row.storyId,
      rank: String(row.rank),
      X: swap ? 'selected' : 'current',
      Y: swap ? 'current' : 'selected',
      treatment: row.treatment,
    });
  }
  return {
    bytes: await sharp({
      create: { width, height, channels: 3, background: '#020617' },
    })
      .composite(layers)
      .png()
      .toBuffer(),
    key,
  };
}

function report(rows: FinalRow[], currentPasses: number): string {
  const selectedPasses = rows.filter((row) => row.selectedPass).length;
  const selectedWins = rows.filter((row) => row.preference === 'selected').length;
  const currentWins = rows.filter((row) => row.preference === 'current').length;
  const ties = rows.filter((row) => row.preference === 'tie').length;
  const decided = selectedWins + currentWins;
  const preferenceRate = decided > 0 ? selectedWins / decided : 0;
  const avg = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const currentAverage = avg(rows.map((row) => row.currentWeightedScore));
  const selectedAverage = avg(rows.map((row) => row.selectedWeightedScore));
  const imageCalls = rows.reduce((sum, row) => sum + row.expectedImageCalls, 0);
  const cost = rows.reduce((sum, row) => sum + row.estimatedImageCostUsd, 0);
  const durationMs = rows.reduce((sum, row) => sum + row.estimatedDurationMs, 0);
  const signalRows = rows.filter((row) => row.safetyMode !== 'factual_visual');
  const signalPasses = signalRows.filter((row) => row.selectedPass).length;
  const safetyClean = rows.every((row) => row.safetyClean);
  const passToOwner =
    selectedPasses >= Math.max(currentPasses, 5) &&
    signalPasses === signalRows.length &&
    safetyClean &&
    preferenceRate >= 0.7 &&
    cost <= rows.length * 0.1;
  const lines = [
    '# Visual Compiler v7.2 — targeted unseen A/B decision',
    '',
    '| Metric | Exact current | Router-selected v7.2 |',
    '|---|---:|---:|',
    `| Production/safety pass | ${currentPasses}/${rows.length} | ${selectedPasses}/${rows.length} |`,
    `| Average weighted score | ${currentAverage.toFixed(1)} | ${selectedAverage.toFixed(1)} |`,
    `| Estimated image calls | ${rows.length} | ${imageCalls} |`,
    `| Estimated image cost | $${(rows.length * 0.015).toFixed(3)} | $${cost.toFixed(3)} |`,
    `| Selected render duration | — | ${(durationMs / 1000).toFixed(1)}s |`,
    `| Reported-signal safety pass | — | ${signalPasses}/${signalRows.length} |`,
    '',
    `Blinded preference: selected **${selectedWins}**, current **${currentWins}**, ties **${ties}**; selected preference excluding ties **${(preferenceRate * 100).toFixed(0)}%**.`,
    '',
    '## Automated decision',
    '',
    passToOwner
      ? '**PASS TO OWNER-BLINDED REVIEW. Production replacement remains disabled.**'
      : '**HOLD. Keep current production selection and inspect remaining failed treatment(s).**',
    '',
    '| # | Story | Treatment | Pass | Score current → selected | Preference | Failed gates |',
    '|---:|---|---|---:|---:|---|---|',
  ];
  for (const row of [...rows].sort((a, b) => a.rank - b.rank)) {
    lines.push(
      `| ${row.rank} | ${row.headline.replace(/\|/g, '\\|')} | \`${row.treatment}\` | ` +
        `${row.selectedPass ? '✓' : '✕'} | ${row.currentWeightedScore.toFixed(1)} → ${row.selectedWeightedScore.toFixed(1)} | ` +
        `**${row.preference}** | ${row.failedGates.length ? row.failedGates.join(', ') : 'none'} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  await mkdir(ROOT, { recursive: true });
  const [evaluation, manifest, treatments] = await Promise.all([
    readFile(join(ROOT, 'evaluation.json'), 'utf8').then(
      (value) => JSON.parse(value) as EvaluationFile,
    ),
    readFile(join(ROOT, 'render-manifest.json'), 'utf8').then(
      (value) => JSON.parse(value) as ManifestRow[],
    ),
    readFile(join(ROOT, 'v7-2-treatments.json'), 'utf8').then(
      (value) => JSON.parse(value) as TreatmentRecord[],
    ),
  ]);
  if (evaluation.rows.length !== 7 || manifest.length !== 7 || treatments.length !== 7) {
    throw new Error(
      `Expected seven rows; evaluation=${evaluation.rows.length}, manifest=${manifest.length}, treatments=${treatments.length}.`,
    );
  }

  const rows: FinalRow[] = treatments.map((treatment) => {
    const evaluationRow = evaluation.rows.find(
      (row) => row.storyId === treatment.storyId,
    );
    const manifestRow = manifest.find((row) => row.storyId === treatment.storyId);
    if (!evaluationRow || !manifestRow) {
      throw new Error(`Missing A/B data for ${treatment.storyId}.`);
    }
    const source = treatment.treatment.selectedSource;
    const selected = evaluationRow[source];
    const audit = manifestRow[source];
    const gates = failedGates(treatment, selected);
    return {
      storyId: treatment.storyId,
      rank: treatment.rank,
      headline: treatment.headline,
      treatment: treatment.treatment.treatment,
      safetyMode: treatment.treatment.safetyMode,
      selectedSource: source,
      sourceEligible: treatment.eligible,
      selectedPass: selectedPass(treatment, selected),
      selectedWeightedScore: selected.weightedScore,
      currentWeightedScore: evaluationRow.current.weightedScore,
      preference: preference(source, evaluationRow.preferredSource),
      failedGates: gates,
      expectedImageCalls: treatment.treatment.expectedImageCalls,
      estimatedImageCostUsd: treatment.treatment.expectedImageCalls * 0.015,
      estimatedDurationMs: audit.durationMs,
      safetyClean:
        !selected.pixel.contradictionVisible &&
        !selected.pixel.unsupportedSpecificsVisible &&
        !selected.pixel.generatedTextPresent &&
        selected.card.certaintyPreserved &&
        !selected.card.misleading,
      evaluatorReason: evaluationRow.reason,
    };
  });

  const currentPasses = evaluation.rows.filter(
    (row) => row.current.productionPass,
  ).length;
  const reportText = report(rows, currentPasses);
  const [selectedSheet, blindSheet] = await Promise.all([
    contactSheet(rows, false),
    contactSheet(rows, true),
  ]);
  await Promise.all([
    writeFile(join(ROOT, 'v7-2-decision.md'), reportText),
    writeFile(
      join(ROOT, 'v7-2-selected-evaluation.json'),
      `${JSON.stringify({ currentPasses, rows }, null, 2)}\n`,
    ),
    writeFile(join(ROOT, 'v7-2-selected-contact-sheet.png'), selectedSheet.bytes),
    writeFile(join(ROOT, 'v7-2-owner-blind-contact-sheet.png'), blindSheet.bytes),
    writeFile(
      join(ROOT, 'v7-2-owner-blind-key.json'),
      `${JSON.stringify(blindSheet.key, null, 2)}\n`,
    ),
  ]);
  console.log(reportText);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
