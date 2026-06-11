/**
 * Backfill evergreen concept hubs with full bodies + FAQ — zero-cost lane.
 * Usage: npx tsx --env-file=.env.local pipeline/scripts/backfill-concepts.ts [--limit N] [--dry-run]
 *
 * For every concept without `body_en`: fetch its official page (enrich),
 * generate a definition-first body (EN + natural UK) and a 2–3 item FAQ with
 * Gemini Flash, fact-check claims against the official page with a
 * VERIFY→revise loop, and update the row. Concepts whose body fails
 * verification stay empty — the hub renders header + stories as before.
 * Concepts without an official URL get conservative general-knowledge bodies
 * (definitions, trade-offs) with a hard "no specific numbers" rule, so there
 * is nothing to fact-check against.
 *
 * Budget: batches of 3 ≈ 2–3 Flash calls per batch → the whole catalog
 * (~20 concepts) fits in a fraction of the free AI Studio tier. Idempotent:
 * re-runs skip filled rows. Pure prompt/parse logic lives in
 * `pipeline/concept-backfill.ts` (unit-tested); this runner only orchestrates.
 */

/* v8 ignore start -- thin orchestration over live network + DB */
import {
  buildConceptPrompt,
  buildConceptRevisePrompt,
  buildConceptVerifyPrompt,
  CONCEPT_VERIFY_SCHEMA,
  CONCEPTS_SCHEMA,
  parseConceptDrafts,
  parseConceptVerify,
  type ConceptDraft,
  type ConceptHubRow,
} from '../concept-backfill';
import { loadPipelineConfig } from '../config';
import { createServiceClient, type PipelineDb } from '../db';
import { enrichPool, type EnrichedSource } from '../enrich';
import { resolveGeminiModelQueue } from '../gemini-models';
import { logError, logEvent } from '../log';
import type { PoolItem } from '../select';
import { generateWithModelQueue, type GeminiResponseSchema } from '../summarize';

const BATCH_SIZE = 3; // bilingual body + faq ×3 stays well under the output cap
const SLEEP_BETWEEN_BATCHES_MS = 25_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function loadEmptyConcepts(db: PipelineDb, limit: number): Promise<ConceptHubRow[]> {
  const { data, error } = await db
    .from('concepts')
    .select('slug, name_en, name_uk, description_en, type, official_url, aliases')
    .is('body_en', null)
    .order('slug')
    .limit(limit);
  if (error) throw new Error(`backfill concepts: ${error.message}`);
  return data ?? [];
}

async function generateJson(
  prompt: string,
  apiKey: string,
  schema: GeminiResponseSchema,
): Promise<string> {
  const modelQueue = await resolveGeminiModelQueue(apiKey);
  const { text } = await generateWithModelQueue(
    prompt,
    apiKey,
    modelQueue,
    2,
    undefined,
    undefined,
    schema,
  );
  return text;
}

/** Verify drafts that have source text; mutates `unsupported_claims` in place. */
async function verifyConceptDrafts(
  drafts: ConceptDraft[],
  batch: ConceptHubRow[],
  enrichment: EnrichedSource[],
  apiKey: string,
): Promise<void> {
  const textByRef = new Map(enrichment.filter((e) => e.text).map((e) => [e.ref, e.text!]));
  const pairs = drafts
    .map((draft) => ({
      draft,
      name: batch[draft.ref - 1]?.name_en ?? '',
      sourceText: textByRef.get(draft.ref) ?? '',
    }))
    .filter((p) => p.sourceText.length > 0);
  if (pairs.length === 0) return;

  const text = await generateJson(buildConceptVerifyPrompt(pairs), apiKey, CONCEPT_VERIFY_SCHEMA);
  const byRef = parseConceptVerify(text, new Set(pairs.map((p) => p.draft.ref)));
  for (const { draft } of pairs) {
    draft.unsupported_claims = byRef.get(draft.ref) ?? [];
    if (draft.unsupported_claims.length > 0) {
      logEvent('warn', 'verify', 'Concept body has unsupported claims', {
        ref: draft.ref,
        claims: draft.unsupported_claims,
      });
    }
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) || 30 : 30;

  const config = loadPipelineConfig();
  const db = createServiceClient(config.supabaseUrl, config.supabaseServiceKey);

  const concepts = await loadEmptyConcepts(db, limit);
  logEvent('info', 'enrich', 'Concept backfill started', {
    concepts: concepts.length,
    dry_run: dryRun,
  });
  if (concepts.length === 0) return;

  let updated = 0;
  let skipped = 0;

  for (let offset = 0; offset < concepts.length; offset += BATCH_SIZE) {
    const batch = concepts.slice(offset, offset + BATCH_SIZE);
    try {
      // Pseudo-pool so the regular enrich stage fetches official pages as-is.
      const pool: PoolItem[] = batch
        .map((c, i) =>
          c.official_url
            ? {
                ref: i + 1,
                title: c.name_en,
                url: c.official_url,
                source: 'official',
                topic: '',
                category: 'tools-and-releases',
              }
            : null,
        )
        .filter((p): p is PoolItem => p !== null);
      const enrichment = pool.length > 0 ? await enrichPool(pool, new Map(), pool.length) : [];

      const text = await generateJson(
        buildConceptPrompt(batch, enrichment),
        config.geminiApiKey,
        CONCEPTS_SCHEMA,
      );
      const drafts = parseConceptDrafts(text, batch.length);

      // Fact-control mirrors the article lane: verify → revise → re-verify.
      await verifyConceptDrafts(drafts, batch, enrichment, config.geminiApiKey);
      const flagged = drafts
        .filter((d) => d.unsupported_claims.length > 0)
        .map((draft) => ({ draft, row: batch[draft.ref - 1]! }));
      if (flagged.length > 0) {
        const revisedText = await generateJson(
          buildConceptRevisePrompt(flagged, enrichment),
          config.geminiApiKey,
          CONCEPTS_SCHEMA,
        );
        const revised = parseConceptDrafts(revisedText, batch.length).filter((r) =>
          flagged.some((f) => f.draft.ref === r.ref),
        );
        await verifyConceptDrafts(revised, batch, enrichment, config.geminiApiKey);
        const byRef = new Map(revised.map((r) => [r.ref, r]));
        for (let i = 0; i < drafts.length; i++) {
          const d = drafts[i]!;
          if (d.unsupported_claims.length === 0) continue;
          const rev = byRef.get(d.ref);
          if (rev && rev.unsupported_claims.length === 0) drafts[i] = rev;
        }
      }

      for (const draft of drafts) {
        const row = batch[draft.ref - 1];
        if (!row) continue;
        if (draft.unsupported_claims.length > 0) {
          skipped++;
          logEvent('warn', 'verify', 'Concept failed fact-control — left empty', {
            slug: row.slug,
          });
          continue;
        }
        if (draft.faq_en.length === 0 || draft.faq_uk.length === 0) {
          skipped++;
          logEvent('warn', 'enrich', 'Concept draft missing FAQ — left empty', {
            slug: row.slug,
          });
          continue;
        }

        if (dryRun) {
          console.log(`--- ${row.slug}\n${draft.body_en}\nFAQ: ${draft.faq_en.length}\n`);
          updated++;
          continue;
        }

        const { error } = await db
          .from('concepts')
          .update({
            body_en: draft.body_en,
            body_uk: draft.body_uk,
            faq_en: draft.faq_en,
            faq_uk: draft.faq_uk,
          })
          .eq('slug', row.slug);
        if (error) {
          logError('publish', 'Concept update failed', error, { slug: row.slug });
          skipped++;
          continue;
        }
        updated++;
      }

      // Refs the model never returned also stay empty for the next run.
      skipped += batch.length - drafts.length;

      logEvent('info', 'enrich', 'Concept backfill batch done', {
        batch: Math.floor(offset / BATCH_SIZE) + 1,
        updated,
        skipped,
      });
    } catch (e) {
      skipped += batch.length;
      logError('enrich', 'Concept backfill batch failed — continuing', e, {
        batch: Math.floor(offset / BATCH_SIZE) + 1,
      });
    }
    if (offset + BATCH_SIZE < concepts.length) await sleep(SLEEP_BETWEEN_BATCHES_MS);
  }

  logEvent('info', 'enrich', 'Concept backfill complete', { updated, skipped, dry_run: dryRun });
}

main().catch((e) => {
  logError('enrich', 'Concept backfill failed', e);
  process.exit(1);
});
/* v8 ignore end */
