/**
 * Vision-critic model bake-off.
 *
 * Picks the model that should back the LIVE weekly image critic
 * (`CONTENT_SIM_VISION_OPENROUTER_MODEL`). It deliberately uses the production
 * critic prompt from `src/lib/content-sim/vision-critic.ts` rather than any
 * experiment rubric — the model is being selected for that job, not for an A/B
 * harness.
 *
 * Ground truth comes from a JSON file of OWNER verdicts (see
 * `experiments/critic-ground-truth/`), because the only authority on whether an
 * illustration is publishable is the person who publishes it. Each item is
 * labelled:
 *
 *   ship    the owner would publish it   -> the critic MUST pass it
 *   reject  the owner called it unusable -> the critic MUST fail it
 *   defect  concept accepted, one named flaw blocks it -> reported, not scored,
 *           because reasonable critics may disagree on whether a named flaw is
 *           blocking. A `mustFlag` code, when present, is still checked.
 *
 * Both directions matter and they trade off. A model that fails everything wins
 * on `reject` recall and is still useless, because it would block the weekly
 * release outright. `ship` accuracy is the counterweight — read the two numbers
 * together, never one alone.
 *
 * Reads an image package produced by any of the visual A/B workflows
 * (render-manifest.json + images/). Writes a markdown + JSON verdict.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { generateWithVision } from '../pipeline/providers/vision';
import {
  buildImageCriticPrompt,
  parseImageCriticResponse,
  type ImageCriticBlockerCode,
} from '../src/lib/content-sim/vision-critic';

const PACKAGE_DIR = resolve(
  process.env.CRITIC_BAKEOFF_PACKAGE?.trim() || 'artifacts/_local/visual-run',
);
const GROUND_TRUTH = resolve(
  process.env.CRITIC_BAKEOFF_GROUND_TRUTH?.trim() ||
    'experiments/critic-ground-truth/owner-verdicts-v6.json',
);
const OUT_DIR = resolve(process.env.CRITIC_BAKEOFF_OUT?.trim() || 'artifacts/_local/critic-bakeoff');
const SAMPLES = Math.max(1, Number(process.env.CRITIC_BAKEOFF_SAMPLES ?? 3));
const MODELS = (
  process.env.CRITIC_BAKEOFF_MODELS?.trim() ||
  'google/gemini-2.5-flash,anthropic/claude-sonnet-5,google/gemini-3.1-pro-preview'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

type Verdict = 'ship' | 'reject' | 'defect';

interface GroundTruthItem {
  image: string;
  rank: number;
  arm: string;
  verdict: Verdict;
  why: string;
  mustFlag?: ImageCriticBlockerCode;
}

interface GroundTruthFile {
  source: string;
  package?: string;
  note?: string;
  items: GroundTruthItem[];
}

interface ManifestRow {
  rank: number;
  headline?: string;
  story: {
    title: string;
    summary?: string;
    why?: string | null;
    practical?: string | null;
    takeaway?: string | null;
  };
}

interface Observation {
  key: string;
  verdict: Verdict;
  model: string;
  sample: number;
  passed: boolean;
  overall: number;
  blockers: ImageCriticBlockerCode[];
  parseFailed: boolean;
  costUsd: number | null;
  error?: string;
}

function promptFor(row: ManifestRow): string {
  return buildImageCriticPrompt({
    headline: row.story.title,
    summary: row.story.summary ?? undefined,
    why: row.story.why ?? undefined,
    practical: row.story.practical ?? undefined,
    takeaway: row.story.takeaway ?? undefined,
    policyId: 'weekly-semantic-story-v5.1',
  });
}

async function observe(
  item: GroundTruthItem,
  row: ManifestRow,
  model: string,
  sample: number,
): Promise<Observation> {
  const key = `${item.rank}-${item.arm}`;
  const base = { key, verdict: item.verdict, model, sample };
  try {
    const imageBytes = await readFile(join(PACKAGE_DIR, item.image));
    const result = await generateWithVision('weekly.image_critic', {
      prompt: promptFor(row),
      imageBytes,
      mimeType: 'image/jpeg',
      openRouterModel: model,
      timeoutMs: 120_000,
    });
    const critique = parseImageCriticResponse(result.text);
    return {
      ...base,
      passed: critique.passed,
      overall: critique.scores?.overall ?? 0,
      blockers: critique.blockers.map((blocker) => blocker.code as ImageCriticBlockerCode),
      parseFailed: critique.blockers.some((blocker) => blocker.code === 'critic_parse_error'),
      costUsd: result.usage?.costUsd ?? null,
    };
  } catch (error) {
    return {
      ...base,
      passed: false,
      overall: 0,
      blockers: [],
      parseFailed: true,
      costUsd: null,
      error: error instanceof Error ? error.message.slice(0, 200) : String(error),
    };
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function spread(values: number[]): number {
  return values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);
}

async function main(): Promise<void> {
  const truth = JSON.parse(await readFile(GROUND_TRUTH, 'utf8')) as GroundTruthFile;
  const manifestRaw = await readFile(join(PACKAGE_DIR, 'render-manifest.json'), 'utf8');
  const parsedManifest: unknown = JSON.parse(manifestRaw);
  const rows: ManifestRow[] = Array.isArray(parsedManifest)
    ? (parsedManifest as ManifestRow[])
    : ((parsedManifest as { rows?: ManifestRow[] }).rows ?? []);
  const rowByRank = new Map<number, ManifestRow>(rows.map((row) => [row.rank, row]));

  const observations: Observation[] = [];
  for (const model of MODELS) {
    for (const item of truth.items) {
      const row = rowByRank.get(item.rank);
      if (!row) {
        console.warn(`[bakeoff] no manifest row for rank ${item.rank}; skipping ${item.image}`);
        continue;
      }
      for (let sample = 1; sample <= SAMPLES; sample += 1) {
        const observation = await observe(item, row, model, sample);
        observations.push(observation);
        console.log(
          `[bakeoff] ${model} ${observation.key} (${item.verdict}) s${sample}: ` +
            `passed=${observation.passed} overall=${observation.overall} ` +
            `blockers=[${observation.blockers.join(',')}]` +
            `${observation.error ? ` ERROR ${observation.error}` : ''}`,
        );
      }
    }
  }

  const perModel = MODELS.map((model) => {
    const mine = observations.filter((observation) => observation.model === model);
    const keys = [...new Set(mine.map((observation) => observation.key))];

    let rejectCaught = 0;
    let rejectTotal = 0;
    let shipKept = 0;
    let shipTotal = 0;
    let flagged = 0;
    let flagTotal = 0;
    let insufficient = 0;
    const spreads: number[] = [];

    const perKey = keys.map((key) => {
      const runs = mine.filter((observation) => observation.key === key);
      // Transport failures and unparseable replies surface as passed=false.
      // Counting them would credit whichever model errors most with the
      // strictest gate, so they are excluded and the image is reported as
      // `insufficient` instead.
      const valid = runs.filter((run) => !run.error && !run.parseFailed);
      const enough = valid.length * 2 > runs.length;
      const failures = valid.filter((run) => !run.passed).length;
      const majorityFailed = enough && failures * 2 > valid.length;
      const item = truth.items.find((entry) => `${entry.rank}-${entry.arm}` === key);
      const verdict: Verdict = item?.verdict ?? 'reject';

      if (!enough) insufficient += 1;
      if (verdict === 'reject') {
        rejectTotal += 1;
        if (majorityFailed) rejectCaught += 1;
      }
      if (verdict === 'ship') {
        shipTotal += 1;
        if (enough && !majorityFailed) shipKept += 1;
      }
      if (item?.mustFlag) {
        const wanted = item.mustFlag;
        flagTotal += 1;
        const hits = valid.filter((run) => run.blockers.includes(wanted)).length;
        if (enough && hits * 2 > valid.length) flagged += 1;
      }

      const overalls = valid.map((run) => run.overall);
      if (overalls.length > 0) spreads.push(spread(overalls));

      let agrees: boolean | null = null;
      if (enough && verdict === 'ship') agrees = !majorityFailed;
      if (enough && verdict === 'reject') agrees = majorityFailed;

      return {
        key,
        ownerVerdict: verdict,
        criticVerdict: enough ? (majorityFailed ? 'fail' : 'pass') : 'insufficient',
        agrees,
        validSamples: valid.length,
        totalSamples: runs.length,
        medianOverall: median(overalls),
        overallSpread: overalls.length > 0 ? spread(overalls) : 0,
        blockerUnion: [...new Set(valid.flatMap((run) => run.blockers))],
        errors: runs.filter((run) => run.error).length,
      };
    });

    const costs = mine
      .map((observation) => observation.costUsd)
      .filter((value): value is number => value != null);
    return {
      model,
      rejectCaught,
      rejectTotal,
      shipKept,
      shipTotal,
      flagged,
      flagTotal,
      insufficient,
      worstOverallSpread: Math.max(0, ...spreads),
      errors: mine.filter((observation) => observation.error).length,
      reportedCostUsd: costs.reduce((sum, value) => sum + value, 0),
      perKey,
    };
  });

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    join(OUT_DIR, 'bakeoff.json'),
    `${JSON.stringify(
      { models: MODELS, samples: SAMPLES, groundTruth: truth.source, perModel, observations },
      null,
      2,
    )}\n`,
  );

  const lines: string[] = [
    '# Vision critic model bake-off',
    '',
    'Prompt: production `buildImageCriticPrompt` (policy `weekly-semantic-story-v5.1`).',
    `Ground truth: ${truth.source}`,
    `${truth.items.length} images, ${SAMPLES} samples per model per image.`,
    '',
    '**Read both columns together.** A model that fails everything scores a perfect',
    '`reject` recall and would still block the weekly release outright. `ship` accuracy is',
    'the counterweight. Images labelled `defect` are reported but not scored.',
    '',
    '| Model | Rejected the bad | Kept the good | Named flaw caught | Insufficient | Worst spread | Errors | Cost |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...perModel.map(
      (entry) =>
        `| \`${entry.model}\` | ${entry.rejectCaught}/${entry.rejectTotal} | ` +
        `${entry.shipKept}/${entry.shipTotal} | ${entry.flagged}/${entry.flagTotal} | ` +
        `${entry.insufficient} | ${entry.worstOverallSpread} | ${entry.errors} | ` +
        `$${entry.reportedCostUsd.toFixed(4)} |`,
    ),
    '',
    '## Per image',
    '',
    '| Model | Image | Owner | Critic | Agrees | Valid | Median | Spread | Blockers |',
    '|---|---|---|---|---|---:|---:|---:|---|',
    ...perModel.flatMap((entry) =>
      entry.perKey.map(
        (key) =>
          `| \`${entry.model}\` | ${key.key} | ${key.ownerVerdict} | ${key.criticVerdict} | ` +
          `${key.agrees === null ? '—' : key.agrees ? 'yes' : '**NO**'} | ` +
          `${key.validSamples}/${key.totalSamples} | ${key.medianOverall} | ` +
          `${key.overallSpread} | ${key.blockerUnion.join(', ') || '—'} |`,
      ),
    ),
    '',
    '## Owner verdicts used',
    '',
    ...truth.items.map((item) => `- \`${item.rank}-${item.arm}\` **${item.verdict}** — ${item.why}`),
    '',
    truth.note ?? '',
    '',
    'No model is switched automatically. This report is evidence for an owner decision.',
    '',
  ];
  await writeFile(join(OUT_DIR, 'bakeoff-report.md'), `${lines.join('\n')}\n`);
  console.log(`\n[bakeoff] wrote ${join(OUT_DIR, 'bakeoff-report.md')}`);
  for (const entry of perModel) {
    console.log(
      `[bakeoff] ${entry.model}: rejected ${entry.rejectCaught}/${entry.rejectTotal}, ` +
        `kept ${entry.shipKept}/${entry.shipTotal}, worst spread ${entry.worstOverallSpread}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
