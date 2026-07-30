/**
 * Stage 4.5 — Verify (Phase 1). A second, cheap LLM pass that compares each
 * drafted item's English claims against the fetched source text and lists
 * claims the source does not support (invented numbers, features, dates).
 *
 * Failures never block publishing — they land in `unsupported_claims`, which
 * the DB layer folds into `review_comment`, so the human gate decides with
 * the warning in view. Items without fetched source text are skipped: there
 * is nothing to check against.
 *
 * `buildVerifyPrompt` / `parseVerifyResults` are pure + unit-tested; the model
 * call reuses the summarize queue plumbing.
 */

import { SchemaType } from '@google/generative-ai';
import type { EnrichedSource } from './enrich';
import { logEvent } from './log';
import { generateJsonWithFallback } from './llm-json';
import type { PoolItem } from './select';
import {
  GEMINI_SCHEMA,
  parseBrief,
  type DraftItem,
  type GeminiResponseSchema,
  type LlmUsage,
} from './summarize';

const VERIFY_SCHEMA: GeminiResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    results: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          ref: { type: SchemaType.NUMBER },
          unsupported_claims: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ['ref', 'unsupported_claims'],
      },
    },
  },
  required: ['results'],
};

/** Items that have source text to check against, with their source attached. */
export function verifiableItems(
  items: DraftItem[],
  enrichment: EnrichedSource[],
): Array<{ item: DraftItem; sourceText: string }> {
  const textByRef = new Map(
    enrichment.filter((e) => e.text).map((e) => [e.ref, e.text!]),
  );
  return items
    .map((item) => ({ item, sourceText: textByRef.get(item.ref) ?? '' }))
    .filter((p): p is { item: DraftItem; sourceText: string } => p.sourceText.length > 0);
}

export function buildVerifyPrompt(
  pairs: Array<{ item: DraftItem; sourceText: string }>,
): string {
  const itemsBlock = pairs
    .map(({ item }) => {
      const facts = item.facts_en.map((f) => `${f.label} = ${f.value}`).join('; ');
      return [
        `[${item.ref}] TITLE: ${item.title_en}`,
        `SUMMARY: ${item.summary_en}`,
        facts ? `FACTS: ${facts}` : '',
        item.body_md_en ? `BODY:\n${item.body_md_en}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  const sourcesBlock = pairs
    .map(({ item, sourceText }) => `--- [${item.ref}] ---\n${sourceText}`)
    .join('\n\n');

  return `You are a strict fact-checker for a developer news brief.

For each ITEM below, compare its claims with the SOURCE TEXT carrying the same [ref].
List the specific claims (short quotes or tight paraphrases, ≤ 120 chars each) that the
source does NOT support — invented numbers, prices, dates, features, quotes.

Rules:
- Judge substance, not wording: paraphrase and reasonable inference from the source are fine.
- Ignore general background knowledge that adds context without asserting new specifics.
- An empty unsupported_claims array means the item is fully supported — that is the
  expected result for a good item; do not nitpick.
- Return one result per item ref, JSON only.

ITEMS:
${itemsBlock}

SOURCE TEXTS:
${sourcesBlock}`;
}

interface VerifyModelResult {
  ref?: unknown;
  unsupported_claims?: unknown;
}

/** Parse the checker output into ref → claims, dropping hallucinated refs. */
export function parseVerifyResults(text: string, validRefs: Set<number>): Map<number, string[]> {
  const parsed: unknown = JSON.parse(text);
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const results = Array.isArray(obj.results) ? (obj.results as VerifyModelResult[]) : [];
  const out = new Map<number, string[]>();
  for (const r of results) {
    const ref = typeof r.ref === 'number' ? r.ref : Number(r.ref);
    if (!validRefs.has(ref)) continue;
    const claims = Array.isArray(r.unsupported_claims)
      ? r.unsupported_claims
          .map((c) => (typeof c === 'string' ? c.trim() : ''))
          .filter((c) => c.length > 0)
      : [];
    out.set(ref, claims);
  }
  return out;
}

export interface VerifyOutcome {
  checked: number;
  flagged: number;
  usage: LlmUsage | null;
  model: string | null;
}

/* v8 ignore start -- integration: real Gemini call; helpers above are unit-tested */
/** Mutates `items[].unsupported_claims` in place; throws only on total failure. */
export async function verifyClaims(
  items: DraftItem[],
  enrichment: EnrichedSource[],
  apiKey: string,
  geminiMaxAttempts: number,
  openRouterApiKey?: string,
): Promise<VerifyOutcome> {
  const pairs = verifiableItems(items, enrichment);
  if (pairs.length === 0) return { checked: 0, flagged: 0, usage: null, model: null };

  const prompt = buildVerifyPrompt(pairs);
  const { text, model, usage } = await generateJsonWithFallback(
    'verify',
    prompt,
    apiKey,
    geminiMaxAttempts,
    VERIFY_SCHEMA,
    openRouterApiKey,
  );

  const byRef = parseVerifyResults(text, new Set(pairs.map((p) => p.item.ref)));
  let flagged = 0;
  for (const { item } of pairs) {
    const claims = byRef.get(item.ref) ?? [];
    item.unsupported_claims = claims;
    if (claims.length > 0) {
      flagged++;
      logEvent('warn', 'verify', 'Item has unsupported claims', {
        ref: item.ref,
        title: item.title_en,
        claims,
      });
    }
  }
  return { checked: pairs.length, flagged, usage, model };
}
/* v8 ignore end */

/**
 * Targeted rewrite prompt for items the fact-checker flagged: keep the story,
 * remove or correct exactly the unsupported claims, using ONLY the source.
 */
export function buildRevisePrompt(
  pairs: Array<{ item: DraftItem; sourceText: string }>,
): string {
  const itemsBlock = pairs
    .map(({ item }) =>
      [
        `[${item.ref}] TITLE_EN: ${item.title_en}`,
        `TITLE_UK: ${item.title_uk}`,
        `SUMMARY_EN: ${item.summary_en}`,
        `SUMMARY_UK: ${item.summary_uk}`,
        item.body_md_en ? `BODY_EN:\n${item.body_md_en}` : '',
        item.body_md_uk ? `BODY_UK:\n${item.body_md_uk}` : '',
        item.facts_en.length
          ? `FACTS: ${item.facts_en.map((f) => `${f.label} = ${f.value}`).join('; ')}`
          : '',
        'UNSUPPORTED CLAIMS (the fact-checker could not find these in the source):',
        ...item.unsupported_claims.map((c) => `  - ${c}`),
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');

  const sourcesBlock = pairs
    .map(({ item, sourceText }) => `--- [${item.ref}] ---\n${sourceText}`)
    .join('\n\n');

  return `You are the editor-in-chief fixing your own draft after a fact-check.

For each ITEM below, the fact-checker listed claims that the SOURCE TEXT (same [ref])
does not support. Rewrite the affected fields so that EVERY remaining claim is
supported by the source: delete the unsupported claims or replace them with what the
source actually says. Keep the story, the tone and every field that was fine — in
BOTH languages. If an item cannot stand without its unsupported claims, return it
with an empty summary_en (that drops it).

Return the full JSON brief object (same schema as the original task) containing ONLY
the revised items, with their ORIGINAL ref numbers. The shell title_en/uk and
intro_en/uk are ignored — copy anything reasonable.

ITEMS TO FIX:
${itemsBlock}

SOURCE TEXTS (the only allowed source of facts):
${sourcesBlock}`;
}

/* v8 ignore start -- integration: real Gemini call; buildRevisePrompt is unit-tested */
/**
 * Rewrite flagged items against their sources. Returns revised DraftItems
 * matched by ref; the caller preserves the original slug/image and re-verifies.
 * Items the model chose to drop (empty summary) simply don't come back.
 */
export async function reviseFlaggedItems(
  flagged: DraftItem[],
  enrichment: EnrichedSource[],
  candidates: PoolItem[],
  apiKey: string,
  geminiMaxAttempts: number,
  openRouterApiKey?: string,
): Promise<{ revised: DraftItem[]; usage: LlmUsage | null }> {
  const pairs = verifiableItems(flagged, enrichment).filter(
    (p) => p.item.unsupported_claims.length > 0,
  );
  if (pairs.length === 0) return { revised: [], usage: null };

  const prompt = buildRevisePrompt(pairs);
  const { text, usage } = await generateJsonWithFallback(
    'verify',
    prompt,
    apiKey,
    geminiMaxAttempts,
    GEMINI_SCHEMA,
    openRouterApiKey,
  );

  const flaggedRefs = new Set(pairs.map((p) => p.item.ref));
  const revised = parseBrief(text, candidates).items.filter((i) => flaggedRefs.has(i.ref));
  logEvent('info', 'verify', 'Flagged items revised', {
    flagged: pairs.length,
    revised: revised.length,
  });
  return { revised, usage };
}
/* v8 ignore end */
