/**
 * `next build` with E2E_MINIMAL_PRERENDER=1 so local `pr:check` does not
 * full-SSG prod PostgREST (Windows-safe; `VAR=1 cmd` is not PowerShell).
 */
import { spawnSync } from 'node:child_process';

process.env.E2E_MINIMAL_PRERENDER = '1';
const result = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});
process.exit(result.status === null ? 1 : result.status);
