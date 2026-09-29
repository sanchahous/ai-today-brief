import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { compareSeoSnapshots, parseSeoHtml } from './seo-contract';

const execFileAsync = promisify(execFile);

const COMPLETE_HTML = `<!doctype html><html lang="uk"><head>
<title>AI &amp; tools</title>
<meta name="description" content="Useful &amp; current">
<meta name="robots" content="index,follow">
<meta property="og:title" content="AI &amp; tools">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://example.com/uk/news">
<link rel="alternate" hreflang="en" href="https://example.com/en/news">
<link rel="alternate" hreflang="uk" href="https://example.com/uk/news">
<link rel="alternate" hreflang="x-default" href="https://example.com/en/news">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
  {"@type":"NewsArticle","headline":"News","image":"a.jpg","datePublished":"2026-09-29","dateModified":"2026-09-29","author":{"@type":"Person","name":"Editor"},"publisher":{"@type":"Organization","name":"Brand","url":"https://example.com","logo":"logo.svg"},"mainEntityOfPage":"https://example.com/uk/news"},
  {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home"}]}
]}</script></head><body><main><h1>AI &amp; tools</h1><p>Useful <strong>article</strong> text.</p><script>ignored()</script></main></body></html>`;

describe('parseSeoHtml', () => {
  it('extracts metadata, schema types, H1, and visible main text from raw HTML', () => {
    const snapshot = parseSeoHtml(COMPLETE_HTML, '/uk/news', 200);
    expect(snapshot).toMatchObject({
      path: '/uk/news',
      status: 200,
      resolvedPath: '/uk/news',
      lang: 'uk',
      title: 'AI & tools',
      description: 'Useful & current',
      robots: 'index,follow',
      canonical: 'https://example.com/uk/news',
      twitterCard: 'summary_large_image',
      h1Count: 1,
    });
    expect(snapshot.hreflang).toEqual({
      en: 'https://example.com/en/news',
      uk: 'https://example.com/uk/news',
      'x-default': 'https://example.com/en/news',
    });
    expect(snapshot.openGraph).toEqual({ 'og:title': 'AI & tools', 'og:type': 'article' });
    expect(snapshot.jsonLdTypes).toEqual([
      'BreadcrumbList',
      'ListItem',
      'NewsArticle',
      'Organization',
      'Person',
    ]);
    expect(snapshot.jsonLdIssues).toEqual([]);
    expect(snapshot.mainTextLength).toBe('AI & tools Useful article text.'.length);
  });

  it('records malformed and incomplete JSON-LD without throwing', () => {
    const html = `<html><head>
      <script type='application/ld+json'>{oops}</script>
      <script type='application/ld+json'>{"@context":"wrong","@graph":[{"@type":["ListItem","Question"],"position":1}]}</script>
      <script type='application/ld+json'>[]</script>
      </head><body><h1>Outside main</h1></body></html>`;
    const snapshot = parseSeoHtml(html, '/en/x', 200, '/en/y');
    expect(snapshot.resolvedPath).toBe('/en/y');
    expect(snapshot.jsonLdTypes).toEqual(['ListItem', 'Question']);
    expect(snapshot.jsonLdIssues).toEqual([
      'ListItem:missing:item/url/name',
      'Question:missing:acceptedAnswer',
      'Question:missing:name',
      'script-1:invalid-json',
      'script-2:invalid-context',
      'script-3:invalid-context',
    ]);
    expect(snapshot.h1Count).toBe(1);
    expect(snapshot.mainTextLength).toBe(0);
    expect(snapshot.lang).toBeNull();
    expect(snapshot.canonical).toBeNull();
  });

  it('handles numeric entities and absent optional fields', () => {
    const snapshot = parseSeoHtml(
      '<html lang=en><body><main>&#65; &#x42; &unknown;</main></body></html>',
      '/en',
      200,
    );
    expect(snapshot.lang).toBe('en');
    expect(snapshot.mainTextLength).toBe('A B &unknown;'.length);
    expect(snapshot.title).toBeNull();
    expect(snapshot.jsonLdTypes).toEqual([]);
  });
});

describe('compareSeoSnapshots', () => {
  const baseline = parseSeoHtml(COMPLETE_HTML, '/uk/news', 200);

  it('passes an unchanged page', () => {
    expect(compareSeoSnapshots(baseline, parseSeoHtml(COMPLETE_HTML, '/uk/news', 200))).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it('fails when canonical is removed from the baseline fixture', () => {
    const current = { ...baseline, canonical: null };
    expect(compareSeoSnapshots(baseline, current).errors).toContain(
      'Canonical changed: https://example.com/uk/news → null',
    );
  });

  it('exits 1 when the CLI compares a fixture missing canonical', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(COMPLETE_HTML);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('HTTP test server has no port');
    const base = `http://127.0.0.1:${address.port}`;
    const dir = await mkdtemp(path.join(process.cwd(), 'artifacts/_local/seo-contract-test-'));
    const fixture = path.join(dir, 'baseline.json');
    const snapshot = { ...baseline, path: '/en', resolvedPath: '/en', canonical: null };
    await writeFile(
      fixture,
      JSON.stringify({ createdAt: new Date().toISOString(), base, routes: [snapshot] }),
    );
    try {
      await expect(
        execFileAsync(
          process.execPath,
          [
            '--import',
            'tsx',
            'scripts/seo-contract.ts',
            '--compare',
            `--base=${base}`,
            `--baseline=${fixture}`,
          ],
          { cwd: process.cwd() },
        ),
      ).rejects.toMatchObject({ code: 1 });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await unlink(fixture);
      await rmdir(dir);
    }
  });

  it('detects removed metadata, hreflang, schema, and main content', () => {
    const current = {
      ...baseline,
      title: null,
      description: null,
      robots: null,
      twitterCard: null,
      hreflang: { en: 'https://example.com/en/other' },
      openGraph: {},
      jsonLdTypes: [],
      mainTextLength: 0,
      h1Count: 0,
      status: 404,
      resolvedPath: '/uk/other',
      lang: 'en',
    };
    const diff = compareSeoSnapshots(baseline, current);
    expect(diff.errors).toContain('title disappeared');
    expect(diff.errors).toContain('description disappeared');
    expect(diff.errors).toContain('robots disappeared');
    expect(diff.errors).toContain('twitterCard disappeared');
    expect(diff.errors).toContain('hreflang uk disappeared');
    expect(diff.errors).toContain('hreflang en changed');
    expect(diff.errors).toContain('og:title disappeared');
    expect(diff.errors).toContain('JSON-LD NewsArticle disappeared');
    expect(diff.errors).toContain('H1 disappeared');
    expect(diff.errors).toContain('Main text disappeared');
    expect(diff.errors).toContain('HTTP status changed: 200 → 404');
    expect(diff.errors).toContain('Resolved path changed: /uk/news → /uk/other');
    expect(diff.errors).toContain('HTML lang changed: uk → en');
  });

  it('fails on new schema omissions or a second H1, and warns on added nodes', () => {
    const current = {
      ...baseline,
      robots: 'noindex',
      h1Count: 2,
      jsonLdTypes: [...baseline.jsonLdTypes, 'FAQPage'],
      jsonLdIssues: ['FAQPage:missing:mainEntity'],
      mainTextLength: 5,
    };
    const diff = compareSeoSnapshots(baseline, current);
    expect(diff.errors).toContain('Robots changed: index,follow → noindex');
    expect(diff.errors).toContain('H1 count increased to 2');
    expect(diff.errors).toContain('JSON-LD FAQPage:missing:mainEntity');
    expect(diff.warnings).toContain('JSON-LD FAQPage added');
    expect(diff.warnings).toContain('Main text shrank by more than half');
  });
});
