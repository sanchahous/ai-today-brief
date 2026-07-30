/**
 * Retroactive semantic-duplicate scan across the published archive.
 *
 * Cross-day dedup (pipeline/config.ts `maxEmbedDistance`, 026/039's
 * `match_relevant_item`) only ever rejects a NEW candidate against what is
 * already live — it never revisits stories already sitting in the archive.
 * That gate is deliberately loose (0.12, not 0.20 — see config.ts) so it
 * doesn't kill genuinely new stories, which means the same event re-told days
 * apart in different words can land in the 0.12–0.25 band and get published
 * twice. This job finds those pairs after the fact and merges the later copy
 * into the earlier one via `canonical_item_id` (031's redirect pattern — no
 * hard deletes, fully reversible by nulling the column back out).
 *
 * Flow: `find_duplicate_item_pairs` RPC → same-article pairs auto-merge,
 * everything else goes through one LLM confirmation pass (chunked ≤40 pairs)
 * → confirmed pairs are clustered (union-find) so a 3-way duplicate merges
 * into a single canonical → canonical_item_id is written idempotently →
 * affected pages are revalidated → a Telegram report lists what merged
 * (skipped when nothing did).
 *
 * Fail-closed: an LLM failure means those pairs are simply not merged this
 * run (they'll surface again next run) — the job never merges on a guess.
 */

import { SchemaType } from '@google/generative-ai';
import { SITE_URL } from '@/lib/site';
import type { PipelineConfig } from './config';
import { findDuplicateItemPairs, logPipelineRun, type DuplicateItemPair, type PipelineDb } from './db';
import { getPipelineDateKyiv } from './schedule';
import { generateJsonWithFallback } from './llm-json';
import { logError, logEvent } from './log';
import { sendMessage } from './telegram';
import type { GeminiResponseSchema } from './summarize';

// ─── Pure: clustering ──────────────────────────────────────────────────────

/** Minimal union-find over string ids — merges transitively (A~B, B~C ⇒ A~B~C). */
export class UnionFind {
  private readonly parent = new Map<string, string>();

  find(x: string): string {
    const p = this.parent.get(x) ?? x;
    if (p === x) {
      this.parent.set(x, x);
      return x;
    }
    const root = this.find(p);
    this.parent.set(x, root);
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export interface ClusterableItem {
  id: string;
  date: string;
  edition: number;
  rank: number;
}

/** Earliest-wins ordering: (date, edition, rank, id) — same rule as 031's backfill. */
export function compareClusterOrder(a: ClusterableItem, b: ClusterableItem): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.edition !== b.edition) return a.edition - b.edition;
  if (a.rank !== b.rank) return a.rank - b.rank;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Groups confirmed duplicate pairs into clusters (transitively) and picks the
 * earliest member of each cluster as canonical. Returns dupeId → canonicalId
 * for every non-canonical member; items with no confirmed pair are absent.
 */
export function clusterConfirmedPairs(
  pairs: Array<{ earlier_id: string; later_id: string }>,
  items: Map<string, ClusterableItem>,
): Map<string, string> {
  const uf = new UnionFind();
  const allIds = new Set<string>();
  for (const p of pairs) {
    if (!items.has(p.earlier_id) || !items.has(p.later_id)) continue;
    uf.union(p.earlier_id, p.later_id);
    allIds.add(p.earlier_id);
    allIds.add(p.later_id);
  }

  const groups = new Map<string, string[]>();
  for (const id of allIds) {
    const root = uf.find(id);
    const group = groups.get(root);
    if (group) group.push(id);
    else groups.set(root, [id]);
  }

  const merges = new Map<string, string>();
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const sorted = [...members].sort((a, b) => compareClusterOrder(items.get(a)!, items.get(b)!));
    const [canonical, ...dupes] = sorted;
    for (const dupe of dupes) merges.set(dupe, canonical!);
  }
  return merges;
}

// ─── Pure: LLM confirmation (prompt + parser) ──────────────────────────────

export const DEDUP_CHUNK_SIZE = 40;
export const DEDUP_CONFIDENCE_THRESHOLD = 0.7;

export interface DedupItemDetail {
  id: string;
  slug: string;
  categorySlug: string | null;
  title: string;
  summary: string;
  rank: number;
  briefId: string;
  date: string;
  edition: number;
}

export interface DedupPairDetail {
  pairIndex: number;
  earlier: DedupItemDetail;
  later: DedupItemDetail;
  distance: number;
}

/** Splits pairs into ≤`size` chunks — one LLM call per chunk. */
export function chunkPairs<T>(items: T[], size = DEDUP_CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function buildDedupPrompt(pairs: DedupPairDetail[]): string {
  const block = pairs
    .map(
      (p) =>
        `[${p.pairIndex}]\n` +
        `A: ${p.earlier.title} (${p.earlier.date}, ${p.earlier.categorySlug ?? 'uncategorized'})\n` +
        `   ${p.earlier.summary}\n` +
        `B: ${p.later.title} (${p.later.date}, ${p.later.categorySlug ?? 'uncategorized'})\n` +
        `   ${p.later.summary}\n` +
        `embedding_distance_hint: ${p.distance.toFixed(3)} (lower = more similar)`,
    )
    .join('\n\n');

  return `You are an editor auditing a developer news archive for duplicate coverage.

For each PAIR below, decide whether A and B report the SAME EVENT — the same specific
announcement, release, or incident — as opposed to merely the same ongoing topic or
product covered on different occasions. A v1 release and a later v2 release are
DIFFERENT events even though they share a product name; two write-ups of the same
specific outage or the same specific announcement ARE the same event.

Return one result per pair: { pair, same_event, confidence } — confidence in [0,1] is
your certainty that same_event is correct. JSON only.

PAIRS:
${block}`;
}

interface DedupModelResult {
  pair?: unknown;
  same_event?: unknown;
  confidence?: unknown;
}

/** Parses verdicts, dropping hallucinated pair indexes and applying the confidence gate. */
export function parseDedupVerdicts(text: string, validPairIndexes: Set<number>): Map<number, boolean> {
  const parsed: unknown = JSON.parse(text);
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const results = Array.isArray(obj.results) ? (obj.results as DedupModelResult[]) : [];
  const out = new Map<number, boolean>();
  for (const r of results) {
    const idx = typeof r.pair === 'number' ? r.pair : Number(r.pair);
    if (!validPairIndexes.has(idx)) continue;
    const confidence = typeof r.confidence === 'number' ? r.confidence : Number(r.confidence);
    const sameEvent =
      r.same_event === true && Number.isFinite(confidence) && confidence >= DEDUP_CONFIDENCE_THRESHOLD;
    out.set(idx, sameEvent);
  }
  return out;
}

const DEDUP_SCHEMA: GeminiResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    results: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          pair: { type: SchemaType.NUMBER },
          same_event: { type: SchemaType.BOOLEAN },
          confidence: { type: SchemaType.NUMBER },
        },
        required: ['pair', 'same_event', 'confidence'],
      },
    },
  },
  required: ['results'],
};

// ─── Pure: Telegram report ──────────────────────────────────────────────────

export interface MergeReportEntry {
  laterTitle: string;
  laterDate: string;
  primaryTitle: string;
  primaryDate: string;
  primaryUrl: string;
}

const TELEGRAM_MAX_CHARS = 4096;

export function formatDedupReport(merges: MergeReportEntry[], opts: { dryRun: boolean }): string {
  const header = opts.dryRun
    ? '🔍 <b>Dedup-scan (dry-run)</b> — знайдені дублі, нічого не змінено'
    : '🔁 <b>Dedup-scan</b> — злито дублі';
  const lines = [header, ''];
  for (const m of merges) {
    lines.push(`«${m.laterTitle}» (${m.laterDate}) → «${m.primaryTitle}» (${m.primaryDate})\n${m.primaryUrl}`);
  }
  let text = lines.join('\n');
  if (text.length > TELEGRAM_MAX_CHARS) {
    text = `${text.slice(0, TELEGRAM_MAX_CHARS - 20)}\n…(обрізано)`;
  }
  return text;
}

// ─── Integration: DB + LLM + Telegram + revalidate ──────────────────────────

export interface DedupScanOptions {
  dryRun: boolean;
  backfill: boolean;
  windowDays: number;
  maxDistance: number;
  maxPairs: number;
}

export interface DedupScanResult {
  pairsCandidate: number;
  pairsConfirmed: number;
  clusters: number;
  merged: number;
  mergedIds: Array<[string, string]>;
  model: string | null;
}

const STANDARD_REVALIDATE_PATHS = [
  '/',
  '/en',
  '/uk',
  '/en/news',
  '/uk/news',
  '/sitemap.xml',
  '/rss.xml',
  '/news-sitemap.xml',
];
const LANGS_FOR_REVALIDATE = ['en', 'uk'] as const;

/* v8 ignore start -- integration: DB/LLM/Telegram/network IO; helpers above are unit-tested */
interface ItemDetailRow {
  id: string;
  slug: string | null;
  category_slug: string | null;
  title_en: string | null;
  summary_en: string | null;
  rank: number;
  brief_id: string;
  briefs: { date: string; edition: number } | null;
}

async function loadItemDetails(db: PipelineDb, ids: string[]): Promise<Map<string, DedupItemDetail>> {
  const out = new Map<string, DedupItemDetail>();
  if (ids.length === 0) return out;
  const { data, error } = await db
    .from('brief_items')
    .select(
      'id, slug, category_slug, title_en, summary_en, rank, brief_id, briefs!brief_items_brief_id_fkey(date, edition)',
    )
    .in('id', ids);
  if (error) throw new Error(`[dedup-scan] loadItemDetails failed: ${error.message}`);
  for (const row of (data ?? []) as unknown as ItemDetailRow[]) {
    if (!row.slug || !row.briefs) continue;
    out.set(row.id, {
      id: row.id,
      slug: row.slug,
      categorySlug: row.category_slug,
      title: row.title_en ?? '',
      summary: row.summary_en ?? '',
      rank: row.rank,
      briefId: row.brief_id,
      date: row.briefs.date,
      edition: row.briefs.edition,
    });
  }
  return out;
}

async function writeCanonicalMerges(db: PipelineDb, merges: Map<string, string>): Promise<Array<[string, string]>> {
  const written: Array<[string, string]> = [];
  for (const [dupeId, canonicalId] of merges) {
    const { data, error } = await db
      .from('brief_items')
      .update({ canonical_item_id: canonicalId })
      .eq('id', dupeId)
      .is('canonical_item_id', null)
      .select('id');
    if (error) throw new Error(`[dedup-scan] canonical write failed: ${error.message}`);
    if ((data ?? []).length > 0) written.push([dupeId, canonicalId]);
  }
  return written;
}

async function revalidatePaths(paths: string[]): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!secret || paths.length === 0) return;
  try {
    const res = await fetch(`${SITE_URL}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ paths }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) logEvent('warn', 'dedup_scan', 'Revalidate ping not ok', { status: res.status });
  } catch (e) {
    logError('dedup_scan', 'Revalidate ping failed', e);
  }
}

export async function runDedupScan(
  db: PipelineDb,
  config: PipelineConfig,
  options: DedupScanOptions,
): Promise<DedupScanResult> {
  const started = Date.now();
  const date = getPipelineDateKyiv();
  const recentDays = options.backfill ? 0 : 3;

  const pairs = await findDuplicateItemPairs(
    db,
    options.maxDistance,
    options.windowDays,
    recentDays,
    options.maxPairs,
  );

  if (pairs.length === 0) {
    await logPipelineRun(db, {
      date,
      stage: 'dedup_scan',
      status: 'skipped',
      durationMs: Date.now() - started,
    });
    return { pairsCandidate: 0, pairsConfirmed: 0, clusters: 0, merged: 0, mergedIds: [], model: null };
  }

  const ids = new Set<string>();
  for (const p of pairs) {
    ids.add(p.earlier_id);
    ids.add(p.later_id);
  }
  const details = await loadItemDetails(db, [...ids]);

  const confirmed: Array<{ earlier_id: string; later_id: string }> = [];
  const needsLlm: DuplicateItemPair[] = [];
  for (const p of pairs) {
    if (!details.has(p.earlier_id) || !details.has(p.later_id)) continue;
    if (p.same_article) confirmed.push(p);
    else needsLlm.push(p);
  }

  let model: string | null = null;
  if (needsLlm.length > 0) {
    const pairDetails: DedupPairDetail[] = needsLlm.map((p, i) => ({
      pairIndex: i,
      earlier: details.get(p.earlier_id)!,
      later: details.get(p.later_id)!,
      distance: p.distance,
    }));

    for (const chunk of chunkPairs(pairDetails)) {
      try {
        const { text, model: usedModel } = await generateJsonWithFallback(
          'dedup_scan',
          buildDedupPrompt(chunk),
          config.geminiApiKey,
          2,
          DEDUP_SCHEMA,
          config.openRouterApiKey,
        );
        model = usedModel ?? model;
        const verdicts = parseDedupVerdicts(text, new Set(chunk.map((d) => d.pairIndex)));
        for (const d of chunk) {
          if (verdicts.get(d.pairIndex)) {
            confirmed.push({ earlier_id: d.earlier.id, later_id: d.later.id });
          }
        }
      } catch (e) {
        // Fail-closed: this chunk's pairs simply aren't merged this run.
        logError('dedup_scan', 'LLM confirmation chunk failed — chunk skipped', e, {
          chunk_size: chunk.length,
        });
      }
    }
  }

  const clusterItems = new Map<string, ClusterableItem>();
  for (const [id, d] of details) clusterItems.set(id, { id, date: d.date, edition: d.edition, rank: d.rank });
  const merges = clusterConfirmedPairs(confirmed, clusterItems);

  const clusterCanonicals = new Set(merges.values());

  let mergedIds: Array<[string, string]> = [];
  if (!options.dryRun && merges.size > 0) {
    mergedIds = await writeCanonicalMerges(db, merges);
  } else if (options.dryRun) {
    mergedIds = [...merges.entries()];
  }

  if (mergedIds.length > 0) {
    const revalidatePathsSet = new Set(STANDARD_REVALIDATE_PATHS);
    for (const [dupeId] of mergedIds) {
      const d = details.get(dupeId);
      if (!d?.categorySlug) continue;
      for (const lang of LANGS_FOR_REVALIDATE) revalidatePathsSet.add(`/${lang}/news/${d.categorySlug}/${d.slug}`);
    }
    if (!options.dryRun) await revalidatePaths([...revalidatePathsSet]);

    if (config.telegramBotToken && config.telegramReviewChatId) {
      const report: MergeReportEntry[] = mergedIds.map(([dupeId, canonicalId]) => {
        const dupe = details.get(dupeId)!;
        const primary = details.get(canonicalId)!;
        return {
          laterTitle: dupe.title,
          laterDate: dupe.date,
          primaryTitle: primary.title,
          primaryDate: primary.date,
          primaryUrl: `${SITE_URL}/en/news/${primary.categorySlug ?? 'news'}/${primary.slug}`,
        };
      });
      const text = formatDedupReport(report, { dryRun: options.dryRun });
      await sendMessage(config.telegramBotToken, config.telegramReviewChatId, text);
    }
  }

  const result: DedupScanResult = {
    pairsCandidate: pairs.length,
    pairsConfirmed: confirmed.length,
    clusters: clusterCanonicals.size,
    merged: mergedIds.length,
    mergedIds,
    model,
  };

  await logPipelineRun(db, {
    date,
    stage: 'dedup_scan',
    status: 'ok',
    durationMs: Date.now() - started,
    meta: {
      pairs_candidate: result.pairsCandidate,
      pairs_confirmed: result.pairsConfirmed,
      clusters: result.clusters,
      merged: result.merged,
      merged_ids: result.mergedIds,
      model: result.model,
      dry_run: options.dryRun,
    },
  });

  return result;
}
/* v8 ignore end */
