import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

type Lang = 'en' | 'uk';
type Theme = 'night' | 'day';
type Route = { key: string; pathname: string };
type SitemapEntry = { pathname: string; lastModified: string; position: number };

const ROOT = process.cwd();
const SIZES = [
  { key: 'desktop', width: 1440, height: 900 },
  { key: 'mobile', width: 390, height: 844 },
] as const;
const LANGS: Lang[] = ['en', 'uk'];
const THEMES: Theme[] = ['night', 'day'];
const STATIC_SEGMENTS = new Set([
  'news',
  'digests',
  'concepts',
  'guides',
  'tools',
  'about',
  'author',
  'subscribe',
  'advertise',
  'editorial-policy',
  'ai-disclosure',
  'privacy',
  'terms',
]);

function option(name: string): string {
  const arg = process.argv.slice(2).find((value) => value.startsWith(`--${name}=`));
  if (!arg) throw new Error(`Missing --${name}=...`);
  return arg.slice(name.length + 3);
}

function parseSitemap(xml: string): SitemapEntry[] {
  return [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/g)].map(
    (match, position) => {
      const lastModified = match[2].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? '';
      return { pathname: new URL(match[1]).pathname, lastModified, position };
    },
  );
}

function newest(entries: SitemapEntry[], pattern: RegExp): SitemapEntry[] {
  return entries
    .filter((entry) => pattern.test(entry.pathname))
    .sort((a, b) => b.lastModified.localeCompare(a.lastModified) || a.position - b.position);
}

function requirePath(
  entries: SitemapEntry[],
  pattern: RegExp,
  name: string,
  preferred?: string,
): string {
  const matches = newest(entries, pattern);
  const selected = matches.find((entry) => entry.pathname === preferred) ?? matches[0];
  if (!selected) throw new Error(`No ${name} URL found in sitemap`);
  return selected.pathname.slice('/en'.length);
}

function routeMatrix(entries: SitemapEntry[]): Route[] {
  const articles = newest(entries, /^\/en\/news\/[^/]+\/[^/]+$/);
  const distinctCategories = new Set<string>();
  const selectedArticles = articles
    .filter((entry) => {
      const category = entry.pathname.split('/')[3];
      if (distinctCategories.has(category)) return false;
      distinctCategories.add(category);
      return true;
    })
    .slice(0, 3);
  if (selectedArticles.length < 3)
    throw new Error('Sitemap has fewer than three article categories');

  const daily = newest(entries, /^\/en\/[^/]+$/).find(
    (entry) => !STATIC_SEGMENTS.has(entry.pathname.slice('/en/'.length)),
  );
  if (!daily) throw new Error('No daily brief URL found in sitemap');

  const routes: Route[] = [
    { key: 'home', pathname: '' },
    { key: 'news', pathname: '/news' },
    { key: 'news-filtered', pathname: '/news?categories=agents-and-mcp&page=2' },
    { key: 'search', pathname: '/news/search?q=mcp' },
    { key: 'search-empty', pathname: '/news/search?q=' },
    ...selectedArticles.map((entry, index) => ({
      key: `article-${index + 1}`,
      pathname: entry.pathname.slice('/en'.length),
    })),
    { key: 'digests', pathname: '/digests' },
    { key: 'daily', pathname: daily.pathname.slice('/en'.length) },
    { key: 'weekly', pathname: requirePath(entries, /^\/en\/weekly\/[^/]+$/, 'weekly') },
    { key: 'concepts', pathname: '/concepts' },
    {
      key: 'concept',
      pathname: requirePath(entries, /^\/en\/concepts\/[^/]+$/, 'concept', '/en/concepts/mcp'),
    },
    { key: 'guides', pathname: '/guides' },
    {
      key: 'guide',
      pathname: requirePath(
        entries,
        /^\/en\/guides\/[^/]+$/,
        'guide',
        '/en/guides/claude-code-vs-cursor-vs-codex',
      ),
    },
    { key: 'tools', pathname: '/tools' },
    { key: 'tool-prompt-optimizer', pathname: '/tools/prompt-optimizer' },
    { key: 'tool-settings-builder', pathname: '/tools/settings-builder' },
    { key: 'tool-claude-md-generator', pathname: '/tools/claude-md-generator' },
    {
      key: 'category',
      pathname: requirePath(
        entries,
        /^\/en\/category\/[^/]+$/,
        'category',
        '/en/category/agents-and-mcp',
      ),
    },
    { key: 'about', pathname: '/about' },
    { key: 'author', pathname: '/author' },
    { key: 'subscribe', pathname: '/subscribe' },
    { key: 'advertise', pathname: '/advertise' },
    { key: 'editorial-policy', pathname: '/editorial-policy' },
    { key: 'ai-disclosure', pathname: '/ai-disclosure' },
    { key: 'privacy', pathname: '/privacy' },
    { key: 'terms', pathname: '/terms' },
    { key: 'not-found', pathname: '/zzz-missing' },
  ];
  return routes;
}

async function main(): Promise<void> {
  const base = new URL(option('base'));
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Base must be an HTTP(S) URL');
  const label = option('label');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(label))
    throw new Error('Label must contain lowercase letters, digits, or hyphens');
  const only = process.argv
    .find((arg) => arg.startsWith('--routes='))
    ?.slice('--routes='.length)
    .split(',');
  const sitemapResponse = await fetch(new URL('/sitemap.xml', base));
  if (!sitemapResponse.ok) throw new Error(`Sitemap returned HTTP ${sitemapResponse.status}`);
  const sitemap = parseSitemap(await sitemapResponse.text());
  const routes = routeMatrix(sitemap).filter((route) => !only || only.includes(route.key));
  if (!routes.length) throw new Error('No matching routes');

  const consentState = JSON.parse(
    await readFile(path.join(ROOT, 'e2e/consent-state.json'), 'utf8'),
  ) as {
    origins: { localStorage: { name: string; value: string }[] }[];
  };
  const consent = consentState.origins[0]?.localStorage.find(
    (entry) => entry.name === 'atb-consent-v1',
  );
  if (!consent) throw new Error('Consent state is missing atb-consent-v1');

  const out = path.join(ROOT, 'artifacts', '_local', label);
  await mkdir(out, { recursive: true });
  const timestamp = new Date().toISOString();
  const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const manifest = {
    label,
    base: base.origin,
    capturedAt: timestamp,
    gitSha,
    sitemapUrl: new URL('/sitemap.xml', base).href,
    screenshots: [] as {
      file: string;
      key: string;
      url: string;
      width: number;
      height: number;
      theme: Theme;
      lang: Lang;
      capturedAt: string;
      gitSha: string;
    }[],
  };

  const browser = await chromium.launch();
  try {
    for (const lang of LANGS)
      for (const theme of THEMES)
        for (const size of SIZES) {
          const context = await browser.newContext({
            viewport: { width: size.width, height: size.height },
            deviceScaleFactor: 1,
            isMobile: size.key === 'mobile',
            hasTouch: size.key === 'mobile',
            colorScheme: theme === 'day' ? 'light' : 'dark',
            reducedMotion: 'reduce',
          });
          await context.addInitScript(
            ({ themeValue, consentName, consentValue }) => {
              localStorage.setItem('theme', themeValue);
              localStorage.setItem(consentName, consentValue);
            },
            {
              themeValue: theme === 'day' ? 'light' : 'dark',
              consentName: consent.name,
              consentValue: consent.value,
            },
          );
          const page = await context.newPage();
          try {
            for (const route of routes) {
              const url = new URL(`/${lang}${route.pathname}`, base).href;
              const response = await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
              const status = response?.status();
              // Streamed Next error pages can carry HTTP 200 after headers have been sent.
              if (status !== 200 && !(route.key === 'not-found' && status === 404)) {
                throw new Error(
                  `${url}: HTTP ${status ?? 'no response'}, expected 200${route.key === 'not-found' ? ' or 404' : ''}`,
                );
              }
              await page.evaluate(() => document.fonts.ready);
              const file = `${route.key}-${lang}-${theme}-${size.key}.png`;
              await page.screenshot({ path: path.join(out, file), animations: 'disabled' });
              manifest.screenshots.push({
                file,
                key: route.key,
                url,
                width: size.width,
                height: size.height,
                theme,
                lang,
                capturedAt: new Date().toISOString(),
                gitSha,
              });
              console.log(`${manifest.screenshots.length}: ${file}`);
            }
          } finally {
            await context.close();
          }
        }
  } finally {
    await browser.close();
    await writeFile(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  console.log(`Captured ${manifest.screenshots.length} screenshots in ${out}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
