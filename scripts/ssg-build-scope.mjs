/**
 * Paths that do not change the Next.js site HTML/JS.
 * The grep in `.github/workflows/e2e.yml` (`Decide whether the site changed`) must
 * equal this regex; Sonar uses the same skip set minus `pipeline/`. Both are pinned by
 * `scripts/check-scope.test.mjs` (WORKFLOW_GATES).
 *
 * Used by Vercel's ignoreCommand and local `build:ci`: skip when the site HTML
 * did not change (no prod PostgREST SSG).
 */
import { execSync } from 'node:child_process';

export const SKIP_SSG_PATH_RE =
  /^(wiki\/|raw\/|artifacts\/|experiments\/|library\/|scripts\/|supabase\/migrations\/|\.github\/|pipeline\/|\.cursor\/|\.agents\/|\.claude\/|\.gitignore$|\.gitattributes$|\.editorconfig$|LICENSE$)|\.md$/;

export function posixPath(file) {
  let path = String(file).split('\\').join('/');
  while (path.startsWith('./')) path = path.slice(2);
  return path;
}

export function isSiteAffectingPath(file) {
  const path = posixPath(file);
  if (!path) return false;
  return !SKIP_SSG_PATH_RE.test(path);
}

/** True when every changed file is docs/ops — Vercel should skip the build. */
export function shouldSkipVercelBuild(files) {
  if (files.length === 0) return false;
  return !files.some((file) => isSiteAffectingPath(file));
}

export function parseGitNameOnly(stdout) {
  return String(stdout ?? '')
    .split('\n')
    .map((line) => posixPath(line.trim()))
    .filter(Boolean);
}

export function uniquePaths(files) {
  const seen = new Set();
  const out = [];
  for (const file of files) {
    const path = posixPath(file);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push(path);
  }
  return out;
}

/**
 * Local `build:ci` / `pr:check`. Empty + gitOk means nothing changed — skip.
 * Unknown git (gitOk false) or FORCE — do not skip.
 */
export function shouldSkipLocalSiteBuild(files, { gitOk = true, force = false } = {}) {
  if (force || !gitOk) return false;
  if (files.length === 0) return true;
  return shouldSkipVercelBuild(files);
}

function gitRefExists(ref) {
  try {
    execSync(`git rev-parse --verify --quiet ${ref}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function gitNameOnlyOrNull(command) {
  try {
    return parseGitNameOnly(execSync(command, { encoding: 'utf8' }));
  } catch {
    return null;
  }
}

/** Integration branches a feature branch can be cut from, in tie-break order. */
export const DIFF_BASE_CANDIDATES = ['origin/main', 'origin/next', 'main', 'next'];

/**
 * The candidate whose merge-base is closest to HEAD (fewest commits in between). Task
 * branches are cut from `next`, which runs ahead of `main` until the daily release; diffing
 * them against `main` would count every unreleased `next` commit as "changed here".
 * Ties keep the candidates' order, so a branch level with both still diffs against main.
 * @param {{ ref: string, distance: number | null }[]} candidates
 */
export function pickClosestBase(candidates) {
  let best = null;
  for (const c of candidates) {
    if (c.distance === null || !Number.isFinite(c.distance)) continue;
    if (best === null || c.distance < best.distance) best = c;
  }
  return best?.ref ?? null;
}

function commitsSinceMergeBase(ref) {
  try {
    const out = execSync(`git rev-list --count ${ref}...HEAD --right-only`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return Number(out.trim());
  } catch {
    return null;
  }
}

/** Ref to diff the working branch against, or null when no candidate exists. */
export function resolveDiffBase() {
  const refs = DIFF_BASE_CANDIDATES.filter(gitRefExists);
  return pickClosestBase(refs.map((ref) => ({ ref, distance: commitsSinceMergeBase(ref) })));
}

/** Branch + working tree vs the closest of origin/main / origin/next. gitOk false → caller must build. */
export function listLocalChangedFiles() {
  const base = resolveDiffBase();
  if (!base) return { files: [], gitOk: false };
  const committed = gitNameOnlyOrNull(`git diff --name-only ${base}...HEAD`);
  const uncommitted = gitNameOnlyOrNull('git diff --name-only HEAD');
  const untracked = gitNameOnlyOrNull('git ls-files --others --exclude-standard');
  if (committed === null || uncommitted === null || untracked === null) {
    return { files: [], gitOk: false };
  }
  return { files: uniquePaths([...committed, ...uncommitted, ...untracked]), gitOk: true, base };
}
