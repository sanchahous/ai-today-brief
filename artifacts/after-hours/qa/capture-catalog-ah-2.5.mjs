import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const out = 'artifacts/_local/ah-2-5-catalog';
const base = process.argv.find((arg) => arg.startsWith('--base='))?.slice(7) ?? 'http://localhost:3107';
await mkdir(out, { recursive: true });
const files = [];
const browser = await chromium.launch();

async function prepare(page, lang, theme) {
  await page.goto(`${base}/ds-catalog`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.locator('main h1').waitFor({ timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'nextjs-portal {display:none!important} *, *::before, *::after {transition:none!important; animation:none!important}' });
  const scope = page.getByTestId('feedback-catalog');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="feedback-catalog"]')?.getAttribute('data-ready') === 'true',
    undefined,
    { timeout: 15000 },
  );
  if (lang === 'uk') {
    await scope.getByRole('button', { name: 'UK', exact: true }).click();
    await scope.getByRole('button', { name: 'Спробувати ще' }).waitFor({ timeout: 10000 });
  }
  await scope.scrollIntoViewIfNeeded();
  return scope;
}

try {
  for (const lang of ['en', 'uk']) {
    for (const theme of ['night', 'day']) {
      for (const [size, width] of [['desktop', 1440], ['mobile', 390]]) {
        const context = await browser.newContext({
          viewport: { width, height: 1400 },
          reducedMotion: 'reduce',
          storageState: 'e2e/consent-state.json',
        });
        await context.addInitScript((value) => localStorage.setItem('theme', value), theme === 'day' ? 'light' : 'dark');
        const page = await context.newPage();
        const scope = await prepare(page, lang, theme);
        const name = `catalog-${lang}-${theme}-${size}.png`;
        await scope.screenshot({ path: `${out}/${name}`, animations: 'disabled', timeout: 20000 });
        files.push({ name, sha256: createHash('sha256').update(await readFile(`${out}/${name}`)).digest('hex') });
        await context.close();
      }
    }
  }

  const extras = [
    ['en', 'night', 'desktop', 1440, 'Show the story', 'ready'],
    ['en', 'day', 'mobile', 390, 'Try again', 'retry'],
    ['uk', 'night', 'desktop', 1440, 'Показати матеріал', 'ready'],
    ['uk', 'day', 'mobile', 390, 'Спробувати ще', 'retry'],
  ];
  for (const [lang, theme, size, width, control, variant] of extras) {
    const context = await browser.newContext({
      viewport: { width, height: 1400 },
      reducedMotion: 'reduce',
      storageState: 'e2e/consent-state.json',
    });
    await context.addInitScript((value) => localStorage.setItem('theme', value), theme === 'day' ? 'light' : 'dark');
    const page = await context.newPage();
    const scope = await prepare(page, lang, theme);
    if (variant === 'ready') await scope.getByRole('button', { name: control, exact: true }).click();
    if (variant === 'retry') await scope.getByRole('button', { name: control, exact: true }).click();
    const name = `state-${variant}-${lang}-${theme}-${size}.png`;
    await scope.screenshot({ path: `${out}/${name}`, animations: 'disabled', timeout: 20000 });
    files.push({ name, sha256: createHash('sha256').update(await readFile(`${out}/${name}`)).digest('hex') });
    await context.close();
  }
} finally {
  await browser.close();
}

const manifest = { base, createdAt: new Date().toISOString(), files };
await writeFile(`${out}/manifest.json`, JSON.stringify(manifest, null, 2));
const manifestHash = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
console.log(`${files.length} catalog screenshots`);
console.log(`manifest-sha ${manifestHash}`);
