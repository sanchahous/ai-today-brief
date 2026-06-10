/**
 * Research a hand-picked story by title (and optional URL) before the editor
 * summarize step. Gathers multiple independent sources — not a single copy-paste.
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { resolveGeminiModelQueue } from './gemini-models';
import { logEvent } from './log';
import { generateWithModelQueue } from './summarize';
import type { PoolItem } from './select';
import type { FetchedArticle } from './sources/http';
import { categoryForTitle, detectTopic } from './topics';
import { fetchWithRetry } from './sources/http';

export interface CustomSourceNote {
  title: string;
  url: string;
  source_name: string;
  excerpt: string;
}

export interface CustomResearchResult {
  title: string;
  url: string;
  source_name: string;
  source_url: string;
  published_at: string;
  /** Cross-source synthesis for the editor prompt (also used in dry-run output). */
  synthesis_notes: string;
  /** @deprecated alias — use synthesis_notes */
  excerpt: string;
  sources: CustomSourceNote[];
}

const RESEARCH_STRING = { type: SchemaType.STRING } as const;

const RESEARCH_SCHEMA: NonNullable<
  NonNullable<
    Parameters<GoogleGenerativeAI['getGenerativeModel']>[0]['generationConfig']
  >['responseSchema']
> = {
  type: SchemaType.OBJECT,
  properties: {
    title: RESEARCH_STRING,
    url: RESEARCH_STRING,
    source_name: RESEARCH_STRING,
    source_url: RESEARCH_STRING,
    published_at: RESEARCH_STRING,
    synthesis_notes: RESEARCH_STRING,
    sources: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: RESEARCH_STRING,
          url: RESEARCH_STRING,
          source_name: RESEARCH_STRING,
          key_facts: RESEARCH_STRING,
        },
        required: ['title', 'url', 'source_name', 'key_facts'],
      },
    },
  },
  required: [
    'title',
    'url',
    'source_name',
    'source_url',
    'published_at',
    'synthesis_notes',
    'sources',
  ],
};

const MIN_SOURCES = 2;
const MAX_SOURCES_FETCH = 4;
const PAGE_EXCERPT_CHARS = 4_000;

interface RawSourceRow {
  title: string;
  url: string;
  source_name: string;
  key_facts: string;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function normalizePublishedAt(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return new Date().toISOString();
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return new Date().toISOString();
  return new Date(parsed).toISOString();
}

function parseRawSources(value: unknown): RawSourceRow[] {
  if (!Array.isArray(value)) return [];
  const rows: RawSourceRow[] = [];
  for (const entry of value) {
    const obj = (entry ?? {}) as Record<string, unknown>;
    const url = asString(obj.url);
    if (!isHttpUrl(url)) continue;
    rows.push({
      title: asString(obj.title) || url,
      url,
      source_name: asString(obj.source_name) || 'Web',
      key_facts: asString(obj.key_facts),
    });
  }
  return rows;
}

/** Dedupe by normalized URL, preserve order. */
export function dedupeSourcesByUrl(sources: RawSourceRow[]): RawSourceRow[] {
  const seen = new Set<string>();
  const out: RawSourceRow[] = [];
  for (const s of sources) {
    const key = s.url.replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Strip HTML to a bounded plain-text excerpt for the research prompt. */
export function htmlToExcerpt(html: string, maxChars = 12_000): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > maxChars) text = `${text.slice(0, maxChars)}…`;
  return text;
}

/* v8 ignore start -- network IO */
export async function fetchPageExcerpt(url: string): Promise<string | null> {
  const res = await fetchWithRetry(
    url,
    {
      headers: {
        'User-Agent': 'AITodayBrief-CustomNews/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(20_000),
    },
    2,
  );
  if (!res?.ok) return null;
  const html = await res.text();
  const excerpt = htmlToExcerpt(html);
  return excerpt.length > 80 ? excerpt : null;
}
/* v8 ignore end */

export function buildResearchPrompt(topic: string, url?: string, pageExcerpt?: string): string {
  const urlBlock = url
    ? `USER-PROVIDED URL (include in sources; prefer as primary when it matches the story):\n${url}\n`
    : 'No URL provided — find the best primary source (official blog, docs, or reputable tech press).\n';

  const excerptBlock = pageExcerpt
    ? `\nPAGE EXCERPT (from the URL above — ground facts here):\n${pageExcerpt}\n`
    : '';

  return `You are a research assistant for "AI Today Brief", a curated AI/engineering daily for developers.

TOPIC TO RESEARCH (editor hand-pick — must be covered):
"${topic}"

${urlBlock}${excerptBlock}
Find at least 3 independent sources from DIFFERENT publishers (official blog + tech press + community
is ideal). Cross-check facts — do not rely on a single press release.

Return JSON only:
  title            — accurate headline (may refine the topic line above)
  url              — best PRIMARY source for attribution (official announcement preferred)
  source_name      — publisher label for the primary url
  source_url       — publisher home or section URL
  published_at     — ISO-8601 when the story broke (best estimate; today UTC if unknown)
  synthesis_notes  — 4–8 bullet-style facts synthesized across sources; note disagreements if any
  sources          — array of 3–5 objects, each:
      title        — headline at that source
      url          — direct https link (specific article, not homepage)
      source_name  — publisher (must differ across entries where possible)
      key_facts    — 2–4 factual sentences unique to this source

Rules:
- sources must include at least ${MIN_SOURCES} entries with distinct publishers.
- Prefer official vendor blogs, docs, and reputable engineering press (not content farms).
- If the topic mentions a free model/benchmark, include concrete names, numbers, license.
- key_facts must be factual; no hype. synthesis_notes is for the editor — not publishable copy.`;
}

export function parseResearchResult(text: string, fallbackTopic: string): CustomResearchResult {
  const parsed: unknown = JSON.parse(text);
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const title = asString(obj.title) || fallbackTopic;
  const url = asString(obj.url);
  if (!isHttpUrl(url)) {
    throw new Error('[custom-research] model returned invalid url');
  }
  const source_name = asString(obj.source_name) || 'Web';
  const source_url = asString(obj.source_url) || url;
  const synthesis_notes = asString(obj.synthesis_notes) || title;

  const rawSources = dedupeSourcesByUrl(parseRawSources(obj.sources));
  if (rawSources.length < MIN_SOURCES) {
    throw new Error(
      `[custom-research] need at least ${MIN_SOURCES} sources, got ${rawSources.length}`,
    );
  }

  const sources: CustomSourceNote[] = rawSources.map((s) => ({
    title: s.title,
    url: s.url,
    source_name: s.source_name,
    excerpt: s.key_facts || s.title,
  }));

  return {
    title,
    url,
    source_name,
    source_url: isHttpUrl(source_url) ? source_url : url,
    published_at: normalizePublishedAt(asString(obj.published_at)),
    synthesis_notes,
    excerpt: synthesis_notes,
    sources,
  };
}

function mergeSourceExcerpt(keyFacts: string, pageText: string | null): string {
  const parts: string[] = [];
  if (keyFacts) parts.push(keyFacts);
  if (pageText) {
    const clipped =
      pageText.length > PAGE_EXCERPT_CHARS
        ? `${pageText.slice(0, PAGE_EXCERPT_CHARS)}…`
        : pageText;
    parts.push(`Page excerpt:\n${clipped}`);
  }
  return parts.join('\n\n') || keyFacts;
}

/* v8 ignore start -- network IO */
export async function enrichSourcesWithPageText(
  sources: CustomSourceNote[],
): Promise<CustomSourceNote[]> {
  const slice = sources.slice(0, MAX_SOURCES_FETCH);
  const enriched = await Promise.all(
    slice.map(async (s) => {
      const pageText = await fetchPageExcerpt(s.url);
      logEvent('info', 'custom-research', 'Source page fetched', {
        url: s.url,
        chars: pageText?.length ?? 0,
      });
      return {
        ...s,
        excerpt: mergeSourceExcerpt(s.excerpt, pageText),
      };
    }),
  );
  return [...enriched, ...sources.slice(MAX_SOURCES_FETCH)];
}
/* v8 ignore end */

export function toFetchedArticle(research: CustomResearchResult): FetchedArticle {
  return {
    source_name: research.source_name,
    source_url: research.source_url,
    title: research.title,
    url: research.url,
    published_at: research.published_at,
    raw: {
      custom_research: true,
      synthesis_notes: research.synthesis_notes,
      source_count: research.sources.length,
      sources: research.sources.map((s) => ({
        title: s.title,
        url: s.url,
        source_name: s.source_name,
      })),
    },
    hn_score: null,
    hn_comments: null,
    reddit_score: null,
    reddit_comments: null,
    inbrief_score: null,
  };
}

export function toPoolItem(research: CustomResearchResult): PoolItem {
  const topic = detectTopic(research.title);
  return {
    ref: 1,
    title: research.title,
    url: research.url,
    source: research.source_name,
    topic,
    category: categoryForTitle(research.title),
  };
}

function createResearchGenerate(apiKey: string): (modelId: string, prompt: string) => Promise<string> {
  const gemini = new GoogleGenerativeAI(apiKey);
  return async (modelId: string, prompt: string) => {
    const model = gemini.getGenerativeModel({
      model: modelId,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESEARCH_SCHEMA,
      },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  };
}

export interface ResearchCustomStoryOptions {
  url?: string;
  openRouterApiKey?: string;
}

/* v8 ignore start -- Gemini integration */
export async function researchCustomStory(
  topic: string,
  apiKey: string,
  options: ResearchCustomStoryOptions = {},
): Promise<CustomResearchResult> {
  const trimmed = topic.trim();
  if (!trimmed) throw new Error('[custom-research] topic is required');

  let pageExcerpt: string | undefined;
  if (options.url) {
    pageExcerpt = (await fetchPageExcerpt(options.url)) ?? undefined;
    logEvent('info', 'custom-research', 'Page excerpt fetched', {
      url: options.url,
      chars: pageExcerpt?.length ?? 0,
    });
  }

  const prompt = buildResearchPrompt(trimmed, options.url, pageExcerpt);
  const modelQueue = await resolveGeminiModelQueue(apiKey);
  const generate = createResearchGenerate(apiKey);
  const { text, model } = await generateWithModelQueue(prompt, apiKey, modelQueue, 2, generate);
  const parsed = parseResearchResult(text, trimmed);
  const enriched = await enrichSourcesWithPageText(parsed.sources);
  logEvent('info', 'custom-research', 'Story researched', {
    model,
    topic: trimmed,
    sources: enriched.length,
  });
  return { ...parsed, sources: enriched };
}
/* v8 ignore end */
