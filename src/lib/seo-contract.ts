export type SeoSnapshot = {
  path: string;
  status: number;
  resolvedPath: string;
  lang: string | null;
  title: string | null;
  description: string | null;
  robots: string | null;
  canonical: string | null;
  hreflang: Record<string, string>;
  openGraph: Record<string, string>;
  twitterCard: string | null;
  jsonLdTypes: string[];
  jsonLdIssues: string[];
  h1Count: number;
  mainTextLength: number;
};

export type SeoDiff = { errors: string[]; warnings: string[] };

const REQUIRED_JSON_LD: Record<string, string[]> = {
  NewsArticle: [
    'headline',
    'image',
    'datePublished',
    'dateModified',
    'author',
    'publisher',
    'mainEntityOfPage',
  ],
  TechArticle: ['headline', 'dateModified', 'author', 'publisher'],
  VideoObject: ['name', 'description', 'thumbnailUrl', 'uploadDate'],
  FAQPage: ['mainEntity'],
  Question: ['name', 'acceptedAnswer'],
  Answer: ['text'],
  BreadcrumbList: ['itemListElement'],
  ItemList: ['itemListElement'],
  ListItem: ['position'],
  CollectionPage: ['name', 'url'],
  WebSite: ['name', 'url'],
  SearchAction: ['target', 'query-input'],
  Organization: ['name', 'url', 'logo'],
  Person: ['name'],
  WebApplication: ['name', 'applicationCategory', 'offers'],
  Offer: ['price', 'priceCurrency'],
  DefinedTermSet: ['name', 'hasDefinedTerm'],
  DefinedTerm: ['name'],
  ProfilePage: ['mainEntity'],
  AboutPage: ['name'],
};

function attrs(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of raw.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return result;
}

function decodeEntities(raw: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };
  return raw.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
    if (name.startsWith('#x')) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    return named[name.toLowerCase()] ?? entity;
  });
}

function textContent(raw: string): string {
  return decodeEntities(
    raw
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function present(value: unknown): boolean {
  return (
    value !== undefined &&
    value !== null &&
    value !== '' &&
    (!Array.isArray(value) || value.length > 0)
  );
}

function inspectNode(value: unknown, types: Set<string>, issues: Set<string>): void {
  if (Array.isArray(value)) {
    for (const child of value) inspectNode(child, types, issues);
    return;
  }
  if (!value || typeof value !== 'object') return;
  // The object guard above makes property inspection safe at this JSON boundary.
  const node = value as Record<string, unknown>;
  const rawTypes = node['@type'];
  const nodeTypes =
    typeof rawTypes === 'string'
      ? [rawTypes]
      : Array.isArray(rawTypes)
        ? rawTypes.filter((type): type is string => typeof type === 'string')
        : [];
  for (const type of nodeTypes) {
    types.add(type);
    for (const field of REQUIRED_JSON_LD[type] ?? []) {
      if (!present(node[field])) issues.add(`${type}:missing:${field}`);
    }
    if (type === 'ListItem' && !present(node.item) && !present(node.url) && !present(node.name)) {
      issues.add('ListItem:missing:item/url/name');
    }
  }
  for (const child of Object.values(node)) {
    if (child && typeof child === 'object') inspectNode(child, types, issues);
  }
}

function parseJsonLd(html: string): { types: string[]; issues: string[] } {
  const types = new Set<string>();
  const issues = new Set<string>();
  let index = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (attrs(match[1]).type?.toLowerCase() !== 'application/ld+json') continue;
    index += 1;
    try {
      const graph: unknown = JSON.parse(match[2]);
      // Parsed JSON has unknown shape; only a non-array object can carry @context.
      const root =
        graph && typeof graph === 'object' && !Array.isArray(graph)
          ? (graph as Record<string, unknown>)
          : null;
      if (root?.['@context'] !== 'https://schema.org')
        issues.add(`script-${index}:invalid-context`);
      inspectNode(graph, types, issues);
    } catch {
      issues.add(`script-${index}:invalid-json`);
    }
  }
  return { types: [...types].sort(), issues: [...issues].sort() };
}

export function parseSeoHtml(
  html: string,
  path: string,
  status: number,
  resolvedPath = path,
): SeoSnapshot {
  const htmlTag = html.match(/<html\b([^>]*)>/i);
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const metas: Record<string, string> = {};
  for (const tag of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const properties = attrs(tag[1]);
    const key = (properties.property ?? properties.name)?.toLowerCase();
    if (key && properties.content !== undefined) metas[key] = decodeEntities(properties.content);
  }
  const links: Record<string, string> = {};
  const hreflang: Record<string, string> = {};
  for (const tag of html.matchAll(/<link\b([^>]*)>/gi)) {
    const properties = attrs(tag[1]);
    if (!properties.href) continue;
    const rel = properties.rel?.toLowerCase().split(/\s+/) ?? [];
    if (rel.includes('canonical')) links.canonical = decodeEntities(properties.href);
    if (rel.includes('alternate') && properties.hreflang) {
      hreflang[properties.hreflang.toLowerCase()] = decodeEntities(properties.href);
    }
  }
  const openGraph = Object.fromEntries(
    Object.entries(metas).filter(([key]) => key.startsWith('og:')),
  );
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? '';
  const jsonLd = parseJsonLd(html);
  return {
    path,
    status,
    resolvedPath,
    lang: htmlTag ? (attrs(htmlTag[1]).lang ?? null) : null,
    title: title ? textContent(title[1]) : null,
    description: metas.description ?? null,
    robots: metas.robots ?? null,
    canonical: links.canonical ?? null,
    hreflang,
    openGraph,
    twitterCard: metas['twitter:card'] ?? null,
    jsonLdTypes: jsonLd.types,
    jsonLdIssues: jsonLd.issues,
    h1Count: [...html.matchAll(/<h1\b/gi)].length,
    mainTextLength: textContent(main).length,
  };
}

export function compareSeoSnapshots(baseline: SeoSnapshot, current: SeoSnapshot): SeoDiff {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (current.status !== baseline.status)
    errors.push(`HTTP status changed: ${baseline.status} → ${current.status}`);
  if (current.resolvedPath !== baseline.resolvedPath)
    errors.push(`Resolved path changed: ${baseline.resolvedPath} → ${current.resolvedPath}`);
  if (current.lang !== baseline.lang)
    errors.push(`HTML lang changed: ${baseline.lang} → ${current.lang}`);
  if (baseline.canonical !== current.canonical)
    errors.push(`Canonical changed: ${baseline.canonical} → ${current.canonical}`);
  for (const field of ['title', 'description', 'robots', 'twitterCard'] as const) {
    if (baseline[field] && !current[field]) errors.push(`${field} disappeared`);
  }
  if (baseline.robots && current.robots && baseline.robots !== current.robots) {
    errors.push(`Robots changed: ${baseline.robots} → ${current.robots}`);
  }
  for (const [lang, href] of Object.entries(baseline.hreflang)) {
    if (!current.hreflang[lang]) errors.push(`hreflang ${lang} disappeared`);
    else if (current.hreflang[lang] !== href) errors.push(`hreflang ${lang} changed`);
  }
  for (const key of Object.keys(baseline.openGraph)) {
    if (!current.openGraph[key]) errors.push(`${key} disappeared`);
  }
  for (const type of baseline.jsonLdTypes) {
    if (!current.jsonLdTypes.includes(type)) errors.push(`JSON-LD ${type} disappeared`);
  }
  for (const type of current.jsonLdTypes) {
    if (!baseline.jsonLdTypes.includes(type)) warnings.push(`JSON-LD ${type} added`);
  }
  for (const issue of current.jsonLdIssues) {
    if (!baseline.jsonLdIssues.includes(issue)) errors.push(`JSON-LD ${issue}`);
  }
  if (current.h1Count > 1 && baseline.h1Count <= 1)
    errors.push(`H1 count increased to ${current.h1Count}`);
  if (baseline.h1Count > 0 && current.h1Count === 0) errors.push('H1 disappeared');
  if (baseline.mainTextLength > 0 && current.mainTextLength === 0)
    errors.push('Main text disappeared');
  else if (current.mainTextLength < baseline.mainTextLength * 0.5)
    warnings.push('Main text shrank by more than half');
  return { errors, warnings };
}
