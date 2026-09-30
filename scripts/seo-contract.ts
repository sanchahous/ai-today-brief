import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { compareSeoSnapshots, parseSeoHtml, type SeoSnapshot } from '../src/lib/seo-contract';

type SeoBaseline = { createdAt: string; base: string; routes: SeoSnapshot[] };

const DEFAULT_BASELINE = path.join(process.cwd(), 'e2e/fixtures/seo-contract.baseline.json');
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

function option(name: string): string | undefined {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function pathFromSitemap(xml: string): { path: string; modified: string; position: number }[] {
  return [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/g)]
    .map((match, position) => ({
      path: new URL(match[1]).pathname,
      modified: match[2].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? '',
      position,
    }))
    .filter((entry) => entry.path.startsWith('/en'));
}

function selectPaths(xml: string): string[] {
  const entries = pathFromSitemap(xml);
  const newest = (pattern: RegExp) =>
    entries
      .filter((entry) => pattern.test(entry.path))
      .sort((a, b) => b.modified.localeCompare(a.modified) || a.position - b.position);
  const select = (pattern: RegExp, name: string, preferred?: string) => {
    const candidates = newest(pattern);
    const chosen = candidates.find((entry) => entry.path === preferred) ?? candidates[0];
    if (!chosen) throw new Error(`No ${name} in sitemap`);
    return chosen.path.slice('/en'.length);
  };
  const categories = new Set<string>();
  const articles = newest(/^\/en\/news\/[^/]+\/[^/]+$/)
    .filter((entry) => {
      const category = entry.path.split('/')[3];
      if (categories.has(category)) return false;
      categories.add(category);
      return true;
    })
    .slice(0, 3);
  if (articles.length < 3) throw new Error('Sitemap has fewer than three article categories');
  const daily = newest(/^\/en\/[^/]+$/).find((entry) => !STATIC_SEGMENTS.has(entry.path.slice(4)));
  if (!daily) throw new Error('No daily brief in sitemap');
  return [
    '',
    '/news',
    '/news?categories=agents-and-mcp&page=2',
    '/news/search?q=mcp',
    '/news/search?q=',
    ...articles.map((entry) => entry.path.slice(3)),
    '/digests',
    daily.path.slice(3),
    select(/^\/en\/weekly\/[^/]+$/, 'weekly'),
    '/concepts',
    select(/^\/en\/concepts\/[^/]+$/, 'concept', '/en/concepts/mcp'),
    '/guides',
    select(/^\/en\/guides\/[^/]+$/, 'guide', '/en/guides/claude-code-vs-cursor-vs-codex'),
    '/tools',
    '/tools/prompt-optimizer',
    '/tools/settings-builder',
    '/tools/claude-md-generator',
    select(/^\/en\/category\/[^/]+$/, 'category', '/en/category/agents-and-mcp'),
    '/about',
    '/author',
    '/subscribe',
    '/advertise',
    '/editorial-policy',
    '/ai-disclosure',
    '/privacy',
    '/terms',
    '/zzz-missing',
  ].flatMap((suffix) => [`/en${suffix}`, `/uk${suffix}`]);
}

function isBaseline(value: unknown): value is SeoBaseline {
  if (!value || typeof value !== 'object') return false;
  // The object guard above permits checking candidate fields before accepting the file.
  const candidate = value as Partial<SeoBaseline>;
  return (
    typeof candidate.createdAt === 'string' &&
    typeof candidate.base === 'string' &&
    Array.isArray(candidate.routes) &&
    candidate.routes.every(
      (route) => typeof route.path === 'string' && typeof route.canonical !== 'undefined',
    )
  );
}

async function getSnapshot(base: URL, routePath: string): Promise<SeoSnapshot> {
  const url = new URL(routePath, base);
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (response.status !== 200 && !(routePath.endsWith('/zzz-missing') && response.status === 404)) {
    throw new Error(`${url.href}: HTTP ${response.status}`);
  }
  const resolved = new URL(response.url);
  return parseSeoHtml(
    await response.text(),
    routePath,
    response.status,
    resolved.pathname + resolved.search,
  );
}

async function checkCacheHeaders(base: URL): Promise<string[]> {
  const errors: string[] = [];
  for (const lang of ['en', 'uk']) {
    const url = new URL(`/${lang}/news`, base);
    await fetch(url, { signal: AbortSignal.timeout(30_000) }).then((response) =>
      response.arrayBuffer(),
    );
    const repeated = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const cache = repeated.headers.get('x-vercel-cache');
    await repeated.arrayBuffer();
    if (cache !== 'HIT')
      errors.push(`${url.href}: second x-vercel-cache was ${cache ?? '(missing)'}, expected HIT`);
  }
  return errors;
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write');
  const compare = process.argv.includes('--compare');
  if (write === compare) throw new Error('Choose exactly one of --write or --compare');
  const base = new URL(option('base') ?? 'https://aitodaybrief.com');
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Base must be an HTTP(S) URL');
  const baselineFile = path.resolve(option('baseline') ?? DEFAULT_BASELINE);
  const headerCheck = process.argv.includes('--headers');
  let paths: string[];
  let baseline: SeoBaseline | undefined;
  if (write) {
    const sitemap = await fetch(new URL('/sitemap.xml', base), {
      signal: AbortSignal.timeout(30_000),
    });
    if (!sitemap.ok) throw new Error(`Sitemap returned HTTP ${sitemap.status}`);
    paths = selectPaths(await sitemap.text());
  } else {
    const parsed: unknown = JSON.parse(await readFile(baselineFile, 'utf8'));
    if (!isBaseline(parsed)) throw new Error('Invalid SEO baseline format');
    baseline = parsed;
    paths = baseline.routes.map((route) => route.path);
  }

  const snapshots: SeoSnapshot[] = [];
  for (const routePath of paths) {
    const snapshot = await getSnapshot(base, routePath);
    snapshots.push(snapshot);
    console.log(`${snapshots.length}/${paths.length} ${routePath}: ${snapshot.status}`);
  }
  if (write) {
    const output: SeoBaseline = {
      createdAt: new Date().toISOString(),
      base: base.origin,
      routes: snapshots,
    };
    await mkdir(path.dirname(baselineFile), { recursive: true });
    await writeFile(baselineFile, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`Wrote ${snapshots.length} routes to ${baselineFile}`);
  } else if (baseline) {
    let errors = 0;
    let warnings = 0;
    for (let index = 0; index < baseline.routes.length; index += 1) {
      const diff = compareSeoSnapshots(baseline.routes[index], snapshots[index]);
      for (const error of diff.errors) console.error(`${paths[index]}: ${error}`);
      for (const warning of diff.warnings) console.warn(`${paths[index]}: ${warning}`);
      errors += diff.errors.length;
      warnings += diff.warnings.length;
    }
    if (headerCheck) {
      const headerErrors = await checkCacheHeaders(base);
      for (const error of headerErrors) console.error(error);
      errors += headerErrors.length;
    }
    console.log(`SEO compare: ${snapshots.length} routes, ${errors} errors, ${warnings} warnings`);
    if (errors) process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
