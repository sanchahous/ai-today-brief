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
import type { EnrichedSource } from './enrich';
import { resolveGeminiModelQueue } from './gemini-models';
import { ukQualityFlags } from './lang-check';
import { logError, logEvent, serializeErrorDetails } from './log';
import type { PoolItem } from './select';
import { slugify, dedupeSlugs } from './text';
import { CATEGORY_SLUGS, isCategorySlug, type CategorySlug } from './topics';

/* Plain `type` (not interface) so the shapes satisfy Supabase's Json columns
   via TypeScript's implicit index signature for type literals. */
export type FactRow = { label: string; value: string };
export type CodeSnippet = { language: string; code: string };
export type CommunityReaction = { author: string; quote: string; url: string };
export type Citation = { title: string; url: string };

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
  /** Markdown body with ### subheadings, written from fetched source text. */
  body_md_en: string;
  body_md_uk: string;
  /** Facts box rows: prices, limits, dates, benchmarks — from source only. */
  facts_en: FactRow[];
  facts_uk: FactRow[];
  /** Shortest way to try it (install/curl/config), when applicable. */
  code_snippet: CodeSnippet | null;
  when_to_use_en: string[];
  when_to_use_uk: string[];
  when_not_to_use_en: string[];
  when_not_to_use_uk: string[];
  /** Quoted HN voices (EN originals, verbatim trims with links). */
  community_reactions: CommunityReaction[];
  /** Primary links, restricted to URLs that appeared in the prompt. */
  citations: Citation[];
  /** og:image of the source article — filled from enrichment, not the LLM. */
  image_url: string | null;
  takeaways_en: string[];
  takeaways_uk: string[];
  tools_mentioned: string[];
  /** 2–4 imperative steps the reader can take today (checklist). */
  action_items_en: string[];
  action_items_uk: string[];
  /** Editorial impact estimate for engineers. */
  impact_level: ImpactLevel | null;
  /** Punchy 200-220 char hook for X / LinkedIn. Generated alongside the deep_dive. */
  social_hook_en: string;
  social_hook_uk: string;
  /** `_uk` fields that failed the Ukrainian-language check (incl. EN fallbacks). */
  uk_quality_flags: string[];
  /** Claims the VERIFY pass could not find in the source (filled post-parse). */
  unsupported_claims: string[];
}

export type ImpactLevel = 'low' | 'medium' | 'high';

export function parseImpactLevel(value: unknown): ImpactLevel | null {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return null;
}

export interface DraftBrief {
  title_en: string;
  title_uk: string;
  intro_en: string;
  intro_uk: string;
  slug: string;
  items: DraftItem[];
}

export interface LlmUsage {
  promptTokens: number | null;
  outputTokens: number | null;
  /** True when counts are derived from character counts, not provider metadata. */
  estimated: boolean;
}

/** Rough chars→tokens fallback when a provider returns no usage metadata. */
export function estimateUsage(promptChars: number, outputChars: number): LlmUsage {
  return {
    promptTokens: Math.round(promptChars / 4),
    outputTokens: Math.round(outputChars / 4),
    estimated: true,
  };
}

export interface SummarizeResult {
  brief: DraftBrief;
  provider: 'gemini' | 'openrouter';
  providerModel: string;
  usage: LlmUsage | null;
}

/**
 * True when the Gemini error is a hard rate-limit / quota exhaustion.
 * These are NOT retried — the quota won't recover within a single run,
 * so we escalate to OpenRouter immediately instead of burning retry budget.
 */
export function isGeminiRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const m = error.message.toLowerCase();
  return (
    m.includes('429') ||
    m.includes('rate limit') ||
    m.includes('resource exhausted') ||
    m.includes('quota')
  );
}

/**
 * True for transient infrastructure failures that are worth retrying
 * (5xx, network resets). Rate-limit errors are excluded — those escalate
 * to OpenRouter without wasting retries.
 */
export function isRetryableGeminiError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (isGeminiRateLimitError(error)) return false; // escalate immediately
  const m = error.message.toLowerCase();
  return (
    m.includes('500') ||
    m.includes('502') ||
    m.includes('503') ||
    m.includes('504') ||
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

export type GeminiResponseSchema = NonNullable<
  NonNullable<
    Parameters<GoogleGenerativeAI['getGenerativeModel']>[0]['generationConfig']
  >['responseSchema']
>;

const FACTS_ARRAY: GeminiResponseSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: { label: STRING, value: STRING },
    required: ['label', 'value'],
  },
};

const REACTIONS_ARRAY: GeminiResponseSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: { author: STRING, quote: STRING, url: STRING },
    required: ['author', 'quote', 'url'],
  },
};

const CITATIONS_ARRAY: GeminiResponseSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: { title: STRING, url: STRING },
    required: ['title', 'url'],
  },
};

/** The brief output schema — also used by the revise pass in verify.ts. */
export const GEMINI_SCHEMA: NonNullable<
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
          body_md_en: STRING,
          body_md_uk: STRING,
          facts_en: FACTS_ARRAY,
          facts_uk: FACTS_ARRAY,
          code_snippet: {
            type: SchemaType.OBJECT,
            properties: { language: STRING, code: STRING },
            required: ['language', 'code'],
            nullable: true,
          },
          when_to_use_en: STRING_ARRAY,
          when_to_use_uk: STRING_ARRAY,
          when_not_to_use_en: STRING_ARRAY,
          when_not_to_use_uk: STRING_ARRAY,
          community_reactions: REACTIONS_ARRAY,
          citations: CITATIONS_ARRAY,
          takeaways_en: STRING_ARRAY,
          takeaways_uk: STRING_ARRAY,
          tools_mentioned: STRING_ARRAY,
          action_items_en: STRING_ARRAY,
          action_items_uk: STRING_ARRAY,
          impact_level: { type: SchemaType.STRING, format: 'enum', enum: ['low', 'medium', 'high'] },
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
          'body_md_en',
          'body_md_uk',
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
function createGenerateContent(
  modelId: string,
  apiKey: string,
  schema: GeminiResponseSchema = GEMINI_SCHEMA,
): (prompt: string) => Promise<GenerateOutput> {
  const gemini = new GoogleGenerativeAI(apiKey);
  return async (prompt: string) => {
    const started = Date.now();
    const model = gemini.getGenerativeModel({
      model: modelId,
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const meta = result.response.usageMetadata;
    // total - prompt (when available) also counts thinking tokens, which are
    // billed as output but excluded from candidatesTokenCount.
    const usage: LlmUsage = meta
      ? {
          promptTokens: meta.promptTokenCount ?? null,
          outputTokens:
            typeof meta.totalTokenCount === 'number' && typeof meta.promptTokenCount === 'number'
              ? meta.totalTokenCount - meta.promptTokenCount
              : meta.candidatesTokenCount ?? null,
          estimated: false,
        }
      : estimateUsage(prompt.length, text.length);
    logEvent('info', 'summarize', 'Gemini generateContent ok', {
      model: modelId,
      prompt_chars: prompt.length,
      response_chars: text.length,
      prompt_tokens: usage.promptTokens,
      output_tokens: usage.outputTokens,
      duration_ms: Date.now() - started,
    });
    return { text, usage };
  };
}
/* v8 ignore end */

/**
 * Output of one model call: plain text (test doubles) or text + token usage.
 * Normalized by `generateWithModelQueue` so injected fakes stay simple.
 */
export type GenerateOutput = string | { text: string; usage: LlmUsage | null };

function normalizeGenerateOutput(out: GenerateOutput): { text: string; usage: LlmUsage | null } {
  return typeof out === 'string' ? { text: out, usage: null } : out;
}

/**
 * Walk the dynamically resolved model queue: retry transient errors on the same
 * model, then advance to the next catalog entry (newer → older flash/pro).
 */
export async function generateWithModelQueue(
  prompt: string,
  apiKey: string,
  modelQueue: string[],
  perModelMaxAttempts = 2,
  generateContent?: (modelId: string, input: string) => Promise<GenerateOutput>,
  sleepFn: (ms: number) => Promise<void> = sleep,
  schema: GeminiResponseSchema = GEMINI_SCHEMA,
): Promise<{ text: string; model: string; usage: LlmUsage | null }> {
  let lastError: unknown;

  for (const modelId of modelQueue) {
    for (let attempt = 1; attempt <= perModelMaxAttempts; attempt++) {
      const call =
        generateContent ??
        ((id: string, input: string) => createGenerateContent(id, apiKey, schema)(input));
      try {
        const { text, usage } = normalizeGenerateOutput(await call(modelId, prompt));
        return { text, model: modelId, usage };
      } catch (error) {
        lastError = error;
        if (isGeminiRateLimitError(error)) {
          logError('summarize', 'Gemini rate limit — trying next model', error, {
            model: modelId,
            attempt,
            ...serializeErrorDetails(error),
          });
          break;
        }
        const canRetry = isRetryableGeminiError(error);
        if (!canRetry || attempt === perModelMaxAttempts) {
          logError('summarize', 'Gemini model failed — trying next', error, {
            model: modelId,
            attempt,
            retryable: canRetry,
            ...serializeErrorDetails(error),
          });
          break;
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
  }

  logError('summarize', 'Gemini model queue exhausted', lastError, {
    models_tried: modelQueue,
  });
  throw lastError instanceof Error ? lastError : new Error('[summarize] Gemini model queue failed');
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

Does NOT want (these are NEWSWIRE noise, not a playbook — drop them even when viral):
  • company business: funding rounds, IPOs, valuations, M&A, earnings, stock
  • executive hires & departures, org-chart drama
  • lawsuits, regulation, policy, geopolitics, export bans
  • AI-celebrity / entertainment stories (biopics, who-said-what)
  • generic "Company X adds AI to its product" enterprise PR
  • generic CEO quotes, raw academic research, big-iron datacenter news,
    philosophical AI-doom takes and scary-research curiosities.`;
}

/** SOURCE MATERIAL block: fetched article text + HN voices, keyed by ref. */
export function buildSourceMaterialBlock(enrichment: EnrichedSource[]): string {
  const withContent = enrichment.filter((e) => e.text || e.comments.length > 0);
  if (withContent.length === 0) return '';

  const blocks = withContent.map((e) => {
    const parts = [`--- [${e.ref}] ${e.url} ---`];
    if (e.text) parts.push(`TEXT:\n${e.text}`);
    if (e.comments.length > 0) {
      parts.push(
        'HN COMMENTS:\n' +
          e.comments.map((c) => `- ${c.author} (${c.url}): ${c.text}`).join('\n'),
      );
    }
    return parts.join('\n');
  });

  return `
SOURCE MATERIAL (fetched from the candidate URLs — trust this over prior knowledge;
candidates NOT listed here have no fetched source, write those conservatively with
no specific numbers):
${blocks.join('\n\n')}
`;
}

export function buildPrompt(
  candidates: PoolItem[],
  recentlyPublished: string[],
  maxItems: number,
  enrichment: EnrichedSource[] = [],
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
${buildSourceMaterialBlock(enrichment)}
ALREADY PUBLISHED RECENTLY (do NOT repeat these stories, even if worded differently):
${recent}

YOUR JOB — a strict editor: every item must earn its place, but ship the FULL set that does:
1. Drop any candidate that is the SAME event as something already published above.
2. If several candidates are the same story, keep only the single best one.
3. Avoid topic spam: don't take multiple items about the same product/technology unless
   they are clearly distinct stories. Prefer breadth across the niche.
4. Drop low value: pure punditry ("X says…"), clickbait, thin listicles, opinion without facts.
5. PRACTICAL TEST — this brief is a PLAYBOOK, not a newswire. Keep an item ONLY if a working
   developer can DO something with it within a week: try a tool, run a command, adopt a
   technique, cut token cost or spend, learn a concrete skill, or grab an opportunity
   (free credits, a cert, a job). If the single honest takeaway is "be aware this happened"
   — funding, hires, lawsuits, valuations, industry drama, scary-research curiosities — DROP it,
   no matter how viral. The CANDIDATES are ranked partly by virality, which over-weights exactly
   this drama; actively correct for it and favour the usable item over the loud one.
6. Use the READER PROFILE above to filter for relevance — skip stories the reader
   explicitly does not want, even if they are technically about AI.
7. From what remains, keep EVERY item that is genuinely new, distinct, and passes the
   PRACTICAL TEST — most important first, AT MOST ${maxItems}. A normal day has ~4–6 such
   items; ship them all, don't stop at 1–2. Go lower ONLY when the corpus is genuinely thin
   (a quiet day may be 1–2, and 0 is valid when nothing qualifies). The balance is strict
   both ways: never pad with filler, but never STARVE the brief by dropping a useful,
   distinct, actionable item just to keep the list short.

For EACH kept item, write BOTH languages (natural Ukrainian, not word-for-word):
  ref              — the candidate number from the list above
  category_slug    — exactly one of: ${CATEGORY_SLUGS.join(', ')}
  title_en/uk      — rewritten headline, ≤ 14 words; expand an acronym on first use
                     (MCP → Model Context Protocol); keep product names (Claude, Cursor, Gemini)
  summary_en/uk    — 2–3 sentences (~45 words): what happened + one concrete takeaway
  why_matters_en/uk— one sentence: what the reader can do with this today
  deep_dive_en/uk  — 2 short paragraphs (~120 words) of substance: context, specifics, caveats
  body_md_en/uk    — 150–300 words of MARKDOWN: 2–4 sections with "### " subheadings, written
                     from SOURCE MATERIAL — concrete numbers, prices, limits, commands; inline
                     \`code\` for identifiers/flags. HARD RULE: every specific claim must come
                     from the source text; for refs WITHOUT source material write one short
                     headline-grade section and no specifics. Do not pad, do not hype.
  facts_en/uk      — 2–6 {label, value} rows for a facts box: price per 1M tokens, context
                     window, rate limits, dates, benchmark numbers (mark vendor numbers
                     "self-reported"). ONLY values present in the source; [] if none.
  code_snippet     — {language, code}: the shortest way to try it (install command, curl call,
                     config block) taken or minimally adapted from the source; null if N/A.
  when_to_use_en/uk / when_not_to_use_en/uk — 2–3 honest bullets each for tool/model stories
                     ("not for X" builds trust); [] when the story is not a usable artifact.
  community_reactions — 1–3 of the provided HN COMMENTS worth quoting: {author, quote, url};
                     quote = verbatim trim ≤ 200 chars, keep it in English; [] if none provided.
  citations        — 1–4 {title, url} primary links chosen ONLY from URLs that appear in this
                     prompt (candidate URL, HN comment links, links inside source text).
  takeaways_en/uk  — 2–4 short bullet strings, the practical points
  action_items_en/uk — 2–4 imperative checklist steps ("Run npm audit", "Pin MCP server version"); [] if none
  impact_level     — one of low | medium | high: how much this changes a typical engineer's week
  tools_mentioned  — array of product/tool names referenced (e.g. ["Claude Code","Cursor"]); [] if none
  social_hook_en/uk— 200-220 char attention hook for X/Twitter & LinkedIn; opens with a verb or number;
                     no hashtags; punchy, concrete, no hype. Example:
                     "DeepSeek releases v3.1 — beats GPT-4o on math benchmarks at 1/10 the inference cost."

Also write the brief shell:
  title_en/uk      — ≤ 8 words naming the day's through-line (becomes the URL); topical, not a date
  intro_en/uk      — one sentence (≤ 30 words) on the common thread. Empty string if 0 items.

TONE: confident, useful, no hype, no emojis, no clickbait. Return JSON only.`;
}

export interface CustomResearchContext {
  synthesis_notes: string;
  sources: Array<{ title: string; url: string; source_name: string; excerpt: string }>;
}

/** Editor hand-pick: multi-source synthesis with original copy (not a single-source rewrite). */
export function buildCustomEditorPrompt(
  candidates: PoolItem[],
  recentlyPublished: string[],
  research: CustomResearchContext,
): string {
  const base = buildPrompt(candidates, recentlyPublished, 1);
  const sourcesBlock = research.sources
    .map(
      (s, i) =>
        `[${i + 1}] ${s.source_name}: ${s.title}\n    URL: ${s.url}\n    Research notes:\n    ${s.excerpt.replace(/\n/g, '\n    ')}`,
    )
    .join('\n\n');

  return `${base}

EDITOR HAND-PICK — MULTI-SOURCE ORIGINAL COPY (mandatory):
This story was researched across ${research.sources.length} independent sources.
You MUST synthesize them into YOUR OWN editorial voice for AI Today Brief.

CROSS-SOURCE RESEARCH (read all before writing):
${sourcesBlock}

SYNTHESIS BRIEF:
${research.synthesis_notes}

WRITING RULES (override generic curation for this single item):
- Keep ref 1 — do not drop this story; the editor explicitly requested it.
- Write original prose: do NOT copy phrases or sentence structure from any source above.
- Combine facts from at least 2 different sources; if sources disagree, note the uncertainty.
- Prefer concrete numbers, product names, benchmarks, availability dates, license terms.
- Candidate [1] URL is the primary attribution link; supporting facts may come from other sources.`;
}

async function runSummarizeFromPrompt(
  prompt: string,
  candidates: PoolItem[],
  apiKey: string,
  openRouterApiKey: string | undefined,
  geminiMaxAttempts: number,
  logLabel: string,
): Promise<SummarizeResult> {
  const modelQueue = await resolveGeminiModelQueue(apiKey);
  logEvent('info', logLabel, 'Curate & summarize started', {
    candidates: candidates.length,
    gemini_model_queue: modelQueue.slice(0, 5),
    openrouter_fallback: Boolean(openRouterApiKey),
  });
  const start = Date.now();

  let text: string;
  let provider: SummarizeResult['provider'] = 'gemini';
  let providerModel: string;
  let usage: LlmUsage | null = null;

  try {
    const geminiResult = await generateWithModelQueue(
      prompt,
      apiKey,
      modelQueue,
      geminiMaxAttempts,
    );
    text = geminiResult.text;
    providerModel = geminiResult.model;
    usage = geminiResult.usage;
  } catch (geminiError) {
    if (!openRouterApiKey) {
      throw geminiError;
    }
    logEvent('warn', logLabel, 'Gemini queue failed — trying OpenRouter fallback', {
      gemini_models_tried: modelQueue,
      ...serializeErrorDetails(geminiError),
    });
    const { generateWithOpenRouterChain } = await import('./openrouter-summarize');
    const orResult = await generateWithOpenRouterChain(prompt, { apiKey: openRouterApiKey });
    text = orResult.text;
    provider = 'openrouter';
    providerModel = orResult.model;
    // The streaming client doesn't surface provider usage — estimate from chars.
    usage = estimateUsage(prompt.length, text.length);
  }

  const brief = parseBrief(text, candidates);
  logEvent('info', logLabel, 'Curate & summarize complete', {
    selected: brief.items.length,
    provider,
    provider_model: providerModel,
    prompt_tokens: usage?.promptTokens ?? null,
    output_tokens: usage?.outputTokens ?? null,
    usage_estimated: usage?.estimated ?? null,
    duration_ms: Date.now() - start,
  });
  return { brief, provider, providerModel, usage };
}

/* v8 ignore start -- integration: real Gemini call */
export async function summarizeEditorPick(
  candidates: PoolItem[],
  recentlyPublished: string[],
  research: CustomResearchContext,
  apiKey: string,
  openRouterApiKey?: string,
  geminiMaxAttempts = 3,
): Promise<SummarizeResult> {
  const prompt = buildCustomEditorPrompt(candidates, recentlyPublished, research);
  return runSummarizeFromPrompt(
    prompt,
    candidates,
    apiKey,
    openRouterApiKey,
    geminiMaxAttempts,
    'summarize-custom',
  );
}
/* v8 ignore end */

// ─── Parse + assemble ────────────────────────────────────────────────────────

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Gemini occasionally double-escapes newlines inside JSON string values, so a
 * multiline field arrives as ONE line full of literal "\n" two-char sequences
 * (rendered to readers as «...воронки\nНовий сервіс...»). The broken signature
 * is unambiguous — escape sequences present, real newlines absent — so mixed
 * content (real newlines plus a literal \n inside inline code) is untouched.
 */
export function normalizeEscapedNewlines(s: string): string {
  if (!s.includes('\\n') || s.includes('\n')) return s;
  return s.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\t/g, '  ');
}

function asMultilineString(value: unknown): string {
  return normalizeEscapedNewlines(asString(value));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asString(v)).filter((s) => s.length > 0);
}

function asFactArray(value: unknown): FactRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      const o = (v ?? {}) as Record<string, unknown>;
      return { label: asString(o.label), value: asString(o.value) };
    })
    .filter((f) => f.label.length > 0 && f.value.length > 0);
}

function asReactionArray(value: unknown): CommunityReaction[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      const o = (v ?? {}) as Record<string, unknown>;
      return { author: asString(o.author), quote: asString(o.quote), url: asString(o.url) };
    })
    .filter((r) => r.quote.length > 0 && r.url.startsWith('http'));
}

function asCitationArray(value: unknown): Citation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      const o = (v ?? {}) as Record<string, unknown>;
      return { title: asString(o.title), url: asString(o.url) };
    })
    .filter((c) => c.url.startsWith('http'));
}

function asCodeSnippet(value: unknown): CodeSnippet | null {
  if (typeof value !== 'object' || value === null) return null;
  const o = value as Record<string, unknown>;
  const code = asString(o.code);
  if (!code) return null;
  return { language: asString(o.language) || 'bash', code };
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
  body_md_en?: unknown;
  body_md_uk?: unknown;
  facts_en?: unknown;
  facts_uk?: unknown;
  code_snippet?: unknown;
  when_to_use_en?: unknown;
  when_to_use_uk?: unknown;
  when_not_to_use_en?: unknown;
  when_not_to_use_uk?: unknown;
  community_reactions?: unknown;
  citations?: unknown;
  takeaways_en?: unknown;
  takeaways_uk?: unknown;
  tools_mentioned?: unknown;
  action_items_en?: unknown;
  action_items_uk?: unknown;
  impact_level?: unknown;
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
    const item: Omit<DraftItem, 'slug' | 'uk_quality_flags'> = {
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
      deep_dive_en: asMultilineString(m.deep_dive_en),
      deep_dive_uk: asMultilineString(m.deep_dive_uk),
      body_md_en: asMultilineString(m.body_md_en),
      body_md_uk: asMultilineString(m.body_md_uk),
      facts_en: asFactArray(m.facts_en),
      facts_uk: asFactArray(m.facts_uk),
      code_snippet: asCodeSnippet(m.code_snippet),
      when_to_use_en: asStringArray(m.when_to_use_en),
      when_to_use_uk: asStringArray(m.when_to_use_uk),
      when_not_to_use_en: asStringArray(m.when_not_to_use_en),
      when_not_to_use_uk: asStringArray(m.when_not_to_use_uk),
      community_reactions: asReactionArray(m.community_reactions),
      citations: asCitationArray(m.citations),
      image_url: null, // filled from enrichment by the caller, never by the LLM
      takeaways_en: asStringArray(m.takeaways_en),
      takeaways_uk: asStringArray(m.takeaways_uk),
      tools_mentioned: asStringArray(m.tools_mentioned),
      action_items_en: asStringArray(m.action_items_en),
      action_items_uk: asStringArray(m.action_items_uk),
      impact_level: parseImpactLevel(m.impact_level),
      social_hook_en: asString(m.social_hook_en),
      social_hook_uk: asString(m.social_hook_uk) || asString(m.social_hook_en),
      unsupported_claims: [], // filled by the VERIFY pass downstream
    };
    // Flag _uk fields that are EN fallbacks or non-Ukrainian text so the item
    // reaches the Telegram reviewer marked instead of silently shipping English.
    const ukFlags = ukQualityFlags(item);
    if (ukFlags.length > 0) {
      logEvent('warn', 'summarize', 'Ukrainian fields look invalid', {
        title: item.title_en,
        fields: ukFlags,
      });
    }
    resolved.push({ ...item, uk_quality_flags: ukFlags });
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
  geminiMaxAttempts = 3,
  enrichment: EnrichedSource[] = [],
): Promise<SummarizeResult> {
  logEvent('info', 'summarize', 'Curate & summarize started', {
    candidates: candidates.length,
    recent_context: recentlyPublished.length,
    max_items: maxItems,
    gemini_per_model_attempts: geminiMaxAttempts,
    openrouter_fallback: Boolean(openRouterApiKey),
    enriched_refs: enrichment.filter((e) => e.text).length,
  });
  const prompt = buildPrompt(candidates, recentlyPublished, maxItems, enrichment);
  return runSummarizeFromPrompt(
    prompt,
    candidates,
    apiKey,
    openRouterApiKey,
    geminiMaxAttempts,
    'summarize',
  );
}
/* v8 ignore end */
