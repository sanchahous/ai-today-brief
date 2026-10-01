// AH-1.5 before/after capture for the owner's visual review.
//   node artifacts/after-hours/qa/capture-ah-1.5-tracking.mjs --label=before --base=http://127.0.0.1:3106
//   node artifacts/after-hours/qa/capture-ah-1.5-tracking.mjs --label=after  --base=http://127.0.0.1:3105
// Output (git-ignored): artifacts/_local/ah-1-5-tracking-<label>/ — page shots and manifest.json.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const label = arg('label');
const base = arg('base');
if (!label || !base) throw new Error('Usage: --label=before|after --base=<origin>');

const out = path.join(process.cwd(), 'artifacts', '_local', `ah-1-5-tracking-${label}`);
await mkdir(out, { recursive: true });

const ROUTES = { digests: '/digests' };
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
  // Local `next dev` draws its own indicator; production has no such element.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.evaluate(() => document.fonts.ready);
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

} finally {
  await browser.close();
}

let gitSha = 'unknown';
let workingTreeStatus = 'unknown';
try {
  gitSha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  workingTreeStatus = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
} catch {
  // Not a git checkout — leave "unknown".
}
await writeFile(
  path.join(out, 'manifest.json'),
  JSON.stringify({ label, base, gitSha, workingTreeStatus, routes: ROUTES, capturedAt: new Date().toISOString(), files }, null, 2),
);
console.log(`${label}: ${files.length} PNG -> ${out}`);
