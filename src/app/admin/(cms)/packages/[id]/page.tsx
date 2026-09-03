import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Json } from '@/lib/database.types';
import { requireSocialAdmin } from '@/lib/admin-auth';
import { SITE_URL } from '@/lib/site';
import { withSocialClickToken } from '@/lib/social/tracked-url';
import { ActionSubmitButton } from '@/components/admin/action-submit-button';
import { StatusPill } from '@/components/admin/status-pill';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  addressWeeklyDigestChangesAction,
  approvePackageAction,
  approvePostAction,
  cancelPackageAction,
  regenerateVariantAction,
  requestWeeklyDigestChangesAction,
  updateVariantAction,
} from '../../../actions';
import { WEEKLY_ITEM_REVIEW_ACTIONS, WEEKLY_REVIEW_REASONS } from '@/lib/social/weekly-review';

export const dynamic = 'force-dynamic';

interface Issue {
  code?: string;
  message?: string;
}

interface EditorialItem {
  briefItemId: string;
  rank: number;
  title: string;
  version: string;
  score: number;
  impact: string;
  category: string;
  sourceName: string;
  sourceUrl: string | null;
  reasons: string[];
  citationCount: number;
}

interface EditorialRationale {
  version: string;
  summary: string;
  factors: string[];
  tradeoffs: string;
  metrics: {
    candidateCount: number;
    eligibleCount: number;
    rejectedCount: number;
    selectedCount: number;
    categoryCount: number;
    sourceCount: number;
    averageScore: number;
  };
}

interface AlternativeCandidate {
  briefItemId: string;
  title: string;
  score: number;
  category: string;
  sourceName: string;
  exclusionReasons: string[];
}

interface WeeklyReviewItem {
  id: string;
  action: string;
  note: string | null;
  previousRank: number | null;
  requestedRank: number | null;
  title: string;
}

function jsonRecord(value: Json | undefined): Record<string, Json | undefined> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : null;
}

function jsonStrings(value: Json | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function jsonNumber(record: Record<string, Json | undefined> | null, key: string): number {
  return typeof record?.[key] === 'number' ? record[key] : 0;
}

function editorialItem(briefItemId: string, rank: number, value: Json): EditorialItem | null {
  const snapshot = jsonRecord(value);
  const selection = jsonRecord(snapshot?.editorial_selection);
  if (!snapshot || !selection || typeof selection.score !== 'number') return null;
  const sourceUrl = typeof selection.source_url === 'string' ? selection.source_url : null;
  return {
    briefItemId,
    rank,
    title:
      typeof snapshot.title_en === 'string'
        ? snapshot.title_en
        : typeof snapshot.title_uk === 'string'
          ? snapshot.title_uk
          : 'Untitled story',
    version: typeof selection.version === 'string' ? selection.version : 'unknown',
    score: selection.score,
    impact: typeof selection.impact_level === 'string' ? selection.impact_level : 'unknown',
    category: typeof selection.category_slug === 'string' ? selection.category_slug : 'other',
    sourceName:
      typeof selection.source_name === 'string' ? selection.source_name : 'Unknown source',
    sourceUrl: sourceUrl?.startsWith('https://') ? sourceUrl : null,
    reasons: Array.isArray(selection.reasons)
      ? selection.reasons.filter((reason): reason is string => typeof reason === 'string')
      : [],
    citationCount: Array.isArray(selection.citation_urls) ? selection.citation_urls.length : 0,
  };
}

function editorialRationale(value: Json | undefined): EditorialRationale | null {
  const rationale = jsonRecord(value);
  const metrics = jsonRecord(rationale?.metrics);
  if (!rationale || !metrics) return null;
  const summary =
    typeof rationale.summary_uk === 'string'
      ? rationale.summary_uk
      : typeof rationale.summary_en === 'string'
        ? rationale.summary_en
        : '';
  if (!summary) return null;
  return {
    version: typeof rationale.version === 'string' ? rationale.version : 'unknown',
    summary,
    factors: jsonStrings(rationale.decisive_factors_uk).length
      ? jsonStrings(rationale.decisive_factors_uk)
      : jsonStrings(rationale.decisive_factors_en),
    tradeoffs:
      typeof rationale.tradeoffs_uk === 'string'
        ? rationale.tradeoffs_uk
        : typeof rationale.tradeoffs_en === 'string'
          ? rationale.tradeoffs_en
          : '',
    metrics: {
      candidateCount: jsonNumber(metrics, 'candidateCount'),
      eligibleCount: jsonNumber(metrics, 'eligibleCount'),
      rejectedCount: jsonNumber(metrics, 'rejectedCount'),
      selectedCount: jsonNumber(metrics, 'selectedCount'),
      categoryCount: jsonNumber(metrics, 'categoryCount'),
      sourceCount: jsonNumber(metrics, 'sourceCount'),
      averageScore: jsonNumber(metrics, 'averageScore'),
    },
  };
}

function alternativeCandidates(value: Json | undefined): AlternativeCandidate[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const candidate = jsonRecord(entry);
    if (
      !candidate ||
      candidate.status !== 'eligible_not_selected' ||
      typeof candidate.brief_item_id !== 'string' ||
      typeof candidate.score !== 'number'
    ) {
      return [];
    }
    return [
      {
        briefItemId: candidate.brief_item_id,
        title:
          typeof candidate.title_uk === 'string'
            ? candidate.title_uk
            : typeof candidate.title_en === 'string'
              ? candidate.title_en
              : 'Untitled story',
        score: candidate.score,
        category: typeof candidate.category_slug === 'string' ? candidate.category_slug : 'other',
        sourceName:
          typeof candidate.source_name === 'string' ? candidate.source_name : 'Unknown source',
        exclusionReasons: jsonStrings(candidate.exclusion_reasons),
      },
    ];
  });
}

function quality(value: Json): {
  blocking: Issue[];
  warnings: Issue[];
  critic?: {
    score?: number;
    flags?: string[];
    provider?: string;
    model?: string;
    fallbackUsed?: boolean;
    auditedAt?: string;
  };
} {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { blocking: [], warnings: [] };
  const report = value as { blocking?: unknown; warnings?: unknown; critic?: unknown };
  return {
    blocking: Array.isArray(report.blocking) ? (report.blocking as Issue[]) : [],
    warnings: Array.isArray(report.warnings) ? (report.warnings as Issue[]) : [],
    critic:
      report.critic && typeof report.critic === 'object' && !Array.isArray(report.critic)
        ? (report.critic as {
            score?: number;
            flags?: string[];
            provider?: string;
            model?: string;
            fallbackUsed?: boolean;
            auditedAt?: string;
          })
        : undefined,
  };
}

function assets(value: Json) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const url = (entry as Record<string, Json | undefined>).url;
    return typeof url === 'string' ? [url] : [];
  });
}

function kyivInput(iso: string | null) {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export default async function PackageEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSocialAdmin();
  const supabase = getSupabaseAdmin();
  const [{ data: socialPackage }, { data: posts }, { data: reviews }] = await Promise.all([
    supabase.from('social_packages').select('*').eq('id', id).maybeSingle(),
    supabase.from('social_posts').select('*').eq('package_id', id).order('scheduled_for'),
    supabase
      .from('social_post_reviews')
      .select('id,action,created_at,content_version,note,social_post_id')
      .eq('package_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  if (!socialPackage) notFound();
  const [weeklyItemsResult, selectionRunResult, weeklyReviewsResult] =
    socialPackage.weekly_digest_id
      ? await Promise.all([
          supabase
            .from('weekly_digest_items')
            .select('brief_item_id,rank,snapshot')
            .eq('weekly_digest_id', socialPackage.weekly_digest_id)
            .order('rank'),
          supabase
            .from('weekly_digest_selection_runs')
            .select('id,algorithm_version,rationale_version,rationale,candidate_pool,created_at')
            .eq('weekly_digest_id', socialPackage.weekly_digest_id)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('weekly_digest_reviews')
            .select('id,action,reason_codes,note,created_at,parent_review_id')
            .eq('weekly_digest_id', socialPackage.weekly_digest_id)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .limit(20),
        ])
      : [
          { data: [], error: null },
          { data: null, error: null },
          { data: [], error: null },
        ];
  const { data: weeklyItemRows, error: weeklyItemsError } = weeklyItemsResult;
  if (weeklyItemsError) throw new Error(`Weekly shortlist: ${weeklyItemsError.message}`);
  if (selectionRunResult.error) {
    throw new Error(`Weekly rationale: ${selectionRunResult.error.message}`);
  }
  if (weeklyReviewsResult.error) {
    throw new Error(`Weekly reviews: ${weeklyReviewsResult.error.message}`);
  }
  const editorialItems = (weeklyItemRows ?? []).flatMap((row) => {
    const item = editorialItem(row.brief_item_id, row.rank, row.snapshot);
    return item ? [item] : [];
  });
  const selectionRun = selectionRunResult.data;
  const rationale = editorialRationale(selectionRun?.rationale);
  const alternatives = alternativeCandidates(selectionRun?.candidate_pool);
  const weeklyReviews = weeklyReviewsResult.data ?? [];
  const weeklyReviewIds = weeklyReviews.map((review) => review.id);
  const { data: weeklyReviewItemRows, error: weeklyReviewItemsError } =
    weeklyReviewIds.length > 0
      ? await supabase
          .from('weekly_digest_review_items')
          .select(
            'id,review_id,brief_item_id,action,note,previous_rank,requested_rank,candidate_snapshot',
          )
          .in('review_id', weeklyReviewIds)
          .order('created_at')
      : { data: [], error: null };
  if (weeklyReviewItemsError) {
    throw new Error(`Weekly review items: ${weeklyReviewItemsError.message}`);
  }
  const selectedTitleById = new Map(editorialItems.map((item) => [item.briefItemId, item.title]));
  const weeklyReviewItemsByReview = new Map<string, WeeklyReviewItem[]>();
  for (const row of weeklyReviewItemRows ?? []) {
    const snapshot = jsonRecord(row.candidate_snapshot);
    const title =
      (typeof snapshot?.title_uk === 'string' ? snapshot.title_uk : null) ??
      (typeof snapshot?.title_en === 'string' ? snapshot.title_en : null) ??
      (row.brief_item_id ? selectedTitleById.get(row.brief_item_id) : null) ??
      'Unknown story';
    const items = weeklyReviewItemsByReview.get(row.review_id) ?? [];
    items.push({
      id: row.id,
      action: row.action,
      note: row.note,
      previousRank: row.previous_rank,
      requestedRank: row.requested_rank,
      title,
    });
    weeklyReviewItemsByReview.set(row.review_id, items);
  }
  const hasOpenChangeRequest = weeklyReviews[0]?.action === 'changes_requested';
  const openChangeRequest = hasOpenChangeRequest ? weeklyReviews[0] : null;
  const reviewReasonLabel = new Map<string, string>(
    WEEKLY_REVIEW_REASONS.map((reason) => [reason.code, reason.label]),
  );
  const allApprovable =
    !hasOpenChangeRequest &&
    (posts ?? []).length > 0 &&
    (posts ?? []).every(
      (post) =>
        ['draft', 'in_review', 'approved', 'failed'].includes(post.status) &&
        quality(post.quality_report).blocking.length === 0 &&
        Boolean(quality(post.quality_report).critic?.auditedAt),
    );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <StatusPill value={socialPackage.risk_level} />
            <StatusPill value={socialPackage.status} />
          </div>
          <h1 className="mt-3 max-w-3xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {socialPackage.title}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {socialPackage.kind.replaceAll('_', ' ')} · generation{' '}
            {socialPackage.generation_version}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={approvePackageAction}>
            <input type="hidden" name="id" value={id} />
            <ActionSubmitButton
              idleLabel="Approve package"
              pendingLabel="Approving package…"
              disabled={!allApprovable}
              className="min-h-11 rounded-xl bg-[#47e4d3] px-4 text-sm font-bold text-[#0a2321] disabled:cursor-not-allowed disabled:opacity-40"
            />
          </form>
          <form action={cancelPackageAction}>
            <input type="hidden" name="id" value={id} />
            <ActionSubmitButton
              idleLabel="Cancel future posts"
              pendingLabel="Cancelling posts…"
              className="min-h-11 rounded-xl border border-red-400/30 px-4 text-sm font-bold text-red-200"
            />
          </form>
        </div>
      </div>

      {rationale ? (
        <section className="mt-8 rounded-3xl border border-violet-300/20 bg-violet-400/[.06] p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-bold tracking-[.15em] text-violet-200 uppercase">
                Why this Weekly Digest
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">Editorial rationale</h2>
            </div>
            <span className="text-xs text-violet-200/70">
              {selectionRun?.algorithm_version} · {rationale.version}
            </span>
          </div>
          <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-200">{rationale.summary}</p>
          <dl className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Selected',
                value: `${rationale.metrics.selectedCount}/${rationale.metrics.candidateCount}`,
              },
              {
                label: 'Passed gates',
                value: `${rationale.metrics.eligibleCount}`,
              },
              {
                label: 'Coverage',
                value: `${rationale.metrics.categoryCount} categories · ${rationale.metrics.sourceCount} sources`,
              },
              {
                label: 'Average score',
                value: `${rationale.metrics.averageScore.toFixed(1)}/100`,
              },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3"
              >
                <dt className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                  {metric.label}
                </dt>
                <dd className="mt-1 text-base font-bold text-white">{metric.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,.8fr)]">
            <ul className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
              {rationale.factors.map((factor) => (
                <li key={factor} className="rounded-xl border border-white/10 px-3 py-2">
                  {factor}
                </li>
              ))}
            </ul>
            <p className="rounded-xl border border-amber-300/15 bg-amber-300/[.05] p-3 text-sm leading-6 text-amber-100">
              <strong className="block text-xs tracking-wide uppercase">Trade-offs</strong>
              {rationale.tradeoffs}
            </p>
          </div>
        </section>
      ) : socialPackage.kind === 'weekly_digest' ? (
        <p className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/[.06] p-4 text-sm text-amber-100">
          Editorial rationale is unavailable for this digest. Generate a new selection run
          before approval if you need a reproducible explanation.
        </p>
      ) : null}

      {openChangeRequest ? (
        <section className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-300/[.08] p-4 sm:p-5">
          <p className="text-xs font-bold tracking-[.15em] text-amber-200 uppercase">
            Changes requested · approval blocked
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-50">{openChangeRequest.note}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {openChangeRequest.reason_codes.map((code) => (
              <span
                key={code}
                className="rounded-full border border-amber-200/20 px-2.5 py-1 text-xs text-amber-100"
              >
                {reviewReasonLabel.get(code) ?? code.replaceAll('_', ' ')}
              </span>
            ))}
          </div>
          <form
            action={addressWeeklyDigestChangesAction}
            className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
          >
            <input type="hidden" name="id" value={id} />
            <label className="grid gap-1 text-sm font-semibold text-amber-100">
              Resolution note
              <input
                name="resolution_note"
                maxLength={2000}
                placeholder="What changed, or why the current version is now acceptable"
                className="min-h-11 rounded-xl border border-amber-200/20 bg-black/20 px-3 text-white outline-none focus:border-amber-200/60"
              />
            </label>
            <ActionSubmitButton
              idleLabel="Mark changes addressed"
              pendingLabel="Saving resolution…"
              className="min-h-11 self-end rounded-xl bg-amber-200 px-4 text-sm font-bold text-amber-950"
            />
          </form>
        </section>
      ) : null}

      {editorialItems.length > 0 ? (
        <section className="mt-8 rounded-3xl border border-[#47e4d3]/20 bg-[#10201f] p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-bold tracking-[.15em] text-[#8af4e9] uppercase">
                Editorial shortlist
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">
                {editorialItems.length} quality-gated stories
              </h2>
            </div>
            <span className="text-xs text-slate-400">{editorialItems[0]?.version}</span>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Scores rank candidates; they do not replace editorial judgment. Open the source and
            verify the central claim before approving the package.
          </p>
          <ol className="mt-5 grid gap-3">
            {editorialItems.map((item) => (
              <li
                key={`${item.rank}-${item.title}`}
                className="rounded-2xl border border-white/10 bg-black/15 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#47e4d3] text-sm font-black text-[#0a2321]">
                    {item.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-white">{item.title}</h3>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-white">
                        {item.score.toFixed(1)}/100
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.impact} impact · {item.category.replaceAll('-', ' ')} ·{' '}
                      {item.citationCount} citation{item.citationCount === 1 ? '' : 's'}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {item.reasons.length > 0
                        ? item.reasons.join(' · ')
                        : 'Passed editorial gates'}
                    </p>
                    {item.sourceUrl ? (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm font-semibold text-[#8af4e9] underline decoration-[#47e4d3]/40 underline-offset-4"
                      >
                        Verify source · {item.sourceName}
                      </a>
                    ) : (
                      <span className="mt-2 block text-sm text-amber-200">
                        Source URL unavailable — do not approve yet
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {socialPackage.kind === 'weekly_digest' && editorialItems.length > 0 ? (
        <section className="mt-6 rounded-3xl border border-white/10 bg-[#151b20] p-4 sm:p-6">
          <div>
            <p className="text-xs font-bold tracking-[.15em] text-slate-400 uppercase">
              Editorial feedback
            </p>
            <h2 className="mt-1 text-xl font-bold text-white">Review decision and corrections</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Save structured reasons and story-level changes before approval. This feedback stays
              linked to the exact algorithm version, candidate pool, and digest snapshot.
            </p>
          </div>

          {!hasOpenChangeRequest ? (
            <details className="mt-5 rounded-2xl border border-white/10 bg-black/15">
              <summary className="cursor-pointer px-4 py-4 text-sm font-bold text-white marker:text-[#47e4d3]">
                Request changes to this Weekly Digest
              </summary>
              <form
                action={requestWeeklyDigestChangesAction}
                className="grid gap-6 border-t border-white/10 p-4 sm:p-5"
              >
                <input type="hidden" name="id" value={id} />
                <fieldset>
                  <legend className="text-sm font-bold text-white">
                    What needs attention? Select all that apply.
                  </legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {WEEKLY_REVIEW_REASONS.map((reason) => (
                      <label
                        key={reason.code}
                        className="flex cursor-pointer gap-3 rounded-xl border border-white/10 p-3 text-sm text-slate-300 hover:border-white/20"
                      >
                        <input
                          type="checkbox"
                          name="reason_codes"
                          value={reason.code}
                          className="mt-1 size-4 accent-[#47e4d3]"
                        />
                        <span>
                          <strong className="block text-white">{reason.label}</strong>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">
                            {reason.help}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="grid gap-2 text-sm font-bold text-white">
                  Editorial note
                  <textarea
                    name="review_note"
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={5}
                    placeholder="Explain what looks wrong, which story may be missing, and what should change."
                    className="rounded-2xl border border-white/15 bg-[#0c1014] p-4 leading-6 font-normal text-white outline-none focus:border-[#47e4d3]"
                  />
                </label>

                <fieldset>
                  <legend className="text-sm font-bold text-white">Selected story actions</legend>
                  <div className="mt-3 grid gap-3">
                    {editorialItems.map((item) => (
                      <div
                        key={item.briefItemId}
                        className="grid gap-3 rounded-2xl border border-white/10 p-3 lg:grid-cols-[minmax(0,1fr)_150px_100px_minmax(180px,.7fr)] lg:items-end"
                      >
                        <div>
                          <p className="text-xs font-bold text-[#8af4e9]">#{item.rank}</p>
                          <p className="mt-1 text-sm font-semibold text-white">{item.title}</p>
                        </div>
                        <label className="grid gap-1 text-xs font-bold text-slate-400">
                          Requested action
                          <select
                            name={`item_action_${item.briefItemId}`}
                            defaultValue="keep"
                            className="min-h-10 rounded-lg border border-white/15 bg-[#0c1014] px-2 text-sm text-white"
                          >
                            {WEEKLY_ITEM_REVIEW_ACTIONS.map((action) => (
                              <option key={action.code} value={action.code}>
                                {action.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-1 text-xs font-bold text-slate-400">
                          New rank
                          <input
                            type="number"
                            name={`item_rank_${item.briefItemId}`}
                            min={1}
                            max={7}
                            defaultValue={item.rank}
                            className="min-h-10 rounded-lg border border-white/15 bg-[#0c1014] px-2 text-sm text-white"
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-bold text-slate-400">
                          Story note
                          <input
                            name={`item_note_${item.briefItemId}`}
                            maxLength={1000}
                            placeholder="Optional detail"
                            className="min-h-10 rounded-lg border border-white/15 bg-[#0c1014] px-3 text-sm font-normal text-white"
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </fieldset>

                {alternatives.length > 0 ? (
                  <label className="grid gap-2 text-sm font-bold text-white">
                    Add missing eligible stories
                    <select
                      multiple
                      name="missing_item_ids"
                      size={Math.min(7, Math.max(3, alternatives.length))}
                      className="rounded-2xl border border-white/15 bg-[#0c1014] p-3 text-sm font-normal text-white"
                    >
                      {alternatives.map((candidate) => (
                        <option
                          key={candidate.briefItemId}
                          value={candidate.briefItemId}
                          className="py-1"
                        >
                          {candidate.score.toFixed(1)} · {candidate.title} ·{' '}
                          {candidate.category.replaceAll('-', ' ')} · {candidate.sourceName}
                          {candidate.exclusionReasons.length > 0
                            ? ` · omitted: ${candidate.exclusionReasons.join(', ')}`
                            : ''}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs leading-5 font-normal text-slate-500">
                      Ctrl/Cmd-click to choose more than one. Only candidates that passed all
                      quality gates are available here.
                    </span>
                  </label>
                ) : null}

                <ActionSubmitButton
                  idleLabel="Save change request"
                  pendingLabel="Saving editorial feedback…"
                  className="min-h-11 w-full rounded-xl bg-amber-200 px-4 text-sm font-bold text-amber-950 sm:w-fit"
                />
              </form>
            </details>
          ) : (
            <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[.04] p-3 text-sm text-amber-100">
              Address the open change request above before starting another review round.
            </p>
          )}

          {weeklyReviews.length > 0 ? (
            <div className="mt-6 border-t border-white/10 pt-5">
              <h3 className="text-sm font-bold text-white">Weekly review history</h3>
              <ol className="mt-3 grid gap-2">
                {weeklyReviews.map((review) => {
                  const reviewItems = weeklyReviewItemsByReview.get(review.id) ?? [];
                  return (
                    <li
                      key={review.id}
                      className="rounded-xl border border-white/10 px-3 py-3 text-sm text-slate-300"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <strong className="text-white capitalize">
                          {review.action.replaceAll('_', ' ')}
                        </strong>
                        <time className="text-xs text-slate-500">
                          {new Date(review.created_at).toLocaleString('uk-UA', {
                            timeZone: 'Europe/Kyiv',
                          })}
                        </time>
                      </div>
                      {review.reason_codes.length > 0 ? (
                        <p className="mt-1 text-xs text-slate-400">
                          {review.reason_codes
                            .map((code) => reviewReasonLabel.get(code) ?? code.replaceAll('_', ' '))
                            .join(' · ')}
                        </p>
                      ) : null}
                      {review.note ? <p className="mt-2 leading-6">{review.note}</p> : null}
                      {reviewItems.length > 0 ? (
                        <ul className="mt-3 grid gap-1.5 border-t border-white/10 pt-3">
                          {reviewItems.map((item) => (
                            <li key={item.id} className="text-xs leading-5 text-slate-400">
                              <strong className="text-slate-200 capitalize">
                                {item.action.replaceAll('_', ' ')}
                              </strong>{' '}
                              · {item.title}
                              {item.requestedRank !== null
                                ? ` · rank ${item.previousRank ?? '—'} → ${item.requestedRank}`
                                : ''}
                              {item.note ? ` · ${item.note}` : ''}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="mt-8 grid gap-6">
        {(posts ?? []).map((post) => {
          const report = quality(post.quality_report);
          const media = assets(post.asset_urls);
          const locked = ['publishing', 'posted', 'cancelled'].includes(post.status);
          const hasCurrentAudit = Boolean(report.critic?.auditedAt);
          return (
            <article
              key={post.id}
              className="overflow-hidden rounded-3xl border border-white/10 bg-[#151b20]"
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-4 sm:px-6">
                <h2 className="text-lg font-bold text-white capitalize">{post.channel}</h2>
                <StatusPill value={post.status} />
                <span className="ml-auto text-xs text-slate-500">v{post.content_version}</span>
              </div>
              <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.72fr)]">
                <form action={updateVariantAction} className="grid content-start gap-4">
                  <input type="hidden" name="id" value={post.id} />
                  <label className="grid gap-2 text-sm font-semibold text-slate-300">
                    Post copy
                    <textarea
                      name="post_text"
                      required
                      rows={Math.min(
                        18,
                        Math.max(7, Math.ceil((post.post_text?.length ?? 0) / 70)),
                      )}
                      defaultValue={post.post_text ?? ''}
                      disabled={locked}
                      className="rounded-2xl border border-white/15 bg-[#0c1014] p-4 text-base leading-6 text-white outline-none focus:border-[#47e4d3] disabled:opacity-60"
                    />
                  </label>
                  <div className="rounded-xl border border-white/10 bg-white/[.02] p-3 text-xs text-slate-400">
                    <strong className="block text-slate-300">Tracked link</strong>
                    <code className="mt-1 block break-all text-[#8af4e9]">
                      {withSocialClickToken(
                        post.utm_url || post.url || SITE_URL,
                        post.tracking_token,
                      )}
                    </code>
                    {post.channel === 'instagram' ? (
                      <span className="mt-1 block">
                        Use this as the temporary link-in-bio destination for post-level
                        attribution.
                      </span>
                    ) : null}
                  </div>
                  {post.channel === 'x' ? (
                    <label className="grid gap-2 text-sm font-semibold text-slate-300">
                      Self-reply
                      <textarea
                        name="first_comment"
                        rows={3}
                        defaultValue={post.first_comment ?? ''}
                        disabled={locked}
                        className="rounded-xl border border-white/15 bg-[#0c1014] p-3 text-white outline-none focus:border-[#47e4d3]"
                      />
                    </label>
                  ) : (
                    <input type="hidden" name="first_comment" value={post.first_comment ?? ''} />
                  )}
                  <label className="grid gap-2 text-sm font-semibold text-slate-300">
                    Alt text
                    <input
                      name="alt_text"
                      defaultValue={post.alt_text ?? ''}
                      disabled={locked}
                      className="min-h-11 rounded-xl border border-white/15 bg-[#0c1014] px-3 text-white outline-none focus:border-[#47e4d3]"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-300">
                    Schedule · Europe/Kyiv
                    <input
                      type="datetime-local"
                      name="scheduled_for"
                      required
                      defaultValue={kyivInput(post.scheduled_for)}
                      disabled={locked}
                      className="min-h-11 rounded-xl border border-white/15 bg-[#0c1014] px-3 text-white outline-none focus:border-[#47e4d3]"
                    />
                  </label>
                  {!locked ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <ActionSubmitButton
                        idleLabel="Save · revoke approval"
                        pendingLabel="Saving and auditing…"
                        className="min-h-11 rounded-xl border border-[#47e4d3]/40 px-4 text-sm font-bold text-[#8af4e9]"
                      />
                      <ActionSubmitButton
                        idleLabel="Regenerate selected"
                        pendingLabel="Regenerating and auditing…"
                        formAction={regenerateVariantAction}
                        className="min-h-11 rounded-xl border border-violet-400/30 px-4 text-sm font-bold text-violet-200"
                      />
                    </div>
                  ) : null}
                </form>

                <div className="min-w-0">
                  <p className="text-xs font-bold tracking-[.15em] text-slate-500 uppercase">
                    Platform preview
                  </p>
                  <div className="mt-3 rounded-2xl border border-white/10 bg-[#0b0f13] p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-full bg-[#47e4d3] font-black text-[#0a2321]">
                        AT
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">AI Today Brief</p>
                        <p className="text-xs text-slate-500 capitalize">{post.channel}</p>
                      </div>
                    </div>
                    <p className="text-sm leading-6 break-words whitespace-pre-wrap text-slate-200">
                      {post.post_text}
                    </p>
                    {media.length > 0 ? (
                      <div className={`mt-4 grid gap-2 ${media.length > 1 ? 'grid-cols-2' : ''}`}>
                        {media.map((url, index) => (
                          <Image
                            key={url}
                            src={url}
                            alt={post.alt_text ?? `Social asset ${index + 1}`}
                            width={post.channel === 'instagram' ? 540 : 600}
                            height={post.channel === 'instagram' ? 675 : 315}
                            className="h-auto w-full rounded-xl object-cover"
                            sizes="(max-width: 1024px) 90vw, 36vw"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-2">
                    {!hasCurrentAudit ? (
                      <p className="rounded-xl border border-red-400/25 bg-red-400/8 p-3 text-sm text-red-200">
                        Blocker: run the current-generation critic audit by saving or regenerating
                        this variant.
                      </p>
                    ) : null}
                    {report.blocking.map((item, index) => (
                      <p
                        key={`${item.code}-${index}`}
                        className="rounded-xl border border-red-400/25 bg-red-400/8 p-3 text-sm text-red-200"
                      >
                        Blocker: {item.message ?? item.code}
                      </p>
                    ))}
                    {report.warnings.map((item, index) => (
                      <p
                        key={`${item.code}-${index}`}
                        className="rounded-xl border border-amber-400/20 bg-amber-400/8 p-3 text-sm text-amber-100"
                      >
                        Review: {item.message ?? item.code}
                      </p>
                    ))}
                    {report.critic ? (
                      <div className="rounded-xl border border-white/10 p-3 text-sm text-slate-300">
                        Critic score:{' '}
                        <strong className="text-white">{report.critic.score ?? '—'}/100</strong>
                        {report.critic.provider || report.critic.model ? (
                          <span className="mt-1 block text-xs text-slate-500">
                            {[report.critic.provider, report.critic.model]
                              .filter(Boolean)
                              .join(' · ')}
                            {report.critic.fallbackUsed ? ' · fallback used' : ''}
                          </span>
                        ) : null}
                        {report.critic.flags?.map((flag) => (
                          <p key={flag} className="mt-1 text-amber-100">
                            • {flag}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {!locked && post.status !== 'approved' ? (
                    <form action={approvePostAction} className="mt-4">
                      <input type="hidden" name="id" value={post.id} />
                      <ActionSubmitButton
                        idleLabel="Approve this variant"
                        pendingLabel="Approving variant…"
                        disabled={report.blocking.length > 0 || !hasCurrentAudit}
                        className="min-h-11 w-full rounded-xl bg-white px-4 text-sm font-bold text-[#101418] disabled:opacity-40"
                      />
                    </form>
                  ) : null}
                  {post.channel === 'linkedin' && post.status !== 'posted' ? (
                    <a
                      href="https://www.linkedin.com/company/aitodaybrief/admin/page-posts/published/"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 block rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-bold text-slate-200"
                    >
                      Open LinkedIn native scheduler
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[.02] p-4">
        <h2 className="font-bold text-white">Audit trail</h2>
        <ol className="mt-3 grid gap-2 text-sm text-slate-400">
          {(reviews ?? []).map((review) => (
            <li
              key={review.id}
              className="flex flex-wrap justify-between gap-2 border-b border-white/5 py-2 last:border-0"
            >
              <span>
                <span className="capitalize">
                  {review.action.replaceAll('_', ' ')} · v{review.content_version}
                </span>
                {review.note ? (
                  <span className="mt-1 block text-xs text-slate-500">{review.note}</span>
                ) : null}
              </span>
              <time>
                {new Date(review.created_at).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}
              </time>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
