/**
 * Research a hand-picked story by title (and optional URL) before the editor
 * summarize step. Returns a primary source the pipeline can upsert + curate.
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { resolveGeminiModelQueue } from './gemini-models';
import { logEvent } from './log';
import { generateWithModelQueue } from './summarize';
import type { PoolItem } from './select';
import type { FetchedArticle } from './sources/http';
import { categoryForTitle, detectTopic } from './topics';
import { fetchWithRetry } from './sources/http';

export interface CustomResearchResult {
  title: string;
  url: string;
  source_name: string;
  source_url: string;
  published_at: string;
  excerpt: string;
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
    excerpt: RESEARCH_STRING,
  },
  required: ['title', 'url', 'source_name', 'source_url', 'published_at', 'excerpt'],
};

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
    ? `USER-PROVIDED URL (prefer as primary when it matches the story):\n${url}\n`
    : 'No URL provided — find the best primary source (official blog, docs, or reputable tech press).\n';

  const excerptBlock = pageExcerpt
    ? `\nPAGE EXCERPT (from the URL above — ground facts here):\n${pageExcerpt}\n`
    : '';

  return `You are a research assistant for "AI Today Brief", a curated AI/engineering daily for developers.

TOPIC TO RESEARCH (editor hand-pick — must be covered):
"${topic}"

${urlBlock}${excerptBlock}
Find the canonical primary source for this story. Return JSON only:
  title          — accurate headline (may refine the topic line above)
  url            — direct link to the announcement/article (https)
  source_name    — publisher label (e.g. "NVIDIA Blog", "Hacker News")
  source_url     — publisher home or section URL
  published_at   — ISO-8601 datetime when the story broke (best estimate if unknown: today UTC)
  excerpt        — 3–6 factual sentences from the source: what shipped, numbers, availability, why engineers care

Rules:
- Prefer official vendor blogs and primary announcements over aggregators.
- url must be a real, specific article — not a homepage only.
- If the topic mentions a free model/benchmark, include concrete names (Nemotron, benchmark suite, license).
- excerpt must be factual; no hype.`;
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
  return {
    title,
    url,
    source_name,
    source_url: isHttpUrl(source_url) ? source_url : url,
    published_at: normalizePublishedAt(asString(obj.published_at)),
    excerpt: asString(obj.excerpt) || title,
  };
}

export function toFetchedArticle(research: CustomResearchResult): FetchedArticle {
  return {
    source_name: research.source_name,
    source_url: research.source_url,
    title: research.title,
    url: research.url,
    published_at: research.published_at,
    raw: { custom_research: true, excerpt: research.excerpt },
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
  logEvent('info', 'custom-research', 'Story researched', { model, topic: trimmed });
  return parseResearchResult(text, trimmed);
}
/* v8 ignore end */
