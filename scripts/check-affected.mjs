/**
 * `npm run check:affected` — run only the checks the changed paths need.
 *
 * Changed files = this branch vs the closest of origin/main / origin/next (merge-base) +
 * staged/unstaged + untracked — the same set `build:ci` uses, handed to `e2e:affected`. The path → checks map lives in
 * scripts/check-scope.mjs; any broad or unknown path there turns this into the full suite,
 * so `npm run pr:check` (= `--all --no-e2e`) and this command share one definition.
 *
 *   npm run check:affected                         select + run (fail-fast)
 *   npm run check:affected -- --dry-run            show the plan, run nothing
 *   npm run check:affected -- --files a,b --dry-run   "what would touching a and b run?"
 *   npm run check:affected -- --all                full suite incl. e2e:affected
 *   npm run check:affected -- --no-e2e             skip Playwright (also: SKIP_E2E=1)
 *   npm run check:affected -- --force              ignore the "already passed" stamp
 *
 * CI (`--ci`): files come from `--files` / `--files-from` (the PR files API), and checks
 * owned by another workflow are dropped. `--ci --dry-run` writes `run` / `needs_deps` /
 * `checks` to $GITHUB_OUTPUT so the job can skip `npm ci` when nothing needs it.
 *
 * A green local run writes a stamp (tree hash + diff base + e2e on/off) into the git dir;
 * the pre-push hook calls this same command and returns at once when the stamp matches,
 * so "run the checks, then push" never pays twice.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { CHECKS, commandFor, loadDerivedInputs, planChecks } from './check-scope.mjs';
import { listLocalChangedFiles, parseGitNameOnly, resolveDiffBase } from './ssg-build-scope.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
function option(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? (argv[i + 1] ?? '') : null;
}

const ci = flag('--ci');
const dryRun = flag('--dry-run');
const all = flag('--all');
const wantE2e = !flag('--no-e2e') && process.env.SKIP_E2E !== '1';
const force = flag('--force') || process.env.CHECK_AFFECTED_FORCE === '1';

// --- changed files -----------------------------------------------------------------------
function resolveFiles() {
  const list = option('--files');
  if (list !== null)
    return { files: list.split(/[\s,]+/).filter(Boolean), source: '--files', gitOk: true };
  const from = option('--files-from');
  if (from !== null) {
    return { files: parseGitNameOnly(readFileSync(from, 'utf8')), source: from, gitOk: true };
  }
  if (ci) return { files: [], source: 'none (CI without --files)', gitOk: true };
  const { files, gitOk, base } = listLocalChangedFiles();
  return { files, source: `git vs ${base ?? '?'}`, gitOk };
}

const { files, source, gitOk } = resolveFiles();
const plan = planChecks(files, { all: all || !gitOk, ci, e2e: wantE2e, ...loadDerivedInputs() });
if (!gitOk) plan.fullReasons.push('git state unreadable (no origin/main or main)');

// --- shell helpers (Windows needs a shell for npm/npx .cmd shims) --------------------------
const quote = (a) => (/^[\w./:=@,+-]+$/.test(a) ? a : `"${a}"`);
function run(cmd, env = process.env) {
  const r = spawnSync(cmd.map(quote).join(' '), { stdio: 'inherit', shell: true, env });
  return r.status ?? 1;
}
function capture(cmd, env = process.env) {
  const r = spawnSync(cmd.map(quote).join(' '), { encoding: 'utf8', shell: true, env });
  return { status: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}
function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

// --- "already passed" stamp ---------------------------------------------------------------
/** Hash of the exact working tree (tracked + untracked, .gitignore respected) + diff base. */
function treeFingerprint() {
  const index = git(['rev-parse', '--git-path', 'index']);
  const baseRef = resolveDiffBase();
  const base = baseRef ? git(['merge-base', baseRef, 'HEAD']) : null;
  if (!index || !base) return null;
  const tmp = `${index}.check-affected`;
  try {
    copyFileSync(index, tmp); // keep the stat cache → `add -A` only rehashes what changed
    const env = { ...process.env, GIT_INDEX_FILE: tmp };
    const add = spawnSync('git', ['add', '-A'], { env, encoding: 'utf8' });
    const tree = spawnSync('git', ['write-tree'], { env, encoding: 'utf8' });
    if (add.status !== 0 || tree.status !== 0) return null;
    return createHash('sha256').update(`${tree.stdout.trim()} ${base}`).digest('hex');
  } catch {
    return null;
  } finally {
    rmSync(tmp, { force: true });
  }
}

const stampPath = () => git(['rev-parse', '--git-path', 'check-affected.stamp']);
const useStamp = !ci && !dryRun && option('--files') === null && option('--files-from') === null;

function stampMatches(fingerprint) {
  const p = stampPath();
  if (!fingerprint || !p) return false;
  try {
    const s = JSON.parse(readFileSync(p, 'utf8'));
    // A stamp from a run WITH e2e also covers a run that does not want e2e.
    return s.fingerprint === fingerprint && (s.e2e || !wantE2e) && (s.full || !plan.full);
  } catch {
    return false;
  }
}

function writeStamp(fingerprint, e2eRan) {
  const p = stampPath();
  if (!fingerprint || !p) return;
  try {
    writeFileSync(
      p,
      JSON.stringify({ fingerprint, e2e: e2eRan, full: plan.full, at: new Date().toISOString() }),
    );
  } catch {
    // Best-effort: a missing stamp only costs a re-run.
  }
}

// --- e2e:affected owns its own build ------------------------------------------------------
/** Ask e2e:affected what it would run for these files: 'none' | 'specs' | 'all'. */
function e2eMode() {
  const env = { ...process.env, E2E_AFFECTED_FILES: plan.files.join(' ') };
  delete env.GITHUB_OUTPUT;
  const r = capture(['npx', 'tsx', 'scripts/e2e-affected.ts', '--ci-plan'], env);
  const m = r.out.match(/mode=(none|specs|all)/);
  return { mode: m ? m[1] : 'all', out: r.out };
}

// --- report -------------------------------------------------------------------------------
function printPlan() {
  console.log(`check:affected — ${plan.files.length} changed file(s) [${source}]`);
  for (const line of plan.lines) console.log(`  ${line}`);
  if (plan.full) {
    console.log(`\n→ FULL suite${all ? ' (--all)' : ''}:`);
    for (const r of plan.fullReasons) console.log(`    ${r}`);
  }
  if (plan.checks.length === 0) {
    console.log('\n→ nothing to run.');
    return;
  }
  console.log(
    `\n→ ${plan.checks.length} check(s)${ci ? ' (CI: build/coverage/e2e/design/migrations run in their own workflows)' : ''}:`,
  );
  for (const id of plan.checks)
    console.log(`    ${id.padEnd(13)} ${commandFor(id, plan).join(' ')}`);
  console.log('');
}

function writeCiOutputs() {
  if (!process.env.GITHUB_OUTPUT) return;
  const needsDeps = plan.checks.some((id) => CHECKS[id].needsDeps);
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `run=${plan.checks.length > 0}\nneeds_deps=${needsDeps}\nchecks=${plan.checks.join(' ')}\n`,
  );
}

// --- main ---------------------------------------------------------------------------------
function main() {
  printPlan();

  if (dryRun) {
    writeCiOutputs();
    if (!ci && plan.checks.includes('e2e')) {
      const { mode, out } = e2eMode();
      console.log(`e2e:affected would run: ${mode}`);
      for (const l of out.split('\n').filter((x) => /^\s+\S.*→/.test(x))) console.log(l);
      if (mode === 'none' && plan.checks.includes('build'))
        console.log('→ so build:ci runs standalone.');
      else if (mode !== 'none')
        console.log('→ e2e:affected builds first, so the standalone build:ci is skipped.');
    }
    return;
  }

  if (plan.checks.length === 0) return;

  const fingerprint = useStamp ? treeFingerprint() : null;
  if (useStamp && !force && stampMatches(fingerprint)) {
    console.log(
      'check:affected — this exact tree already passed these checks; nothing to re-run (--force to repeat).',
    );
    return;
  }

  let ids = plan.checks;
  if (ids.includes('e2e')) {
    const { mode } = e2eMode();
    if (mode === 'none') {
      console.log(
        'check:affected — e2e:affected selects no specs for these files; skipping Playwright.\n',
      );
      ids = ids.filter((id) => id !== 'e2e');
    } else {
      // e2e:affected builds (or reuses a running server) before Playwright — no second build.
      ids = ids.filter((id) => id !== 'build');
    }
  }

  const started = Date.now();
  for (const id of ids) {
    console.log(`\n━━ check:affected · ${id} — ${CHECKS[id].label}`);
    const env =
      id === 'e2e' ? { ...process.env, E2E_AFFECTED_FILES: plan.files.join(' ') } : process.env;
    const status = run(commandFor(id, plan), env);
    if (status !== 0) {
      console.error(`\ncheck:affected — ${id} FAILED (exit ${status}). Fix it and re-run.`);
      process.exit(status);
    }
  }
  const secs = Math.round((Date.now() - started) / 1000);
  console.log(`\ncheck:affected — ${ids.length} check(s) green in ${secs}s: ${ids.join(', ')}`);
  // e2e is "covered" only when this run was allowed to consider it (ran, or selected nothing).
  if (useStamp) writeStamp(fingerprint, wantE2e);
}

main();
