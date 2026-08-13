/**
 * Vision-critic model bake-off.
 *
 * Picks the model that should back the LIVE weekly image critic
 * (`CONTENT_SIM_VISION_OPENROUTER_MODEL`). It deliberately uses the production
 * critic prompt from `src/lib/content-sim/vision-critic.ts` rather than any
 * experiment rubric — the model is being selected for that job, not for an A/B
 * harness.
 *
 * Why these images: the six candidates in the targeted V10 run are all
 * independently known to be unshippable, from two different sources.
 *
 *   - The V8 arm carries the owner's own verdicts recorded in
 *     `OWNER_VISUAL_CALIBRATION_V10` (reject / reject / major_rework).
 *   - Both deterministic V10 cards bake legible text straight into the raster;
 *     that is mechanically certain from the SVG source, so `readable_text` is a
 *     ground truth no judgement call can soften.
 *
 * A critic that passes any of the six, or misses the baked text, cannot be
 * trusted to gate a weekly release. On top of that we measure self-consistency,
 * because the incumbent `gemini-2.5-flash` was observed spreading 15.5 weighted
 * points while re-scoring unchanged pixels.
 *
 * Reads a run package produced by `.github/workflows/visual-experiment.yml`
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
const OUT_DIR = resolve(process.env.CRITIC_BAKEOFF_OUT?.trim() || 'artifacts/_local/critic-bakeoff');
const SAMPLES = Math.max(1, Number(process.env.CRITIC_BAKEOFF_SAMPLES ?? 3));
const MODELS = (
  process.env.CRITIC_BAKEOFF_MODELS?.trim() ||
  'google/gemini-2.5-flash,anthropic/claude-sonnet-5,google/gemini-3.1-pro-preview'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

type Arm = 'v8' | 'v10';

interface ManifestRow {
  storyId: string;
  rank: number;
  headline: string;
  story: {
    title: string;
    summary?: string;
    why?: string | null;
    practical?: string | null;
    takeaway?: string | null;
  };
  candidatePixelPath: string;
  baselinePixelPath: string;
}

/**
 * Ground truth. `mustFail` holds for every row: three from the owner's recorded
 * verdicts, three from the corrected-harness blockers plus direct inspection.
 * `mustFlag` is only asserted where the defect is mechanically certain.
 */
const EXPECTATION: Record<string, { mustFail: true; mustFlag?: ImageCriticBlockerCode; why: string }> = {
  '2-v8': { mustFail: true, why: 'owner: reject — ambiguous_diagram, weak_visual_thesis, labels_carry_claim' },
  '4-v8': { mustFail: true, why: 'owner: major_rework — anatomy_error, unclear_causal_source' },
  '5-v8': { mustFail: true, why: 'owner: reject — generic_diagram, ambiguous_diagram, labels_carry_claim' },
  '2-v10': {
    mustFail: true,
    mustFlag: 'readable_text',
    why: 'deterministic SVG bakes two JavaScript listings into the raster',
  },
  '4-v10': { mustFail: true, why: 'beam never reaches the hint card; the amber route is broken by an unlit tile' },
  '5-v10': {
    mustFail: true,
    mustFlag: 'readable_text',
    why: 'deterministic SVG bakes BOUNDED 1/2/3 into the raster',
  },
};

interface Observation {
  key: string;
  rank: number;
  arm: Arm;
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
  row: ManifestRow,
  arm: Arm,
  imagePath: string,
  model: string,
  sample: number,
): Promise<Observation> {
  const key = `${row.rank}-${arm}`;
  const base: Omit<Observation, 'passed' | 'overall' | 'blockers' | 'parseFailed' | 'costUsd'> = {
    key,
    rank: row.rank,
    arm,
    model,
    sample,
  };
  try {
    const imageBytes = await readFile(imagePath);
    const result = await generateWithVision('weekly.image_critic', {
      prompt: promptFor(row),
      imageBytes,
      mimeType: 'image/jpeg',
      openRouterModel: model,
      timeoutMs: 120_000,
    });
    const critique = parseImageCriticResponse(result.text);
    const parseFailed = critique.blockers.some((blocker) => blocker.code === 'critic_parse_error');
    return {
      ...base,
      passed: critique.passed,
      overall: critique.scores?.overall ?? 0,
      blockers: critique.blockers.map((blocker) => blocker.code as ImageCriticBlockerCode),
      parseFailed,
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
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

async function main(): Promise<void> {
  const manifestRaw = await readFile(join(PACKAGE_DIR, 'render-manifest.json'), 'utf8');
  const parsed: unknown = JSON.parse(manifestRaw);
  const rows: ManifestRow[] = Array.isArray(parsed)
    ? (parsed as ManifestRow[])
    : ((parsed as { rows?: ManifestRow[] }).rows ?? []);
  if (rows.length === 0) throw new Error(`No manifest rows in ${PACKAGE_DIR}`);

  const targets: Array<{ row: ManifestRow; arm: Arm; path: string }> = [];
  for (const row of rows) {
    const label = `${row.rank}-${row.storyId}`;
    targets.push({ row, arm: 'v10', path: join(PACKAGE_DIR, 'images', `${label}-v10-pixels.jpg`) });
    targets.push({ row, arm: 'v8', path: join(PACKAGE_DIR, 'images', `${label}-v8-pixels.jpg`) });
  }

  const observations: Observation[] = [];
  for (const model of MODELS) {
    for (const target of targets) {
      for (let sample = 1; sample <= SAMPLES; sample += 1) {
        const observation = await observe(target.row, target.arm, target.path, model, sample);
        observations.push(observation);
        const flag = observation.error ? ` ERROR ${observation.error}` : '';
        console.log(
          `[bakeoff] ${model} ${observation.key} s${sample}: ` +
            `passed=${observation.passed} overall=${observation.overall} ` +
            `blockers=[${observation.blockers.join(',')}]${flag}`,
        );
      }
    }
  }

  const perModel = MODELS.map((model) => {
    const mine = observations.filter((observation) => observation.model === model);
    const keys = [...new Set(mine.map((observation) => observation.key))];

    // A candidate is treated as failed by the critic when the MAJORITY of
    // samples fail it — a model that only sometimes catches a defect is not a
    // gate.
    let caught = 0;
    let flagged = 0;
    let flagExpected = 0;
    const spreads: number[] = [];
    const perKey = keys.map((key) => {
      const runs = mine.filter((observation) => observation.key === key);
      const failures = runs.filter((run) => !run.passed).length;
      const majorityFailed = failures * 2 > runs.length;
      const expectation = EXPECTATION[key];
      if (expectation?.mustFail && majorityFailed) caught += 1;
      if (expectation?.mustFlag) {
        flagExpected += 1;
        const hits = runs.filter((run) => run.blockers.includes(expectation.mustFlag!)).length;
        if (hits * 2 > runs.length) flagged += 1;
      }
      const overalls = runs.map((run) => run.overall);
      spreads.push(spread(overalls));
      return {
        key,
        majorityFailed,
        medianOverall: median(overalls),
        overallSpread: spread(overalls),
        blockerUnion: [...new Set(runs.flatMap((run) => run.blockers))],
        parseFailures: runs.filter((run) => run.parseFailed).length,
        errors: runs.filter((run) => run.error).length,
      };
    });

    const costs = mine.map((observation) => observation.costUsd).filter((value): value is number => value != null);
    return {
      model,
      mustFailCaught: caught,
      mustFailTotal: keys.filter((key) => EXPECTATION[key]?.mustFail).length,
      readableTextCaught: flagged,
      readableTextTotal: flagExpected,
      worstOverallSpread: Math.max(0, ...spreads),
      medianOverallSpread: median(spreads),
      parseFailures: mine.filter((observation) => observation.parseFailed).length,
      errors: mine.filter((observation) => observation.error).length,
      reportedCostUsd: costs.reduce((sum, value) => sum + value, 0),
      perKey,
    };
  });

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    join(OUT_DIR, 'bakeoff.json'),
    `${JSON.stringify({ models: MODELS, samples: SAMPLES, perModel, observations }, null, 2)}\n`,
  );

  const lines: string[] = [
    '# Vision critic model bake-off',
    '',
    `Prompt: production \`buildImageCriticPrompt\` (policy \`weekly-semantic-story-v5.1\`).`,
    `Images: ${targets.length} labels-stripped renders; ${SAMPLES} samples per model per image.`,
    '',
    'All six candidates are independently known to be unshippable — three from the owner’s recorded',
    'verdicts, three from the corrected-harness blockers and direct inspection. A usable critic fails',
    'all six and names the baked text on the two deterministic cards.',
    '',
    '| Model | Caught must-fail | Caught readable_text | Worst score spread | Parse fails | Errors | Reported cost |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...perModel.map(
      (entry) =>
        `| \`${entry.model}\` | ${entry.mustFailCaught}/${entry.mustFailTotal} | ` +
        `${entry.readableTextCaught}/${entry.readableTextTotal} | ${entry.worstOverallSpread} | ` +
        `${entry.parseFailures} | ${entry.errors} | $${entry.reportedCostUsd.toFixed(4)} |`,
    ),
    '',
    '## Per image',
    '',
    '| Model | Image | Failed by majority | Median overall | Spread | Blockers seen |',
    '|---|---|---|---:|---:|---|',
    ...perModel.flatMap((entry) =>
      entry.perKey.map(
        (key) =>
          `| \`${entry.model}\` | ${key.key} | ${key.majorityFailed ? 'yes' : '**NO**'} | ` +
          `${key.medianOverall} | ${key.overallSpread} | ${key.blockerUnion.join(', ') || '—'} |`,
      ),
    ),
    '',
    '## Ground truth',
    '',
    ...Object.entries(EXPECTATION).map(([key, value]) => `- \`${key}\` — ${value.why}`),
    '',
    'No automated switch is performed. Choosing the live critic model is an owner decision;',
    'this report is the evidence for it.',
    '',
  ];
  await writeFile(join(OUT_DIR, 'bakeoff-report.md'), `${lines.join('\n')}\n`);
  console.log(`\n[bakeoff] wrote ${join(OUT_DIR, 'bakeoff-report.md')}`);
  for (const entry of perModel) {
    console.log(
      `[bakeoff] ${entry.model}: must-fail ${entry.mustFailCaught}/${entry.mustFailTotal}, ` +
        `readable_text ${entry.readableTextCaught}/${entry.readableTextTotal}, ` +
        `worst spread ${entry.worstOverallSpread}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
