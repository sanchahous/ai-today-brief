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
 *   run      runWeeklyMaster() against that fixture with NO database handle:
 *            the real segment prompts, the real provider ladder, the real
 *            critic and the real targeted-repair loop, but nothing is written
 *            back — no lease, no revision, no artifact, no cost ledger row.
 *            The durable run state is written to state.json after every
 *            segment, so `--resume <dir>` continues an interrupted run exactly
 *            the way a retried production job does.
 *   gates    re-run the deterministic validators over a bundle saved by an
 *            earlier `run`. Free, instant, no provider call at all — this is
 *            the loop for iterating on validateMasterBundle rules.
 *
 * Usage (env comes from .env.local, same as every other pipeline script):
 *   npm run weekly:sandbox -- capture --digest <uuid> [--revision <uuid>]
 *   npm run weekly:sandbox -- run --fixture <path> [--resume <dir>] [--order claude-cli]
 *   npm run weekly:sandbox -- gates --run <artifacts/_local/weekly-sandbox/dir>
 *
 * `capture` reads production through the service key. Everything else is
 * local and offline of the database. See wiki/ops/weekly-sandbox.md.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  validateMasterBundle,
  type WeeklyMasterBundle,
  type WeeklyResearchPack,
} from '../../src/lib/weekly-digest/content-studio';
import type {
  WeeklyMasterInputStory,
  WeeklyMasterProviderStep,
  WeeklyMasterRetryGuidance,
} from '../../src/lib/weekly-digest/editorial-llm';
import {
  runWeeklyMaster,
  type MasterRunState,
} from '../../src/lib/weekly-digest/master-engine';

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

function readState(dir: string | undefined): MasterRunState | null {
  if (!dir) return null;
  const path = join(dir, 'state.json');
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as MasterRunState;
  } catch {
    throw new Error(`--resume ${dir} has no readable state.json`);
  }
}

async function run(): Promise<void> {
  const { fixture, path } = readFixture();
  const order = flag('order');
  if (order) process.env.WEEKLY_MASTER_PROVIDER_ORDER = order;
  const resumeState = readState(flag('resume'));

  const outDir = flag('out-dir') ?? join(OUTPUT_DIR, runStamp());
  const statePath = join(outDir, 'state.json');
  const startedAt = new Date();
  const calls: Array<{
    step: WeeklyMasterProviderStep;
    label: string;
    provider: string;
    model: string;
    durationMs: number;
    outputTokens: number;
    costUsd: number;
    costSource: string;
  }> = [];

  console.log(`Fixture      ${path}`);
  console.log(
    `Digest       ${fixture.slug ?? fixture.weeklyDigestId} (revision ${fixture.revisionId})`,
  );
  console.log(
    `Provider order ${process.env.WEEKLY_MASTER_PROVIDER_ORDER ?? 'claude-cli,openrouter (default)'}`,
  );
  console.log(`Output       ${outDir}`);
  console.log(
    resumeState
      ? `Mode         resuming ${Object.keys(resumeState.segments).length} saved segment(s)\n`
      : 'Mode         full master (segmented write -> validate -> critic -> targeted repair)\n',
  );

  const outcome = await runWeeklyMaster({
    stories: fixture.stories,
    researchPacks: fixture.researchPacks,
    retryGuidance: fixture.retryGuidance,
    state: resumeState,
    hooks: {
      // The local stand-in for the production checkpoint. Killing the run at
      // any point and re-running with `--resume <dir>` must continue rather
      // than restart -- which is exactly the property this refactor is for.
      onState: (state, progress) => {
        writeJson(statePath, state);
        console.log(`  .. ${String(progress.percent).padStart(3)}%  ${progress.message}`);
      },
      onProviderCallStarted: (_step, { label }) => {
        console.log(`  -> ${label}`);
      },
      onProviderCallCompleted: (step, metadata, { label, durationMs }) => {
        calls.push({
          step,
          label,
          provider: metadata.provider,
          model: metadata.model,
          durationMs,
          outputTokens: metadata.outputTokens,
          costUsd: metadata.estimatedCostUsd,
          costSource: metadata.costSource,
        });
        console.log(
          `  <- ${label} ${seconds(durationMs)} via ${metadata.provider}/${metadata.model} ` +
            `(${metadata.outputTokens} out, $${metadata.estimatedCostUsd.toFixed(4)} ${metadata.costSource})`,
        );
      },
      onNote: (note) => {
        console.log(`  !! [${note.level}] ${note.message}`);
      },
    },
    // No `db` on purpose: the sandbox must never reach the database, so an
    // /admin/providers override is not applied here. Pass --order to
    // reproduce a specific chain instead.
  });

  const totalCost = calls.reduce((sum, entry) => sum + entry.costUsd, 0);
  writeJson(join(outDir, 'run.json'), {
    fixture: path,
    startedAt: startedAt.toISOString(),
    totalMs: Date.now() - startedAt.getTime(),
    providerOrder: process.env.WEEKLY_MASTER_PROVIDER_ORDER ?? null,
    resumedFrom: flag('resume') ?? null,
    outcome: outcome.status,
    totalCostUsd: Number(totalCost.toFixed(4)),
    calls,
  });
  writeJson(statePath, outcome.state);

  if (outcome.status === 'incomplete') {
    console.log(
      `\nPAUSED       ${outcome.completedSegments}/${outcome.totalSegments} segments written`,
    );
    console.log(`Reason       ${outcome.reason}`);
    console.log(`Resume with  npm run weekly:sandbox -- run --fixture ${path} --resume ${outDir}`);
    process.exitCode = 1;
  } else {
    writeJson(join(outDir, 'bundle.json'), outcome.bundle);
    writeJson(join(outDir, 'quality.json'), outcome.quality);
    writeJson(join(outDir, 'unresolved.json'), outcome.unresolved);
    console.log(`\nQuality      ${outcome.quality.score}/100`);
    for (const dimension of outcome.quality.dimensions) {
      console.log(`  ${dimension.name.padEnd(20)} ${dimension.score}`);
    }
    if (outcome.converged) {
      console.log('Gate         PASS — this bundle would have been promoted.');
    } else {
      console.log(`Gate         NEEDS REVIEW (${outcome.unresolved.length} unresolved)`);
      for (const entry of outcome.unresolved) {
        console.log(
          `  - ${entry.code}${entry.locale ? ` [${entry.locale}]` : ''}${entry.field ? `.${entry.field}` : ''} (${entry.reason}) ${entry.message}`,
        );
      }
      console.log(
        '  A production run would save this as an inactive draft revision and finish as succeeded.',
      );
    }
  }

  console.log(`\nCalls        ${calls.length}, $${totalCost.toFixed(4)} total`);
  console.log(`Total        ${seconds(Date.now() - startedAt.getTime())}`);
  console.log(`Written to   ${outDir}`);
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
