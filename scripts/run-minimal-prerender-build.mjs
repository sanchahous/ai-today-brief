/**
 * `next build` with E2E_MINIMAL_PRERENDER=1 so local `pr:check` does not
 * full-SSG prod PostgREST (Windows-safe; `VAR=1 cmd` is not PowerShell).
 * Skips entirely when git shows no site-affecting changes. FORCE_SSG_BUILD=1
 * always builds.
 */
import { spawnSync } from 'node:child_process';
import {
  listLocalChangedFiles,
  shouldSkipLocalSiteBuild,
} from './ssg-build-scope.mjs';

const force = process.env.FORCE_SSG_BUILD === '1';
const { files, gitOk } = listLocalChangedFiles();
if (shouldSkipLocalSiteBuild(files, { gitOk, force })) {
  console.warn('[build:ci] skip — no site-affecting changes (FORCE_SSG_BUILD=1 to run)');
  process.exit(0);
}

process.env.E2E_MINIMAL_PRERENDER = '1';
const result = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});
process.exit(result.status === null ? 1 : result.status);
