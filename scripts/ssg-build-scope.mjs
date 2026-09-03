/**
 * Paths that do not change the Next.js site HTML/JS.
 * Keep the grep in `.github/workflows/e2e.yml` (`Decide whether the site changed`)
 * in sync with this regex. Sonar uses the same skip set except it still scans
 * `pipeline/` (see `.github/workflows/sonarqube.yml`).
 *
 * Used by Vercel's ignoreCommand: exit 0 skips the deploy (no prod PostgREST SSG).
 */
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
