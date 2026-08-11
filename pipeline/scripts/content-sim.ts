/**
 * Content simulation / backtest CLI.
 *
 *   capture  dump fixture inputs (weekly-master delegates to weekly:sandbox)
 *   run      replay an adapter against a fixture (no prod writes)
 *   gates    re-validate a saved quality.json / bundle
 *   hypothesis  compare a run's quality.json against a baseline
 *
 * Usage:
 *   npm run content-sim -- capture --adapter weekly-master --digest <uuid>
 *   npm run content-sim -- run --adapter weekly-image --fixture <path>
 *   npm run content-sim -- gates --run <artifacts/_local/content-sim/dir>
 *   npm run content-sim -- hypothesis --baseline <path> --run <path>
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  CONTENT_SIM_ADAPTERS,
  contentSimMaxImageRepairAttempts,
  contentSimMaxImageSpendUsd,
  contentSimScoreThreshold,
  type ContentSimAdapterId,
  type ContentSimManifest,
  type ContentSimQualityReport,
} from '../../src/lib/content-sim';

const FIXTURE_DIR = 'raw/_local/content-sim';
const OUTPUT_DIR = 'artifacts/_local/content-sim';

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

function command(): string {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  return args[0] ?? '';
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function runStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function requireAdapter(): ContentSimAdapterId {
  const raw = flag('adapter') ?? 'weekly-master';
  if (!(CONTENT_SIM_ADAPTERS as readonly string[]).includes(raw)) {
    throw new Error(`Unknown adapter '${raw}'. Expected one of: ${CONTENT_SIM_ADAPTERS.join(', ')}`);
  }
  return raw as ContentSimAdapterId;
}

function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16);
}

function runWeeklySandbox(args: string[]): void {
  const result = spawnSync(
    process.execPath,
    [
      '--conditions=react-server',
      '--env-file-if-exists=.env.local',
      '--import',
      'tsx',
      'pipeline/scripts/weekly-master-sandbox.ts',
      ...args,
    ],
    { stdio: 'inherit', shell: false },
  );
  if (result.status && result.status !== 0) {
    process.exitCode = result.status;
  }
}

async function capture(): Promise<void> {
  const adapter = requireAdapter();
  if (adapter === 'weekly-master') {
    const digest = flag('digest');
    if (!digest) throw new Error('capture weekly-master requires --digest <uuid>');
    runWeeklySandbox([
      'capture',
      '--digest',
      digest,
      ...(flag('revision') ? ['--revision', flag('revision')!] : []),
    ]);
    return;
  }
  if (adapter === 'daily-brief') {
    const { captureDailyBriefFixture } = await import(
      '../../src/lib/content-sim/adapters/daily-brief'
    );
    const briefId = flag('brief') ?? flag('digest');
    if (!briefId) throw new Error('capture daily-brief requires --brief <brief_id_or_slug>');
    const fixture = await captureDailyBriefFixture(briefId);
    const dir = join(FIXTURE_DIR, 'daily');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${fixture.slug ?? fixture.briefId}.json`);
    writeJson(path, fixture);
    console.log(`Wrote ${path}`);
    return;
  }
  throw new Error(
    `capture for adapter '${adapter}' is not implemented yet (use weekly-master or daily-brief).`,
  );
}

async function run(): Promise<void> {
  const adapter = requireAdapter();
  const fixturePath = flag('fixture');
  if (!fixturePath || !existsSync(fixturePath)) {
    throw new Error('run requires --fixture <path> to an existing fixture JSON');
  }
  const outDir = join(OUTPUT_DIR, `${adapter}-${runStamp()}`);
  mkdirSync(outDir, { recursive: true });
  const manifest: ContentSimManifest = {
    runId: outDir.replace(/\\/g, '/'),
    adapter,
    fixturePath,
    fixtureHash: hashFile(fixturePath),
    hypothesisId: flag('hypothesis'),
    maxAttempts: contentSimMaxImageRepairAttempts(),
    maxSpendUsd: contentSimMaxImageSpendUsd(),
    scoreThreshold: contentSimScoreThreshold(),
  };
  writeJson(join(outDir, 'manifest.json'), manifest);

  if (adapter === 'weekly-master') {
    runWeeklySandbox([
      'run',
      '--fixture',
      fixturePath,
      ...(flag('resume') ? ['--resume', flag('resume')!] : []),
      ...(flag('order') ? ['--order', flag('order')!] : []),
    ]);
    writeJson(join(outDir, 'quality.json'), {
      adapter,
      note: 'weekly-master sandbox writes its own artifacts/_local/weekly-sandbox run; see that directory for quality.json',
    });
    console.log(`Manifest at ${join(outDir, 'manifest.json')}`);
    return;
  }

  if (adapter === 'weekly-image') {
    const { runWeeklyImageFixtureSim } = await import(
      '../../src/lib/content-sim/adapters/weekly-image-fixture'
    );
    const report = await runWeeklyImageFixtureSim(fixturePath, outDir);
    writeJson(join(outDir, 'quality.json'), report);
    if (report.escalation) writeJson(join(outDir, 'escalation.json'), report.escalation);
    console.log(
      `weekly-image sim: outcome=${report.outcome} attempts=${report.attempts} passed=${report.passed}`,
    );
    console.log(`Wrote ${join(outDir, 'quality.json')}`);
    return;
  }

  if (adapter === 'daily-brief') {
    const { runDailyBriefSim } = await import('../../src/lib/content-sim/adapters/daily-brief');
    const report = await runDailyBriefSim(fixturePath, outDir);
    writeJson(join(outDir, 'quality.json'), report);
    console.log(`daily-brief sim: outcome=${report.outcome} passed=${report.passed}`);
    return;
  }

  if (adapter === 'daily-image') {
    const { runDailyImageFixtureSim } = await import(
      '../../src/lib/content-sim/adapters/daily-image'
    );
    const report = await runDailyImageFixtureSim(fixturePath, outDir);
    writeJson(join(outDir, 'quality.json'), report);
    if (report.escalation) writeJson(join(outDir, 'escalation.json'), report.escalation);
    console.log(`daily-image sim: outcome=${report.outcome} passed=${report.passed}`);
    return;
  }

  throw new Error(`run for adapter '${adapter}' is not implemented`);
}

function gates(): void {
  const runDir = flag('run');
  if (!runDir || !existsSync(runDir)) throw new Error('gates requires --run <dir>');
  const qualityPath = join(runDir, 'quality.json');
  if (!existsSync(qualityPath)) throw new Error(`No quality.json in ${runDir}`);
  const report = JSON.parse(readFileSync(qualityPath, 'utf8')) as ContentSimQualityReport;
  const ok = report.passed === true;
  console.log(
    JSON.stringify(
      {
        passed: ok,
        outcome: report.outcome,
        attempts: report.attempts,
        blockers: report.blockers,
      },
      null,
      2,
    ),
  );
  if (!ok) process.exitCode = 1;
}

function hypothesis(): void {
  const baselinePath = flag('baseline');
  const runDir = flag('run');
  if (!baselinePath || !runDir) {
    throw new Error('hypothesis requires --baseline <quality.json> and --run <dir>');
  }
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as ContentSimQualityReport;
  const current = JSON.parse(readFileSync(join(runDir, 'quality.json'), 'utf8')) as ContentSimQualityReport;
  const baselineScore = baseline.finalScores?.overall ?? (baseline.passed ? 100 : 0);
  const currentScore = current.finalScores?.overall ?? (current.passed ? 100 : 0);
  const delta = currentScore - baselineScore;
  const summary = {
    baseline_passed: baseline.passed,
    current_passed: current.passed,
    baseline_overall: baselineScore,
    current_overall: currentScore,
    delta,
    regression: current.passed !== true && baseline.passed === true,
  };
  console.log(JSON.stringify(summary, null, 2));
  writeJson(join(runDir, 'hypothesis.json'), summary);
  if (summary.regression) process.exitCode = 1;
}

async function main(): Promise<void> {
  const cmd = command();
  if (cmd === 'capture') await capture();
  else if (cmd === 'run') await run();
  else if (cmd === 'gates') gates();
  else if (cmd === 'hypothesis') hypothesis();
  else {
    console.error(`Unknown command '${cmd}'. Use capture | run | gates | hypothesis.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
