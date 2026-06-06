/**
 * Stage 3 — Curate & summarize (single Gemini call, EN primary / UK secondary).
 *
 * The deterministic stages hand over a diverse, deduped, ranked POOL. This stage
 * is a strict editor in one model call:
 *   - drops candidates that are the same story (semantically) as something
 *     already published recently — even if worded differently;
 *   - drops near-duplicates / same-topic spam among the candidates;
 *   - drops low-value punditry / clickbait;
 *   - rewrites the best ≤N as full bilingual brief items (title, summary,
 *     why-it-matters, a deep-dive, takeaways, tools) and writes a brief shell.
 *
 * Quality over quantity: returning fewer — or zero — items is correct on a quiet
 * day, and the prompt says so. The brief lands as a `draft`; a human publishes.
 *
 * `buildPrompt`/`parseBrief` are pure + unit-tested; the SDK call is covered by
 * live runs (excluded from the coverage gate).
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { logError, logEvent, serializeErrorDetails } from './log';
import type { PoolItem } from './select';
import { slugify, dedupeSlugs } from './text';
import { CATEGORY_SLUGS, isCategorySlug, type CategorySlug } from './topics';

export interface DraftItem {
  ref: number;
  url: string;
  source: string;
  category_slug: CategorySlug;
  slug: string;
  title_en: string;
  title_uk: string;
  summary_en: string;
  summary_uk: string;
  why_matters_en: string;
  why_matters_uk: string;
  deep_dive_en: string;
  deep_dive_uk: string;
  takeaways_en: string[];
  takeaways_uk: string[];
  tools_mentioned: string[];
  /** Punchy 200-220 char hook for X / LinkedIn. Generated alongside the deep_dive. */
  social_hook_en: string;
  social_hook_uk: string;
}

export interface DraftBrief {
  title_en: string;
  title_uk: string;
  intro_en: string;
  intro_uk: string;
  slug: string;
  items: DraftItem[];
}

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export function resolveGeminiModel(
  env: Record<string, string | undefined> = process.env,
): string {
  const fromEnv = env.GEMINI_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_GEMINI_MODEL;
}

export function resolveGeminiModelFallback(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const explicit = env.GEMINI_MODEL_FALLBACK?.trim();
  return explicit && explicit.length > 0 ? explicit : null;
}

export function isRetryableGeminiError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const m = error.message.toLowerCase();
  return (
    m.includes('429') ||
    m.includes('500') ||
    m.includes('502') ||
    m.includes('503') ||
    m.includes('504') ||
    m.includes('rate limit') ||
    m.includes('resource exhausted') ||
    m.includes('temporarily unavailable') ||
    m.includes('fetch failed') ||
    m.includes('econnreset') ||
    m.includes('etimedout') ||
    m.includes('network')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const STRING = { type: SchemaType.STRING } as const;
const STRING_ARRAY = { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } } as const;

const GEMINI_SCHEMA: NonNullable<
  NonNullable<
    Parameters<GoogleGenerativeAI['getGenerativeModel']>[0]['generationConfig']
  >['responseSchema']
> = {
  type: SchemaType.OBJECT,
  properties: {
    title_en: STRING,
    title_uk: STRING,
    intro_en: STRING,
    intro_uk: STRING,
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          ref: { type: SchemaType.NUMBER },
          category_slug: { type: SchemaType.STRING, format: 'enum', enum: [...CATEGORY_SLUGS] },
          title_en: STRING,
          title_uk: STRING,
          summary_en: STRING,
          summary_uk: STRING,
          why_matters_en: STRING,
          why_matters_uk: STRING,
          deep_dive_en: STRING,
          deep_dive_uk: STRING,
          takeaways_en: STRING_ARRAY,
          takeaways_uk: STRING_ARRAY,
          tools_mentioned: STRING_ARRAY,
          social_hook_en: STRING,
          social_hook_uk: STRING,
        },
        required: [
          'ref',
          'category_slug',
          'title_en',
          'title_uk',
          'summary_en',
          'summary_uk',
          'why_matters_en',
          'why_matters_uk',
          'deep_dive_en',
          'deep_dive_uk',
          'takeaways_en',
          'takeaways_uk',
          'tools_mentioned',
          'social_hook_en',
          'social_hook_uk',
        ],
      },
    },
  },
  required: ['title_en', 'title_uk', 'intro_en', 'intro_uk', 'items'],
};

/* v8 ignore start -- thin wrapper over the Gemini SDK; exercised via live run */
function createGenerateContent(modelId: string, apiKey: string): (prompt: string) => Promise<string> {
  const gemini = new GoogleGenerativeAI(apiKey);
  return async (prompt: string) => {
    const started = Date.now();
    const model = gemini.getGenerativeModel({
      model: modelId,
      generationConfig: { responseMimeType: 'application/json', responseSchema: GEMINI_SCHEMA },
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    logEvent('info', 'summarize', 'Gemini generateContent ok', {
      model: modelId,
      prompt_chars: prompt.length,
      response_chars: text.length,
      duration_ms: Date.now() - started,
    });
    return text;
  };
}
/* v8 ignore end */

export async function generateWithRetry(
  prompt: string,
  apiKey: string,
  maxAttempts = 3,
  generateContent?: (input: string) => Promise<string>,
  sleepFn: (ms: number) => Promise<void> = sleep,
): Promise<string> {
  const primaryModel = resolveGeminiModel();
  const fallbackModel = resolveGeminiModelFallback();
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const useFallback = Boolean(fallbackModel && attempt === maxAttempts);
    const modelId = useFallback ? fallbackModel! : primaryModel;
    const call = generateContent ?? createGenerateContent(modelId, apiKey);
    try {
      return await call(prompt);
    } catch (error) {
      lastError = error;
      const canRetry = isRetryableGeminiError(error);
      if (!canRetry || attempt === maxAttempts) {
        logError('summarize', 'Gemini summarize failed — no more attempts', error, {
          primary_model: primaryModel,
          fallback_model: fallbackModel,
          attempt,
          retryable: canRetry,
          ...serializeErrorDetails(error),
        });
        throw error;
      }
      const backoffMs = 1000 * 2 ** (attempt - 1);
      logError('summarize', 'Gemini transient error, retrying', error, {
        model: modelId,
        attempt,
        backoff_ms: backoffMs,
      });
      await sleepFn(backoffMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('[summarize] Gemini call failed');
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

/**
 * A fixed description of the reader this brief is written for.
 * Injected into the prompt so the model can apply content-relevance judgement
 * consistently — not just a style guide but a filter for *what matters*.
 */
export function buildReaderProfileBlock(): string {
  return `READER PROFILE
A working developer and vibe coder. Daily tools: Claude Code, Cursor, Codex,
Gemini and similar agentic IDEs. Wants concrete, actionable intelligence on:
  • LLM token-cost / prompt-caching / context-window optimisation
  • Claude / Cursor / Codex / Gemini cheatsheets, hidden features,
    slash commands, hooks, skills, MCP servers
  • Vibe-coding workflow: testing, design, content generation
  • Building & orchestrating AI agents (Claude Agent SDK, MCP)
  • Realistic monetisation for AI-native devs
  • Free certifications, internships, fellowships, hands-on tutorials

Does NOT want: geopolitics, generic CEO quotes, raw academic research,
big-iron datacenter news, philosophical AI-doom takes.`;
}

export function buildPrompt(
  candidates: PoolItem[],
  recentlyPublished: string[],
  maxItems: number,
): string {
  const list = candidates
    .map((c) => `[${c.ref}] (${c.source}) ${c.title}\n     ${c.url}`)
    .join('\n');

  const recent =
    recentlyPublished.length > 0
      ? recentlyPublished.map((t) => `- ${t}`).join('\n')
      : '(nothing published yet)';

  return `You are the editor-in-chief of "AI Today Brief", a daily curated AI/engineering
brief for software engineers, AI practitioners and tech leads. The brief is the product:
a few genuinely valuable, NEW items per day — each with a clear "why it matters" and a
link to the primary source. English is primary; Ukrainian is a full, natural translation
(not transliteration), with correct IT terminology.

${buildReaderProfileBlock()}

CANDIDATES (already ranked by velocity + cross-source coverage + authority + recency):
${list}

ALREADY PUBLISHED RECENTLY (do NOT repeat these stories, even if worded differently):
${recent}

YOUR JOB — a strict editor, QUALITY over quantity:
1. Drop any candidate that is the SAME event as something already published above.
2. If several candidates are the same story, keep only the single best one.
3. Avoid topic spam: don't take multiple items about the same product/technology unless
   they are clearly distinct stories. Prefer breadth across the niche.
4. Drop low value: pure punditry ("X says…"), clickbait, thin listicles, opinion without facts.
5. Use the READER PROFILE above to filter for relevance — skip stories the reader
   explicitly does not want, even if they are technically about AI.
6. From what remains, keep AT MOST ${maxItems}, most important first. Returning FEWER
   (even 0) is correct when there isn't enough that is genuinely new, valuable and distinct.
   Never pad to hit a number.

For EACH kept item, write BOTH languages (natural Ukrainian, not word-for-word):
  ref              — the candidate number from the list above
  category_slug    — exactly one of: ${CATEGORY_SLUGS.join(', ')}
  title_en/uk      — rewritten headline, ≤ 14 words; expand an acronym on first use
                     (MCP → Model Context Protocol); keep product names (Claude, Cursor, Gemini)
  summary_en/uk    — 2–3 sentences (~45 words): what happened + one concrete takeaway
  why_matters_en/uk— one sentence: what the reader can do with this today
  deep_dive_en/uk  — 2 short paragraphs (~120 words) of substance: context, specifics, caveats
  takeaways_en/uk  — 2–4 short bullet strings, the practical points
  tools_mentioned  — array of product/tool names referenced (e.g. ["Claude Code","Cursor"]); [] if none
  social_hook_en/uk— 200-220 char attention hook for X/Twitter & LinkedIn; opens with a verb or number;
                     no hashtags; punchy, concrete, no hype. Example:
                     "DeepSeek releases v3.1 — beats GPT-4o on math benchmarks at 1/10 the inference cost."

Also write the brief shell:
  title_en/uk      — ≤ 8 words naming the day's through-line (becomes the URL); topical, not a date
  intro_en/uk      — one sentence (≤ 30 words) on the common thread. Empty string if 0 items.

TONE: confident, useful, no hype, no emojis, no clickbait. Return JSON only.`;
}

// ─── Parse + assemble ────────────────────────────────────────────────────────

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asString(v)).filter((s) => s.length > 0);
}

interface ModelItem {
  ref?: unknown;
  category_slug?: unknown;
  title_en?: unknown;
  title_uk?: unknown;
  summary_en?: unknown;
  summary_uk?: unknown;
  why_matters_en?: unknown;
  why_matters_uk?: unknown;
  deep_dive_en?: unknown;
  deep_dive_uk?: unknown;
  takeaways_en?: unknown;
  takeaways_uk?: unknown;
  tools_mentioned?: unknown;
  social_hook_en?: unknown;
  social_hook_uk?: unknown;
}

/**
 * Parse the editor JSON and resolve each item back to its candidate by `ref`
 * (the model selects/reorders/drops, so position is unreliable). Hallucinated
 * refs and items with no English title/summary are skipped. Slugs are derived
 * from the English title and de-duplicated within the brief. An empty item list
 * is a valid editorial outcome.
 */
export function parseBrief(text: string, candidates: PoolItem[]): DraftBrief {
  const parsed: unknown = JSON.parse(text);
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const byRef = new Map(candidates.map((c) => [c.ref, c]));
  const rawItems = Array.isArray(obj.items) ? (obj.items as ModelItem[]) : [];

  const resolved: Array<Omit<DraftItem, 'slug'>> = [];
  for (const m of rawItems) {
    const ref = typeof m.ref === 'number' ? m.ref : Number(m.ref);
    const source = byRef.get(ref);
    if (!source) continue; // hallucinated ref
    const title_en = asString(m.title_en) || source.title;
    const summary_en = asString(m.summary_en);
    if (!summary_en) continue; // no substance — skip rather than store an empty item
    const category = isCategorySlug(m.category_slug) ? m.category_slug : source.category;
    resolved.push({
      ref,
      url: source.url,
      source: source.source,
      category_slug: category,
      title_en,
      title_uk: asString(m.title_uk) || title_en,
      summary_en,
      summary_uk: asString(m.summary_uk) || summary_en,
      why_matters_en: asString(m.why_matters_en),
      why_matters_uk: asString(m.why_matters_uk),
      deep_dive_en: asString(m.deep_dive_en),
      deep_dive_uk: asString(m.deep_dive_uk),
      takeaways_en: asStringArray(m.takeaways_en),
      takeaways_uk: asStringArray(m.takeaways_uk),
      tools_mentioned: asStringArray(m.tools_mentioned),
      social_hook_en: asString(m.social_hook_en),
      social_hook_uk: asString(m.social_hook_uk) || asString(m.social_hook_en),
    });
  }

  const slugs = dedupeSlugs(resolved.map((r) => slugify(r.title_en)));
  const items: DraftItem[] = resolved.map((r, i) => ({ ...r, slug: slugs[i]! }));

  const title_en = asString(obj.title_en) || 'AI Today Brief';
  return {
    title_en,
    title_uk: asString(obj.title_uk) || title_en,
    intro_en: asString(obj.intro_en),
    intro_uk: asString(obj.intro_uk),
    slug: slugify(title_en, 'ai-today-brief'),
    items,
  };
}

/* v8 ignore start -- integration: real Gemini call; buildPrompt + parseBrief are unit-tested */
export async function summarize(
  candidates: PoolItem[],
  recentlyPublished: string[],
  maxItems: number,
  apiKey: string,
  openRouterApiKey?: string,
): Promise<DraftBrief> {
  logEvent('info', 'summarize', 'Curate & summarize started', {
    candidates: candidates.length,
    recent_context: recentlyPublished.length,
    max_items: maxItems,
    model: resolveGeminiModel(),
    openrouter_fallback: Boolean(openRouterApiKey),
  });
  const start = Date.now();
  const prompt = buildPrompt(candidates, recentlyPublished, maxItems);

  let text: string;
  let provider = 'gemini';
  let providerModel = resolveGeminiModel();

  try {
    text = await generateWithRetry(prompt, apiKey);
  } catch (geminiError) {
    if (!openRouterApiKey) {
      throw geminiError;
    }
    logEvent('warn', 'summarize', 'Gemini failed — trying OpenRouter fallback', {
      gemini_model: resolveGeminiModel(),
      ...serializeErrorDetails(geminiError),
    });
    const { generateWithOpenRouterChain } = await import('./openrouter-summarize');
    const orResult = await generateWithOpenRouterChain(prompt, { apiKey: openRouterApiKey });
    text = orResult.text;
    provider = 'openrouter';
    providerModel = orResult.model;
  }

  const brief = parseBrief(text, candidates);
  logEvent('info', 'summarize', 'Curate & summarize complete', {
    selected: brief.items.length,
    provider,
    provider_model: providerModel,
    duration_ms: Date.now() - start,
  });
  return brief;
}
/* v8 ignore end */
