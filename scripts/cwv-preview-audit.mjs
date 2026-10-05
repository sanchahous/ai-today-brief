/**
 * AH-7.2: Lighthouse lab metrics + JS/CSS transfer sizes for five public templates.
 * Usage: node scripts/cwv-preview-audit.mjs --base=http://localhost:3100 --label=after-hours-preview
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const ROUTES = [
  { key: 'home', pathname: '/en' },
  { key: 'news', pathname: '/en/news' },
  {
    key: 'article',
    pathname:
      '/en/news/agents-and-mcp/automate-agent-email-verification-with-open-source-moemail-model-context-protoco',
  },
  { key: 'daily', pathname: '/en/reasoning-token-compression-and-efficient-agent-execution' },
  {
    key: 'weekly',
    pathname: '/en/weekly/multiverse-s-4-bit-model-beats-16-bit-nvidia-grades-its-own-2026-08-23',
  },
];

function option(name) {
  const arg = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (!arg) throw new Error(`Missing --${name}=...`);
  return arg.slice(name.length + 3);
}

function metricValue(audit) {
  return typeof audit?.numericValue === 'number' ? audit.numericValue : null;
}

function runLighthouse(url, formFactor, outFile) {
  const args = [
    url,
    '--quiet',
    '--chrome-flags=--headless --no-sandbox --disable-gpu',
    '--only-categories=performance',
    `--form-factor=${formFactor}`,
    ...(formFactor === 'desktop' ? ['--screenEmulation.disabled'] : []),
    '--output=json',
    `--output-path=${outFile}`,
  ];
  const result = spawnSync('npx', ['lighthouse', ...args], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status !== 0) throw new Error(`Lighthouse failed for ${url} (${formFactor})`);
}

async function measureTransfer(base, pathname) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const response = await page.goto(new URL(pathname, base).toString(), {
    waitUntil: 'networkidle',
    timeout: 120_000,
  });
  if (!response?.ok()) throw new Error(`HTTP ${response?.status()} for ${pathname}`);
  const totals = await page.evaluate(() => {
    const entries = performance.getEntriesByType('resource');
    let js = 0;
    let css = 0;
    let requests = 0;
    for (const entry of entries) {
      if (!('transferSize' in entry)) continue;
      const size = entry.transferSize ?? 0;
      if (!size) continue;
      requests += 1;
      if (entry.initiatorType === 'script' || /\.m?js(\?|$)/i.test(entry.name)) js += size;
      else if (entry.initiatorType === 'css' || /\.css(\?|$)/i.test(entry.name)) css += size;
    }
    return { js, css, requests };
  });
  await browser.close();
  return totals;
}

async function main() {
  const base = option('base').replace(/\/$/, '');
  const label = option('label');
  const outDir = path.join(ROOT, 'artifacts', 'after-hours', 'analytics', label);
  await mkdir(outDir, { recursive: true });

  const capturedAt = new Date().toISOString();
  const reports = [];

  for (const route of ROUTES) {
    const url = `${base}${route.pathname}`;
    const transfer = await measureTransfer(base, route.pathname);
    const devices = [];

    for (const formFactor of ['mobile', 'desktop']) {
      const outFile = path.join(outDir, `${route.key}-${formFactor}.json`);
      runLighthouse(url, formFactor, outFile);
      const lhr = JSON.parse(await readFile(outFile, 'utf8'));
      const audits = lhr.audits ?? {};
      devices.push({
        device: formFactor,
        lighthouse_version: lhr.lighthouseVersion,
        performance_score: audits['performance-score']?.score ?? audits.score?.performance ?? null,
        metrics: {
          fcp_ms: metricValue(audits['first-contentful-paint']),
          lcp_ms: metricValue(audits['largest-contentful-paint']),
          tbt_ms: metricValue(audits['total-blocking-time']),
          cls: metricValue(audits['cumulative-layout-shift']),
          speed_index_ms: metricValue(audits['speed-index']),
        },
        budgets: {
          lcp_pass: (metricValue(audits['largest-contentful-paint']) ?? 99_000) <= 2000,
          tbt_pass: (metricValue(audits['total-blocking-time']) ?? 999) <= 200,
          cls_pass: (metricValue(audits['cumulative-layout-shift']) ?? 99) <= 0.05,
        },
      });
    }

    reports.push({
      page_type: route.key,
      url,
      transfer_bytes: transfer,
      devices,
    });
  }

  const summary = {
    summary: 'AH-7.2 CWV preview audit — lab Lighthouse + transfer sizes',
    captured_at: capturedAt,
    base,
    label,
    method:
      'Lighthouse CLI performance category; TBT as INP lab proxy; JS/CSS from Playwright response content-length sum',
    routes: ROUTES.map((r) => r.key),
    reports,
  };

  const summaryPath = path.join(outDir, 'summary.json');
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${summaryPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
