import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.argv.find((arg) => arg.startsWith('--base='))?.slice(7) ?? 'http://localhost:3107';
const width = Number(process.argv.find((arg) => arg.startsWith('--width='))?.slice(8) ?? 1440);
const height = Number(process.argv.find((arg) => arg.startsWith('--height='))?.slice(9) ?? 900);
const out = `artifacts/_local/ah-2-5-loading-cls-${width}.json`;

const hops = [
  { from: '/en', to: '/en/news', fallback: 'news' },
  { from: '/en/news', to: '/en', fallback: 'home' },
  { from: '/uk/news', to: '/uk', fallback: 'home' },
  { from: '/en', to: '/en/category/agents-and-mcp', fallback: 'category' },
  { from: '/en/category/agents-and-mcp', to: '/en/news', fallback: 'news' },
];

async function arm(page) {
  await page.evaluate(() => {
    const bucket = [];
    window.__ahShifts = bucket;
    if (window.__ahShiftObserver) return;
    window.__ahShiftObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        bucket.push({
          value: entry.value,
          hadRecentInput: entry.hadRecentInput,
        });
      }
    });
    window.__ahShiftObserver.observe({ type: 'layout-shift', buffered: true });
  });
  await page.evaluate(() => {
    window.__ahShifts.length = 0;
  });
}

async function readShifts(page) {
  return page.evaluate(() => {
    const shifts = window.__ahShifts ?? [];
    const sum = (items) => items.reduce((total, item) => total + item.value, 0);
    return {
      counted: sum(shifts.filter((item) => !item.hadRecentInput)),
      includingInput: sum(shifts),
      entries: shifts.length,
    };
  });
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height },
  reducedMotion: 'reduce',
  storageState: 'e2e/consent-state.json',
});
const page = await context.newPage();
await page.route('**/*', async (route) => {
  const headers = route.request().headers();
  if (headers['next-router-prefetch'] === '1') {
    await route.abort();
    return;
  }
  if (headers.rsc === '1') await new Promise((resolve) => setTimeout(resolve, 900));
  await route.continue();
});

const rows = [];
try {
  for (const hop of hops) {
    await page.goto(`${base}${hop.from}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('main h1').waitFor({ timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    await arm(page);
    const clicked = await page.evaluate((href) => {
      const link = document.querySelector(`a[href="${href}"]`);
      if (!(link instanceof HTMLAnchorElement)) return false;
      link.click();
      return true;
    }, hop.to);
    if (!clicked) {
      rows.push({ ...hop, sawSkeleton: false, counted: null, includingInput: null, entries: 0, error: 'link missing' });
      console.log(`${hop.from} -> ${hop.to} link missing`);
      continue;
    }
    let sawSkeleton = false;
    let skeletonBox = null;
    for (let i = 0; i < 40; i += 1) {
      const skeleton = page.locator('.skeleton-reveal').first();
      sawSkeleton = await skeleton.isVisible().catch(() => false);
      if (sawSkeleton) {
        skeletonBox = await skeleton.boundingBox();
        break;
      }
      await page.waitForTimeout(40);
    }
    await page.locator('main h1').waitFor({ timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const contentBox = await page.locator('main').boundingBox();
    const shifts = await readShifts(page);
    rows.push({ ...hop, sawSkeleton, skeletonBox, contentBox, ...shifts });
    console.log(`${hop.from} -> ${hop.to} skeleton=${sawSkeleton} counted=${shifts.counted.toFixed(4)} all=${shifts.includingInput.toFixed(4)}`);
  }
} finally {
  await browser.close();
}

await mkdir('artifacts/_local', { recursive: true });
const report = { base, createdAt: new Date().toISOString(), viewport: `${width}x${height}`, rows };
await writeFile(out, JSON.stringify(report, null, 2));
const worst = rows.reduce((best, row) => Math.max(best, row.counted ?? 0), 0);
console.log(`worst counted CLS ${worst}`);
console.log(`wrote ${out}`);
