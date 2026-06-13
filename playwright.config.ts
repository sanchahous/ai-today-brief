import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke + layout regression for critical UI flows.
 * One-time setup: `npm run e2e:install`
 * Run locally: `npm run build && npm run e2e` (starts `next start` via webServer)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Cap local workers: the full 3-engine matrix with heavy click-through specs can
  // thrash a dev machine and cascade into timeouts. CI stays serial.
  workers: process.env.CI ? 1 : 4,
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
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
