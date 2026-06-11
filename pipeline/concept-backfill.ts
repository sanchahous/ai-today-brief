/**
 * Pure logic for the evergreen-concept backfill (prompts, schemas, parsing).
 * The network/DB orchestration lives in `pipeline/scripts/backfill-concepts.ts`;
 * everything here is side-effect free and unit-tested — the same lib/runner
 * split as `weekly-digest.ts`.
 */

import { SchemaType } from '@google/generative-ai';
import type { EnrichedSource } from './enrich';
import type { GeminiResponseSchema } from './summarize';

export interface ConceptHubRow {
  slug: string;
  name_en: string;
  name_uk: string;
  description_en: string | null;
  type: string;
  official_url: string | null;
  aliases: string[] | null;
}

/* Type literal (not interface) so the implicit index signature satisfies the
   Supabase `Json` column type — same trick as `FactRow` in summarize.ts. */
export type FaqEntry = { q: string; a: string };

export interface ConceptDraft {
  ref: number;
  body_en: string;
  body_uk: string;
  faq_en: FaqEntry[];
  faq_uk: FaqEntry[];
  /** Specific claims (numbers, prices, dates, features) the source does not
      support — these BLOCK publication until revised away. */
  unsupported_claims: string[];
  /** Definitional/background statements the source simply cannot confirm —
      published, but recorded and softly marked on the hub page. */
  definitional_claims: string[];
}

/**
 * How a published concept body relates to its official source:
 * 'verified' — page fetched, every claim confirmed; 'partial' — specifics
 * confirmed/removed but some background statements unconfirmed; 'unchecked' —
 * no source text to check against.
 */
export type ConceptVerification = 'verified' | 'partial' | 'unchecked';

/** Decide the marker stored on the row (specifics must already be clean). */
export function decideVerification(
  hadSourceText: boolean,
  definitionalClaims: string[],
): ConceptVerification {
  if (!hadSourceText) return 'unchecked';
  return definitionalClaims.length > 0 ? 'partial' : 'verified';
}

const STR: GeminiResponseSchema = { type: SchemaType.STRING };

const FAQ_ARRAY: GeminiResponseSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: { q: STR, a: STR },
    required: ['q', 'a'],
  },
};

export const CONCEPTS_SCHEMA: GeminiResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    concepts: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          ref: { type: SchemaType.NUMBER },
          body_en: STR,
          body_uk: STR,
          faq_en: FAQ_ARRAY,
          faq_uk: FAQ_ARRAY,
        },
        required: ['ref', 'body_en', 'body_uk', 'faq_en', 'faq_uk'],
      },
    },
  },
  required: ['concepts'],
};

export const CONCEPT_VERIFY_SCHEMA: GeminiResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    results: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          ref: { type: SchemaType.NUMBER },
          specific_claims: { type: SchemaType.ARRAY, items: STR },
          definitional_claims: { type: SchemaType.ARRAY, items: STR },
        },
        required: ['ref', 'specific_claims', 'definitional_claims'],
      },
    },
  },
  required: ['results'],
};

export function parseFaq(value: unknown): FaqEntry[] {
  if (!Array.isArray(value)) return [];
  const out: FaqEntry[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const q = (entry as { q?: unknown }).q;
    const a = (entry as { a?: unknown }).a;
    if (typeof q === 'string' && typeof a === 'string' && q.trim() && a.trim()) {
      out.push({ q: q.trim(), a: a.trim() });
    }
  }
  return out.slice(0, 3);
}

/** Narrow the model's JSON into drafts; refs outside the batch are dropped. */
export function parseConceptDrafts(text: string, batchSize: number): ConceptDraft[] {
  const parsed: unknown = JSON.parse(text);
  const list = (parsed as { concepts?: unknown })?.concepts;
  if (!Array.isArray(list)) return [];
  const drafts: ConceptDraft[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const ref = typeof r.ref === 'number' ? r.ref : Number(r.ref);
    if (!Number.isInteger(ref) || ref < 1 || ref > batchSize) continue;
    const bodyEn = typeof r.body_en === 'string' ? r.body_en.trim() : '';
    const bodyUk = typeof r.body_uk === 'string' ? r.body_uk.trim() : '';
    if (!bodyEn) continue;
    drafts.push({
      ref,
      body_en: bodyEn,
      body_uk: bodyUk || bodyEn,
      faq_en: parseFaq(r.faq_en),
      faq_uk: parseFaq(r.faq_uk),
      unsupported_claims: [],
      definitional_claims: [],
    });
  }
  return drafts;
}

export function buildConceptPrompt(batch: ConceptHubRow[], enrichment: EnrichedSource[]): string {
  const textByRef = new Map(enrichment.filter((e) => e.text).map((e) => [e.ref, e.text!]));

  const conceptsBlock = batch
    .map((c, i) => {
      const ref = i + 1;
      return [
        `[${ref}] NAME: ${c.name_en} (uk: ${c.name_uk})`,
        `TYPE: ${c.type}`,
        c.description_en ? `SHORT DESCRIPTION: ${c.description_en}` : '',
        c.aliases?.length ? `ALIASES: ${c.aliases.join(', ')}` : '',
        textByRef.has(ref)
          ? `OFFICIAL PAGE TEXT:\n${textByRef.get(ref)}`
          : 'OFFICIAL PAGE TEXT: (unavailable — write from well-established general knowledge; ' +
            'NO specific numbers, prices, dates or version claims)',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  return `You write evergreen explainer hubs for "AI Today Brief" — a daily brief for developers,
founders and tech leads who build with AI (Claude Code, Cursor, MCP, agents).

For each CONCEPT below produce, in BOTH languages (English + natural Ukrainian that keeps
established English tech terms like "tool calls", "workflow", "sandboxing"):

  body_en / body_uk — exactly 2 plain-text paragraphs separated by ONE blank line.
                      NO markdown headings, NO lists, NO bold. 90–160 words total.
                      Paragraph 1 STARTS with a crisp definition ("<Name> is …") and explains
                      what it does and where it sits in the AI-engineering stack.
                      Paragraph 2 is practical: when to use it, the honest trade-off or
                      main pitfall an engineer should know.
  faq_en / faq_uk   — 2–3 question/answer pairs developers actually ask (comparisons,
                      cost/limits, security, "when not to use"). Answers ≤ 2 sentences.

HARD RULES:
- Specific claims (numbers, prices, limits, dates, named features) are allowed ONLY when
  the OFFICIAL PAGE TEXT for the same [ref] supports them; otherwise stay general.
- faq_uk must answer the SAME questions as faq_en, naturally translated, not transliterated.
- Return JSON only, one entry per [ref].

CONCEPTS:
${conceptsBlock}`;
}

export function buildConceptVerifyPrompt(
  pairs: Array<{ draft: ConceptDraft; name: string; sourceText: string }>,
): string {
  const itemsBlock = pairs
    .map(({ draft, name }) =>
      [
        `[${draft.ref}] CONCEPT: ${name}`,
        `BODY:\n${draft.body_en}`,
        draft.faq_en.length
          ? `FAQ:\n${draft.faq_en.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');

  const sourcesBlock = pairs
    .map(({ draft, sourceText }) => `--- [${draft.ref}] ---\n${sourceText}`)
    .join('\n\n');

  return `You are a strict fact-checker for evergreen developer documentation.

For each CONCEPT below, compare its claims with the SOURCE TEXT carrying the same [ref].
Sort every claim the source does NOT support (≤ 120 chars each) into exactly one bucket:

  specific_claims     — hard facts the source must back: numbers, prices, limits,
                        dates, version numbers, named features or integrations.
                        These block publication, so flag them aggressively.
  definitional_claims — general definitional or background statements ("X is an
                        AI-native IDE", "it is popular for rapid prototyping")
                        that the page neither confirms nor contradicts. These are
                        publishable; you are only recording them for transparency.

Widely-established background knowledge that adds no new specifics does not need
flagging at all. Empty arrays are the expected result for a good entry.
Return one result per [ref], JSON only.

CONCEPTS:
${itemsBlock}

SOURCE TEXTS:
${sourcesBlock}`;
}

export interface ConceptVerifyResult {
  specific: string[];
  definitional: string[];
}

function cleanClaims(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((c) => (typeof c === 'string' ? c.trim() : '')).filter((c) => c.length > 0)
    : [];
}

/** Parse verify output into ref → claim buckets, dropping hallucinated refs. */
export function parseConceptVerify(
  text: string,
  validRefs: Set<number>,
): Map<number, ConceptVerifyResult> {
  const parsed: unknown = JSON.parse(text);
  const results = (parsed as { results?: unknown })?.results;
  const out = new Map<number, ConceptVerifyResult>();
  if (!Array.isArray(results)) return out;
  for (const raw of results) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const ref = typeof r.ref === 'number' ? r.ref : Number(r.ref);
    if (!validRefs.has(ref)) continue;
    out.set(ref, {
      specific: cleanClaims(r.specific_claims),
      definitional: cleanClaims(r.definitional_claims),
    });
  }
  return out;
}

/** Targeted rewrite prompt: keep structure, fix exactly the unsupported claims. */
export function buildConceptRevisePrompt(
  flagged: Array<{ draft: ConceptDraft; row: ConceptHubRow }>,
  enrichment: EnrichedSource[],
): string {
  const textByRef = new Map(enrichment.filter((e) => e.text).map((e) => [e.ref, e.text!]));
  const block = flagged
    .map(({ draft, row }) =>
      [
        `[${draft.ref}] CONCEPT: ${row.name_en}`,
        `BODY_EN:\n${draft.body_en}`,
        `BODY_UK:\n${draft.body_uk}`,
        `FAQ_EN:\n${draft.faq_en.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n')}`,
        'UNSUPPORTED CLAIMS (not found in the official page):',
        ...draft.unsupported_claims.map((c) => `  - ${c}`),
        `OFFICIAL PAGE TEXT:\n${textByRef.get(draft.ref) ?? '(unavailable)'}`,
      ].join('\n'),
    )
    .join('\n\n');

  return `You are the editor fixing your own evergreen concept entries after a fact-check.
For each CONCEPT, rewrite body/faq so EVERY specific claim is supported by the official
page text: delete the unsupported claims or replace them with what the page actually says.
Keep the structure (2 plain paragraphs, same FAQ questions) and both languages.
Return JSON only, one entry per [ref], same schema as the original task.

${block}`;
}
