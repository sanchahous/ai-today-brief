/**
 * Midnight (Kyiv) auto-publish for draft briefs the owner didn't get to
 * review. A draft otherwise sits in `status='draft'` forever — there is no
 * programmatic publish path besides the founder's 🚀 button in Telegram
 * (`handlePublish`, a private webhook function). This job sweeps the
 * accumulated pool of unreviewed drafts from the last `windowDays` (default
 * 7) and, for each one independently:
 *
 *   1. hard-rejects any pending item whose auto-check flagged an unconfirmed
 *      fact-check claim (never overridden by the judge);
 *   2. asks an LLM "judge" to triage the rest, calibrated to the owner's
 *      historical approve rate from `item_reviews`;
 *   3. publishes the pack if anything ended up approved.
 *
 * Fail-closed on the judge: if it's unavailable, existing owner-approved
 * items still publish (pending stays pending, hidden from the public site by
 * RLS) — the job never guesses a rejection from an infra failure.
 *
 * A brief already fully reviewed (0 pending, ≥1 approved) publishes
 * immediately without touching the judge — the owner decided and forgot to
 * press 🚀. Drafts older than the window are left untouched (stale news) and
 * only mentioned in the run's Telegram note.
 */

import { SchemaType } from '@google/generative-ai';
import { decorateCard } from '@/lib/telegram-webhook';
import { LANGS, SITE_URL } from '@/lib/site';
import { indexNowConfigured, submitToIndexNow } from '@/lib/indexnow';
import type { PipelineConfig } from './config';
import { logPipelineRun, type PipelineDb } from './db';
import { getPipelineDateKyiv } from './schedule';
import { generateJsonWithFallback } from './llm-json';
import { logError, logEvent } from './log';
import { editMessageText, sendMessage } from './telegram';
import type { GeminiResponseSchema } from './summarize';

// ─── Pure: weekly window ────────────────────────────────────────────────────

export const DEFAULT_AUTO_PUBLISH_WINDOW_DAYS = 7;

function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** A draft is in scope when it's strictly before `todayKyiv` and within `windowDays`. */
export function isWithinAutoPublishWindow(
  draftDate: string,
  todayKyiv: string,
  windowDays: number = DEFAULT_AUTO_PUBLISH_WINDOW_DAYS,
): boolean {
  if (draftDate >= todayKyiv) return false;
  const cutoff = addDaysToDateString(todayKyiv, -windowDays);
  return draftDate >= cutoff;
}

export function isStaleBeforeWindow(
  draftDate: string,
  todayKyiv: string,
  windowDays: number = DEFAULT_AUTO_PUBLISH_WINDOW_DAYS,
): boolean {
  const cutoff = addDaysToDateString(todayKyiv, -windowDays);
  return draftDate < cutoff;
}

// ─── Pure: hard rule (fact-check gate, before the judge) ───────────────────

const FACT_CHECK_UNCONFIRMED_MARKER = 'джерело не підтверджує';

export interface HardRuleVerdict {
  comment: string;
}

/**
 * `autoReviewComment` (db.ts) stamps this marker on pending items the VERIFY
 * pass flagged as unsupported by the source. Never overridden by the judge —
 * a fact-check failure is a hard reject regardless of taste calibration.
 */
export function detectHardRuleReject(reviewComment: string | null): HardRuleVerdict | null {
  if (!reviewComment || !reviewComment.includes(FACT_CHECK_UNCONFIRMED_MARKER)) return null;
  return { comment: `${reviewComment} | авто-відхилено: факт-чек не підтверджено` };
}

// ─── Pure: taste profile ────────────────────────────────────────────────────

export interface ReviewHistoryRow {
  action: 'approved' | 'rejected';
  reviewer: string | null;
  category_slug: string | null;
  title_en: string | null;
  comment: string | null;
}

const AUTO_REVIEWER_PREFIX = 'auto:';

/** Drops this pipeline's own past decisions — otherwise the judge would learn from itself. */
export function excludeAutoReviewer<T extends { reviewer: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => !r.reviewer?.startsWith(AUTO_REVIEWER_PREFIX));
}

/** Historical approve rate `p`, or `null` with zero decisions (no calibration possible). */
export function computeApproveRate(rows: Array<{ action: 'approved' | 'rejected' }>): number | null {
  let approved = 0;
  let total = 0;
  for (const r of rows) {
    total++;
    if (r.action === 'approved') approved++;
  }
  return total === 0 ? null : approved / total;
}

export interface CategoryApproveRate {
  category: string;
  approved: number;
  rejected: number;
  rate: number;
}

export interface JudgeProfileExample {
  title: string;
  category: string | null;
  comment?: string | null;
}

export interface JudgeProfile {
  approveRate: number | null;
  totalDecisions: number;
  categoryApproveRates: CategoryApproveRate[];
  recentApproved: JudgeProfileExample[];
  recentRejected: JudgeProfileExample[];
}

const PROFILE_EXAMPLE_CAP = 40;

/**
 * `rows` should already be ordered most-recent-first so the 40-cap keeps the
 * freshest signal. Category rates are scoped to `batchCategories` — the
 * categories actually present in the pending items being judged right now.
 */
export function buildJudgeProfile(rows: ReviewHistoryRow[], batchCategories: Set<string>): JudgeProfile {
  const history = excludeAutoReviewer(rows);
  const approveRate = computeApproveRate(history);

  const byCategory = new Map<string, { approved: number; rejected: number }>();
  for (const r of history) {
    if (!r.category_slug || !batchCategories.has(r.category_slug)) continue;
    const entry = byCategory.get(r.category_slug) ?? { approved: 0, rejected: 0 };
    if (r.action === 'approved') entry.approved++;
    else entry.rejected++;
    byCategory.set(r.category_slug, entry);
  }
  const categoryApproveRates: CategoryApproveRate[] = [...byCategory.entries()].map(([category, c]) => ({
    category,
    approved: c.approved,
    rejected: c.rejected,
    rate: c.approved + c.rejected === 0 ? 0 : c.approved / (c.approved + c.rejected),
  }));

  const recentApproved = history
    .filter((r): r is ReviewHistoryRow & { title_en: string } => r.action === 'approved' && !!r.title_en)
    .slice(0, PROFILE_EXAMPLE_CAP)
    .map((r) => ({ title: r.title_en, category: r.category_slug }));
  const recentRejected = history
    .filter((r): r is ReviewHistoryRow & { title_en: string } => r.action === 'rejected' && !!r.title_en)
    .slice(0, PROFILE_EXAMPLE_CAP)
    .map((r) => ({ title: r.title_en, category: r.category_slug, comment: r.comment }));

  return {
    approveRate,
    totalDecisions: history.length,
    categoryApproveRates,
    recentApproved,
    recentRejected,
  };
}

// ─── Pure: judge prompt + parser ────────────────────────────────────────────

export interface JudgeCandidate {
  ref: number;
  category: string | null;
  title_en: string;
  summary_en: string;
  why_matters_en: string | null;
}

export function buildJudgePrompt(profile: JudgeProfile, candidates: JudgeCandidate[]): string {
  const rateLine =
    profile.approveRate === null
      ? 'No review history yet — use your own editorial judgement.'
      : `Historically approves ${(profile.approveRate * 100).toFixed(0)}% of items reviewed (${profile.totalDecisions} decisions).`;

  const categoryLines = profile.categoryApproveRates
    .map((c) => `  - ${c.category}: ${(c.rate * 100).toFixed(0)}% approved (${c.approved + c.rejected} decisions)`)
    .join('\n');

  const approvedExamples = profile.recentApproved
    .map((e) => `  + [${e.category ?? 'uncategorized'}] ${e.title}`)
    .join('\n');
  const rejectedExamples = profile.recentRejected
    .map((e) => `  - [${e.category ?? 'uncategorized'}] ${e.title}${e.comment ? ` — reason: ${e.comment}` : ''}`)
    .join('\n');

  const candidateBlock = candidates
    .map(
      (c) =>
        `[${c.ref}] category: ${c.category ?? 'uncategorized'}\n` +
        `title: ${c.title_en}\n` +
        `summary: ${c.summary_en}\n` +
        (c.why_matters_en ? `why it matters: ${c.why_matters_en}\n` : ''),
    )
    .join('\n');

  return `You are emulating this editor's own historical review decisions for a developer news brief.

${rateLine}
${categoryLines ? `\nBy category:\n${categoryLines}\n` : ''}
${approvedExamples ? `\nRecently approved:\n${approvedExamples}\n` : ''}
${rejectedExamples ? `\nRecently rejected:\n${rejectedExamples}\n` : ''}

Judge each PENDING ITEM below as this editor would. Return one result per item:
{ ref, verdict: "approve" | "reject", confidence (0-1), reason }. JSON only.

PENDING ITEMS:
${candidateBlock}`;
}

const JUDGE_SCHEMA: GeminiResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    results: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          ref: { type: SchemaType.NUMBER },
          verdict: { type: SchemaType.STRING, format: 'enum', enum: ['approve', 'reject'] },
          confidence: { type: SchemaType.NUMBER },
          reason: { type: SchemaType.STRING },
        },
        required: ['ref', 'verdict', 'confidence', 'reason'],
      },
    },
  },
  required: ['results'],
};

export interface JudgeVerdict {
  ref: number;
  verdict: 'approve' | 'reject';
  confidence: number;
  reason: string;
}

interface RawJudgeResult {
  ref?: unknown;
  verdict?: unknown;
  confidence?: unknown;
  reason?: unknown;
}

/** Throws on malformed JSON — callers treat that as total judge failure (fail-closed). */
export function parseJudgeVerdicts(text: string, validRefs: Set<number>): JudgeVerdict[] {
  const parsed: unknown = JSON.parse(text);
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const results = Array.isArray(obj.results) ? (obj.results as RawJudgeResult[]) : [];
  const out: JudgeVerdict[] = [];
  for (const r of results) {
    const ref = typeof r.ref === 'number' ? r.ref : Number(r.ref);
    if (!validRefs.has(ref)) continue;
    const verdict = r.verdict === 'approve' || r.verdict === 'reject' ? r.verdict : null;
    if (!verdict) continue;
    const confidence = typeof r.confidence === 'number' ? r.confidence : Number(r.confidence);
    if (!Number.isFinite(confidence)) continue;
    out.push({
      ref,
      verdict,
      confidence: Math.min(1, Math.max(0, confidence)),
      reason: typeof r.reason === 'string' ? r.reason : '',
    });
  }
  return out;
}

// ─── Pure: calibration to the owner's historical approve rate ─────────────

/** Score ≥ this is always approved, even beyond the top-k quota. */
export const CALIBRATION_CEILING = 0.85;
/** Score < this is always rejected, even inside the top-k quota (no padding the quota with junk). */
export const CALIBRATION_FLOOR = 0.35;

export interface CalibratedVerdict {
  ref: number;
  approve: boolean;
  score: number;
}

/**
 * Calibrates raw judge verdicts to the owner's historical approve rate `p`:
 * scores each item (confidence if approve, 1-confidence if reject), keeps the
 * top round(p×N) by score, then applies the ceiling/floor overrides. With no
 * history (`approveRate === null`) calibration is skipped entirely — the
 * judge's raw verdicts pass through unchanged.
 */
export function calibrateVerdicts(verdicts: JudgeVerdict[], approveRate: number | null): CalibratedVerdict[] {
  const scored = verdicts
    .map((v) => ({
      ref: v.ref,
      rawApprove: v.verdict === 'approve',
      score: v.verdict === 'approve' ? v.confidence : 1 - v.confidence,
    }))
    .sort((a, b) => b.score - a.score || a.ref - b.ref);

  if (approveRate === null) {
    return scored.map((s) => ({ ref: s.ref, approve: s.rawApprove, score: s.score }));
  }

  const n = scored.length;
  const k = Math.min(n, Math.max(0, Math.round(approveRate * n)));

  const approvedRefs = new Set<number>(scored.slice(0, k).map((s) => s.ref));
  for (const s of scored) {
    if (s.score >= CALIBRATION_CEILING) approvedRefs.add(s.ref);
    if (s.score < CALIBRATION_FLOOR) approvedRefs.delete(s.ref);
  }

  return scored.map((s) => ({ ref: s.ref, approve: approvedRefs.has(s.ref), score: s.score }));
}

// ─── Pure: card text + banners (mirror src/app/api/telegram/route.ts) ──────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface AutoCardItem {
  title_en: string | null;
  title_uk: string | null;
  summary_en: string;
  summary_uk: string | null;
  why_matters_en: string | null;
  why_matters_uk: string | null;
  category_slug: string | null;
}

/** Mirrors `buildCardText` in src/app/api/telegram/route.ts — keep the two in sync. */
export function buildAutoCardText(item: AutoCardItem): string {
  const titleUk = escHtml(item.title_uk ?? item.title_en ?? '(untitled)');
  const titleEn = escHtml(item.title_en ?? '');
  const summary = escHtml(item.summary_uk ?? item.summary_en);
  const why = item.why_matters_uk ?? item.why_matters_en;
  const cat = escHtml(item.category_slug ?? 'uncategorized');
  const lines = [`🗂 <b>${cat}</b>`, '', `📰 <b>${titleUk}</b>`, `<i>${titleEn}</i>`, '', summary];
  if (why) lines.push('', `💡 <b>Навіщо:</b> ${escHtml(why)}`);
  return lines.join('\n');
}

export function autoApprovedBanner(): string {
  return '🤖 ▔▔▔▔▔ <b>АВТО-СХВАЛЕНО</b> ▔▔▔▔▔';
}

export function autoRejectedBanner(reason: string): string {
  return `🤖 ▔▔▔▔▔ <b>АВТО-ВІДХИЛЕНО</b> ▔▔▔▔▔\n💬 ${escHtml(reason)}`;
}

// ─── Pure: Telegram run summary ─────────────────────────────────────────────

export interface AutoPublishSummaryInput {
  title: string;
  edition: number;
  approved: number;
  rejected: number;
  hardRejected: number;
  readUrl?: string;
  judgeUnavailable?: boolean;
  nothingApproved?: boolean;
}

export function formatAutoPublishSummary(s: AutoPublishSummaryInput): string {
  const packLine = s.edition > 1 ? ` (пак ${s.edition})` : '';
  const hardNote = s.hardRejected > 0 ? ` (з них ${s.hardRejected} за жорстким правилом факт-чеку)` : '';
  const lines = [
    '🤖 <b>Опівнічна авто-публікація</b>',
    `🗞 «${escHtml(s.title)}»${packLine}`,
    '',
    `✅ Схвалено: <b>${s.approved}</b>`,
    `❌ Відхилено: <b>${s.rejected}</b>${hardNote}`,
  ];
  if (s.judgeUnavailable) {
    lines.push('', '⚠️ Суддя недоступний — опубліковано лише раніше схвалене вручну, інше лишилось на розгляді.');
  }
  if (s.nothingApproved) {
    lines.push('', '⚠️ Жодного схваленого матеріалу — брифінг лишається чернеткою.');
  }
  if (s.readUrl) lines.push('', `🔗 <a href="${escHtml(s.readUrl)}">Читати бриф на сайті</a>`);
  return lines.join('\n');
}

export function formatStaleDraftsNote(count: number): string {
  return `🤖 <b>Авто-публікація</b>: ${count} застарілих чернеток поза тижневим вікном — без змін (новини вже неактуальні).`;
}

// ─── Integration: DB + LLM + Telegram + revalidate + IndexNow ─────────────

export interface AutoPublishOptions {
  dryRun: boolean;
  /** Overrides the Kyiv "today" cutoff — mainly for manual re-runs / tests. */
  date?: string;
  windowDays: number;
}

export interface DraftOutcome {
  briefId: string;
  date: string;
  edition: number;
  action: 'published' | 'left_draft' | 'no_pending_no_approved' | 'error';
  approved: number;
  rejected: number;
  hardRejected: number;
  judgeUnavailable: boolean;
  error?: string;
}

export interface AutoPublishResult {
  windowDrafts: number;
  staleDrafts: number;
  outcomes: DraftOutcome[];
}

/* v8 ignore start -- integration: DB/LLM/Telegram/network IO; helpers above are unit-tested */

interface PendingItemRow {
  id: string;
  brief_id: string;
  category_slug: string | null;
  title_en: string | null;
  title_uk: string | null;
  summary_en: string;
  summary_uk: string | null;
  why_matters_en: string | null;
  why_matters_uk: string | null;
  review_comment: string | null;
  review_msg_id: number | null;
}

async function loadPendingItems(db: PipelineDb, briefId: string): Promise<PendingItemRow[]> {
  const { data, error } = await db
    .from('brief_items')
    .select(
      'id, brief_id, category_slug, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, review_comment, review_msg_id',
    )
    .eq('brief_id', briefId)
    .eq('review_status', 'pending');
  if (error) throw new Error(`[auto-publish] loadPendingItems failed: ${error.message}`);
  return data ?? [];
}

async function countApproved(db: PipelineDb, briefId: string): Promise<number> {
  const { count, error } = await db
    .from('brief_items')
    .select('id', { count: 'exact', head: true })
    .eq('brief_id', briefId)
    .eq('review_status', 'approved');
  if (error) throw new Error(`[auto-publish] countApproved failed: ${error.message}`);
  return count ?? 0;
}

async function loadReviewHistory(db: PipelineDb): Promise<ReviewHistoryRow[]> {
  const { data, error } = await db
    .from('item_reviews')
    .select('action, reviewer, category_slug, title_en, comment')
    .in('action', ['approved', 'rejected'])
    .not('reviewer', 'like', `${AUTO_REVIEWER_PREFIX}%`)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw new Error(`[auto-publish] loadReviewHistory failed: ${error.message}`);
  return (data ?? []) as ReviewHistoryRow[];
}

const AUTO_MODEL_UNKNOWN = 'unknown';

async function applyApprove(
  db: PipelineDb,
  item: PendingItemRow,
  model: string,
  chat?: { token: string; chatId: string },
): Promise<boolean> {
  const reviewerStr = `${AUTO_REVIEWER_PREFIX}${model}`;
  const { data: updated, error } = await db
    .from('brief_items')
    .update({ review_status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: reviewerStr })
    .eq('id', item.id)
    .eq('review_status', 'pending')
    .select('brief_id, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, category_slug')
    .single();
  if (error || !updated) return false;

  await db.from('item_reviews').insert({
    brief_id: updated.brief_id,
    brief_item_id: item.id,
    action: 'approved',
    reviewer: reviewerStr,
    category_slug: updated.category_slug,
    title_en: updated.title_en,
    summary_en: updated.summary_en,
  });

  if (item.review_msg_id && chat) {
    await editMessageText(
      chat.token,
      chat.chatId,
      item.review_msg_id,
      decorateCard(buildAutoCardText(updated), autoApprovedBanner()),
    );
  }
  return true;
}

async function applyReject(
  db: PipelineDb,
  item: PendingItemRow,
  comment: string,
  model: string,
  chat?: { token: string; chatId: string },
): Promise<boolean> {
  const reviewerStr = `${AUTO_REVIEWER_PREFIX}${model}`;
  const { data: updated, error } = await db
    .from('brief_items')
    .update({
      review_status: 'rejected',
      review_comment: comment,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerStr,
    })
    .eq('id', item.id)
    .eq('review_status', 'pending')
    .select('brief_id, title_en, title_uk, summary_en, summary_uk, why_matters_en, why_matters_uk, category_slug')
    .single();
  if (error || !updated) return false;

  await db.from('item_reviews').insert({
    brief_id: updated.brief_id,
    brief_item_id: item.id,
    action: 'rejected',
    comment,
    reviewer: reviewerStr,
    category_slug: updated.category_slug,
    title_en: updated.title_en,
    summary_en: updated.summary_en,
  });

  if (item.review_msg_id && chat) {
    await editMessageText(
      chat.token,
      chat.chatId,
      item.review_msg_id,
      decorateCard(buildAutoCardText(updated), autoRejectedBanner(comment)),
    );
  }
  return true;
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

async function revalidateSite(): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!secret) return;
  try {
    const res = await fetch(`${SITE_URL}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ paths: STANDARD_REVALIDATE_PATHS }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) logEvent('warn', 'auto_publish', 'Revalidate ping not ok', { status: res.status });
  } catch (e) {
    logError('auto_publish', 'Revalidate ping failed', e);
  }
}

/** Mirrors `pingIndexNow` in src/app/api/telegram/route.ts. */
async function pingIndexNow(db: PipelineDb, briefId: string, briefSlug: string | null): Promise<void> {
  if (!indexNowConfigured || !briefSlug) return;

  const { data: items } = await db
    .from('brief_items')
    .select('slug, category_slug')
    .eq('brief_id', briefId)
    .eq('review_status', 'approved')
    .is('canonical_item_id', null);

  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/sitemap.xml`,
    `${SITE_URL}/news-sitemap.xml`,
    ...LANGS.flatMap((lang) => [`${SITE_URL}/${lang}`, `${SITE_URL}/${lang}/news`, `${SITE_URL}/${lang}/${briefSlug}`]),
  ];
  for (const item of items ?? []) {
    if (!item.slug || !item.category_slug) continue;
    for (const lang of LANGS) urls.push(`${SITE_URL}/${lang}/news/${item.category_slug}/${item.slug}`);
  }

  const result = await submitToIndexNow(urls);
  if (!result.ok && !result.skipped) {
    logEvent('warn', 'auto_publish', 'IndexNow ping not ok', { brief_id: briefId, status: result.status ?? null });
  }
}

interface DraftRow {
  id: string;
  date: string;
  edition: number;
  slug: string | null;
  title_en: string | null;
  title_uk: string | null;
}

async function publishDraft(db: PipelineDb, draft: DraftRow): Promise<{ published: boolean }> {
  const { data: updated, error } = await db
    .from('briefs')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', draft.id)
    .eq('status', 'draft')
    .select('slug')
    .single();
  if (error || !updated) return { published: false };

  await revalidateSite();
  await pingIndexNow(db, draft.id, updated.slug);
  return { published: true };
}

async function processDraft(
  db: PipelineDb,
  config: PipelineConfig,
  draft: DraftRow,
  dryRun: boolean,
  chat: { token: string; chatId: string } | undefined,
): Promise<DraftOutcome> {
  const pending = await loadPendingItems(db, draft.id);
  const existingApproved = await countApproved(db, draft.id);

  let approvedThisRun = 0;
  let rejectedThisRun = 0;
  let hardRejected = 0;
  let judgeUnavailable = false;

  if (pending.length > 0) {
    const hardRejects: Array<{ item: PendingItemRow; comment: string }> = [];
    const needsJudge: PendingItemRow[] = [];
    for (const item of pending) {
      const hard = detectHardRuleReject(item.review_comment);
      if (hard) hardRejects.push({ item, comment: hard.comment });
      else needsJudge.push(item);
    }

    if (!dryRun) {
      for (const { item, comment } of hardRejects) {
        if (await applyReject(db, item, comment, 'hard-rule', chat)) {
          rejectedThisRun++;
          hardRejected++;
        }
      }
    } else {
      rejectedThisRun += hardRejects.length;
      hardRejected += hardRejects.length;
    }

    if (needsJudge.length > 0) {
      try {
        const batchCategories = new Set(
          needsJudge.map((i) => i.category_slug).filter((c): c is string => !!c),
        );
        const history = await loadReviewHistory(db);
        const profile = buildJudgeProfile(history, batchCategories);
        const candidates: JudgeCandidate[] = needsJudge.map((item, ref) => ({
          ref,
          category: item.category_slug,
          title_en: item.title_en ?? '',
          summary_en: item.summary_en,
          why_matters_en: item.why_matters_en,
        }));
        const prompt = buildJudgePrompt(profile, candidates);
        const { text, model } = await generateJsonWithFallback(
          'auto_publish',
          prompt,
          config.geminiApiKey,
          2,
          JUDGE_SCHEMA,
          config.openRouterApiKey,
          config.primaryTextProvider,
        );
        const rawVerdicts = parseJudgeVerdicts(text, new Set(candidates.map((c) => c.ref)));
        const calibrated = calibrateVerdicts(rawVerdicts, profile.approveRate);
        const calibratedByRef = new Map(calibrated.map((c) => [c.ref, c]));

        for (let ref = 0; ref < needsJudge.length; ref++) {
          const item = needsJudge[ref]!;
          const verdict = calibratedByRef.get(ref);
          if (!verdict) continue; // no coverage from the model — leave pending
          if (dryRun) {
            if (verdict.approve) approvedThisRun++;
            else rejectedThisRun++;
            continue;
          }
          const rawReason = rawVerdicts.find((v) => v.ref === ref)?.reason ?? '';
          if (verdict.approve) {
            if (await applyApprove(db, item, model ?? AUTO_MODEL_UNKNOWN, chat)) approvedThisRun++;
          } else if (await applyReject(db, item, `авто: ${rawReason || 'не пройшло калібрування'}`, model ?? AUTO_MODEL_UNKNOWN, chat)) {
            rejectedThisRun++;
          }
        }
      } catch (e) {
        judgeUnavailable = true;
        logError('auto_publish', 'Judge unavailable — leaving remaining pending items untouched', e, {
          brief_id: draft.id,
          pending: needsJudge.length,
        });
      }
    }
  }

  const totalApproved = existingApproved + approvedThisRun;
  const title = draft.title_uk ?? draft.title_en ?? '–';
  // 0 pending + 0 approved is a true no-op (nothing to decide, nothing to report) —
  // silent by design, unlike "we triaged this and nothing survived" below.
  const isSilentNoOp = pending.length === 0 && existingApproved === 0;

  if (totalApproved === 0) {
    if (!dryRun && chat && !isSilentNoOp) {
      await sendMessage(
        chat.token,
        chat.chatId,
        formatAutoPublishSummary({
          title,
          edition: draft.edition,
          approved: approvedThisRun,
          rejected: rejectedThisRun,
          hardRejected,
          judgeUnavailable,
          nothingApproved: true,
        }),
      );
    }
    return {
      briefId: draft.id,
      date: draft.date,
      edition: draft.edition,
      action: isSilentNoOp ? 'no_pending_no_approved' : 'left_draft',
      approved: approvedThisRun,
      rejected: rejectedThisRun,
      hardRejected,
      judgeUnavailable,
    };
  }

  if (dryRun) {
    return {
      briefId: draft.id,
      date: draft.date,
      edition: draft.edition,
      action: 'published',
      approved: approvedThisRun,
      rejected: rejectedThisRun,
      hardRejected,
      judgeUnavailable,
    };
  }

  const { published } = await publishDraft(db, draft);
  if (published && chat) {
    const readUrl = draft.slug ? `${SITE_URL}/uk/${draft.slug}` : undefined;
    await sendMessage(
      chat.token,
      chat.chatId,
      formatAutoPublishSummary({
        title,
        edition: draft.edition,
        approved: approvedThisRun,
        rejected: rejectedThisRun,
        hardRejected,
        readUrl,
        judgeUnavailable,
      }),
    );
  }

  return {
    briefId: draft.id,
    date: draft.date,
    edition: draft.edition,
    action: published ? 'published' : 'left_draft',
    approved: approvedThisRun,
    rejected: rejectedThisRun,
    hardRejected,
    judgeUnavailable,
  };
}

export async function runAutoPublish(
  db: PipelineDb,
  config: PipelineConfig,
  options: AutoPublishOptions,
): Promise<AutoPublishResult> {
  const started = Date.now();
  const today = options.date ?? getPipelineDateKyiv();
  const cutoff = addDaysToDateString(today, -options.windowDays);
  const logDate = getPipelineDateKyiv();

  const { data: windowDraftRows, error: draftsErr } = await db
    .from('briefs')
    .select('id, date, edition, slug, title_en, title_uk')
    .eq('status', 'draft')
    .gte('date', cutoff)
    .lt('date', today)
    .order('date', { ascending: true })
    .order('edition', { ascending: true });
  if (draftsErr) throw new Error(`[auto-publish] load window drafts failed: ${draftsErr.message}`);

  const windowDrafts = (windowDraftRows ?? []) as DraftRow[];

  if (windowDrafts.length === 0) {
    await logPipelineRun(db, {
      date: logDate,
      stage: 'auto_publish',
      status: 'skipped',
      durationMs: Date.now() - started,
    });
    return { windowDrafts: 0, staleDrafts: 0, outcomes: [] };
  }

  const { count: staleCount, error: staleErr } = await db
    .from('briefs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'draft')
    .lt('date', cutoff);
  if (staleErr) throw new Error(`[auto-publish] stale drafts count failed: ${staleErr.message}`);

  const chat =
    config.telegramBotToken && config.telegramReviewChatId
      ? { token: config.telegramBotToken, chatId: config.telegramReviewChatId }
      : undefined;

  const outcomes: DraftOutcome[] = [];
  for (const draft of windowDrafts) {
    try {
      outcomes.push(await processDraft(db, config, draft, options.dryRun, chat));
    } catch (e) {
      logError('auto_publish', 'Draft processing failed — continuing with the rest', e, {
        brief_id: draft.id,
      });
      outcomes.push({
        briefId: draft.id,
        date: draft.date,
        edition: draft.edition,
        action: 'error',
        approved: 0,
        rejected: 0,
        hardRejected: 0,
        judgeUnavailable: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (!options.dryRun && (staleCount ?? 0) > 0 && chat) {
    await sendMessage(chat.token, chat.chatId, formatStaleDraftsNote(staleCount ?? 0));
  }

  await logPipelineRun(db, {
    date: logDate,
    stage: 'auto_publish',
    status: 'ok',
    durationMs: Date.now() - started,
    meta: {
      window_drafts: windowDrafts.length,
      stale_drafts: staleCount ?? 0,
      outcomes: outcomes.map((o) => ({
        brief_id: o.briefId,
        date: o.date,
        edition: o.edition,
        action: o.action,
        approved: o.approved,
        rejected: o.rejected,
        hard_rejected: o.hardRejected,
        judge_unavailable: o.judgeUnavailable,
      })),
      dry_run: options.dryRun,
    },
  });

  return { windowDrafts: windowDrafts.length, staleDrafts: staleCount ?? 0, outcomes };
}
/* v8 ignore end */
