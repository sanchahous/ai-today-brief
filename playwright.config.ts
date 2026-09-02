import { defineConfig, devices } from '@playwright/test';
import { realpathSync } from 'node:fs';

/**
 * E2E smoke + layout regression for critical UI flows.
 * One-time setup: `npm run e2e:install`
 * Run locally: `E2E_MINIMAL_PRERENDER=1 npm run build && npm run e2e`
 * (starts `next start` via webServer). Without the env flag a full SSG against
 * live PostgREST repeats the Sep 2026 uncached-egress incident.
 */

/**
 * Canonical project dir for the web server's cwd. On a subst / dual-drive-letter
 * dev box the process cwd can be the subst drive (e.g. `D:`) while Next bakes the
 * app dir on the real drive (`E:`); `next start` then joins the two across drives
 * and looks for `.next/routes-manifest.json` at a mangled, tripled path, so the
 * server never boots and every spec fails. Starting it from the realpath'd dir
 * keeps cwd on the same drive Next baked. No-op on CI / a normal checkout
 * (realpath returns the same path there). `__dirname` (not `import.meta`) —
 * Playwright loads this config as CommonJS.
 */
const projectDir = realpathSync(__dirname);
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Cap local workers: the full 3-engine matrix with heavy click-through specs can
  // thrash a dev machine and cascade into timeouts.
  //
  // CI ran serial because a private-repo runner is 2-core, and Playwright's own
  // default (half the cores) is 1 there — two workers plus `next start` would have
  // contended for the same two CPUs. The repo is public as of 2026-08-18, so
  // ubuntu-latest is 4-core/16 GB and two workers fit alongside the server. This is
  // what takes the ~11 min three-engine matrix down to roughly half.
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    viewport: { width: 1280, height: 720 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Pre-seed cookie consent so the bottom-fixed consent banner never intercepts
    // clicks / covers content during tests (it otherwise breaks bottom-of-page flows).
    storageState: './e2e/consent-state.json',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run start',
    // Run from the canonical (realpath'd) dir — see projectDir above.
    cwd: projectDir,
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
