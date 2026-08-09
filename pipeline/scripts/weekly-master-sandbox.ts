/**
 * Off-production replay harness for the Weekly Digest master write.
 *
 * The editorial_master job only ever ran one way: dispatch a GitHub Actions
 * run against production, wait ~40 minutes, read a one-line failure string.
 * That made every prompt, provider or gate change a blind push. This script
 * splits that loop in two so a change can be exercised before it ships:
 *
 *   capture  read-only dump of the exact master input production would build
 *            (stories + approved research packs + retry guidance) into
 *            raw/_local/, via the worker's own loaders — no parallel query
 *            path, so the fixture cannot drift from what the worker sends.
 *   run      generateWeeklyMaster() against that fixture with NO database
 *            handle: the real prompts, the real provider ladder, the real
 *            critic and revise loop, but nothing is written back — no lease,
 *            no revision, no artifact, no cost ledger row.
 *   gates    re-run the deterministic validators over a bundle saved by an
 *            earlier `run`. Free, instant, no provider call at all — this is
 *            the loop for iterating on validateMasterBundle rules.
 *
 * Usage (env comes from .env.local, same as every other pipeline script):
 *   npm run weekly:sandbox -- capture --digest <uuid> [--revision <uuid>]
 *   npm run weekly:sandbox -- run --fixture <path> [--only english] [--order claude-cli]
 *   npm run weekly:sandbox -- gates --run <artifacts/_local/weekly-sandbox/dir>
 *
 * `capture` reads production through the service key. Everything else is
 * local and offline of the database. See wiki/ops/weekly-sandbox.md.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  editorialQualityFailures,
  validateMasterBundle,
  type WeeklyMasterBundle,
  type WeeklyResearchPack,
} from '../../src/lib/weekly-digest/content-studio';
import {
  generateWeeklyMaster,
  type EditorialGenerationMetadata,
  type WeeklyMasterInputStory,
  type WeeklyMasterProviderStep,
  type WeeklyMasterRetryGuidance,
} from '../../src/lib/weekly-digest/editorial-llm';

const FIXTURE_DIR = 'raw/_local/weekly-sandbox';
const OUTPUT_DIR = 'artifacts/_local/weekly-sandbox';

interface SandboxFixture {
  capturedAt: string;
  weeklyDigestId: string;
  revisionId: string;
  slug?: string;
  stories: WeeklyMasterInputStory[];
  researchPacks: WeeklyResearchPack[];
  retryGuidance: WeeklyMasterRetryGuidance[];
}

/** Thrown from an onStepComplete callback to end a `--only` run early. The
 * callback is the documented extension point and the step's result is already
 * saved by the time it fires, so aborting there costs nothing and needs no
 * sandbox-only branch inside generateWeeklyMaster itself. */
class StopAfterStep extends Error {
  constructor(readonly step: string) {
    super(`stop-after:${step}`);
  }
}

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Filesystem-safe run directory name. Colons break the path on Windows and
 * this repo is developed there — see wiki/ops for the subst-drive history. */
function runStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function capture(): Promise<void> {
  const weeklyDigestId = flag('digest');
  if (!weeklyDigestId) throw new Error('capture requires --digest <weekly_digest_id>');

  // Imported lazily: these pull in `server-only` and a live Supabase client,
  // which `run`/`gates` must never touch.
  const { getSupabaseAdmin } = await import('../../src/lib/supabase-admin');
  const { loadMasterGenerationInput } = await import(
    '../../src/lib/weekly-digest/generation-worker'
  );

  const { data, error } = await getSupabaseAdmin()
    .from('weekly_digests')
    .select('id,slug,active_revision_id')
    .eq('id', weeklyDigestId)
    .single();
  if (error || !data) throw new Error(`Weekly digest ${weeklyDigestId} was not found.`);

  const revisionId = flag('revision') ?? data.active_revision_id;
  if (!revisionId) throw new Error('Digest has no active revision; pass --revision explicitly.');

  const input = await loadMasterGenerationInput({ weeklyDigestId, revisionId });
  const fixture: SandboxFixture = {
    capturedAt: new Date().toISOString(),
    weeklyDigestId,
    revisionId,
    ...(data.slug ? { slug: data.slug } : {}),
    ...input,
  };

  const path = flag('out') ?? join(FIXTURE_DIR, `${data.slug ?? weeklyDigestId}.json`);
  writeJson(path, fixture);

  const features = fixture.stories.filter((story) => story.placement === 'feature');
  console.log(`Captured ${path}`);
  console.log(
    `  ${fixture.stories.length} stories (${features.length} feature / ${fixture.stories.length - features.length} radar)`,
  );
  console.log(`  ${fixture.researchPacks.length} approved research packs`);
  console.log(`  ${fixture.retryGuidance.length} retry-guidance entries from the last critic`);
  console.log(`  ${(JSON.stringify(fixture).length / 1024).toFixed(0)} KB of prompt material`);
}

function readFixture(): { fixture: SandboxFixture; path: string } {
  const path = flag('fixture');
  if (!path) throw new Error('run requires --fixture <path> (produce one with `capture`)');
  return { fixture: JSON.parse(readFileSync(path, 'utf8')) as SandboxFixture, path };
}

async function run(): Promise<void> {
  const { fixture, path } = readFixture();
  const only = flag('only');
  const order = flag('order');
  if (order) process.env.WEEKLY_MASTER_PROVIDER_ORDER = order;

  const outDir = flag('out-dir') ?? join(OUTPUT_DIR, runStamp());
  const startedAt = new Date();
  const calls: Array<{
    step: WeeklyMasterProviderStep;
    provider: string;
    model: string;
    durationMs: number;
    outputTokens: number;
    costUsd: number;
    costSource: string;
  }> = [];
  const stepStartedAt = new Map<WeeklyMasterProviderStep, number>();

  console.log(`Fixture      ${path}`);
  console.log(`Digest       ${fixture.slug ?? fixture.weeklyDigestId} (revision ${fixture.revisionId})`);
  console.log(`Provider order ${process.env.WEEKLY_MASTER_PROVIDER_ORDER ?? 'claude-cli,openrouter (default)'}`);
  console.log(`Output       ${outDir}`);
  console.log(only ? `Mode         stop after "${only}"\n` : 'Mode         full master (writer -> critic -> revise)\n');

  let result: Awaited<ReturnType<typeof generateWeeklyMaster>> | null = null;
  let failed = false;

  try {
    result = await generateWeeklyMaster(fixture.stories, fixture.researchPacks, fixture.retryGuidance, {
      onProviderCallStarted: async (step) => {
        stepStartedAt.set(step, Date.now());
        console.log(`  -> ${step} started`);
      },
      onProviderCallCompleted: async (step, metadata: EditorialGenerationMetadata) => {
        const durationMs = Date.now() - (stepStartedAt.get(step) ?? Date.now());
        calls.push({
          step,
          provider: metadata.provider,
          model: metadata.model,
          durationMs,
          outputTokens: metadata.outputTokens,
          costUsd: metadata.estimatedCostUsd,
          costSource: metadata.costSource,
        });
        console.log(
          `  <- ${step} ${seconds(durationMs)} via ${metadata.provider}/${metadata.model} ` +
            `(${metadata.outputTokens} out, $${metadata.estimatedCostUsd.toFixed(4)} ${metadata.costSource})`,
        );
      },
      onStepComplete: async (step, stepResult) => {
        writeJson(join(outDir, `${step}.json`), stepResult);
        if (only === step) throw new StopAfterStep(step);
      },
      // No `db` on purpose: the sandbox must never reach the database, so an
      // /admin/providers override is not applied here. Pass --order to
      // reproduce a specific chain instead.
    });
  } catch (error) {
    if (!(error instanceof StopAfterStep)) {
      writeJson(join(outDir, 'error.json'), {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.error(`\nFAILED after ${seconds(Date.now() - startedAt.getTime())}`);
      console.error(error instanceof Error ? error.message : String(error));
      console.error(`\nPartial results and timings: ${outDir}`);
      failed = true;
    } else {
      console.log(`\nStopped after "${error.step}" as requested.`);
    }
  }

  if (result) {
    writeJson(join(outDir, 'bundle.json'), result.bundle);
    writeJson(join(outDir, 'quality.json'), result.quality);
    const failures = editorialQualityFailures(result.quality);
    console.log(`\nQuality      ${result.quality.score}/100`);
    for (const dimension of result.quality.dimensions) {
      console.log(`  ${dimension.name.padEnd(20)} ${dimension.score}`);
    }
    if (failures.length === 0) {
      console.log('Gate         PASS — this bundle would have been promoted.');
    } else {
      console.log(`Gate         FAIL (${failures.length})`);
      for (const failure of failures) console.log(`  - ${failure}`);
    }
  }

  // Written on every path, failures included: per-step timings are the whole
  // reason to run this, and they matter most when something blew up.
  writeJson(join(outDir, 'run.json'), {
    fixture: path,
    startedAt: startedAt.toISOString(),
    totalMs: Date.now() - startedAt.getTime(),
    providerOrder: process.env.WEEKLY_MASTER_PROVIDER_ORDER ?? null,
    only: only ?? null,
    outcome: failed ? 'failed' : 'ok',
    calls,
  });

  console.log(`\nTotal        ${seconds(Date.now() - startedAt.getTime())}`);
  console.log(`Written to   ${outDir}`);
  if (failed) process.exitCode = 1;
}

function gates(): void {
  const runDir = flag('run');
  if (!runDir) throw new Error('gates requires --run <artifacts/_local/weekly-sandbox/...>');
  const { fixture } = readFixture();
  const bundle = JSON.parse(readFileSync(join(runDir, 'bundle.json'), 'utf8')) as WeeklyMasterBundle;

  const issues = validateMasterBundle(
    bundle,
    fixture.researchPacks,
    fixture.stories.map((story) => ({
      revisionItemId: story.revisionItemId,
      placement: story.placement,
      claimIds: story.claims.map((claim) => claim.id),
    })),
  );

  const blockers = issues.filter((issue) => issue.blocker);
  console.log(`${issues.length} deterministic issue(s), ${blockers.length} blocking\n`);
  for (const issue of issues) {
    console.log(`${issue.blocker ? 'BLOCK' : 'warn '} ${issue.code}${issue.locale ? ` [${issue.locale}]` : ''}`);
    console.log(`      ${issue.message}`);
  }
  process.exitCode = blockers.length > 0 ? 1 : 0;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'capture') return capture();
  if (command === 'run') return run();
  if (command === 'gates') return gates();
  throw new Error(
    'Usage: weekly-master-sandbox.ts <capture|run|gates> [flags] — see the file header.',
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
