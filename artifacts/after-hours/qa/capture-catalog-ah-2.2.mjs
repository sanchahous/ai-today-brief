import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const out = 'artifacts/_local/ah-2-2-catalog';
const base = process.argv.find((arg) => arg.startsWith('--base='))?.slice(7) ?? 'http://localhost:3106';
await mkdir(out, { recursive: true });
const files = [];
const browser = await chromium.launch();
try {
  for (const lang of ['en', 'uk']) for (const theme of ['night', 'day']) for (const [size, width] of [['desktop', 1440], ['mobile', 390]]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', storageState: 'e2e/consent-state.json' });
    await context.addInitScript((value) => localStorage.setItem('theme', value), theme === 'day' ? 'light' : 'dark');
    const page = await context.newPage();
    await page.goto(`${base}/ds-catalog`);
    await page.locator('main h1').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: 'nextjs-portal {display:none!important} * {transition:none!important}' });
    const scope = page.getByTestId('action-catalog');
    if (lang === 'uk') await scope.getByRole('button', { name: 'UK', exact: true }).click();
    const name = `catalog-${lang}-${theme}-${size}.png`;
    await scope.screenshot({ path: `${out}/${name}`, animations: 'disabled' });
    files.push({ name, sha256: createHash('sha256').update(await readFile(`${out}/${name}`)).digest('hex') });
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(`${out}/manifest.json`, JSON.stringify({ base, createdAt: new Date().toISOString(), files }, null, 2));
console.log(`${files.length} catalog screenshots`);
