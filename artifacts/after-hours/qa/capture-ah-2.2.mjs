// Local real-data visual receipts; PNGs stay in artifacts/_local/.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const arg = (key) => process.argv.find((value) => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const label = arg('label');
const base = arg('base');
if (!label || !base) throw new Error('Pass --label=before|after and --base=<local origin>');
const out = path.resolve('artifacts/_local', `ah-2-2-${label}`);
await mkdir(out, { recursive: true });
const routes = {
  home: '',
  news: '/news',
  filters: '/news?categories=agents-and-mcp',
  category: '/category/agents-and-mcp',
  article: '/news/tools-and-releases/deep-dive-into-chatgpt-work-persistent-filesystem-web-browser-and-cloud-deployme',
};
const files = [];
const errors = [];
const consent = JSON.parse(await readFile('e2e/consent-state.json', 'utf8'));
consent.origins = consent.origins.map((origin) => ({ ...origin, origin: new URL(base).origin }));
const browser = await chromium.launch();
try {
  for (const lang of ['en', 'uk']) for (const theme of ['night', 'day']) {
    for (const [size, width] of [['desktop', 1440], ['mobile', 390]]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: 'reduce',
        storageState: consent,
      });
      await context.addInitScript((value) => localStorage.setItem('theme', value), theme === 'day' ? 'light' : 'dark');
      for (const [route, suffix] of Object.entries(routes)) {
        const page = await context.newPage();
        page.on('pageerror', (error) => errors.push({ route, lang, theme, size, message: error.message }));
        await page.goto(`${base}/${lang}${suffix}`);
        await page.locator('main h1').waitFor({ timeout: 30_000 });
        if (['news', 'filters', 'category'].includes(route)) await page.getByTestId('post-card').first().waitFor();
        if (route === 'filters') await page.getByTestId('active-filter-chips').waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({ content: 'nextjs-portal { display:none!important }' });
        const name = `${route}-${lang}-${theme}-${size}.png`;
        await page.screenshot({ path: path.join(out, name), fullPage: true, animations: 'disabled' });
        files.push({ name, sha256: createHash('sha256').update(await readFile(path.join(out, name))).digest('hex') });
        await page.close();
      }
      await context.close();
    }
  }
} finally { await browser.close(); }
await writeFile(path.join(out, 'manifest.json'), JSON.stringify({
  label, base, createdAt: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  files, errors,
}, null, 2));
console.log(`${label}: ${files.length} screenshots, ${errors.length} page errors`);
if (errors.length) process.exitCode = 1;
