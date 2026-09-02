/**
 * Vercel Ignored Build Step. Exit 0 = skip deploy; exit 1 = build.
 * @see https://vercel.com/docs/project-configuration/git-settings#ignored-build-step
 */
import { execSync } from 'node:child_process';
import { shouldSkipVercelBuild } from './ssg-build-scope.mjs';

function gitChangedFiles() {
  const prev = (process.env.VERCEL_GIT_PREVIOUS_SHA ?? '').trim();
  const spec = prev ? `${prev} HEAD` : 'HEAD^ HEAD';
  try {
    const out = execSync(`git diff --name-only ${spec}`, { encoding: 'utf8' });
    return out.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch {
    return ['src/FORCE_BUILD'];
  }
}

const files = gitChangedFiles();
if (shouldSkipVercelBuild(files)) {
  console.warn('[vercel-should-build] skip — docs/ops only, no site SSG');
  process.exit(0);
}
console.warn('[vercel-should-build] build — site-affecting change');
process.exit(1);
