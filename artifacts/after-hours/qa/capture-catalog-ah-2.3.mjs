import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const out = 'artifacts/_local/ah-2-3-catalog';
const base = process.argv.find((arg) => arg.startsWith('--base='))?.slice(7) ?? 'http://localhost:3107';
await mkdir(out, { recursive: true });
const files = [];
const browser = await chromium.launch();
try {
  for (const lang of ['en', 'uk']) for (const theme of ['night', 'day']) for (const [size, width] of [['desktop', 1440], ['mobile', 390]]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', storageState: 'e2e/consent-state.json' });
    await context.addInitScript((value) => localStorage.setItem('theme', value), theme === 'day' ? 'light' : 'dark');
    const page = await context.newPage();
    await page.goto(`${base}/ds-catalog`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.locator('main h1').waitFor({ timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: 'nextjs-portal {display:none!important} * {transition:none!important}' });
    const scope = page.getByTestId('field-catalog');
    await page.waitForFunction(() => document.querySelector('[data-testid="field-catalog"]')?.getAttribute('data-ready') === 'true', undefined, { timeout: 15000 });
    if (lang === 'uk') await scope.getByRole('button', { name: 'UK', exact: true }).click();
    await scope.getByTestId('field-focus-sample').focus();
    const name = `catalog-${lang}-${theme}-${size}.png`;
    await scope.screenshot({ path: `${out}/${name}`, animations: 'disabled', timeout: 20000 });
    files.push({ name, sha256: createHash('sha256').update(await readFile(`${out}/${name}`)).digest('hex') });
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(`${out}/manifest.json`, JSON.stringify({ base, createdAt: new Date().toISOString(), files }, null, 2));
console.log(`${files.length} catalog screenshots`);
