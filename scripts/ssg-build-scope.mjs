/**
 * Paths that do not change the Next.js site HTML/JS.
 * Keep the grep in `.github/workflows/e2e.yml` (`Decide whether the site changed`)
 * in sync with this regex. Sonar uses the same skip set except it still scans
 * `pipeline/` (see `.github/workflows/sonarqube.yml`).
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

/** Branch + working tree vs origin/main (or main). gitOk false → caller must build. */
export function listLocalChangedFiles() {
  const base = gitRefExists('origin/main') ? 'origin/main' : gitRefExists('main') ? 'main' : null;
  if (!base) return { files: [], gitOk: false };
  const committed = gitNameOnlyOrNull(`git diff --name-only ${base}...HEAD`);
  const uncommitted = gitNameOnlyOrNull('git diff --name-only HEAD');
  const untracked = gitNameOnlyOrNull('git ls-files --others --exclude-standard');
  if (committed === null || uncommitted === null || untracked === null) {
    return { files: [], gitOk: false };
  }
  return { files: uniquePaths([...committed, ...uncommitted, ...untracked]), gitOk: true };
}
