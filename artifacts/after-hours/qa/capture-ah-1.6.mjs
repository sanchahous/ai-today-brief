// AH-1.6 before/after capture for the owner's visual review.
//   node artifacts/after-hours/qa/capture-ah-1.6.mjs --label=before --base=https://aitodaybrief.com
//   node artifacts/after-hours/qa/capture-ah-1.6.mjs --label=after  --base=http://127.0.0.1:3100
// Output (git-ignored): artifacts/_local/ah-1-6-<label>/ — page shots, focus close-ups, manifest.json.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const label = arg('label');
const base = arg('base');
if (!label || !base) throw new Error('Usage: --label=before|after --base=<origin>');

const out = path.join(process.cwd(), 'artifacts', '_local', `ah-1-6-${label}`);
await mkdir(out, { recursive: true });

const ROUTES = { home: '', news: '/news' };
const SIZES = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const THEMES = { night: 'dark', day: 'light' };
const LANGS = ['en', 'uk'];
const files = [];

async function save(page, name, options = {}) {
  const file = path.join(out, name);
  await page.screenshot({ path: file, animations: 'disabled', ...options });
  const sha256 = createHash('sha256').update(await readFile(file)).digest('hex').toUpperCase();
  files.push({ name, sha256 });
}

async function open(context, lang, route, theme, size) {
  const page = await context.newPage();
  await page.setViewportSize(SIZES[size]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(
    ({ value }) => {
      localStorage.setItem('theme', value);
      localStorage.setItem('atb-consent-v1', JSON.stringify({ analytics: false, ads: false, updatedAt: '2026-09-30' }));
    },
    { value: THEMES[theme] },
  );
  await page.goto(`${base}/${lang}${ROUTES[route]}`, { waitUntil: 'load' });
  await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1200);
  return page;
}

const browser = await chromium.launch();
try {
  for (const lang of LANGS) {
    for (const route of Object.keys(ROUTES)) {
      for (const theme of Object.keys(THEMES)) {
        for (const size of Object.keys(SIZES)) {
          const context = await browser.newContext();
          const page = await open(context, lang, route, theme, size);
          await save(page, `${route}-${lang}-${theme}-${size}.png`);
          await context.close();
        }
      }
    }
  }

  // Focus close-ups (EN, desktop): the ring is the most visible AH-1.6 change.
  for (const theme of Object.keys(THEMES)) {
    const context = await browser.newContext();
    const page = await open(context, 'en', 'news', theme, 'desktop');
    const targets = {
      link: page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'News', exact: true }),
      button: page.getByTestId('theme-toggle').filter({ visible: true }).first(),
      field: page.locator('input[type="email"]').first(),
    };
    for (const [kind, locator] of Object.entries(targets)) {
      await locator.scrollIntoViewIfNeeded();
      await page.keyboard.press('Shift');
      await locator.focus();
      await page.waitForTimeout(150);
      const box = await locator.boundingBox();
      if (!box) continue;
      const pad = 24;
      await save(page, `focus-${kind}-${theme}.png`, {
        clip: {
          x: Math.max(0, box.x - pad),
          y: Math.max(0, box.y - pad),
          width: Math.min(box.width + pad * 2, 520),
          height: box.height + pad * 2,
        },
      });
    }
    await context.close();
  }
} finally {
  await browser.close();
}

let gitSha = 'unknown';
try {
  gitSha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {
  // Not a git checkout — leave "unknown".
}
await writeFile(
  path.join(out, 'manifest.json'),
  JSON.stringify({ label, base, gitSha, capturedAt: new Date().toISOString(), files }, null, 2),
);
console.log(`${label}: ${files.length} PNG -> ${out}`);
