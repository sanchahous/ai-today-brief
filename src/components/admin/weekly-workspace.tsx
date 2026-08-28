import Image from 'next/image';
import Link from 'next/link';
import { ActionSubmitButton } from '@/components/admin/action-submit-button';
import { HookCandidatePicker } from '@/components/admin/hook-candidate-picker';
import { SocialCharCount } from '@/components/admin/social-char-count';
import { StatusPill } from '@/components/admin/status-pill';
import { StoryPromptSetPanel } from '@/components/admin/story-prompt-set-panel';
import { VideoShootPackPanel } from '@/components/admin/VideoShootPackPanel';
import { WeeklyGenerationJobsLive } from '@/components/admin/weekly-generation-jobs-live';
import { WeeklyReplacementUploadForm } from '@/components/admin/weekly-replacement-upload-form';
import { socialFormHas, socialCopyLimit, threadsPartLimit } from '@/lib/social/channel-form';
import { parseInstagramCarouselSpec } from '@/lib/social/instagram-carousel';
import type { SocialChannel } from '@/lib/social/types';
import type { SocialAdminSession } from '@/lib/admin-auth';
import type { Json } from '@/lib/database.types';
import { SITE_URL } from '@/lib/site';
import { scenesFromVideoScriptContent } from '@/lib/weekly-digest/video-script-content';
import { buildVideoShootPack } from '@/lib/weekly-digest/video-shoot-pack';
import { buildHallucinationBoard } from '@/lib/weekly-digest/hallucination-board';
import { qualityReportForbidsApprove } from '@/lib/weekly-digest/machine-attest';
import type {
  WeeklyArtifactAdminRow,
  WeeklyArtifactReviewAdminRow,
  WeeklyDigestWorkspace,
  WeeklyGenerationAttemptAdminRow,
  WeeklyGenerationEventAdminRow,
  WeeklyGenerationJobAdminRow,
  WeeklyRevisionAdminRow,
} from '@/lib/weekly-digest/admin-data';
import {
  WEEKLY_SOCIAL_MATRIX,
  groupWeeklyPreflightBlockers,
  type WeeklyArtifactType,
  type WeeklyPreflightArtifact,
  type WeeklyPreflightBlocker,
  type WeeklyPreflightSocial,
  type WeeklyPreflightTab,
  validateWeeklyDigestPreflight,
} from '@/lib/weekly-digest/preflight';
import { contentSimGateCleared, type ContentSimArtifactMeta } from '@/lib/content-sim';
import {
  parseStoryPromptSetContent,
  storyImageSlotState,
  storyPromptReadiness,
} from '@/lib/weekly-digest/story-prompt-set';
import { ownerFeedbackFromImageMetadata } from '@/lib/weekly-digest/owner-feedback';
import {
  evaluatePromptPromotionGate,
  promptPromotionStoriesFromArtifacts,
} from '@/lib/weekly-digest/prompt-promotion-gate';
import {
  adviceForPostUploadQa,
  parsePostUploadQa,
  formatPostUploadQaLine,
  postUploadQaNeedsWarning,
} from '@/lib/weekly-digest/post-upload-qa';
import {
  editorialVersionRole,
  type EditorialVersionRole,
} from '@/lib/weekly-digest/master-persist';
import { weeklyWorkspaceTabForArtifactType } from '@/lib/weekly-digest/workspace-tab';
import { qualityContentNeedsRepair } from '@/lib/weekly-digest/content-studio';
import { COVER_PROMPT_SLOT } from '@/lib/weekly-digest/story-prompt-job';
import { isWeeklyVisualRefreshStagedAsset } from '@/lib/weekly-digest/visual-refresh';

function contentSimClearedFromMetadata(metadata: Json | null | undefined): boolean | undefined {
  const root = asRecord(metadata);
  const raw = root.content_sim;
  if (raw === undefined || raw === null) return undefined;
  return contentSimGateCleared(raw as unknown as ContentSimArtifactMeta);
}
import {
  approveWeeklyDigestAction,
  applyWeeklyVisualRefreshAssetsAction,
  carryOverWeeklyQualityReportAction,
  commentWeeklyArtifactAction,
  commentWeeklySocialAction,
  createWeeklyVisualRefreshDraftAction,
  dispatchWeeklyMasterCliAction,
  enqueueWeeklyGenerationAction,
  pauseWeeklyDigestAction,
  postponeWeeklyDigestAction,
  rebuildWeeklySelectionAction,
  restoreWeeklyDigestRevisionAction,
  regenerateWeeklyMasterAction,
  useLatestWeeklyDigestRevisionAction,
  resumeWeeklyThreadsSequenceAction,
  reviewWeeklyArtifactAction,
  saveWeeklyRevisionAction,
  saveWeeklyVisualRefreshDirectionAction,
  saveWeeklySocialAction,
  saveWeeklyStoryDirectionAction,
  saveWeeklyVideoAction,
  scheduleWeeklyDigestAction,
  selectWeeklyArtifactVariantAction,
  startWeeklyContentStudioAction,
  shipWeeklyDigestAction,
  toggleWeeklySocialAction,
  ignorePostUploadQaAction,
  recheckPostUploadQaAction,
} from '@/app/admin/(cms)/weekly/actions';

export const WEEKLY_WORKSPACE_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'stories', label: 'Stories' },
  { id: 'research', label: 'Research' },
  { id: 'article', label: 'Article UK / EN' },
  { id: 'visuals', label: 'Visuals' },
  { id: 'social', label: 'Social' },
  { id: 'pdf', label: 'PDF' },
  { id: 'video', label: 'Video' },
  { id: 'release', label: 'Release' },
] as const;

export type WeeklyWorkspaceTab = (typeof WEEKLY_WORKSPACE_TABS)[number]['id'];

/** Job types shown on each workspace tab (Overview keeps a summary only). */
const GENERATION_JOB_TYPES_BY_TAB: Record<WeeklyWorkspaceTab, readonly string[]> = {
  overview: [],
  stories: [],
  research: ['research_pack', 'editorial_master'],
  article: ['editorial_master'],
  visuals: ['story_image', 'cover', 'social_asset'],
  social: ['social_copy'],
  pdf: ['pdf'],
  video: ['video_script', 'video_manifest'],
  release: [],
};

/** Primary tab for Overview counts — each job type counted once. */
const GENERATION_JOB_PRIMARY_TAB: Record<string, WeeklyWorkspaceTab> = {
  research_pack: 'research',
  editorial_master: 'article',
  story_image: 'visuals',
  cover: 'visuals',
  social_asset: 'visuals',
  social_copy: 'social',
  pdf: 'pdf',
  video_script: 'video',
  video_manifest: 'video',
};

const FIELD =
  'min-h-11 w-full rounded-xl border border-white/12 bg-black/20 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-[#47e4d3] focus:outline-none';
const TEXTAREA = `${FIELD} resize-y leading-6`;
const LABEL = 'grid gap-2 text-sm font-semibold text-slate-200';
const PANEL = 'rounded-2xl border border-white/10 bg-[#151b20] p-5';
const PRIMARY =
  'min-h-11 rounded-xl bg-[#47e4d3] px-4 text-sm font-bold text-[#08211f] transition hover:bg-[#75eee2]';
const SECONDARY =
  'min-h-11 rounded-xl border border-white/15 px-4 text-sm font-bold text-slate-200 transition hover:border-white/30 hover:bg-white/[.04]';
const DANGER =
  'min-h-11 rounded-xl border border-red-400/30 bg-red-400/8 px-4 text-sm font-bold text-red-200 transition hover:bg-red-400/15';

/** Release-gate types only. `story_prompt_set` is text and is not a preflight artifact. */
const ARTIFACT_TYPES = new Set<WeeklyArtifactType>([
  'research_pack',
  'content_quality_report',
  'article',
  'pdf',
  'cover',
  'story_image',
  'video_script',
  'video_manifest',
  'video_preview',
  'video_final',
  'captions',
  'thumbnail',
  'heygen_preview',
  'graphics_preview',
  'social_asset',
]);

function asRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

/** Overall plus semantic/craft dims so a naked 100 is not read as editorial OK. */
function formatVariantScoreChip(score: {
  overall: number;
  passed: boolean;
  news_legibility?: number;
  craft?: number;
  semantic_min?: number;
}): string {
  const head = score.passed
    ? `pass ${Math.round(score.overall)}`
    : `score ${Math.round(score.overall)}`;
  const dims: string[] = [];
  if (typeof score.semantic_min === 'number') {
    dims.push(`semantic ${Math.round(score.semantic_min)}`);
  }
  if (typeof score.news_legibility === 'number') {
    dims.push(`news ${Math.round(score.news_legibility)}`);
  }
  if (typeof score.craft === 'number') {
    dims.push(`craft ${Math.round(score.craft)}`);
  }
  return dims.length ? `${head} · ${dims.join(' · ')}` : head;
}

function textFrom(value: Json | null | undefined, ...keys: string[]) {
  const object = asRecord(value);
  for (const key of keys) {
    const candidate = object[key];
    if (typeof candidate === 'string') return candidate;
  }
  return '';
}

function jsonText(value: Json | null | undefined, fallback = '[]') {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return fallback;
  }
}

function listFrom(value: Json | null | undefined, key: string) {
  const candidate = asRecord(value)[key];
  if (!Array.isArray(candidate)) return [];
  return candidate.filter((item): item is string => typeof item === 'string');
}

function kyivDate(value: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
}

function isActiveGenerationJob(status: string) {
  return status === 'queued' || status === 'running';
}

function GenerationJobsSection({
  digestId,
  revisionId,
  jobs,
  attempts,
  events,
  tab,
}: {
  digestId: string;
  revisionId: string | null;
  jobs: WeeklyGenerationJobAdminRow[];
  attempts: WeeklyGenerationAttemptAdminRow[];
  events: WeeklyGenerationEventAdminRow[];
  tab: WeeklyWorkspaceTab;
}) {
  const tabJobTypes = GENERATION_JOB_TYPES_BY_TAB[tab];
  if (tabJobTypes.length === 0) return null;

  const headingId = `jobs-${tab}-heading`;
  // Every one of the 6 tabs that render this section received the digest's
  // *entire* jobs/attempts/events history unfiltered, even though each tab
  // only ever displays one or two job_types. On a busy digest that pushed the
  // per-tab RSC payload to ~1.3 MB (vs ~80 KB for a tab without this section)
  // and froze the browser while it parsed/hydrated the duplicate data on
  // every tab click. Scoping to this tab's job_types before it ever reaches
  // the client component fixes that at the source.
  const allowedJobTypes = new Set(tabJobTypes);
  const scopedJobs = jobs.filter((job) => allowedJobTypes.has(job.job_type));
  const scopedJobIds = new Set(scopedJobs.map((job) => job.id));
  const scopedAttempts = attempts.filter((attempt) => scopedJobIds.has(attempt.job_id));
  const scopedEvents = events.filter((event) => scopedJobIds.has(event.job_id));

  return (
    <section className={PANEL} aria-labelledby={headingId}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id={headingId} className="text-lg font-bold text-white">
          Generation jobs
        </h2>
        <span className="text-xs font-semibold text-slate-500">{tabJobTypes.join(' · ')}</span>
      </div>
      <WeeklyGenerationJobsLive
        digestId={digestId}
        revisionId={revisionId}
        jobTypes={tabJobTypes}
        initialJobs={scopedJobs}
        initialAttempts={scopedAttempts}
        initialEvents={scopedEvents}
      />
    </section>
  );
}

function GenerationJobsOverviewSummary({
  digestId,
  jobs,
}: {
  digestId: string;
  jobs: WeeklyGenerationJobAdminRow[];
}) {
  const byTab = new Map<WeeklyWorkspaceTab, { total: number; active: number; failed: number }>();
  for (const tab of WEEKLY_WORKSPACE_TABS) {
    if (GENERATION_JOB_TYPES_BY_TAB[tab.id].length === 0) continue;
    byTab.set(tab.id, { total: 0, active: 0, failed: 0 });
  }
  for (const job of jobs) {
    const tab = GENERATION_JOB_PRIMARY_TAB[job.job_type];
    if (!tab) continue;
    const bucket = byTab.get(tab);
    if (!bucket) continue;
    bucket.total += 1;
    if (isActiveGenerationJob(job.status)) bucket.active += 1;
    if (job.status === 'failed') bucket.failed += 1;
  }

  const rows = WEEKLY_WORKSPACE_TABS.flatMap((tab) => {
    const stats = byTab.get(tab.id);
    if (!stats) return [];
    return [{ tab, ...stats }];
  });

  return (
    <section className={PANEL} aria-labelledby="jobs-summary-heading">
      <h2 id="jobs-summary-heading" className="text-lg font-bold text-white">
        Generation jobs by tab
      </h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Full job history lives on each workspace tab — open the tab to see only its job types.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="text-xs font-bold tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="pb-3">Tab</th>
              <th className="pb-3">Jobs</th>
              <th className="pb-3">Active</th>
              <th className="pb-3">Failed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {rows.map(({ tab, total, active, failed }) => (
              <tr key={tab.id}>
                <td className="py-3">
                  <a
                    href={`/admin/weekly/${encodeURIComponent(digestId)}?tab=${tab.id}`}
                    className="font-semibold text-[#47e4d3] underline decoration-[#47e4d3]/40 underline-offset-4"
                  >
                    {tab.label}
                  </a>
                </td>
                <td className="py-3 text-slate-300">{total}</td>
                <td className="py-3 text-slate-300">{active}</td>
                <td
                  className={`py-3 ${failed > 0 ? 'font-semibold text-red-200' : 'text-slate-300'}`}
                >
                  {failed}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function kyivDateTime(value: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function localDateTimeInput(value: string | null) {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

function artifactFor(
  artifacts: WeeklyArtifactAdminRow[],
  artifactType: string,
  locale?: string,
  revisionItemId?: string,
) {
  return artifacts.find(
    (artifact) =>
      artifact.artifact_type === artifactType &&
      (locale === undefined || artifact.locale === locale) &&
      (revisionItemId === undefined || artifact.revision_item_id === revisionItemId),
  );
}

function promptPromotionClass(result: { passed: boolean; ready: boolean }): string {
  if (result.passed) return 'text-cyan-100/90';
  if (result.ready) return 'text-amber-100/90';
  return 'text-slate-400';
}

/** Most recent job for a Visuals/PDF slot (jobs are ordered newest-first in admin data). */
function latestJobForSlot(
  jobs: WeeklyGenerationJobAdminRow[],
  jobType: string,
  opts?: { slotKey?: string | null; revisionItemId?: string | null },
) {
  return (
    jobs.find((job) => {
      if (job.job_type !== jobType) return false;
      if (opts?.revisionItemId) {
        return textFrom(job.input, 'revision_item_id') === opts.revisionItemId;
      }
      if (opts?.slotKey) {
        return textFrom(job.input, 'slot_key') === opts.slotKey;
      }
      return true;
    }) ?? null
  );
}

function researchArtifactFor(
  artifacts: WeeklyArtifactAdminRow[],
  item: { id: string; source_snapshot: Json },
) {
  const direct = artifactFor(artifacts, 'research_pack', undefined, item.id);
  if (direct) return direct;
  const contentStudio = asRecord(asRecord(item.source_snapshot).content_studio);
  const provenanceId = contentStudio.research_artifact_id;
  return typeof provenanceId === 'string'
    ? artifacts.find(
        (artifact) => artifact.id === provenanceId && artifact.artifact_type === 'research_pack',
      )
    : undefined;
}

function latestReviews(reviews: WeeklyArtifactReviewAdminRow[], artifactId: string, limit = 3) {
  return reviews.filter((review) => review.artifact_id === artifactId).slice(0, limit);
}

function channelLabel(channel: string) {
  if (channel === 'x') return 'X';
  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

function qualityReport(value: Json) {
  const object = asRecord(value);
  const blocking = Array.isArray(object.blocking) ? object.blocking : [];
  const warnings = Array.isArray(object.warnings) ? object.warnings : [];
  const items = [...blocking, ...warnings]
    .map((item, index) => {
      const record = asRecord(item);
      return typeof record.message === 'string'
        ? {
            key: `${typeof record.code === 'string' ? record.code : 'quality'}-${index}`,
            code: typeof record.code === 'string' ? record.code : null,
            blocking: index < blocking.length,
            message: record.message,
            span: typeof record.span === 'string' ? record.span : null,
            suggestedFix: typeof record.suggestedFix === 'string' ? record.suggestedFix : null,
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  return { blocking: blocking.length, warnings: warnings.length, items };
}

function cleanWeeklyDestinationUrl(locale: string, slug: string, utmUrl: string | null): string {
  if (utmUrl) {
    try {
      const parsed = new URL(utmUrl);
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    } catch {
      // Fall through to slug-based weekly URL.
    }
  }
  return new URL(`/${locale}/weekly/${slug}`, SITE_URL).toString();
}

function formatBytes(value: number | null) {
  if (value === null) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

const PREFLIGHT_TAB_LABEL: Record<WeeklyPreflightTab, string> = {
  overview: 'Overview',
  stories: 'Stories',
  research: 'Research',
  article: 'Article UK / EN',
  visuals: 'Visuals',
  social: 'Social',
  pdf: 'PDF',
  video: 'Video',
  release: 'Release',
};

function PreflightBlockerList({
  digestId,
  blockers,
  storyIds = [],
  compact = false,
}: {
  digestId: string;
  blockers: WeeklyPreflightBlocker[];
  storyIds?: string[];
  compact?: boolean;
}) {
  const groups = groupWeeklyPreflightBlockers(blockers, storyIds);
  const path = groups.map((group) => `${group.section.step}. ${group.section.title}`).join(' → ');

  return (
    <div className="grid min-w-0 gap-4">
      <p className={`leading-5 text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}>
        Work top → bottom along the release path
        {path ? (
          <>
            : <span className="font-semibold text-slate-300">{path}</span>
          </>
        ) : null}
        . Inside each section, clear items in listed order.
      </p>
      {groups.map((group) => (
        <section
          key={group.section.tab}
          className="min-w-0 rounded-xl border border-amber-400/15 bg-black/15 p-3"
          aria-labelledby={`preflight-section-${group.section.tab}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold tracking-wide text-amber-200/70 uppercase">
                Step {group.section.step} of 8
              </p>
              <h3
                id={`preflight-section-${group.section.tab}`}
                className={`mt-0.5 font-bold text-amber-50 ${compact ? 'text-sm' : 'text-base'}`}
              >
                {group.section.title}
                <span className="ml-2 text-xs font-semibold text-amber-200/60">
                  {group.blockers.length} gate{group.blockers.length === 1 ? '' : 's'}
                </span>
              </h3>
              <p className="mt-1 text-xs leading-5 text-amber-100/55">{group.section.blurb}</p>
            </div>
            <a
              href={`/admin/weekly/${encodeURIComponent(digestId)}?tab=${group.section.tab}`}
              className="inline-flex shrink-0 text-xs font-bold text-cyan-300 underline hover:text-cyan-200"
            >
              Open {PREFLIGHT_TAB_LABEL[group.section.tab]} →
            </a>
          </div>
          <ol className="mt-3 grid min-w-0 gap-2">
            {group.blockers.map((blocker, index) => (
              <li
                key={`${blocker.slot}:${blocker.code}`}
                className="min-w-0 rounded-lg border border-amber-400/20 bg-amber-400/6 px-3 py-2.5 text-amber-100"
              >
                <p className={`break-words ${compact ? 'text-sm font-bold' : 'text-sm'}`}>
                  <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-amber-300/15 text-[11px] font-bold text-amber-100">
                    {index + 1}
                  </span>
                  <span className="font-bold">{blocker.slot}</span>
                  <span className="text-amber-100/75"> — {blocker.message}</span>
                </p>
                <p
                  className={`mt-1.5 leading-5 text-amber-100/70 ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}
                >
                  {blocker.fix}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function ArtifactReview({
  digestId,
  artifact,
  reviews,
  canReview,
}: {
  digestId: string;
  artifact: WeeklyArtifactAdminRow;
  reviews: WeeklyArtifactReviewAdminRow[];
  canReview: boolean;
}) {
  const history = latestReviews(reviews, artifact.id);
  const alreadyApproved = artifact.review_status === 'approved';
  const workspaceTab = weeklyWorkspaceTabForArtifactType(artifact.artifact_type);

  return (
    <div className="mt-4 border-t border-white/8 pt-4">
      {history.length > 0 ? (
        <details className="mb-4 text-sm text-slate-400">
          <summary className="font-semibold text-slate-300">
            Review history ({history.length}
            {reviews.filter((review) => review.artifact_id === artifact.id).length > history.length
              ? '+'
              : ''}
            )
          </summary>
          <ol className="mt-3 grid gap-2 border-l border-white/10 pl-4">
            {history.map((review) => (
              <li key={review.id}>
                <span className="font-semibold text-slate-200">
                  {review.action.replaceAll('_', ' ')}
                </span>
                {review.note ? ` — ${review.note}` : ''}
                <span className="ml-2 text-xs text-slate-600">
                  {kyivDateTime(review.created_at)}
                </span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {canReview ? (
        <form action={reviewWeeklyArtifactAction} className="grid gap-3">
          <input type="hidden" name="weekly_digest_id" value={digestId} />
          <input type="hidden" name="workspace_tab" value={workspaceTab} />
          <input type="hidden" name="artifact_id" value={artifact.id} />
          <input type="hidden" name="artifact_version" value={artifact.version} />
          <input type="hidden" name="artifact_input_hash" value={artifact.input_hash} />
          <label className={LABEL}>
            Review note
            <textarea
              name="note"
              rows={2}
              maxLength={2000}
              className={TEXTAREA}
              placeholder="What is approved, or what needs to change?"
            />
          </label>
          {artifact.artifact_type === 'content_quality_report' &&
          qualityReportForbidsApprove(artifact.content) ? (
            <p className="text-sm text-rose-200">
              Approve is blocked until language and other blocking issues are empty. Click{' '}
              <span className="font-semibold">Fix remaining issues</span> above to run another
              writer/critic pass, or Request changes if the remaining items are editorial.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {alreadyApproved ? (
              <p className="self-center text-xs font-semibold text-emerald-200">Approved</p>
            ) : (
              <ActionSubmitButton
                name="decision"
                value="approved"
                idleLabel="Approve version"
                pendingLabel="Approving…"
                className={PRIMARY}
                disabled={
                  artifact.artifact_type === 'content_quality_report' &&
                  qualityReportForbidsApprove(artifact.content)
                }
              />
            )}
            <ActionSubmitButton
              name="decision"
              value="changes_requested"
              idleLabel="Request changes"
              pendingLabel="Saving request…"
              className={SECONDARY}
            />
          </div>
        </form>
      ) : (
        <p className="text-xs text-slate-500">
          Artifact decisions require an owner. Editors can revise the source content, and analysts
          retain read-only access.
        </p>
      )}
      <form action={commentWeeklyArtifactAction} className="mt-4 grid gap-2">
        <input type="hidden" name="weekly_digest_id" value={digestId} />
        <input type="hidden" name="workspace_tab" value={workspaceTab} />
        <input type="hidden" name="artifact_id" value={artifact.id} />
        <label className={LABEL}>
          Add comment
          <textarea
            name="note"
            rows={2}
            required
            maxLength={2000}
            className={TEXTAREA}
            placeholder="Question, observation, or non-blocking feedback"
          />
        </label>
        <ActionSubmitButton idleLabel="Comment" pendingLabel="Commenting…" className={SECONDARY} />
      </form>
    </div>
  );
}

function ArtifactCard({
  digestId,
  artifact,
  reviews,
  canReview,
  label,
  imagePreview = false,
  variantSelection,
}: {
  digestId: string;
  artifact: WeeklyArtifactAdminRow | undefined;
  reviews: WeeklyArtifactReviewAdminRow[];
  canReview: boolean;
  label: string;
  imagePreview?: boolean;
  /**
   * story_image only (PR5): enables the variant thumbnail strip (promote an
   * alternate render to primary) and the "edit scene, regenerate" form.
   * Requires the caller's own edit permission -- passed separately as
   * `canEdit` below rather than reusing `canReview`, since promoting a
   * variant is an editing action, not an approval one (same permission
   * class as ReplacementAssetForm).
   */
  variantSelection?: {
    canEdit: boolean;
    revisionId: string;
    revisionItemId: string;
    slotKey: string;
    costSummary?: {
      totalUsd: number;
      renderUsd: number;
      visionUsd: number;
      legacyUsd: number;
      eventCount: number;
      jobCount: number;
    };
  };
}) {
  if (!artifact) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-black/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-white">{label}</h3>
          <StatusPill value="draft" />
        </div>
        <p className="mt-3 text-sm text-slate-500">No current artifact has been created.</p>
      </div>
    );
  }

  const previewUrls = listFrom(artifact.content, 'preview_urls');
  const artifactContent = asRecord(artifact.content);
  const artifactWarnings = listFrom(artifact.metadata, 'warnings');
  const artifactMetadata = asRecord(artifact.metadata);
  const estimatedCost =
    typeof artifactMetadata.estimated_cost_usd === 'number'
      ? artifactMetadata.estimated_cost_usd
      : null;
  const failedChecks = Object.entries(asRecord(asRecord(artifact.metadata).checks))
    .filter(([, passed]) => passed === false)
    .map(([check]) => check);
  const previewUrl =
    imagePreview && artifact.external_url
      ? artifact.external_url
      : imagePreview
        ? previewUrls[0]
        : undefined;
  const illustrationScene =
    typeof artifactMetadata.scene === 'string' ? artifactMetadata.scene : null;
  const illustrationPositive =
    typeof artifactMetadata.positive_prompt === 'string' ? artifactMetadata.positive_prompt : null;
  const illustrationNegative =
    typeof artifactMetadata.negative_prompt === 'string' ? artifactMetadata.negative_prompt : null;
  const illustrationSceneSource =
    typeof artifactMetadata.scene_source === 'string' ? artifactMetadata.scene_source : null;
  const illustrationSemanticContract = [
    ['Context', artifactMetadata.story_context],
    ['Meaning', artifactMetadata.meaning],
    ['Mechanism', artifactMetadata.mechanism],
    ['Consequence', artifactMetadata.consequence],
    ['Visual thesis', artifactMetadata.visual_thesis],
  ].filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  const alternateVariantPaths = variantSelection ? listFrom(artifact.content, 'preview_paths') : [];
  const alternateVariantUrls = variantSelection ? previewUrls : [];
  const variantScoresRaw = Array.isArray(artifactMetadata.variant_scores)
    ? artifactMetadata.variant_scores
    : [];
  const variantScoreByIndex = new Map<
    number,
    {
      overall: number;
      blockers: string[];
      passed: boolean;
      news_legibility?: number;
      craft?: number;
      semantic_min?: number;
    }
  >();
  for (const entry of variantScoresRaw) {
    const row = asRecord(entry);
    const index = typeof row.index === 'number' ? row.index : null;
    if (index === null) continue;
    const blockers = Array.isArray(row.blockers)
      ? row.blockers.filter((b): b is string => typeof b === 'string')
      : [];
    variantScoreByIndex.set(index, {
      overall: typeof row.overall === 'number' ? row.overall : 0,
      blockers,
      passed: row.passed === true,
      news_legibility: typeof row.news_legibility === 'number' ? row.news_legibility : undefined,
      craft: typeof row.craft === 'number' ? row.craft : undefined,
      semantic_min: typeof row.semantic_min === 'number' ? row.semantic_min : undefined,
    });
  }
  const variantConceptsRaw = Array.isArray(artifactMetadata.variant_concepts)
    ? artifactMetadata.variant_concepts
    : [];
  const variantConceptByIndex = new Map<
    number,
    {
      lens: string | null;
      title: string | null;
      scene: string | null;
      source: string | null;
    }
  >();
  for (const entry of variantConceptsRaw) {
    const row = asRecord(entry);
    const index = typeof row.index === 'number' ? row.index : null;
    if (index === null) continue;
    variantConceptByIndex.set(index, {
      lens: typeof row.concept_lens === 'string' ? row.concept_lens : null,
      title: typeof row.metaphor_title === 'string' ? row.metaphor_title : null,
      scene: typeof row.scene === 'string' ? row.scene : null,
      source: typeof row.scene_source === 'string' ? row.scene_source : null,
    });
  }
  const pickSource =
    artifactMetadata.pick_source === 'owner'
      ? 'owner'
      : artifactMetadata.pick_source === 'auto'
        ? 'auto'
        : null;
  const primaryVariantScore = variantScoreByIndex.get(0);
  const primaryVariantConcept = variantConceptByIndex.get(0);
  const iterationPreviewRows = Array.isArray(artifactContent.iteration_previews)
    ? artifactContent.iteration_previews.flatMap((entry) => {
        const row = asRecord(entry);
        const previewUrl = typeof row.preview_url === 'string' ? row.preview_url : null;
        if (!previewUrl) return [];
        const score = asRecord(row.score);
        const scoreMeta =
          typeof score.overall === 'number'
            ? {
                overall: score.overall,
                blockers: Array.isArray(score.blockers)
                  ? score.blockers.filter((value): value is string => typeof value === 'string')
                  : [],
                passed: score.passed === true,
                news_legibility:
                  typeof score.news_legibility === 'number' ? score.news_legibility : undefined,
                craft: typeof score.craft === 'number' ? score.craft : undefined,
                semantic_min:
                  typeof score.semantic_min === 'number' ? score.semantic_min : undefined,
              }
            : null;
        return [
          {
            previewUrl,
            attempt: typeof row.attempt === 'number' ? row.attempt : null,
            variantIndex: typeof row.variant_index === 'number' ? row.variant_index : null,
            label: typeof row.label === 'string' ? row.label : 'Unlabelled render',
            lens: typeof row.concept_lens === 'string' ? row.concept_lens : null,
            title: typeof row.metaphor_title === 'string' ? row.metaphor_title : null,
            motif: typeof row.motif_class === 'string' ? row.motif_class : null,
            scene: typeof row.scene === 'string' ? row.scene : null,
            attemptCostUsd: typeof row.attempt_cost_usd === 'number' ? row.attempt_cost_usd : null,
            score: scoreMeta,
            critiquePassed: row.critique_passed === true,
          },
        ];
      })
    : [];
  const contentSim = asRecord(artifactMetadata.content_sim);
  const contentSimOutcome = typeof contentSim.outcome === 'string' ? contentSim.outcome : null;
  const contentSimPassed = contentSim.passed === true || contentSim.human_override === true;
  const contentSimEscalation = asRecord(contentSim.escalation);
  const contentSimSummary =
    typeof contentSimEscalation.summary === 'string' ? contentSimEscalation.summary : null;
  const contentSimBlockers = Array.isArray(contentSimEscalation.blockers)
    ? contentSimEscalation.blockers
    : Array.isArray(contentSim.blockers)
      ? contentSim.blockers
      : [];
  const contentSimActions = Array.isArray(contentSimEscalation.suggestedActions)
    ? contentSimEscalation.suggestedActions
    : Array.isArray(contentSimEscalation.suggested_actions)
      ? contentSimEscalation.suggested_actions
      : [];
  const postUploadQa = parsePostUploadQa(artifact.metadata);
  const postUploadQaLine = postUploadQa ? formatPostUploadQaLine(postUploadQa) : null;
  const postUploadAdvice = postUploadQa ? adviceForPostUploadQa(postUploadQa) : [];

  return (
    <article className="rounded-2xl border border-white/10 bg-black/10 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto font-bold text-white">{label}</h3>
        <StatusPill value={artifact.generation_status} />
        <StatusPill value={artifact.review_status} />
      </div>

      {previewUrl ? (
        <div className="relative mt-4 aspect-[16/9] overflow-hidden rounded-xl border border-white/10 bg-black">
          <Image
            key={`${artifact.id}:${artifact.version}:${previewUrl}`}
            src={previewUrl}
            alt={
              textFrom(artifact.content, 'alt_text', 'alt', 'alt_en', 'alt_uk') ||
              `${label} preview`
            }
            fill
            sizes="(max-width: 768px) 100vw, 520px"
            unoptimized
            className="object-cover"
          />
          {pickSource || primaryVariantScore ? (
            <div className="absolute top-2 left-2 flex flex-wrap gap-1">
              {pickSource ? (
                <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold tracking-wide text-cyan-200 uppercase">
                  {pickSource === 'owner' ? 'owner-promoted' : 'auto-picked'}
                </span>
              ) : null}
              {primaryVariantScore ? (
                <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                  {formatVariantScoreChip(primaryVariantScore)}
                </span>
              ) : null}
              {primaryVariantConcept?.lens ? (
                <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-200 uppercase">
                  {primaryVariantConcept.lens.replaceAll('_', ' ')}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {variantSelection && alternateVariantUrls.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {alternateVariantUrls.map((url, index) => {
            const path = alternateVariantPaths[index];
            if (!path) return null;
            // Alternate #i maps to variant_scores index i+1 (0 = primary).
            const scoreMeta = variantScoreByIndex.get(index + 1);
            const conceptMeta = variantConceptByIndex.get(index + 1);
            return (
              <form key={path} action={selectWeeklyArtifactVariantAction}>
                <input type="hidden" name="weekly_digest_id" value={digestId} />
                <input type="hidden" name="revision_id" value={variantSelection.revisionId} />
                <input type="hidden" name="artifact_id" value={artifact.id} />
                <input type="hidden" name="variant_path" value={path} />
                <button
                  type="submit"
                  disabled={!variantSelection.canEdit}
                  className="group relative block aspect-[16/9] w-full overflow-hidden rounded-lg border border-white/10 hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Image
                    src={url}
                    alt={`Alternate render ${index + 1}`}
                    fill
                    sizes="160px"
                    unoptimized
                    className="object-cover"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-4 pb-1 text-left">
                    {scoreMeta ? (
                      <>
                        <span className="block text-[10px] font-bold text-white">
                          {formatVariantScoreChip(scoreMeta)}
                        </span>
                        <span className="block truncate text-[9px] text-slate-300">
                          {conceptMeta?.title ||
                            conceptMeta?.lens?.replaceAll('_', ' ') ||
                            (scoreMeta.blockers.length
                              ? scoreMeta.blockers.slice(0, 2).join(', ')
                              : 'pass')}
                        </span>
                      </>
                    ) : (
                      <span className="block text-[10px] text-slate-400">alt {index + 1}</span>
                    )}
                  </span>
                  {variantSelection.canEdit ? (
                    <span className="absolute inset-0 hidden items-center justify-center bg-black/55 text-xs font-bold text-white group-hover:flex">
                      Use this
                    </span>
                  ) : null}
                </button>
              </form>
            );
          })}
        </div>
      ) : null}

      {variantSelection && iterationPreviewRows.length > 0 ? (
        <details className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[.03] p-3" open>
          <summary className="cursor-pointer text-xs font-bold tracking-wide text-amber-200 uppercase">
            Generation history · {iterationPreviewRows.length} rendered versions
          </summary>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Every rendered concept from every repair round is retained here until this artifact is
            approved. Failed scores remain visible; approval keeps only the selected primary.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {iterationPreviewRows.map((row, index) => (
              <div
                key={`${row.previewUrl}:${index}`}
                className="overflow-hidden rounded-lg border border-white/10 bg-black/30"
              >
                <div className="relative aspect-[16/9]">
                  <Image
                    src={row.previewUrl}
                    alt={`${row.label}, generation ${row.attempt ?? '?'}`}
                    fill
                    sizes="(max-width: 768px) 50vw, 220px"
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <div className="grid gap-1 p-2 text-[11px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-slate-200">{row.label}</span>
                    {row.attempt !== null ? (
                      <span className="text-slate-500">round {row.attempt}</span>
                    ) : null}
                    {row.variantIndex !== null ? (
                      <span className="text-slate-500">variant {row.variantIndex + 1}</span>
                    ) : null}
                    {row.attemptCostUsd !== null ? (
                      <span className="text-slate-500">${row.attemptCostUsd.toFixed(4)} run</span>
                    ) : null}
                  </div>
                  {row.score ? (
                    <span className={row.score.passed ? 'text-emerald-300' : 'text-rose-300'}>
                      {formatVariantScoreChip(row.score)}
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      {row.critiquePassed ? 'vision pass' : 'not scored'}
                    </span>
                  )}
                  {row.lens || row.motif ? (
                    <span className="truncate text-slate-400">
                      {[row.lens?.replaceAll('_', ' '), row.motif].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                  {row.scene ? (
                    <span className="line-clamp-3 text-slate-500">{row.scene}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {imagePreview && illustrationScene ? (
        <details className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <summary className="cursor-pointer text-xs font-bold text-cyan-200">
            Illustration prompt
            {illustrationSceneSource ? ` · ${illustrationSceneSource}` : ''}
          </summary>
          <div className="mt-3 grid gap-3 text-xs text-slate-300">
            {variantConceptByIndex.size > 1 ? (
              <div className="grid gap-2 rounded-lg border border-amber-300/15 bg-amber-300/[.03] p-2">
                <p className="font-bold tracking-wide text-amber-200 uppercase">
                  Three independent concepts
                </p>
                {[...variantConceptByIndex.entries()]
                  .sort(([left], [right]) => left - right)
                  .map(([index, concept]) => (
                    <div key={index}>
                      <p className="font-bold text-slate-200">
                        {index + 1}.{' '}
                        {concept.title || concept.lens?.replaceAll('_', ' ') || 'Concept'}
                      </p>
                      {concept.scene ? (
                        <p className="mt-0.5 text-slate-400">{concept.scene}</p>
                      ) : null}
                    </div>
                  ))}
              </div>
            ) : null}
            {illustrationSemanticContract.length ? (
              <div className="grid gap-2 rounded-lg border border-cyan-300/15 bg-cyan-300/[.03] p-2">
                {illustrationSemanticContract.map(([name, value]) => (
                  <div key={name}>
                    <p className="font-bold tracking-wide text-slate-500 uppercase">{name}</p>
                    <p className="mt-0.5 text-slate-200">{value}</p>
                  </div>
                ))}
              </div>
            ) : null}
            <div>
              <p className="font-bold tracking-wide text-slate-500 uppercase">Scene</p>
              <p className="mt-1 font-mono whitespace-pre-wrap text-slate-200">
                {illustrationScene}
              </p>
            </div>
            {illustrationPositive ? (
              <div>
                <p className="font-bold tracking-wide text-slate-500 uppercase">Positive</p>
                <p className="mt-1 font-mono whitespace-pre-wrap text-slate-200">
                  {illustrationPositive}
                </p>
              </div>
            ) : null}
            {illustrationNegative ? (
              <div>
                <p className="font-bold tracking-wide text-slate-500 uppercase">Negative</p>
                <p className="mt-1 font-mono whitespace-pre-wrap text-slate-200">
                  {illustrationNegative}
                </p>
              </div>
            ) : null}
            {variantSelection ? (
              <form
                action={enqueueWeeklyGenerationAction}
                className="grid gap-2 border-t border-white/10 pt-3"
              >
                <input type="hidden" name="weekly_digest_id" value={digestId} />
                <input type="hidden" name="revision_id" value={variantSelection.revisionId} />
                <input type="hidden" name="job_type" value="story_image" />
                <input type="hidden" name="locale" value="neutral" />
                <input type="hidden" name="slot_key" value={variantSelection.slotKey} />
                <input
                  type="hidden"
                  name="revision_item_id"
                  value={variantSelection.revisionItemId}
                />
                <label className="grid gap-1 text-xs font-bold text-slate-300">
                  Edit direction (kept as concept 1; concepts 2–3 stay independent)
                  <textarea
                    name="scene_override"
                    rows={2}
                    maxLength={400}
                    disabled={!variantSelection.canEdit}
                    defaultValue={illustrationScene ?? ''}
                    className="rounded-lg border border-white/15 bg-black/30 p-2 font-mono text-xs text-slate-200"
                  />
                </label>
                <ActionSubmitButton
                  idleLabel="Regenerate with this scene"
                  pendingLabel="Queueing…"
                  disabled={!variantSelection.canEdit}
                  className={SECONDARY}
                />
              </form>
            ) : null}
          </div>
        </details>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="font-bold tracking-wide text-slate-600 uppercase">Version</dt>
          <dd className="mt-1 text-slate-300">v{artifact.version}</dd>
        </div>
        <div>
          <dt className="font-bold tracking-wide text-slate-600 uppercase">Updated</dt>
          <dd className="mt-1 text-slate-300">{kyivDateTime(artifact.updated_at)}</dd>
        </div>
        {artifact.mime_type ? (
          <div>
            <dt className="font-bold tracking-wide text-slate-600 uppercase">Format</dt>
            <dd className="mt-1 text-slate-300">{artifact.mime_type}</dd>
          </div>
        ) : null}
        {artifact.byte_size !== null ? (
          <div>
            <dt className="font-bold tracking-wide text-slate-600 uppercase">Size</dt>
            <dd className="mt-1 text-slate-300">{formatBytes(artifact.byte_size)}</dd>
          </div>
        ) : null}
        {artifact.provider ? (
          <div>
            <dt className="font-bold tracking-wide text-slate-600 uppercase">Provider</dt>
            <dd className="mt-1 text-slate-300">{artifact.provider}</dd>
          </div>
        ) : null}
        {artifact.provider_id ? (
          <div>
            <dt className="font-bold tracking-wide text-slate-600 uppercase">Model / ID</dt>
            <dd className="mt-1 break-words text-slate-300">{artifact.provider_id}</dd>
          </div>
        ) : null}
        {estimatedCost !== null ? (
          <div>
            <dt className="font-bold tracking-wide text-slate-600 uppercase">Current run cost</dt>
            <dd className="mt-1 text-slate-300">${estimatedCost.toFixed(4)}</dd>
          </div>
        ) : null}
        {variantSelection?.costSummary ? (
          <div className="col-span-2 rounded-lg border border-cyan-300/15 bg-cyan-300/[.03] p-2">
            <dt className="font-bold tracking-wide text-slate-500 uppercase">
              Story revision spend
            </dt>
            <dd className="mt-1 text-slate-200">
              ${variantSelection.costSummary.totalUsd.toFixed(4)} tracked across{' '}
              {variantSelection.costSummary.jobCount} job
              {variantSelection.costSummary.jobCount === 1 ? '' : 's'}
            </dd>
            <dd className="mt-1 text-[11px] text-slate-500">
              render ${variantSelection.costSummary.renderUsd.toFixed(4)} · vision $
              {variantSelection.costSummary.visionUsd.toFixed(4)}
              {variantSelection.costSummary.legacyUsd > 0
                ? ` · legacy aggregate $${variantSelection.costSummary.legacyUsd.toFixed(4)}`
                : ''}{' '}
              · {variantSelection.costSummary.eventCount} ledger events
            </dd>
          </div>
        ) : null}
        {typeof artifactMetadata.target_audience === 'string' ? (
          <div>
            <dt className="font-bold tracking-wide text-slate-600 uppercase">Audience</dt>
            <dd className="mt-1 text-slate-300">{artifactMetadata.target_audience}</dd>
          </div>
        ) : null}
      </dl>

      {artifact.external_url ? (
        <a
          href={artifact.external_url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex text-sm font-bold text-[#47e4d3] underline decoration-[#47e4d3]/40 underline-offset-4"
        >
          Open artifact
        </a>
      ) : artifact.storage_path ? (
        <p className="mt-4 truncate font-mono text-xs text-slate-500">
          {artifact.storage_bucket}/{artifact.storage_path}
        </p>
      ) : null}

      {artifactWarnings.length > 0 || failedChecks.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/7 p-3 text-xs text-amber-100">
          <p className="font-bold">Automatic checks need review</p>
          <ul className="mt-2 grid gap-1">
            {[...artifactWarnings, ...failedChecks.map((check) => `failed:${check}`)].map(
              (warning) => (
                <li key={warning}>• {warning.replaceAll('_', ' ')}</li>
              ),
            )}
          </ul>
        </div>
      ) : null}

      {postUploadQaLine ? (
        <div
          className={
            postUploadQaNeedsWarning(postUploadQa)
              ? 'mt-4 rounded-xl border border-amber-300/25 bg-amber-300/8 p-3 text-xs text-amber-50'
              : 'mt-4 rounded-xl border border-white/10 bg-white/4 p-3 text-xs text-slate-300'
          }
        >
          <p className="font-bold">{postUploadQaLine}</p>
          {postUploadAdvice.length > 0 ? (
            <ul className="mt-2 grid gap-1 text-amber-100/90">
              {postUploadAdvice.map((row) => (
                <li key={row.kind}>
                  {row.do} {row.dont}
                </li>
              ))}
            </ul>
          ) : null}
          {postUploadQaNeedsWarning(postUploadQa) ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {canReview ? (
                <form action={ignorePostUploadQaAction}>
                  <input type="hidden" name="weekly_digest_id" value={digestId} />
                  <input type="hidden" name="artifact_id" value={artifact.id} />
                  <button
                    type="submit"
                    className="font-bold text-amber-100 underline decoration-amber-100/40 underline-offset-2"
                  >
                    Ігнорувати
                  </button>
                </form>
              ) : null}
              <span className="text-amber-100/80">Замінити файл — форма upload на цій картці.</span>
            </div>
          ) : null}
          {canReview && (postUploadQa?.pending || postUploadQa?.error) ? (
            <form action={recheckPostUploadQaAction} className="mt-2">
              <input type="hidden" name="weekly_digest_id" value={digestId} />
              <input type="hidden" name="artifact_id" value={artifact.id} />
              <button
                type="submit"
                className="font-bold text-cyan-100 underline decoration-cyan-100/40 underline-offset-2"
              >
                Перевірити ще раз
              </button>
              {postUploadQa?.pending ? (
                <span className="ml-2 text-slate-500">
                  Якщо перевірка не завершилась — натисни, щоб запустити її знову.
                </span>
              ) : null}
            </form>
          ) : null}
        </div>
      ) : null}

      {contentSimOutcome && !contentSimPassed ? (
        <div className="mt-4 rounded-xl border border-rose-300/25 bg-rose-300/8 p-3 text-xs text-rose-50">
          <p className="font-bold text-rose-100">
            Content Sim · {String(contentSimOutcome).replaceAll('_', ' ')}
            {typeof contentSim.attempts === 'number'
              ? ` · ${contentSim.attempts}/${typeof contentSim.max_attempts === 'number' ? contentSim.max_attempts : '?'} attempts`
              : ''}
          </p>
          {contentSimSummary ? (
            <p className="mt-2 leading-5 text-rose-50/90">{contentSimSummary}</p>
          ) : null}
          {contentSimBlockers.length > 0 ? (
            <ul className="mt-2 grid gap-1">
              {contentSimBlockers.slice(0, 6).map((entry, index) => {
                const row = asRecord(entry as Json);
                const code = typeof row.code === 'string' ? row.code : 'issue';
                const message = typeof row.message === 'string' ? row.message : '';
                return (
                  <li key={`${code}-${index}`}>
                    • <span className="font-mono text-rose-100/80">{code}</span>
                    {message ? ` — ${message}` : ''}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {contentSimActions.length > 0 ? (
            <div className="mt-3">
              <p className="font-bold tracking-wide text-rose-200/80 uppercase">
                Suggested next steps
              </p>
              <ul className="mt-1 grid gap-1 text-rose-50/90">
                {contentSimActions.slice(0, 3).map((action) => (
                  <li key={String(action)}>• {String(action)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-3 text-rose-100/70">
            Approve after review to record a human override, or regenerate with a scene override.
          </p>
        </div>
      ) : null}

      {contentSim.human_override === true ? (
        <p className="mt-3 text-xs text-amber-100/80">
          Content Sim human override recorded
          {typeof contentSim.human_override_note === 'string' && contentSim.human_override_note
            ? `: ${contentSim.human_override_note}`
            : '.'}
        </p>
      ) : null}

      <ArtifactReview
        digestId={digestId}
        artifact={artifact}
        reviews={reviews}
        canReview={canReview}
      />
    </article>
  );
}

function HallucinationBoardPanel({
  workspace,
  canShip,
}: {
  workspace: WeeklyDigestWorkspace;
  canShip: boolean;
}) {
  const videoFinal = workspace.artifacts.find(
    (artifact) => artifact.artifact_type === 'video_final' && artifact.is_current,
  );
  const qualityArtifact = workspace.artifacts.find(
    (artifact) => artifact.artifact_type === 'content_quality_report' && artifact.is_current,
  );
  const board = buildHallucinationBoard({
    items: workspace.items.map((item) => ({
      id: item.id,
      rank: item.rank,
      title_en: item.title_en,
      title_uk: item.title_uk,
    })),
    artifacts: workspace.artifacts,
    videoYoutubeId: videoFinal?.provider_id ?? videoFinal?.external_url ?? null,
  });

  return (
    <section className={PANEL} aria-labelledby="hallucination-board-heading">
      <p className="text-xs font-bold tracking-wide text-cyan-200 uppercase">Release review</p>
      <h2 id="hallucination-board-heading" className="mt-1 text-lg font-bold text-white">
        Hallucination board
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        Review each claim against its source URL — a missing URL is your editorial call, not an
        automatic block. Unresolved blockers and the waiting list below do block Ship.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/8 bg-white/[.025] p-3">
          <p className="text-xs font-bold text-slate-500 uppercase">Claims</p>
          <p className="mt-1 text-2xl font-bold text-white">{board.claims.length}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[.025] p-3">
          <p className="text-xs font-bold text-slate-500 uppercase">Language fixes</p>
          <p className="mt-1 text-2xl font-bold text-white">{board.languageFixes.length}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[.025] p-3">
          <p className="text-xs font-bold text-slate-500 uppercase">Blockers</p>
          <p className="mt-1 text-2xl font-bold text-white">{board.unresolvedBlockers.length}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[.025] p-3">
          <p className="text-xs font-bold text-slate-500 uppercase">EN/UK numeric</p>
          <p className="mt-1 text-2xl font-bold text-white">{board.numericParityIssues.length}</p>
        </div>
      </div>
      {board.waitingOnOwner.length ? (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-100">
          {board.waitingOnOwner.map((item) => (
            <li key={`${item.kind}:${item.slotKey ?? item.label}`}>{item.label}</li>
          ))}
        </ul>
      ) : null}
      {board.languageFixes.length ? (
        <details className="mt-4 text-sm text-slate-400">
          <summary className="font-semibold text-slate-200">Auto-applied language fixes</summary>
          <ul className="mt-2 space-y-1">
            {board.languageFixes.map((fix) => (
              <li key={`${fix.locale}:${fix.span}`}>
                {fix.locale.toUpperCase()}: «{fix.span}» → «{fix.replacement}»
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {board.claims.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-xs">
            <thead className="font-bold tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="pb-2">Claim</th>
                <th className="pb-2">Story</th>
                <th className="pb-2">Sources</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {board.claims.slice(0, 24).map((claim) => (
                <tr key={claim.claimId}>
                  <td className="py-2 pr-3 text-slate-200">
                    <span className="font-mono text-[0.7rem] text-slate-500">{claim.claimId}</span>
                    <span className="mt-1 block">{claim.text}</span>
                  </td>
                  <td className="py-2 pr-3 text-slate-400">{claim.storyHeadline}</td>
                  <td className="py-2 text-slate-400">
                    {claim.sourceUrls.length ? claim.sourceUrls.join(', ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Research packs are not on this revision yet.</p>
      )}
      {board.unresolvedBlockers.length ? (
        <ul className="mt-4 space-y-1 text-sm text-rose-200">
          {board.unresolvedBlockers.map((issue) => (
            <li key={`${issue.code}:${issue.span ?? issue.message}`}>
              {issue.code}
              {issue.span ? `: «${issue.span}»` : ` — ${issue.message}`}
            </li>
          ))}
        </ul>
      ) : null}
      {canShip ? (
        <div className="mt-5 grid gap-4">
          {board.canShip ? (
            <form action={shipWeeklyDigestAction}>
              <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
              <ActionSubmitButton
                idleLabel="Ship (approve + schedule in 15 min)"
                pendingLabel="Shipping…"
                className={PRIMARY}
              />
            </form>
          ) : (
            <p className="text-sm text-amber-100">
              Ship unlocks when the waiting list above is empty and no blocker remains.
            </p>
          )}
          {qualityArtifact ? (
            <form action={reviewWeeklyArtifactAction} className="grid gap-2">
              <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
              <input type="hidden" name="workspace_tab" value={canShip ? 'release' : 'overview'} />
              <input type="hidden" name="artifact_id" value={qualityArtifact.id} />
              <input type="hidden" name="artifact_version" value={qualityArtifact.version} />
              <input type="hidden" name="artifact_input_hash" value={qualityArtifact.input_hash} />
              <label className={LABEL}>
                Request repair on claims
                <textarea
                  name="note"
                  rows={2}
                  minLength={10}
                  maxLength={2000}
                  required
                  className={TEXTAREA}
                  placeholder="Repair claims X, Y — what is invented or ungrounded?"
                />
              </label>
              <ActionSubmitButton
                name="decision"
                value="changes_requested"
                idleLabel="Request repair"
                pendingLabel="Sending…"
                className={SECONDARY}
              />
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function OverviewPanel({
  workspace,
  blockers,
  progress,
  canEdit,
  canRebuildSelection,
  canCreateVisualRefresh,
}: {
  workspace: WeeklyDigestWorkspace;
  blockers: ReturnType<typeof validateWeeklyDigestPreflight>['blockers'];
  progress: number;
  canEdit: boolean;
  canRebuildSelection: boolean;
  canCreateVisualRefresh: boolean;
}) {
  const unresolvedArtifacts = workspace.artifacts.filter(
    (artifact) => artifact.review_status === 'changes_requested',
  );
  const latestEvents = workspace.releaseEvents.slice(0, 8);
  const isTestEdition = workspace.digest.is_test;
  const canRestoreRevision =
    canEdit &&
    workspace.digest.status !== 'publishing' &&
    workspace.digest.status !== 'published' &&
    workspace.digest.status !== 'cancelled';
  const engagementSegments = Array.from(
    workspace.engagementEvents.reduce((segments, event) => {
      const key = `${event.channel ?? 'direct'}|${event.locale}|${event.hook_angle ?? 'default'}`;
      const current = segments.get(key) ?? {
        channel: event.channel ?? 'direct',
        locale: event.locale,
        hookAngle: event.hook_angle ?? 'default',
        views: new Set<string>(),
        engaged: new Set<string>(),
        subscribeClicks: new Set<string>(),
        signups: new Set<string>(),
      };
      if (event.event_type === 'digest_view') current.views.add(event.session_hash);
      if (event.event_type === 'scroll_50' || event.event_type === 'story_open')
        current.engaged.add(event.session_hash);
      if (event.event_type === 'subscribe_click') current.subscribeClicks.add(event.session_hash);
      if (event.event_type === 'signup_complete') current.signups.add(event.session_hash);
      segments.set(key, current);
      return segments;
    }, new Map<string, { channel: string; locale: string; hookAngle: string; views: Set<string>; engaged: Set<string>; subscribeClicks: Set<string>; signups: Set<string> }>()),
  )
    .map(([, segment]) => ({
      channel: segment.channel,
      locale: segment.locale,
      hookAngle: segment.hookAngle,
      views: segment.views.size,
      engaged: segment.engaged.size,
      subscribeClicks: segment.subscribeClicks.size,
      signups: segment.signups.size,
    }))
    .sort((left, right) => right.views - left.views)
    .slice(0, 10);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,.6fr)]">
      <div className="grid gap-5">
        <section className={PANEL} aria-labelledby="playbook-heading">
          <p className="text-xs font-bold tracking-wide text-cyan-200 uppercase">Editor playbook</p>
          <h2 id="playbook-heading" className="mt-1 text-lg font-bold text-white">
            How to move this weekly forward
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>
              <span className="font-semibold text-white">Stories</span> — keep Top 3 + 3–4 Radar,
              Save.
            </li>
            <li>
              <span className="font-semibold text-white">
                Research → Article → Social → PDF → Script
              </span>{' '}
              run without Approve when gates pass. Watch the job strip; retryable failures re-queue
              themselves.
            </li>
            <li>
              <span className="font-semibold text-white">Visuals</span> — copy prompts, generate
              outside, upload 8 files. <span className="font-semibold text-white">Video</span> —
              shooting package, Remotion, paste YouTube id.
            </li>
            <li>
              <span className="font-semibold text-white">Hallucination board</span> then one AAL2{' '}
              <span className="font-semibold text-white">Ship</span>. Approve version stays as
              override only.
            </li>
          </ol>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Full runbook (stuck jobs, retries, overrides):{' '}
            <code className="text-slate-400">wiki/ops/weekly-admin-runbook.md</code> in the repo.
          </p>
        </section>

        {workspace.digest.status === 'published' ? (
          <section className={PANEL} aria-labelledby="visual-refresh-heading">
            <p className="text-xs font-bold tracking-wide text-cyan-200 uppercase">
              Post-publication visual refresh
            </p>
            <h2 id="visual-refresh-heading" className="mt-1 text-lg font-bold text-white">
              Prepare a visual refresh without touching the live edition
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Creates a private working revision from the published copy, carries approved text, PDF
              and unchanged image provenance, and queues a cover prompt plus one story prompt per
              item. New cover/story files stay private for QA and review; only an explicit later
              apply can replace selected public pixels.
            </p>
            {workspace.revision?.visual_refresh_source_revision_id ? (
              <p className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-xs text-cyan-100">
                A private visual-refresh draft is already active. Edit its direction, regenerate
                prompts and stage replacements; the public revision remains unchanged until you
                explicitly apply approved images.
              </p>
            ) : null}
            <form action={createWeeklyVisualRefreshDraftAction} className="mt-4">
              <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
              <ActionSubmitButton
                idleLabel={
                  workspace.revision?.visual_refresh_source_revision_id
                    ? 'Open visual refresh draft'
                    : 'Create visual refresh draft'
                }
                pendingLabel="Creating private draft…"
                disabled={!canCreateVisualRefresh}
                className={PRIMARY}
              />
            </form>
            {!canCreateVisualRefresh ? (
              <p className="mt-2 text-xs text-slate-500">Requires an AAL2 owner session.</p>
            ) : null}
          </section>
        ) : null}

        <HallucinationBoardPanel workspace={workspace} canShip={false} />

        <section className={PANEL} aria-labelledby="readiness-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                Release readiness
              </p>
              <h2 id="readiness-heading" className="mt-1 text-2xl font-bold text-white">
                {progress}% complete
              </h2>
            </div>
            <StatusPill value={blockers.length === 0 ? 'approved' : 'in_review'} />
          </div>
          <div
            className="mt-5 h-2 overflow-hidden rounded-full bg-white/8"
            role="progressbar"
            aria-label="Weekly Digest readiness"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div className="h-full rounded-full bg-[#47e4d3]" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/8 bg-white/[.025] p-3">
              <p className="text-xs font-bold text-slate-500 uppercase">Blockers</p>
              <p className="mt-1 text-2xl font-bold text-white">{blockers.length}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[.025] p-3">
              <p className="text-xs font-bold text-slate-500 uppercase">Change requests</p>
              <p className="mt-1 text-2xl font-bold text-white">{unresolvedArtifacts.length}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[.025] p-3">
              <p className="text-xs font-bold text-slate-500 uppercase">Stories</p>
              <p className="mt-1 text-2xl font-bold text-white">{workspace.items.length}</p>
            </div>
          </div>
        </section>

        <section className={PANEL} aria-labelledby="blockers-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="blockers-heading" className="text-lg font-bold text-white">
              Release preflight
            </h2>
            <span className="text-xs font-semibold text-slate-500">Required gates only</span>
          </div>
          {blockers.length ? (
            <div className="mt-4">
              <PreflightBlockerList
                digestId={workspace.digest.id}
                blockers={blockers}
                storyIds={workspace.items.map((item) => item.id)}
              />
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/6 p-4 text-sm text-emerald-200">
              Every required artifact and enabled social variant is current and approved.
            </p>
          )}
        </section>

        <GenerationJobsOverviewSummary
          digestId={workspace.digest.id}
          jobs={workspace.generationJobs}
        />
      </div>

      <aside className="grid content-start gap-5">
        <section className={PANEL} aria-labelledby="engagement-heading">
          <h2 id="engagement-heading" className="text-lg font-bold text-white">
            First-party engagement
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Latest 500 events, segmented by channel, language and hook angle. No raw IP is stored.
          </p>
          {engagementSegments.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[30rem] text-left text-xs">
                <thead className="font-bold tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="pb-2">Segment</th>
                    <th className="pb-2">Views</th>
                    <th className="pb-2">Engaged</th>
                    <th className="pb-2">Subscribe CTR</th>
                    <th className="pb-2">Signup CVR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {engagementSegments.map((segment) => (
                    <tr key={`${segment.channel}:${segment.locale}:${segment.hookAngle}`}>
                      <td className="max-w-52 py-2 pr-3 text-slate-300">
                        <span className="font-bold text-white">
                          {segment.channel} · {segment.locale}
                        </span>
                        <span className="block truncate text-slate-500">{segment.hookAngle}</span>
                      </td>
                      <td className="py-2 text-slate-300">{segment.views}</td>
                      <td className="py-2 text-slate-300">{segment.engaged}</td>
                      <td className="py-2 text-slate-300">
                        {segment.views
                          ? `${((segment.subscribeClicks / segment.views) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                      <td className="py-2 text-slate-300">
                        {segment.views
                          ? `${((segment.signups / segment.views) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No engagement events recorded yet.</p>
          )}
        </section>

        <section className={PANEL} aria-labelledby="schedule-heading">
          <h2 id="schedule-heading" className="text-lg font-bold text-white">
            Edition clock
          </h2>
          <dl className="mt-4 grid gap-4 text-sm">
            <div>
              <dt className="font-bold text-slate-500">Editorial period</dt>
              <dd className="mt-1 text-white">
                {kyivDate(workspace.digest.week_start)} – {kyivDate(workspace.digest.week_end)}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-slate-500">Automatic preflight</dt>
              <dd className="mt-1 text-white">{kyivDateTime(workspace.digest.preflight_at)}</dd>
            </div>
            <div>
              <dt className="font-bold text-slate-500">
                {isTestEdition ? 'Reference release (test locked)' : 'Public release'}
              </dt>
              <dd className="mt-1 text-white">{kyivDateTime(workspace.digest.release_at)}</dd>
            </div>
          </dl>
          <p className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-300/6 p-3 text-sm leading-6 text-cyan-100">
            {isTestEdition
              ? 'This test follows the same Monday review timing, but the database prevents any public publication.'
              : 'Monday is part of the review window. Editors can revise and re-approve until the automated 15:45 Kyiv preflight; publication begins at 16:00.'}
          </p>
        </section>

        <section className={PANEL} aria-labelledby="rebuild-heading">
          <h2 id="rebuild-heading" className="text-lg font-bold text-white">
            Rebuild selection
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Re-runs story selection over this editorial week with the current selector and seeds
            each story from its daily item. Use it when the week gained approved stories after this
            digest was composed, or after the selection rules changed.
          </p>
          {canRebuildSelection && canRestoreRevision ? (
            <form action={rebuildWeeklySelectionAction} className="mt-4 grid gap-3">
              <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
              <p className="rounded-xl border border-amber-400/25 bg-amber-400/8 p-3 text-xs leading-5 text-amber-100">
                This replaces the active version. The digest returns to <b>in review</b> and every
                approval — research, article, images, social — is cleared, because a different story
                set no longer matches them. The current version stays in the list and can be
                restored.
              </p>
              <div>
                <ActionSubmitButton
                  idleLabel="Rebuild selection"
                  pendingLabel="Rebuilding…"
                  className={SECONDARY}
                />
              </div>
            </form>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              {canRebuildSelection
                ? 'This edition can no longer be edited.'
                : 'Owner session required.'}
            </p>
          )}
        </section>

        <section className={PANEL} aria-labelledby="versions-heading">
          <h2 id="versions-heading" className="text-lg font-bold text-white">
            Editorial versions
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            The working copy is the latest generated or saved version. Older versions stay here so
            you can go back. Identical saves keep the current version and its approvals.
          </p>
          {workspace.revisions.length ? (
            <ul className="mt-4 grid gap-3">
              {workspace.revisions.map((revision) => (
                <EditorialVersionCard
                  key={revision.id}
                  digestId={workspace.digest.id}
                  revision={revision}
                  role={editorialVersionRole({
                    revisionId: revision.id,
                    activeRevisionId: workspace.digest.active_revision_id,
                    latestRevisionId: workspace.revisions[0]?.id ?? null,
                  })}
                  draftReason={draftReasonForRevision(workspace, revision.id)}
                  canRestore={canRestoreRevision}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No editorial versions yet.</p>
          )}
        </section>

        <section className={PANEL} aria-labelledby="history-heading">
          <h2 id="history-heading" className="text-lg font-bold text-white">
            Release history
          </h2>
          <ol className="mt-4 grid gap-4 border-l border-white/10 pl-4">
            {latestEvents.map((event) => (
              <li key={event.id}>
                <p className="text-sm font-bold text-white">
                  {event.event_type.replaceAll('_', ' ')}
                </p>
                <p className="mt-1 text-xs text-slate-500">{kyivDateTime(event.created_at)}</p>
              </li>
            ))}
          </ol>
          {latestEvents.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No release events recorded.</p>
          ) : null}
        </section>
      </aside>
    </div>
  );
}

function draftReasonForRevision(
  workspace: WeeklyDigestWorkspace,
  revisionId: string,
): string | null {
  const draftEvent = workspace.releaseEvents.find(
    (event) => event.revision_id === revisionId && event.event_type === 'draft_revision_created',
  );
  return draftEvent ? textFrom(draftEvent.payload, 'reason') : null;
}

function EditorialVersionCard({
  digestId,
  revision,
  role,
  draftReason,
  canRestore,
}: {
  digestId: string;
  revision: WeeklyRevisionAdminRow;
  role: EditorialVersionRole;
  draftReason: string | null;
  canRestore: boolean;
}) {
  const borderClass =
    role === 'active'
      ? 'border-emerald-400/30 bg-emerald-400/[.04]'
      : role === 'latest-unused'
        ? 'border-amber-400/30 bg-amber-400/[.06]'
        : 'border-white/8 bg-white/[.025]';
  return (
    <li className={`rounded-xl border p-3 ${borderClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-white">Revision {revision.revision_number}</p>
        {role === 'active' ? (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-emerald-200 uppercase">
            Working copy
          </span>
        ) : null}
        {role === 'latest-unused' ? (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-amber-200 uppercase">
            Latest — not in use
          </span>
        ) : null}
        <span className="text-xs text-slate-500">{kyivDateTime(revision.created_at)}</span>
      </div>
      <p className="mt-1 truncate text-sm text-slate-300">{revision.title_en}</p>
      {role === 'latest-unused' ? (
        <p className="mt-1 text-xs text-amber-200/80">
          {draftReason ? `${draftReason}. ` : ''}
          Article and other tabs still show the working copy until you switch.
        </p>
      ) : null}
      {canRestore && role === 'latest-unused' ? (
        <form action={useLatestWeeklyDigestRevisionAction} className="mt-3">
          <input type="hidden" name="weekly_digest_id" value={digestId} />
          <input type="hidden" name="target_revision_id" value={revision.id} />
          <ActionSubmitButton
            idleLabel="Use this version"
            pendingLabel="Switching…"
            className={PRIMARY}
          />
        </form>
      ) : null}
      {canRestore && role === 'earlier' ? (
        <form action={restoreWeeklyDigestRevisionAction} className="mt-3 grid gap-3">
          <input type="hidden" name="weekly_digest_id" value={digestId} />
          <input type="hidden" name="target_revision_id" value={revision.id} />
          <label className={LABEL}>
            Why go back to this version?
            <textarea
              name="reason"
              rows={2}
              required
              minLength={10}
              maxLength={500}
              className={TEXTAREA}
              placeholder="Undo a bad Save, recover an earlier story set, etc."
            />
          </label>
          <div>
            <ActionSubmitButton
              idleLabel="Go back to this version"
              pendingLabel="Switching…"
              className={SECONDARY}
            />
          </div>
        </form>
      ) : null}
    </li>
  );
}

function MasterQualityRepairCta({
  digestId,
  revisionId,
  canReview,
  canEdit,
  masterBusy,
}: {
  digestId: string;
  revisionId: string | null;
  canReview: boolean;
  canEdit: boolean;
  masterBusy: boolean;
}) {
  if (!revisionId) return null;
  if (masterBusy) {
    return (
      <p className="mt-4 text-sm leading-6 text-slate-400">
        A writer/critic pass is already running. Wait for it to finish — this panel will refresh
        with the new scores.
      </p>
    );
  }
  if (canReview) {
    return (
      <form
        action={regenerateWeeklyMasterAction}
        className="mt-4 rounded-xl border border-cyan-400/25 bg-cyan-400/8 p-4"
      >
        <input type="hidden" name="weekly_digest_id" value={digestId} />
        <input type="hidden" name="revision_id" value={revisionId} />
        <p className="text-sm font-bold text-cyan-50">Fix remaining issues</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          Re-runs critic and field repair on the current article, using this report as guidance.
          Research packs stay. The edition is not rewritten from scratch. The new draft becomes the
          working copy and counts against this revision&apos;s spend cap.
        </p>
        <div className="mt-3">
          <ActionSubmitButton
            idleLabel="Fix remaining issues"
            pendingLabel="Queueing writer/critic…"
            className={PRIMARY}
          />
        </div>
      </form>
    );
  }
  if (canEdit) {
    return (
      <p className="mt-4 text-sm leading-6 text-slate-500">
        Owner can queue another writer/critic pass from this report (Fix remaining issues).
      </p>
    );
  }
  return null;
}

function ResearchPanel({
  workspace,
  canEdit,
  canReview,
}: {
  workspace: WeeklyDigestWorkspace;
  canEdit: boolean;
  canReview: boolean;
}) {
  const features = workspace.items.filter((item) => item.rank <= 3);
  const quality = artifactFor(workspace.artifacts, 'content_quality_report', 'neutral');
  const qualityContent = asRecord(quality?.content);
  const orphanedQuality = workspace.orphanedQualityReport;
  const orphanedQualityContent = asRecord(orphanedQuality?.content);
  const qualityIssues = Array.isArray(qualityContent.issues)
    ? qualityContent.issues.filter(
        (value): value is Json =>
          Boolean(value) && typeof value === 'object' && !Array.isArray(value),
      )
    : [];
  const qualityDimensions = Array.isArray(qualityContent.dimensions)
    ? qualityContent.dimensions.filter(
        (value): value is Json =>
          Boolean(value) && typeof value === 'object' && !Array.isArray(value),
      )
    : [];
  const readyResearch = features.filter((item) => {
    const artifact = researchArtifactFor(workspace.artifacts, item);
    return artifact?.generation_status === 'ready';
  }).length;
  const approvedResearch = features.filter(
    (item) => researchArtifactFor(workspace.artifacts, item)?.review_status === 'approved',
  ).length;
  const featureBriefItemIds = new Set(
    features.flatMap((item) => (item.brief_item_id ? [item.brief_item_id] : [])),
  );
  const directionsSet = workspace.storyDirections.filter(
    (direction) => direction.angle.trim() && featureBriefItemIds.has(direction.brief_item_id),
  ).length;
  const editorialMasterJob =
    workspace.generationJobs.find((job) => job.job_type === 'editorial_master') ?? null;
  const masterWaitingOnPackApprovals =
    editorialMasterJob?.status === 'queued' && readyResearch === 3 && approvedResearch < 3;
  const masterRunnable = editorialMasterJob?.status === 'queued' && approvedResearch === 3;
  const masterBusy = workspace.generationJobs.some(
    (job) =>
      job.job_type === 'editorial_master' &&
      (job.status === 'dispatching' || job.status === 'running'),
  );
  const qualityNeedsRepair = qualityContentNeedsRepair(quality?.content);

  return (
    <div className="grid gap-5">
      <section className={PANEL} aria-labelledby="research-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-wide text-cyan-200 uppercase">
              Content Studio v2 · Research gate
            </p>
            <h2 id="research-heading" className="mt-1 text-xl font-bold text-white">
              Top 3 evidence packs
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Job <span className="font-semibold text-slate-300">succeeded</span> only means the
              pack was generated. The worker will not start <code>editorial_master</code> until you
              click <span className="font-semibold text-slate-300">Approve version</span> on all
              three packs below ({approvedResearch}/3 approved now).
            </p>
          </div>
          {canEdit && workspace.revision ? (
            <div className="flex flex-wrap items-center gap-3">
              <form action={startWeeklyContentStudioAction}>
                <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
                <input type="hidden" name="revision_id" value={workspace.revision.id} />
                <ActionSubmitButton
                  className={PRIMARY}
                  idleLabel="Start / retry Content Studio"
                  pendingLabel="Queueing research…"
                />
              </form>
              <form action={dispatchWeeklyMasterCliAction}>
                <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
                <ActionSubmitButton
                  className={SECONDARY}
                  idleLabel="Write master via Claude subscription"
                  pendingLabel="Dispatching GitHub Actions…"
                />
              </form>
            </div>
          ) : null}
        </div>

        <ol className="mt-4 list-decimal space-y-2 rounded-xl border border-white/8 bg-black/15 px-5 py-4 pl-9 text-sm leading-6 text-slate-300">
          <li>
            Click <span className="font-semibold text-white">Start / retry Content Studio</span> —
            generates the three research packs, or queues new jobs if the previous ones already
            succeeded. In-flight jobs and a waiting master are left in place. You must Approve the
            new packs again.
          </li>
          <li>
            When each pack shows <span className="font-semibold text-white">ready</span> /{' '}
            <span className="font-semibold text-white">in review</span>, open it and click{' '}
            <span className="font-semibold text-white">Approve version</span> (owner). Do this for
            all three — not optional.
          </li>
          <li>
            Only then does <code>editorial_master</code> leave the queue and receive its dedicated
            GitHub Actions worker (the five-minute cron remains a safety dispatcher).
          </li>
          <li>
            Review Master quality below → click{' '}
            <span className="font-semibold text-white">Fix remaining issues</span> if scores or
            warnings remain → <span className="font-semibold text-white">Approve version</span> on
            the quality report.
          </li>
        </ol>

        {masterWaitingOnPackApprovals ? (
          <div
            role="status"
            className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50"
          >
            <p className="font-bold text-amber-100">Next action: approve the three packs</p>
            <p className="mt-1">
              Research jobs finished ({readyResearch}/3 ready), but only {approvedResearch}/3 are
              approved. <code>editorial_master</code> stays <strong>queued on purpose</strong> until
              you approve every Feature pack below. The spinner does not mean the worker is about to
              start.
            </p>
          </div>
        ) : null}
        {masterRunnable ? (
          <div
            role="status"
            className="mt-4 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm leading-6 text-cyan-50"
          >
            <p className="font-bold text-cyan-100">Packs approved — master is eligible</p>
            <p className="mt-1">
              All three packs are approved. The control plane should dispatch{' '}
              <code>editorial_master</code> immediately. Check its precise status and run link below
              if it remains queued.
            </p>
          </div>
        ) : null}

        {canEdit && workspace.revision ? (
          <p className="mt-3 text-xs leading-5 text-slate-500">
            &quot;Write master via Claude subscription&quot; hands the same queued job to GitHub
            Actions (Claude Code) instead of OpenRouter. Track that run on{' '}
            <a
              href="https://github.com/sanchahous/ai-today-brief/actions/workflows/weekly-master-cli-worker.yml"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 underline hover:text-cyan-200"
            >
              GitHub Actions
            </a>
            .
          </p>
        ) : null}
        {editorialMasterJob ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/[.025] px-4 py-3">
            <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              editorial_master
            </span>
            <StatusPill value={editorialMasterJob.status} />
            <span className="text-xs text-slate-500">
              Attempt {editorialMasterJob.attempts} · Updated{' '}
              {kyivDateTime(editorialMasterJob.updated_at ?? editorialMasterJob.created_at)}
            </span>
            {masterWaitingOnPackApprovals ? (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-100">
                Waiting for pack approvals ({approvedResearch}/3)
              </span>
            ) : null}
            {editorialMasterJob.status === 'running' ||
            (editorialMasterJob.status === 'queued' && !masterWaitingOnPackApprovals) ? (
              <span
                aria-hidden="true"
                className="size-3 animate-spin rounded-full border-2 border-cyan-300 border-r-transparent"
              />
            ) : null}
            {editorialMasterJob.last_error ? (
              <p className="w-full text-xs leading-5 whitespace-pre-wrap text-red-200">
                {editorialMasterJob.last_error}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/8 bg-white/[.025] p-3">
            <p className="text-xs font-bold text-slate-500 uppercase">Approved research</p>
            <p className="mt-1 text-2xl font-bold text-white">{approvedResearch}/3</p>
            <p className="mt-1 text-xs text-slate-500">{readyResearch}/3 packs ready to review</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[.025] p-3">
            <p className="text-xs font-bold text-slate-500 uppercase">Audience</p>
            <p className="mt-1 text-sm font-semibold text-white">
              Builders, AI practitioners & the technically curious
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[.025] p-3">
            <p className="text-xs font-bold text-slate-500 uppercase">Editorial angles</p>
            <p className="mt-1 text-2xl font-bold text-white">{directionsSet}/3</p>
            <p className="mt-1 text-xs text-slate-500">
              Optional — set below per feature. Unset stories default to a plain recap.
            </p>
          </div>
        </div>
      </section>

      {features.map((item) => {
        const artifact = researchArtifactFor(workspace.artifacts, item);
        const researchJob = workspace.generationJobs.find(
          (job) =>
            job.job_type === 'research_pack' && textFrom(job.input, 'revision_item_id') === item.id,
        );
        const content = asRecord(artifact?.content);
        const primary = asRecord(content.primarySource);
        const claims = Array.isArray(content.claims)
          ? content.claims.filter(
              (value): value is Json =>
                Boolean(value) && typeof value === 'object' && !Array.isArray(value),
            )
          : [];
        const risks = listFrom(artifact?.metadata, 'risk_flags');
        return (
          <section key={item.id} className={PANEL}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                  Feature {item.rank} · deep research
                </p>
                <h3 className="mt-1 max-w-4xl text-lg font-bold text-white">{item.title_en}</h3>
              </div>
              {artifact ? (
                <div className="flex gap-2">
                  <StatusPill value={artifact.generation_status} />
                  <StatusPill value={artifact.review_status} />
                </div>
              ) : (
                <StatusPill value="queued" />
              )}
            </div>
            {artifact?.generation_status === 'ready' &&
            artifact.review_status !== 'approved' &&
            canReview ? (
              <p className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/8 px-3 py-2 text-xs leading-5 text-amber-100">
                Pack is generated. Scroll to <span className="font-semibold">Approve version</span>{' '}
                at the bottom of this card — until then master stays queued.
              </p>
            ) : null}
            {artifact ? (
              <>
                <dl className="mt-4 grid gap-3 rounded-xl border border-white/8 bg-black/15 p-4 text-sm md:grid-cols-3">
                  <div>
                    <dt className="font-bold text-slate-500">Primary source</dt>
                    <dd className="mt-1 break-words text-white">
                      {textFrom(primary as Json, 'sourceName') || 'Unknown'}
                    </dd>
                    {textFrom(primary as Json, 'url') ? (
                      <a
                        href={textFrom(primary as Json, 'url')}
                        className="mt-1 block text-xs break-all text-cyan-200 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {textFrom(primary as Json, 'url')}
                      </a>
                    ) : null}
                  </div>
                  <div>
                    <dt className="font-bold text-slate-500">Approved claims</dt>
                    <dd className="mt-1 text-white">{claims.length}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-500">Risk flags</dt>
                    <dd className="mt-1 text-white">{risks.length ? risks.join(', ') : 'None'}</dd>
                  </div>
                </dl>
                <div className="mt-4 grid gap-2">
                  {claims.map((claim, index) => {
                    const row = asRecord(claim);
                    const evidenceUrls = Array.isArray(row.evidenceUrls)
                      ? row.evidenceUrls.filter(
                          (value): value is string => typeof value === 'string',
                        )
                      : [];
                    return (
                      <div
                        key={`${textFrom(claim, 'id')}:${index}`}
                        className="rounded-xl border border-white/8 p-3"
                      >
                        <p className="text-xs font-bold text-cyan-200">{textFrom(claim, 'id')}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-200">
                          {textFrom(claim, 'text')}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          Evidence: {evidenceUrls.length ? evidenceUrls.join(' · ') : 'missing'}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/[.04] p-4">
                  <p className="text-xs font-bold tracking-wide text-cyan-200 uppercase">
                    Кут подачі · Editorial angle
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Binding direction the writer follows for this story. Leave empty and the writer
                    defaults to a plain recap of the claims above.
                  </p>
                  {item.brief_item_id ? (
                    <form action={saveWeeklyStoryDirectionAction} className="mt-3 grid gap-2">
                      <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
                      <input type="hidden" name="brief_item_id" value={item.brief_item_id} />
                      <textarea
                        name="angle"
                        rows={2}
                        maxLength={600}
                        disabled={!canEdit}
                        defaultValue={
                          workspace.storyDirections.find(
                            (direction) => direction.brief_item_id === item.brief_item_id,
                          )?.angle ?? ''
                        }
                        className={TEXTAREA}
                        placeholder="e.g. Frame this as a cautionary story about infra trust, not a feature announcement."
                      />
                      {canEdit ? (
                        <ActionSubmitButton
                          idleLabel="Save angle"
                          pendingLabel="Saving…"
                          className={SECONDARY}
                        />
                      ) : null}
                    </form>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      No linked brief item — angle cannot be set for this story.
                    </p>
                  )}
                </div>
                <ArtifactReview
                  digestId={workspace.digest.id}
                  artifact={artifact}
                  reviews={workspace.artifactReviews}
                  canReview={canReview && artifact.revision_id === workspace.revision?.id}
                />
              </>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/6 p-4 text-sm text-amber-100">
                <p>Research has not completed. The system will not substitute generic copy.</p>
                {researchJob?.last_error ? (
                  <p className="mt-2 text-xs whitespace-pre-wrap text-red-200">
                    {researchJob.last_error}
                  </p>
                ) : null}
                {researchJob?.status === 'failed' ? (
                  <p className="mt-2 text-xs">
                    Correct the source, replace the story, or move it below rank 3 in Stories before
                    retrying.
                  </p>
                ) : null}
              </div>
            )}
          </section>
        );
      })}

      {quality ? (
        <section className={PANEL} aria-labelledby="quality-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                Independent audit
              </p>
              <h3 id="quality-heading" className="mt-1 text-lg font-bold text-white">
                Master quality ·{' '}
                {typeof qualityContent.score === 'number' ? qualityContent.score : 0}/100
              </h3>
            </div>
            <StatusPill value={quality.review_status} />
          </div>
          {qualityDimensions.length ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {qualityDimensions.map((dimension, index) => {
                const row = asRecord(dimension);
                return (
                  <div
                    key={`${textFrom(dimension, 'name')}:${index}`}
                    className="rounded-xl border border-white/8 p-3"
                  >
                    <p className="text-xs font-bold text-slate-500 uppercase">
                      {textFrom(dimension, 'name') || 'dimension'}
                    </p>
                    <p className="mt-1 text-xl font-bold text-white">
                      {typeof row.score === 'number' ? `${row.score}/100` : '—'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {textFrom(dimension, 'note')}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : null}
          <div className="mt-4 grid gap-2">
            {qualityIssues.map((value, index) => {
              const issue = asRecord(value);
              return (
                <div
                  key={`${textFrom(value, 'code')}:${index}`}
                  className={`rounded-xl border p-3 text-sm ${
                    issue.blocker === true
                      ? 'border-red-400/25 bg-red-400/7 text-red-100'
                      : 'border-amber-400/20 bg-amber-400/6 text-amber-100'
                  }`}
                >
                  <p className="font-bold">{textFrom(value, 'code')}</p>
                  <p className="mt-1">{textFrom(value, 'message')}</p>
                  {textFrom(value, 'span') ? (
                    <p className="mt-2 rounded-lg bg-black/20 p-2 text-xs">
                      “{textFrom(value, 'span')}”
                    </p>
                  ) : null}
                  {textFrom(value, 'suggestedFix') ? (
                    <p className="mt-2 text-xs opacity-80">
                      Fix: {textFrom(value, 'suggestedFix')}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {qualityIssues.length === 0 && !qualityNeedsRepair ? (
              <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/6 p-4 text-sm text-emerald-100">
                No editorial or factual issues reported.
              </p>
            ) : null}
            {qualityIssues.length === 0 && qualityNeedsRepair ? (
              <p className="rounded-xl border border-amber-400/20 bg-amber-400/6 p-4 text-sm text-amber-100">
                No coded issue cards, but one or more scores are below the quality floor. Fix
                remaining issues re-runs writer/critic with those notes as guidance.
              </p>
            ) : null}
          </div>
          {qualityNeedsRepair ? (
            <MasterQualityRepairCta
              digestId={workspace.digest.id}
              revisionId={workspace.revision?.id ?? null}
              canReview={canReview && quality.revision_id === workspace.revision?.id}
              canEdit={canEdit}
              masterBusy={masterBusy}
            />
          ) : null}
          <ArtifactReview
            digestId={workspace.digest.id}
            artifact={quality}
            reviews={workspace.artifactReviews}
            canReview={canReview && quality.revision_id === workspace.revision?.id}
          />
        </section>
      ) : orphanedQuality ? (
        <section
          className={`${PANEL} border-cyan-300/25 bg-cyan-300/[.03]`}
          aria-labelledby="quality-orphaned-heading"
        >
          <p className="text-xs font-bold tracking-wide text-cyan-200 uppercase">
            Independent audit · found on an earlier version
          </p>
          <h3 id="quality-orphaned-heading" className="mt-1 text-lg font-bold text-white">
            Master quality ·{' '}
            {typeof orphanedQualityContent.score === 'number' ? orphanedQualityContent.score : 0}
            /100
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            <code>editorial_master</code> already scored this content — the report stayed on the
            previous working copy when this version was switched in. Nothing was lost. Attach the
            existing report here to review and approve it.
          </p>
          <form action={carryOverWeeklyQualityReportAction} className="mt-4">
            <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
            {canReview ? (
              <ActionSubmitButton
                idleLabel="Attach this report to the current version"
                pendingLabel="Attaching…"
                className={SECONDARY}
              />
            ) : (
              <p className="text-xs text-slate-500">
                Owner or editor session required to attach it.
              </p>
            )}
          </form>
        </section>
      ) : (
        <section className={PANEL} aria-labelledby="quality-missing-heading">
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
            Independent audit
          </p>
          <h3 id="quality-missing-heading" className="mt-1 text-lg font-bold text-white">
            Master quality report
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            This report is written by the Content Studio critic after all three Top research packs
            are approved and <code>editorial_master</code> finishes. It is not a separate upload —
            it appears here automatically.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>Approve all three Top 3 research packs above (owner).</li>
            <li>
              Click <span className="font-semibold text-white">Start / retry Content Studio</span>.
            </li>
            <li>
              Wait until <code>editorial_master</code> succeeds (Overview jobs or the status chip
              above).
            </li>
            <li>Return here, review the score/issues, then Approve version (owner).</li>
          </ol>
          {editorialMasterJob?.status === 'failed' && editorialMasterJob.last_error ? (
            <p className="mt-4 rounded-xl border border-red-400/25 bg-red-400/7 p-3 text-xs leading-5 whitespace-pre-wrap text-red-100">
              {editorialMasterJob.last_error}
            </p>
          ) : null}
        </section>
      )}

      <GenerationJobsSection
        digestId={workspace.digest.id}
        revisionId={workspace.revision?.id ?? null}
        jobs={workspace.generationJobs}
        attempts={workspace.generationAttempts}
        events={workspace.generationEvents}
        tab="research"
      />
    </div>
  );
}

function StoriesPanel({
  workspace,
  canEdit,
}: {
  workspace: WeeklyDigestWorkspace;
  canEdit: boolean;
}) {
  if (!workspace.revision) {
    return (
      <div className={PANEL}>
        <h2 className="text-xl font-bold text-white">No active revision</h2>
        <p className="mt-2 text-sm text-slate-400">
          Create the editorial selection before editing individual stories.
        </p>
      </div>
    );
  }

  return (
    <form action={saveWeeklyRevisionAction} className="grid gap-5">
      <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
      <input type="hidden" name="revision_id" value={workspace.revision.id} />
      <input type="hidden" name="edit_scope" value="stories" />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Selected stories</h2>
          <p className="mt-2 text-sm text-slate-400">
            Keep 3–7 stories. Saving creates a new immutable version only when content actually
            changed; identical saves keep approvals and carried artifacts.
          </p>
        </div>
        <ActionSubmitButton
          idleLabel="Save stories"
          pendingLabel="Saving…"
          disabled={!canEdit}
          className={PRIMARY}
        />
      </div>

      {workspace.items.map((item, index) => {
        const prefix = `story-${item.id}`;
        return (
          <details
            key={item.id}
            open={index === 0}
            className="rounded-2xl border border-white/10 bg-[#151b20]"
          >
            <summary className="flex min-h-16 items-center gap-3 px-5 py-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#47e4d3]/10 text-sm font-bold text-[#47e4d3]">
                {item.rank}
              </span>
              <span className="min-w-0 flex-1 truncate font-bold text-white">{item.title_en}</span>
              <span className="text-xs text-slate-500">Edit</span>
            </summary>
            <div className="grid gap-5 border-t border-white/8 p-5">
              <input type="hidden" name="item_id" value={item.id} />
              <input type="hidden" name="item_brief_item_id" value={item.brief_item_id ?? ''} />
              <label className="inline-flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-black/10 px-3 text-sm font-semibold text-slate-200">
                <input
                  type="checkbox"
                  name="included_item_id"
                  value={item.id}
                  defaultChecked
                  disabled={!canEdit}
                  className="size-4 accent-[#47e4d3]"
                />
                Include this story in the next revision
              </label>

              <div className="grid gap-4 md:grid-cols-[8rem_minmax(0,1fr)]">
                <label className={LABEL}>
                  Rank
                  <input
                    name="item_rank"
                    type="number"
                    min={1}
                    max={7}
                    required
                    defaultValue={item.rank}
                    disabled={!canEdit}
                    className={FIELD}
                  />
                </label>
                <label className={LABEL}>
                  Event date
                  <input
                    name="item_event_date"
                    type="date"
                    defaultValue={item.event_date ?? ''}
                    disabled={!canEdit}
                    className={FIELD}
                  />
                </label>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <fieldset className="grid gap-4">
                  <legend className="mb-1 text-xs font-bold tracking-[.14em] text-[#47e4d3] uppercase">
                    English
                  </legend>
                  <label className={LABEL}>
                    Headline
                    <input
                      id={`${prefix}-title-en`}
                      name="item_title_en"
                      required
                      defaultValue={item.title_en}
                      disabled={!canEdit}
                      className={FIELD}
                    />
                  </label>
                  <label className={LABEL}>
                    Short summary
                    <textarea
                      name="item_summary_en"
                      rows={3}
                      required
                      defaultValue={item.summary_en}
                      disabled={!canEdit}
                      className={TEXTAREA}
                    />
                  </label>
                  <label className={LABEL}>
                    Full story
                    <textarea
                      name="item_body_en"
                      rows={10}
                      required
                      defaultValue={item.body_en}
                      disabled={!canEdit}
                      className={TEXTAREA}
                    />
                  </label>
                  <label className={LABEL}>
                    Why it matters
                    <textarea
                      name="item_why_en"
                      rows={4}
                      required
                      defaultValue={item.why_en ?? ''}
                      disabled={!canEdit}
                      className={TEXTAREA}
                    />
                  </label>
                  <label className={LABEL}>
                    Practical example
                    <textarea
                      name="item_practical_en"
                      rows={4}
                      required
                      defaultValue={item.practical_en ?? ''}
                      disabled={!canEdit}
                      className={TEXTAREA}
                    />
                  </label>
                  <label className={LABEL}>
                    Audience takeaway
                    <textarea
                      name="item_takeaway_en"
                      rows={3}
                      required
                      defaultValue={item.takeaway_en ?? ''}
                      disabled={!canEdit}
                      className={TEXTAREA}
                    />
                  </label>
                </fieldset>

                <fieldset className="grid gap-4">
                  <legend className="mb-1 text-xs font-bold tracking-[.14em] text-[#47e4d3] uppercase">
                    Ukrainian
                  </legend>
                  <label className={LABEL}>
                    Заголовок
                    <input
                      id={`${prefix}-title-uk`}
                      name="item_title_uk"
                      required
                      defaultValue={item.title_uk}
                      disabled={!canEdit}
                      className={FIELD}
                    />
                  </label>
                  <label className={LABEL}>
                    Короткий опис
                    <textarea
                      name="item_summary_uk"
                      rows={3}
                      required
                      defaultValue={item.summary_uk}
                      disabled={!canEdit}
                      className={TEXTAREA}
                    />
                  </label>
                  <label className={LABEL}>
                    Повний текст
                    <textarea
                      name="item_body_uk"
                      rows={10}
                      required
                      defaultValue={item.body_uk}
                      disabled={!canEdit}
                      className={TEXTAREA}
                    />
                  </label>
                  <label className={LABEL}>
                    Чому це важливо
                    <textarea
                      name="item_why_uk"
                      rows={4}
                      required
                      defaultValue={item.why_uk ?? ''}
                      disabled={!canEdit}
                      className={TEXTAREA}
                    />
                  </label>
                  <label className={LABEL}>
                    Практичний приклад
                    <textarea
                      name="item_practical_uk"
                      rows={4}
                      required
                      defaultValue={item.practical_uk ?? ''}
                      disabled={!canEdit}
                      className={TEXTAREA}
                    />
                  </label>
                  <label className={LABEL}>
                    Висновок для аудиторії
                    <textarea
                      name="item_takeaway_uk"
                      rows={3}
                      required
                      defaultValue={item.takeaway_uk ?? ''}
                      disabled={!canEdit}
                      className={TEXTAREA}
                    />
                  </label>
                </fieldset>
              </div>

              <label className={LABEL}>
                Sources (JSON array)
                <textarea
                  name="item_sources_json"
                  rows={5}
                  required
                  spellCheck={false}
                  defaultValue={jsonText(item.sources)}
                  disabled={!canEdit}
                  className={`${TEXTAREA} font-mono text-xs`}
                  aria-describedby={`${prefix}-sources-help`}
                />
                <span id={`${prefix}-sources-help`} className="text-xs font-normal text-slate-500">
                  Each source should include a name and an https URL.
                </span>
              </label>
            </div>
          </details>
        );
      })}
    </form>
  );
}

function VisualDirectionFields({
  revision,
  locale,
  canEdit,
  required,
}: {
  revision: WeeklyRevisionAdminRow;
  locale: 'en' | 'uk';
  canEdit: boolean;
  required: boolean;
}) {
  const english = locale === 'en';
  const displayTitle = english ? revision.display_title_en : revision.display_title_uk;
  const visualThesis = english ? revision.visual_thesis_en : revision.visual_thesis_uk;
  return (
    <>
      <label className={LABEL}>
        {english ? 'Hero / PDF display title' : 'Короткий заголовок для hero / PDF'}
        <input
          name={`display_title_${locale}`}
          minLength={8}
          maxLength={96}
          required={required}
          defaultValue={displayTitle ?? ''}
          disabled={!canEdit}
          className={FIELD}
        />
        <span className="text-xs font-normal text-slate-500">
          {english
            ? 'Reader-facing only in the hero and PDF cover · 8–96 characters. SEO, Open Graph and lists keep the edition title.'
            : 'Видимий читачеві лише в hero та PDF-обкладинці · 8–96 символів. SEO, Open Graph і списки лишають назву випуску.'}
        </span>
      </label>
      <label className={LABEL}>
        {english ? 'Internal visual thesis' : 'Внутрішня візуальна теза'}
        <textarea
          name={`visual_thesis_${locale}`}
          rows={3}
          minLength={16}
          maxLength={360}
          required={required}
          defaultValue={visualThesis ?? ''}
          disabled={!canEdit}
          className={TEXTAREA}
        />
        <span className="text-xs font-normal text-slate-500">
          {english
            ? 'Private causal direction for the no-text cover prompt · 16–360 characters. It never appears to readers.'
            : 'Приватний причинно-наслідковий напрям для no-text промпта обкладинки · 16–360 символів. Читачі його не бачать.'}
        </span>
      </label>
    </>
  );
}

function VisualRefreshDirectionPanel({
  workspace,
  revision,
  canEdit,
}: {
  workspace: WeeklyDigestWorkspace;
  revision: WeeklyRevisionAdminRow;
  canEdit: boolean;
}) {
  return (
    <section className={PANEL} aria-labelledby="visual-refresh-direction-heading">
      <p className="text-xs font-bold tracking-wide text-cyan-200 uppercase">
        Private visual-refresh draft
      </p>
      <h2 id="visual-refresh-direction-heading" className="mt-1 text-xl font-bold text-white">
        Edit the direction, then regenerate no-text prompts
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
        The published edition, SEO title, Open Graph and reader copy stay locked. Saving this
        private direction records an audit event and queues fresh prompt-only cover and story jobs;
        it never renders, uploads or replaces public pixels.
      </p>
      <form action={saveWeeklyVisualRefreshDirectionAction} className="mt-6 grid gap-6">
        <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
        <input type="hidden" name="revision_id" value={revision.id} />
        <input type="hidden" name="edit_scope" value="article" />
        <div className="grid gap-6 xl:grid-cols-2">
          <fieldset className="grid content-start gap-4">
            <legend className="mb-1 text-xs font-bold tracking-[.14em] text-[#47e4d3] uppercase">
              English direction
            </legend>
            <VisualDirectionFields revision={revision} locale="en" canEdit={canEdit} required />
          </fieldset>
          <fieldset className="grid content-start gap-4">
            <legend className="mb-1 text-xs font-bold tracking-[.14em] text-[#47e4d3] uppercase">
              Український напрям
            </legend>
            <VisualDirectionFields revision={revision} locale="uk" canEdit={canEdit} required />
          </fieldset>
        </div>
        <ActionSubmitButton
          idleLabel="Save direction and regenerate prompts"
          pendingLabel="Saving private direction…"
          disabled={!canEdit}
          className={PRIMARY}
        />
        {!canEdit ? (
          <p className="text-xs text-slate-500">Requires an AAL2 owner session.</p>
        ) : null}
      </form>
    </section>
  );
}

function ArticlePanel({
  workspace,
  canEdit,
  canReview,
  canRefreshVisualDirection,
}: {
  workspace: WeeklyDigestWorkspace;
  canEdit: boolean;
  canReview: boolean;
  canRefreshVisualDirection: boolean;
}) {
  const revision = workspace.revision;
  if (!revision) {
    return <p className={`${PANEL} text-sm text-slate-400`}>No active revision.</p>;
  }
  const articleEn = artifactFor(workspace.artifacts, 'article', 'en');
  const articleUk = artifactFor(workspace.artifacts, 'article', 'uk');
  const articleEnContent = asRecord(articleEn?.content);
  const articleUkContent = asRecord(articleUk?.content);
  const isVisualRefreshDraft = Boolean(revision.visual_refresh_source_revision_id);

  if (isVisualRefreshDraft) {
    return (
      <div className="grid gap-5">
        <VisualRefreshDirectionPanel
          workspace={workspace}
          revision={revision}
          canEdit={canRefreshVisualDirection}
        />
        <section aria-labelledby="article-build-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="article-build-heading" className="text-lg font-bold text-white">
                Published landing articles
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Carried reader copy remains read-only in this prompt-only refresh. Review only the
                new visual direction and prompts.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <ArtifactCard
              digestId={workspace.digest.id}
              artifact={articleEn}
              reviews={workspace.artifactReviews}
              canReview={false}
              label="English landing article"
            />
            <ArtifactCard
              digestId={workspace.digest.id}
              artifact={articleUk}
              reviews={workspace.artifactReviews}
              canReview={false}
              label="Ukrainian landing article"
            />
          </div>
        </section>
        <GenerationJobsSection
          digestId={workspace.digest.id}
          revisionId={workspace.revision?.id ?? null}
          jobs={workspace.generationJobs}
          attempts={workspace.generationAttempts}
          events={workspace.generationEvents}
          tab="article"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <form action={saveWeeklyRevisionAction} className={PANEL}>
        <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
        <input type="hidden" name="revision_id" value={revision.id} />
        <input type="hidden" name="edit_scope" value="article" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Article framing</h2>
            <p className="mt-2 text-sm text-slate-400">
              Titles, editorial intro and issue-level takeaways for both landing pages and PDFs.
              Identical framing keeps the current version; only real edits open a new revision.
            </p>
          </div>
          <ActionSubmitButton
            idleLabel="Save article framing"
            pendingLabel="Saving…"
            disabled={!canEdit}
            className={PRIMARY}
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <fieldset className="grid content-start gap-4">
            <legend className="mb-1 text-xs font-bold tracking-[.14em] text-[#47e4d3] uppercase">
              English article
            </legend>
            <label className={LABEL}>
              Edition title
              <input
                name="title_en"
                required
                defaultValue={revision.title_en}
                disabled={!canEdit}
                className={FIELD}
              />
            </label>
            <VisualDirectionFields
              revision={revision}
              locale="en"
              canEdit={canEdit}
              required={false}
            />
            <label className={LABEL}>
              SEO title
              <input
                name="seo_title_en"
                required
                maxLength={65}
                defaultValue={textFrom(articleEnContent as Json, 'seoTitle') || revision.title_en}
                disabled={!canEdit}
                className={FIELD}
              />
              <span className="text-xs font-normal text-slate-500">
                Search-result headline · maximum 65 characters.
              </span>
            </label>
            <label className={LABEL}>
              Theme
              <input
                name="theme_en"
                required
                defaultValue={textFrom(articleEnContent as Json, 'theme') || revision.title_en}
                disabled={!canEdit}
                className={FIELD}
              />
            </label>
            <label className={LABEL}>
              Short intro under the headline (standfirst)
              <textarea
                name="standfirst_en"
                rows={3}
                required
                defaultValue={
                  textFrom(articleEnContent as Json, 'standfirst') || revision.intro_en || ''
                }
                disabled={!canEdit}
                className={TEXTAREA}
              />
              <span className="text-xs font-normal text-slate-500">
                One compact paragraph that sells the issue before the full introduction.
              </span>
            </label>
            <label className={LABEL}>
              Meta description
              <textarea
                name="meta_description_en"
                rows={3}
                required
                maxLength={160}
                defaultValue={
                  textFrom(articleEnContent as Json, 'metaDescription') || revision.intro_en || ''
                }
                disabled={!canEdit}
                className={TEXTAREA}
              />
              <span className="text-xs font-normal text-slate-500">
                Search-result summary · maximum 160 characters.
              </span>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className={LABEL}>
                Social sharing title (Open Graph)
                <input
                  name="og_title_en"
                  maxLength={70}
                  defaultValue={
                    textFrom(articleEnContent as Json, 'ogTitle') ||
                    textFrom(articleEnContent as Json, 'seoTitle') ||
                    revision.title_en
                  }
                  disabled={!canEdit}
                  className={FIELD}
                />
                <span className="text-xs font-normal text-slate-500">
                  Headline shown when the page is shared in social apps.
                </span>
              </label>
              <label className={LABEL}>
                Social sharing summary (Open Graph)
                <textarea
                  name="og_description_en"
                  rows={2}
                  maxLength={200}
                  defaultValue={
                    textFrom(articleEnContent as Json, 'ogDescription') ||
                    textFrom(articleEnContent as Json, 'metaDescription') ||
                    revision.intro_en ||
                    ''
                  }
                  disabled={!canEdit}
                  className={TEXTAREA}
                />
                <span className="text-xs font-normal text-slate-500">
                  Description shown in social link previews · maximum 200 characters.
                </span>
              </label>
            </div>
            <label className={LABEL}>
              Introduction
              <textarea
                name="intro_en"
                rows={6}
                required
                defaultValue={revision.intro_en ?? ''}
                disabled={!canEdit}
                className={TEXTAREA}
              />
            </label>
            <label className={LABEL}>
              Editor’s note
              <textarea
                name="editor_note_en"
                rows={5}
                required
                defaultValue={revision.editor_note_en ?? ''}
                disabled={!canEdit}
                className={TEXTAREA}
              />
            </label>
            <label className={LABEL}>
              Key takeaways (one per line)
              <textarea
                name="key_takeaways_en"
                rows={6}
                required
                defaultValue={
                  Array.isArray(revision.key_takeaways_en)
                    ? revision.key_takeaways_en
                        .filter((item) => typeof item === 'string')
                        .join('\n')
                    : ''
                }
                disabled={!canEdit}
                className={TEXTAREA}
              />
            </label>
            <label className={LABEL}>
              Topics (one per line)
              <textarea
                name="topics_en"
                rows={4}
                defaultValue={listFrom(articleEnContent as Json, 'topics').join('\n')}
                disabled={!canEdit}
                className={TEXTAREA}
              />
            </label>
            <label className={LABEL}>
              Entities (one per line)
              <textarea
                name="entities_en"
                rows={4}
                defaultValue={listFrom(articleEnContent as Json, 'entities').join('\n')}
                disabled={!canEdit}
                className={TEXTAREA}
              />
            </label>
            <label className={LABEL}>
              Internal links (JSON)
              <textarea
                name="internal_links_en"
                rows={5}
                defaultValue={jsonText(articleEnContent.internalLinks ?? [], '[]')}
                disabled={!canEdit}
                className={`${TEXTAREA} font-mono text-xs`}
              />
            </label>
          </fieldset>

          <fieldset className="grid content-start gap-4">
            <legend className="mb-1 text-xs font-bold tracking-[.14em] text-[#47e4d3] uppercase">
              Ukrainian article
            </legend>
            <label className={LABEL}>
              Назва випуску
              <input
                name="title_uk"
                required
                defaultValue={revision.title_uk}
                disabled={!canEdit}
                className={FIELD}
              />
            </label>
            <VisualDirectionFields
              revision={revision}
              locale="uk"
              canEdit={canEdit}
              required={false}
            />
            <label className={LABEL}>
              SEO-заголовок
              <input
                name="seo_title_uk"
                required
                maxLength={65}
                defaultValue={textFrom(articleUkContent as Json, 'seoTitle') || revision.title_uk}
                disabled={!canEdit}
                className={FIELD}
              />
              <span className="text-xs font-normal text-slate-500">
                Заголовок у результатах пошуку · максимум 65 символів.
              </span>
            </label>
            <label className={LABEL}>
              Тема випуску
              <input
                name="theme_uk"
                required
                defaultValue={textFrom(articleUkContent as Json, 'theme') || revision.title_uk}
                disabled={!canEdit}
                className={FIELD}
              />
            </label>
            <label className={LABEL}>
              Короткий вступ під заголовком (standfirst)
              <textarea
                name="standfirst_uk"
                rows={3}
                required
                defaultValue={
                  textFrom(articleUkContent as Json, 'standfirst') || revision.intro_uk || ''
                }
                disabled={!canEdit}
                className={TEXTAREA}
              />
              <span className="text-xs font-normal text-slate-500">
                Один стислий абзац, який пояснює цінність випуску перед основним вступом.
              </span>
            </label>
            <label className={LABEL}>
              Meta description
              <textarea
                name="meta_description_uk"
                rows={3}
                required
                maxLength={160}
                defaultValue={
                  textFrom(articleUkContent as Json, 'metaDescription') || revision.intro_uk || ''
                }
                disabled={!canEdit}
                className={TEXTAREA}
              />
              <span className="text-xs font-normal text-slate-500">
                Опис у результатах пошуку · максимум 160 символів.
              </span>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className={LABEL}>
                Заголовок для соцмереж (Open Graph)
                <input
                  name="og_title_uk"
                  maxLength={70}
                  defaultValue={
                    textFrom(articleUkContent as Json, 'ogTitle') ||
                    textFrom(articleUkContent as Json, 'seoTitle') ||
                    revision.title_uk
                  }
                  disabled={!canEdit}
                  className={FIELD}
                />
                <span className="text-xs font-normal text-slate-500">
                  Заголовок у прев’ю посилання в соцмережах і месенджерах.
                </span>
              </label>
              <label className={LABEL}>
                Опис для соцмереж (Open Graph)
                <textarea
                  name="og_description_uk"
                  rows={2}
                  maxLength={200}
                  defaultValue={
                    textFrom(articleUkContent as Json, 'ogDescription') ||
                    textFrom(articleUkContent as Json, 'metaDescription') ||
                    revision.intro_uk ||
                    ''
                  }
                  disabled={!canEdit}
                  className={TEXTAREA}
                />
                <span className="text-xs font-normal text-slate-500">
                  Текст у прев’ю посилання · максимум 200 символів.
                </span>
              </label>
            </div>
            <label className={LABEL}>
              Вступ
              <textarea
                name="intro_uk"
                rows={6}
                required
                defaultValue={revision.intro_uk ?? ''}
                disabled={!canEdit}
                className={TEXTAREA}
              />
            </label>
            <label className={LABEL}>
              Слово редактора
              <textarea
                name="editor_note_uk"
                rows={5}
                required
                defaultValue={revision.editor_note_uk ?? ''}
                disabled={!canEdit}
                className={TEXTAREA}
              />
            </label>
            <label className={LABEL}>
              Ключові висновки (по одному в рядку)
              <textarea
                name="key_takeaways_uk"
                rows={6}
                required
                defaultValue={
                  Array.isArray(revision.key_takeaways_uk)
                    ? revision.key_takeaways_uk
                        .filter((item) => typeof item === 'string')
                        .join('\n')
                    : ''
                }
                disabled={!canEdit}
                className={TEXTAREA}
              />
            </label>
            <label className={LABEL}>
              Теми (по одній у рядку)
              <textarea
                name="topics_uk"
                rows={4}
                defaultValue={listFrom(articleUkContent as Json, 'topics').join('\n')}
                disabled={!canEdit}
                className={TEXTAREA}
              />
            </label>
            <label className={LABEL}>
              Сутності (по одній у рядку)
              <textarea
                name="entities_uk"
                rows={4}
                defaultValue={listFrom(articleUkContent as Json, 'entities').join('\n')}
                disabled={!canEdit}
                className={TEXTAREA}
              />
            </label>
            <label className={LABEL}>
              Внутрішні посилання (JSON)
              <textarea
                name="internal_links_uk"
                rows={5}
                defaultValue={jsonText(articleUkContent.internalLinks ?? [], '[]')}
                disabled={!canEdit}
                className={`${TEXTAREA} font-mono text-xs`}
              />
            </label>
          </fieldset>
        </div>
      </form>

      <section aria-labelledby="article-build-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="article-build-heading" className="text-lg font-bold text-white">
              Versioned landing articles
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Saving the framing creates current EN and UK article artifacts on the new revision;
              approve each locale independently.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <ArtifactCard
            digestId={workspace.digest.id}
            artifact={articleEn}
            reviews={workspace.artifactReviews}
            canReview={canReview}
            label="English landing article"
          />
          <ArtifactCard
            digestId={workspace.digest.id}
            artifact={articleUk}
            reviews={workspace.artifactReviews}
            canReview={canReview}
            label="Ukrainian landing article"
          />
        </div>
      </section>

      <GenerationJobsSection
        digestId={workspace.digest.id}
        revisionId={workspace.revision?.id ?? null}
        jobs={workspace.generationJobs}
        attempts={workspace.generationAttempts}
        events={workspace.generationEvents}
        tab="article"
      />
    </div>
  );
}

function ReplacementAssetForm({
  workspace,
  artifactType,
  slotKey,
  canEdit,
  revisionItemId,
  locale = 'neutral',
}: {
  workspace: WeeklyDigestWorkspace;
  artifactType: 'cover' | 'story_image' | 'social_asset' | 'pdf' | 'thumbnail';
  slotKey: string;
  canEdit: boolean;
  revisionItemId?: string;
  locale?: 'neutral' | 'en' | 'uk';
}) {
  if (!workspace.revision) return null;
  return (
    <WeeklyReplacementUploadForm
      weeklyDigestId={workspace.digest.id}
      revisionId={workspace.revision.id}
      artifactType={artifactType}
      slotKey={slotKey}
      canEdit={canEdit}
      revisionItemId={revisionItemId}
      locale={locale}
    />
  );
}

function VisualsPanel({
  workspace,
  canEdit,
  canReview,
  canRefreshVisuals,
}: {
  workspace: WeeklyDigestWorkspace;
  canEdit: boolean;
  canReview: boolean;
  canRefreshVisuals: boolean;
}) {
  const revision = workspace.revision;
  if (!revision) return <p className={`${PANEL} text-sm text-slate-400`}>No active revision.</p>;
  const isVisualRefreshDraft = Boolean(revision.visual_refresh_source_revision_id);
  const canChangeVisuals = canEdit && (!isVisualRefreshDraft || canRefreshVisuals);
  // Carried images are provenance-only in this lane. A review decision belongs
  // only to a newly staged replacement, never to a historical public asset.
  // Staged refresh pixels can alter an already-published edition, so the UI
  // must mirror the owner+AAL2 review gate enforced by the RPC. Ordinary
  // draft assets retain the existing editor-review affordance.
  const canReviewVisuals = canReview && (!isVisualRefreshDraft || canRefreshVisuals);
  const cover = artifactFor(workspace.artifacts, 'cover', 'neutral');
  const coverIsStaged = isWeeklyVisualRefreshStagedAsset(cover?.metadata);
  const stagedVisualAssets = isVisualRefreshDraft
    ? workspace.artifacts.filter(
        (artifact) =>
          (artifact.artifact_type === 'cover' || artifact.artifact_type === 'story_image') &&
          artifact.is_current &&
          isWeeklyVisualRefreshStagedAsset(artifact.metadata),
      )
    : [];
  const approvedStagedVisualAssets = stagedVisualAssets.filter(
    (artifact) => artifact.generation_status === 'ready' && artifact.review_status === 'approved',
  );
  const coverPromptArtifact = workspace.artifacts.find(
    (artifact) =>
      artifact.artifact_type === 'story_prompt_set' && artifact.slot_key === COVER_PROMPT_SLOT,
  );
  const coverPromptSet = parseStoryPromptSetContent(coverPromptArtifact?.content);
  const coverSlot = storyImageSlotState(cover);
  const promptPromotion = evaluatePromptPromotionGate(
    promptPromotionStoriesFromArtifacts({
      storyIds: workspace.items.map((item) => item.id),
      artifacts: workspace.artifacts,
    }),
  );
  const socialAssets = workspace.artifacts.filter(
    (artifact) =>
      artifact.artifact_type === 'social_asset' && artifact.mime_type?.startsWith('image/'),
  );

  return (
    <div className="grid gap-7">
      {isVisualRefreshDraft ? (
        <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm text-cyan-100">
          <p className="font-bold">Private staged visual refresh</p>
          <p className="mt-1 leading-6 text-cyan-100/80">
            Regenerate no-text prompts, then upload a private replacement for the cover or an
            individual story. Each new file goes through QA and owner review first. The live edition
            remains unchanged until you explicitly apply selected approved images below.
          </p>
          <p className="mt-2 text-xs leading-5 text-cyan-100/70">
            Applying images changes only the public cover/story pixels. It never changes published
            text, SEO or Open Graph titles, PDF, or existing social materials.
          </p>
          {!canRefreshVisuals ? (
            <p className="mt-2 text-xs text-cyan-100/70">
              Prompt regeneration, private uploads, review approval and application require an AAL2
              owner session.
            </p>
          ) : null}
          {stagedVisualAssets.length > 0 ? (
            <form action={applyWeeklyVisualRefreshAssetsAction} className="mt-4 grid gap-3">
              <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
              <input type="hidden" name="revision_id" value={revision.id} />
              <fieldset className="grid gap-2">
                <legend className="text-xs font-bold tracking-wide text-cyan-100 uppercase">
                  Select approved images to apply
                </legend>
                {stagedVisualAssets.map((artifact) => {
                  const isApproved =
                    artifact.generation_status === 'ready' && artifact.review_status === 'approved';
                  const item = artifact.revision_item_id
                    ? workspace.items.find(
                        (candidate) => candidate.id === artifact.revision_item_id,
                      )
                    : null;
                  const label =
                    artifact.artifact_type === 'cover'
                      ? 'Weekly cover'
                      : `Story ${item?.rank ?? 'image'}`;
                  return (
                    <label
                      key={artifact.id}
                      className="flex items-center gap-2 rounded-lg border border-cyan-200/15 bg-black/10 px-3 py-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        name="staged_artifact_id"
                        value={artifact.id}
                        defaultChecked={isApproved}
                        disabled={!isApproved || !canRefreshVisuals}
                      />
                      <span className="font-semibold text-cyan-50">{label}</span>
                      <span className="ml-auto text-cyan-100/70">
                        {isApproved ? 'approved' : artifact.review_status}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
              <ActionSubmitButton
                idleLabel={`Apply selected approved image${approvedStagedVisualAssets.length === 1 ? '' : 's'} to public edition`}
                pendingLabel="Applying reviewed images…"
                disabled={!canRefreshVisuals || approvedStagedVisualAssets.length === 0}
                className={PRIMARY}
              />
              {approvedStagedVisualAssets.length === 0 ? (
                <p className="text-xs text-cyan-100/70">
                  New uploads stay private until QA succeeds and an owner approves them.
                </p>
              ) : null}
            </form>
          ) : null}
        </section>
      ) : null}
      <section aria-labelledby="cover-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="cover-heading" className="text-xl font-bold text-white">
              Weekly cover composition
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Copy the cover prompt, generate the image in your tool, then upload it here. Channel
              crops still compose automatically from the approved cover.
            </p>
          </div>
          <form action={enqueueWeeklyGenerationAction}>
            <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
            <input type="hidden" name="revision_id" value={revision.id} />
            <input type="hidden" name="job_type" value="cover" />
            <input type="hidden" name="locale" value="neutral" />
            <input type="hidden" name="slot_key" value="cover:neutral" />
            <ActionSubmitButton
              idleLabel={coverPromptSet ? 'Regenerate cover prompt' : 'Generate cover prompt'}
              pendingLabel="Queueing cover…"
              disabled={!canChangeVisuals}
              className={PRIMARY}
            />
          </form>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <ArtifactCard
            digestId={workspace.digest.id}
            artifact={cover}
            reviews={workspace.artifactReviews}
            canReview={canReviewVisuals && (!isVisualRefreshDraft || coverIsStaged)}
            label="Master cover"
            imagePreview
          />
          <StoryPromptSetPanel
            itemId="cover"
            prompts={coverPromptSet?.prompts ?? []}
            policy={coverPromptSet?.policy ?? null}
            generatedAt={coverPromptSet?.generatedAt ?? null}
            slotState={coverSlot}
            weeklyDigestId={workspace.digest.id}
            promptSetArtifactId={coverPromptArtifact?.id}
            imageArtifactId={cover?.id}
            ownerFeedback={{
              ...ownerFeedbackFromImageMetadata(cover?.metadata),
              ...coverPromptSet?.ownerFeedback,
            }}
            mappingGateIssues={coverPromptSet?.mappingGateIssues ?? []}
            canEdit={canChangeVisuals}
          >
            <ReplacementAssetForm
              workspace={workspace}
              artifactType="cover"
              slotKey="cover:neutral"
              canEdit={canChangeVisuals}
            />
          </StoryPromptSetPanel>
        </div>
      </section>

      <section aria-labelledby="story-images-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="story-images-heading" className="text-xl font-bold text-white">
              Story illustrations
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Copy a concept, generate the image in your tool, then upload it on the same card. Each
              visual must depict that news item, not generic AI decoration.
            </p>
            <p
              className={`mt-2 text-xs font-bold ${promptPromotionClass(promptPromotion)}`}
              data-testid="prompt-promotion-gate"
            >
              {promptPromotion.label}
              {promptPromotion.detail ? ` · ${promptPromotion.detail}` : ''}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-5 xl:grid-cols-2">
          {workspace.items.map((item) => {
            const artifact = artifactFor(workspace.artifacts, 'story_image', undefined, item.id);
            const promptArtifact = artifactFor(
              workspace.artifacts,
              'story_prompt_set',
              undefined,
              item.id,
            );
            const promptSet = parseStoryPromptSetContent(promptArtifact?.content);
            const promptReadiness = storyPromptReadiness(
              promptSet?.prompts ?? [],
              artifact?.metadata,
            );
            const imageSlot = storyImageSlotState(artifact);
            const slotKey = `story-image:${item.id}`;
            const artifactIsStaged = isWeeklyVisualRefreshStagedAsset(artifact?.metadata);
            const job = latestJobForSlot(workspace.generationJobs, 'story_image', {
              revisionItemId: item.id,
            });
            const storyCostEvents = workspace.generationCosts.filter(
              (event) => asRecord(event.metadata).revision_item_id === item.id,
            );
            const preciseCostEvents = storyCostEvents.filter(
              (event) => asRecord(event.metadata).cost_granularity === 'provider_call',
            );
            const costOf = (events: typeof storyCostEvents) =>
              events.reduce((sum, event) => sum + Number(event.cost_usd || 0), 0);
            const costSummary = {
              totalUsd: costOf(storyCostEvents),
              renderUsd: costOf(preciseCostEvents.filter((event) => event.kind === 'image')),
              visionUsd: costOf(preciseCostEvents.filter((event) => event.kind === 'llm')),
              legacyUsd: costOf(
                storyCostEvents.filter(
                  (event) => asRecord(event.metadata).cost_granularity !== 'provider_call',
                ),
              ),
              eventCount: storyCostEvents.length,
              jobCount: new Set(storyCostEvents.map((event) => event.job_id).filter(Boolean)).size,
            };
            return (
              <div key={item.id} className="grid content-start gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white">
                      {item.rank}. {item.title_en}
                    </p>
                    <p className="mt-1 text-xs text-slate-400" data-testid="story-prompt-readiness">
                      {promptReadiness.label}
                      {promptReadiness.detail ? ` · ${promptReadiness.detail}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {job ? <StatusPill value={job.status} /> : null}
                    <form action={enqueueWeeklyGenerationAction}>
                      <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
                      <input type="hidden" name="revision_id" value={revision.id} />
                      <input type="hidden" name="job_type" value="story_image" />
                      <input type="hidden" name="locale" value="neutral" />
                      <input type="hidden" name="slot_key" value={slotKey} />
                      <input type="hidden" name="revision_item_id" value={item.id} />
                      <ActionSubmitButton
                        idleLabel={promptSet ? 'Regenerate prompts' : 'Generate prompts'}
                        pendingLabel="Queueing…"
                        disabled={!canChangeVisuals}
                        className={SECONDARY}
                      />
                    </form>
                  </div>
                </div>
                {job?.status === 'queued' ? (
                  <p className="rounded-xl border border-amber-400/20 bg-amber-400/6 px-3 py-2 text-xs text-amber-100">
                    Queued — reload this tab after the job succeeds to see the new prompts.
                  </p>
                ) : null}
                {job?.status === 'running' ? (
                  <p className="rounded-xl border border-cyan-400/20 bg-cyan-400/6 px-3 py-2 text-xs text-cyan-100">
                    Generating — reload this tab when status becomes succeeded.
                  </p>
                ) : null}
                {job?.last_error ? (
                  <p className="rounded-xl border border-red-400/25 bg-red-400/8 px-3 py-2 text-xs whitespace-pre-wrap text-red-100">
                    {job.last_error}
                  </p>
                ) : null}
                <StoryPromptSetPanel
                  itemId={item.id}
                  prompts={promptSet?.prompts ?? []}
                  policy={promptSet?.policy ?? null}
                  generatedAt={promptSet?.generatedAt ?? null}
                  slotState={imageSlot}
                  readinessLabel={promptReadiness.label}
                  readinessDetail={promptReadiness.detail}
                  weeklyDigestId={workspace.digest.id}
                  promptSetArtifactId={promptArtifact?.id}
                  imageArtifactId={artifact?.id}
                  ownerFeedback={{
                    ...ownerFeedbackFromImageMetadata(artifact?.metadata),
                    ...promptSet?.ownerFeedback,
                  }}
                  mappingGateIssues={promptSet?.mappingGateIssues ?? []}
                  canEdit={canChangeVisuals}
                >
                  <ReplacementAssetForm
                    workspace={workspace}
                    artifactType="story_image"
                    slotKey={slotKey}
                    revisionItemId={item.id}
                    canEdit={canChangeVisuals}
                  />
                </StoryPromptSetPanel>
                <ArtifactCard
                  digestId={workspace.digest.id}
                  artifact={artifact}
                  reviews={workspace.artifactReviews}
                  canReview={canReviewVisuals && (!isVisualRefreshDraft || artifactIsStaged)}
                  label={`Story ${item.rank} illustration`}
                  imagePreview
                  variantSelection={
                    isVisualRefreshDraft
                      ? undefined
                      : {
                          canEdit,
                          revisionId: revision.id,
                          revisionItemId: item.id,
                          slotKey,
                          costSummary,
                        }
                  }
                />
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="derivatives-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="derivatives-heading" className="text-xl font-bold text-white">
              Channel derivatives
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Open Graph, feed and story crops are generated from the approved master cover.
            </p>
          </div>
          {!isVisualRefreshDraft ? (
            <form action={enqueueWeeklyGenerationAction}>
              <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
              <input type="hidden" name="revision_id" value={revision.id} />
              <input type="hidden" name="job_type" value="social_asset" />
              <input type="hidden" name="locale" value="neutral" />
              <input type="hidden" name="slot_key" value="social-assets:neutral" />
              <ActionSubmitButton
                idleLabel="Generate all derivatives"
                pendingLabel="Queueing assets…"
                disabled={!canEdit || cover?.review_status !== 'approved'}
                className={SECONDARY}
              />
            </form>
          ) : null}
        </div>
        {socialAssets.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {socialAssets.map((artifact) => (
              <ArtifactCard
                key={artifact.id}
                digestId={workspace.digest.id}
                artifact={artifact}
                reviews={workspace.artifactReviews}
                canReview={canReviewVisuals}
                label={textFrom(artifact.metadata, 'format') || artifact.slot_key}
                imagePreview
              />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-500">
            Approve the master cover before generating channel crops.
          </p>
        )}
      </section>

      <GenerationJobsSection
        digestId={workspace.digest.id}
        revisionId={workspace.revision?.id ?? null}
        jobs={workspace.generationJobs}
        attempts={workspace.generationAttempts}
        events={workspace.generationEvents}
        tab="visuals"
      />
    </div>
  );
}

const SOCIAL_LIMITS: Record<string, number> = {
  telegram: socialCopyLimit('telegram'),
  facebook: socialCopyLimit('facebook'),
  linkedin: socialCopyLimit('linkedin'),
  x: socialCopyLimit('x'),
  threads: socialCopyLimit('threads'),
  instagram: socialCopyLimit('instagram'),
};

function SocialPanel({
  workspace,
  canEdit,
  canReview,
  canDisable,
  canSchedule,
}: {
  workspace: WeeklyDigestWorkspace;
  canEdit: boolean;
  canReview: boolean;
  canDisable: boolean;
  canSchedule: boolean;
}) {
  const revision = workspace.revision;
  const postsByChannel = new Map(workspace.socialPosts.map((post) => [post.channel, post]));
  const configuredLocales = new Map(
    workspace.localeMap
      .filter((entry) => entry.locale === 'en' || entry.locale === 'uk')
      .map((entry) => [entry.channel, entry.locale as 'en' | 'uk']),
  );
  const socialMatrix = Object.fromEntries(
    Object.entries(WEEKLY_SOCIAL_MATRIX).map(([channel, fallback]) => [
      channel,
      configuredLocales.get(channel) ?? fallback,
    ]),
  ) as Record<keyof typeof WEEKLY_SOCIAL_MATRIX, 'en' | 'uk'>;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Six-channel social review</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Each channel has one fixed language, its own character limit, preview, schedule and
            approval. Facts should represent the full edition.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-400">
            Times shown in Europe/Kyiv
          </p>
          {revision ? (
            <form action={enqueueWeeklyGenerationAction}>
              <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
              <input type="hidden" name="revision_id" value={revision.id} />
              <input type="hidden" name="job_type" value="social_copy" />
              <input type="hidden" name="locale" value="neutral" />
              <input type="hidden" name="slot_key" value="social-copy:neutral" />
              <ActionSubmitButton
                idleLabel={
                  workspace.socialPosts.length > 0
                    ? 'Regenerate social package'
                    : 'Generate social package'
                }
                pendingLabel="Queueing social package…"
                disabled={!canEdit}
                className={PRIMARY}
              />
            </form>
          ) : null}
        </div>
      </div>

      {(
        Object.entries(socialMatrix) as Array<[keyof typeof WEEKLY_SOCIAL_MATRIX, 'en' | 'uk']>
      ).map(([channel, locale]) => {
        const post = postsByChannel.get(channel);
        if (!post) {
          return (
            <section
              key={channel}
              className="rounded-2xl border border-red-400/20 bg-red-400/6 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-white">{channelLabel(channel)}</h3>
                <StatusPill value="failed" />
              </div>
              <p className="mt-2 text-sm text-red-200">
                Required {locale.toUpperCase()} variant is missing. Use the social package button
                above to generate all six channel variants.
              </p>
            </section>
          );
        }

        const quality = qualityReport(post.quality_report);
        const postReviews = workspace.socialPostReviews
          .filter((review) => review.social_post_id === post.id)
          .slice(0, 5);
        const enabled = post.publish_enabled;
        const meta = asRecord(post.meta);
        const socialQuality = asRecord(post.quality_report);
        const writer = asRecord(
          socialQuality.writer && typeof socialQuality.writer === 'object'
            ? socialQuality.writer
            : meta.writer,
        );
        const critic = asRecord(socialQuality.critic);
        const hookAngle =
          (typeof meta.hook_angle === 'string' && meta.hook_angle) ||
          (typeof socialQuality.hookAngle === 'string' && socialQuality.hookAngle) ||
          null;
        const platformFitScore =
          typeof socialQuality.platformFitScore === 'number'
            ? socialQuality.platformFitScore
            : typeof critic.platformFitScore === 'number'
              ? critic.platformFitScore
              : null;
        const media = workspace.socialAssetPreviews[post.id] ?? { assets: [], blockers: [] };
        const assetPreviewUrls = media.assets.map((asset) => asset.url);
        const channelId = channel as SocialChannel;
        const carousel = parseInstagramCarouselSpec(meta.instagram_carousel);
        const threadParts = Array.isArray(post.content_parts)
          ? post.content_parts.filter((part): part is string => typeof part === 'string')
          : [];
        const destinationUrl =
          post.url || cleanWeeklyDestinationUrl(locale, workspace.digest.slug, post.utm_url);
        const hasQualityBlockers = quality.blocking > 0;
        const hookCandidates = Array.isArray(meta.hook_candidates)
          ? meta.hook_candidates.filter(
              (candidate): candidate is string =>
                typeof candidate === 'string' && Boolean(candidate.trim()),
            )
          : Array.isArray(socialQuality.hookCandidates)
            ? socialQuality.hookCandidates.filter(
                (candidate): candidate is string =>
                  typeof candidate === 'string' && Boolean(candidate.trim()),
              )
            : [];
        const linkedinDocument =
          channel === 'linkedin' && typeof meta.document_artifact_id === 'string'
            ? workspace.artifacts.find((artifact) => artifact.id === meta.document_artifact_id)
            : undefined;
        return (
          <section
            key={channel}
            className={PANEL}
            aria-labelledby={`social-${channel}-heading`}
            data-social-panel={channel}
            data-testid={`social-panel-${channel}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 id={`social-${channel}-heading`} className="mr-auto text-lg font-bold text-white">
                {channelLabel(channel)}
              </h3>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-bold text-slate-300 uppercase">
                {locale}
              </span>
              <StatusPill value={post.status} />
              {!enabled ? <StatusPill value="paused" /> : null}
            </div>
            {hasQualityBlockers ? (
              <div
                className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/6 px-3 py-2.5"
                role="status"
              >
                <p className="text-sm font-semibold text-amber-100">
                  Generation repair needed · {quality.blocking} check
                  {quality.blocking === 1 ? '' : 's'}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  This draft is held outside approval until the channel passes validation. Technical
                  details are collapsed under Quality checks.
                </p>
              </div>
            ) : null}
            {channel === 'threads' && post.status === 'needs_reconciliation' ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/25 bg-amber-400/7 p-3">
                <p className="text-sm text-amber-100">
                  A partial sequence is stored. Resume continues from the last published reply and
                  does not repost the root.
                </p>
                <form action={resumeWeeklyThreadsSequenceAction}>
                  <input type="hidden" name="social_post_id" value={post.id} />
                  <ActionSubmitButton
                    idleLabel="Resume sequence"
                    pendingLabel="Resuming…"
                    disabled={!canSchedule}
                    className={SECONDARY}
                  />
                </form>
              </div>
            ) : null}

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,.55fr)]">
              <form action={saveWeeklySocialAction} className="grid gap-4">
                <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
                <input type="hidden" name="revision_id" value={workspace.revision?.id ?? ''} />
                <input type="hidden" name="social_post_id" value={post.id} />
                <input type="hidden" name="channel" value={channel} />
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="time_zone" value="Europe/Kyiv" />
                {socialFormHas(channelId, 'post_copy') || socialFormHas(channelId, 'caption') ? (
                  <label className={LABEL}>
                    {socialFormHas(channelId, 'caption') ? 'Caption' : 'Post copy'}
                    <textarea
                      id={`social-post-text-${post.id}`}
                      name="post_text"
                      rows={socialFormHas(channelId, 'caption') ? 6 : 8}
                      required
                      maxLength={SOCIAL_LIMITS[channel]}
                      defaultValue={post.post_text ?? ''}
                      disabled={!canEdit}
                      className={TEXTAREA}
                      aria-describedby={`social-${post.id}-limit`}
                      data-testid={`social-field-${socialFormHas(channelId, 'caption') ? 'caption' : 'post-copy'}`}
                    />
                    <SocialCharCount
                      id={`social-${post.id}-limit`}
                      textareaId={`social-post-text-${post.id}`}
                      limit={SOCIAL_LIMITS[channel]}
                      initialLength={(post.post_text ?? '').length}
                    />
                  </label>
                ) : null}
                {socialFormHas(channelId, 'thread_parts') ? (
                  <div className="grid gap-3" data-testid="social-field-thread-parts">
                    <p className="text-sm font-semibold text-slate-200">Thread parts (3–5)</p>
                    {[0, 1, 2, 3, 4].map((index) => (
                      <label key={`${post.id}-part-${index}`} className={LABEL}>
                        Part {index + 1}
                        <textarea
                          name={`content_part_${index + 1}`}
                          rows={4}
                          maxLength={threadsPartLimit()}
                          defaultValue={threadParts[index] ?? ''}
                          disabled={!canEdit}
                          className={TEXTAREA}
                          data-testid={`social-field-threads-part-${index + 1}`}
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
                {socialFormHas(channelId, 'linkedin_document') ? (
                  <div
                    className="grid gap-4 rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-4 md:grid-cols-2"
                    data-testid="social-linkedin-document"
                  >
                    <label className={LABEL}>
                      Manual PDF/document status
                      <select
                        name="linkedin_document_status"
                        defaultValue={
                          typeof meta.document_status === 'string'
                            ? meta.document_status
                            : 'not_started'
                        }
                        disabled={!canEdit}
                        className={FIELD}
                      >
                        <option value="not_started">Not started</option>
                        <option value="draft_ready">Draft prepared</option>
                        <option value="ready">Ready for manual upload</option>
                        <option value="completed">Uploaded manually</option>
                      </select>
                    </label>
                    <label className={LABEL}>
                      Manual delivery note
                      <input
                        name="linkedin_document_note"
                        defaultValue={
                          typeof meta.document_note === 'string' ? meta.document_note : ''
                        }
                        disabled={!canEdit}
                        maxLength={500}
                        className={FIELD}
                        placeholder="File/version or handoff note"
                      />
                    </label>
                    {linkedinDocument?.external_url ? (
                      <a
                        href={linkedinDocument.external_url}
                        target="_blank"
                        rel="noreferrer"
                        className="self-end text-sm font-bold text-[#47e4d3] underline underline-offset-4"
                      >
                        Open generated 7-page document
                      </a>
                    ) : (
                      <p className="self-end text-xs text-slate-500">
                        LinkedIn PDF is a document attachment, not a channel image.
                      </p>
                    )}
                  </div>
                ) : null}
                {socialFormHas(channelId, 'first_comment') ? (
                  <label className={LABEL}>
                    Self-reply
                    <textarea
                      name="first_comment"
                      rows={3}
                      defaultValue={post.first_comment ?? ''}
                      disabled={!canEdit}
                      className={TEXTAREA}
                      data-testid="social-field-first-comment"
                    />
                    <span className="text-xs font-normal text-slate-500">
                      Keep the tracked URL in this self-reply. The root post stays link-free.
                    </span>
                  </label>
                ) : null}
                {socialFormHas(channelId, 'carousel_preview') ? (
                  <div
                    className="rounded-xl border border-white/10 bg-black/20 p-3"
                    data-testid="social-instagram-carousel"
                  >
                    <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                      7-slide carousel (read-only)
                    </p>
                    {carousel ? (
                      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                        {carousel.slides.map((slide, index) => (
                          <li
                            key={`${post.id}-slide-${index}`}
                            className="rounded-lg border border-white/10 p-2 text-xs text-slate-400"
                            data-testid={`social-instagram-slide-${index + 1}`}
                          >
                            <p className="font-bold text-slate-200">
                              {index + 1}. {slide.kind}
                            </p>
                            <p className="mt-1 text-slate-300">{slide.headline}</p>
                            {'body' in slide ? <p className="mt-1">{slide.body}</p> : null}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-2 text-xs text-amber-100">
                        Carousel spec is missing. Regenerate the social package.
                      </p>
                    )}
                  </div>
                ) : null}
                {socialFormHas(channelId, 'destination') ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className={LABEL}>
                      Destination URL
                      <input
                        type="url"
                        name="url"
                        required
                        defaultValue={destinationUrl}
                        disabled={!canEdit}
                        className={FIELD}
                      />
                      <span className="text-xs font-normal text-slate-500">
                        Clean weekly page URL (no UTM). Tracked URL below keeps campaign params.
                      </span>
                    </label>
                    <label className={LABEL}>
                      Tracked URL
                      <input
                        type="url"
                        name="utm_url"
                        defaultValue={post.utm_url ?? ''}
                        disabled={!canEdit}
                        className={FIELD}
                      />
                    </label>
                  </div>
                ) : null}
                <label className={LABEL}>
                  Image alt text
                  <textarea
                    name="alt_text"
                    rows={2}
                    required
                    defaultValue={post.alt_text ?? ''}
                    disabled={!canEdit}
                    className={TEXTAREA}
                  />
                </label>
                <div
                  className="rounded-xl border border-white/10 bg-black/20 p-3"
                  data-testid="social-media-summary"
                >
                  <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                    Media summary
                  </p>
                  {media.blockers.length > 0 ? (
                    <ul className="mt-2 grid gap-1 text-xs text-amber-100">
                      {media.blockers.map((blocker) => (
                        <li key={blocker.code}>{blocker.message}</li>
                      ))}
                    </ul>
                  ) : null}
                  {media.assets.length > 0 ? (
                    <div
                      className={`mt-3 grid gap-2 ${media.assets.length > 1 ? 'grid-cols-2' : ''}`}
                    >
                      {media.assets.map((asset, index) => (
                        <figure
                          key={`${post.id}-asset-${asset.artifactId ?? index}`}
                          className="overflow-hidden rounded-lg border border-white/10"
                        >
                          <a href={asset.url} target="_blank" rel="noreferrer" className="block">
                            <Image
                              src={asset.url}
                              alt={
                                post.alt_text
                                  ? `${post.alt_text}${media.assets.length > 1 ? ` (${index + 1})` : ''}`
                                  : `Social asset ${index + 1} for ${channelLabel(channel)}`
                              }
                              width={channel === 'instagram' ? 540 : 600}
                              height={channel === 'instagram' ? 675 : 315}
                              className="h-auto w-full object-cover"
                              sizes="(max-width: 1280px) 90vw, 28vw"
                            />
                          </a>
                          <figcaption className="px-2 py-1.5 text-[11px] leading-4 text-slate-500">
                            {[
                              asset.slotKey ?? asset.artifactType,
                              asset.mimeType,
                              asset.width && asset.height ? `${asset.width}×${asset.height}` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-amber-100">
                      No channel images yet. Generate Social assets on the Visuals tab, then
                      regenerate social copy if assets stay empty.
                    </p>
                  )}
                </div>
                <label className={LABEL}>
                  Scheduled time in Kyiv
                  <input
                    type="datetime-local"
                    name="scheduled_for_local"
                    required
                    defaultValue={localDateTimeInput(post.scheduled_for)}
                    readOnly={!canEdit || !canSchedule}
                    aria-readonly={!canEdit || !canSchedule}
                    className={FIELD}
                  />
                  {!canSchedule ? (
                    <span className="text-xs font-normal text-slate-500">
                      Schedule changes require an owner with AAL2.
                    </span>
                  ) : null}
                </label>
                <label className={LABEL}>
                  Review note
                  <textarea
                    name="review_note"
                    rows={2}
                    maxLength={2000}
                    disabled={!canEdit}
                    className={TEXTAREA}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <ActionSubmitButton
                    name="intent"
                    value="save"
                    idleLabel="Save draft"
                    pendingLabel="Saving…"
                    disabled={!canEdit}
                    className={SECONDARY}
                  />
                  <ActionSubmitButton
                    name="intent"
                    value="approved"
                    idleLabel="Save & approve"
                    pendingLabel="Approving…"
                    disabled={!canReview || hasQualityBlockers}
                    className={PRIMARY}
                    title={
                      hasQualityBlockers
                        ? 'Fix quality blockers before approving this channel'
                        : undefined
                    }
                  />
                  <ActionSubmitButton
                    name="intent"
                    value="changes_requested"
                    idleLabel="Request changes"
                    pendingLabel="Saving request…"
                    disabled={!canReview}
                    className={SECONDARY}
                  />
                </div>
              </form>

              <aside className="grid content-start gap-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                    {channelLabel(channel)} preview
                  </p>
                  <p className="mt-4 text-sm leading-6 whitespace-pre-wrap text-slate-200">
                    {post.post_text || 'No copy yet.'}
                  </p>
                  {Array.isArray(post.content_parts) && post.content_parts.length > 0 ? (
                    <ol className="mt-4 grid gap-2 border-l border-white/10 pl-4 text-xs leading-5 text-slate-400">
                      {post.content_parts.flatMap((part, index) =>
                        typeof part === 'string' ? (
                          <li key={`${post.id}-part-${index}`}>{part}</li>
                        ) : (
                          []
                        ),
                      )}
                    </ol>
                  ) : null}
                  {post.url || destinationUrl ? (
                    <p className="mt-4 truncate text-xs text-[#47e4d3]">
                      {post.url || destinationUrl}
                    </p>
                  ) : null}
                  {assetPreviewUrls.length > 0 ? (
                    <div
                      className={`mt-4 grid gap-2 ${assetPreviewUrls.length > 1 ? 'grid-cols-2' : ''}`}
                    >
                      {assetPreviewUrls
                        .slice(0, channel === 'instagram' ? 7 : 4)
                        .map((url, index) => (
                          <Image
                            key={`${post.id}-preview-${index}`}
                            src={url}
                            alt={
                              post.alt_text
                                ? `${post.alt_text}${assetPreviewUrls.length > 1 ? ` (${index + 1})` : ''}`
                                : `Preview asset ${index + 1}`
                            }
                            width={channel === 'instagram' ? 270 : 300}
                            height={channel === 'instagram' ? 338 : 160}
                            className="h-auto w-full rounded-lg object-cover"
                            sizes="(max-width: 1280px) 45vw, 14vw"
                          />
                        ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-white/10 p-4">
                  <dl className="grid gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="font-bold text-slate-500 uppercase">Hook angle</dt>
                      <dd className="mt-1 text-slate-300">{hookAngle ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-slate-500 uppercase">Writer model</dt>
                      <dd className="mt-1 break-words text-slate-300">
                        {[writer.provider, writer.model]
                          .filter((value) => typeof value === 'string')
                          .join(' · ') || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold text-slate-500 uppercase">Critic model</dt>
                      <dd className="mt-1 break-words text-slate-300">
                        {[critic.provider, critic.model]
                          .filter((value) => typeof value === 'string')
                          .join(' · ') || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold text-slate-500 uppercase">Platform fit</dt>
                      <dd className="mt-1 text-slate-300">
                        {typeof platformFitScore === 'number' ? `${platformFitScore}/100` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold text-slate-500 uppercase">Generation cost</dt>
                      <dd className="mt-1 text-slate-300">
                        {typeof asRecord(writer.usage).estimatedCostUsd === 'number' ||
                        typeof asRecord(critic.usage).estimatedCostUsd === 'number'
                          ? `$${(
                              (typeof asRecord(writer.usage).estimatedCostUsd === 'number'
                                ? (asRecord(writer.usage).estimatedCostUsd as number)
                                : 0) +
                              (typeof asRecord(critic.usage).estimatedCostUsd === 'number'
                                ? (asRecord(critic.usage).estimatedCostUsd as number)
                                : 0)
                            ).toFixed(6)}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold text-slate-500 uppercase">Audience</dt>
                      <dd className="mt-1 text-slate-300">Builders, founders & AI leaders</dd>
                    </div>
                  </dl>
                  <HookCandidatePicker channel={channelId} candidates={hookCandidates} />
                </div>

                <div className="rounded-xl border border-white/10 p-4">
                  {quality.items.length ? (
                    <details>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-white marker:content-none">
                        <span>Quality checks</span>
                        <span
                          className={
                            quality.blocking
                              ? 'text-xs font-semibold text-amber-200'
                              : 'text-xs font-semibold text-slate-400'
                          }
                        >
                          {quality.blocking
                            ? `${quality.blocking} repair checks`
                            : `${quality.warnings} notes`}
                        </span>
                      </summary>
                      <ul className="mt-3 grid gap-2 text-xs leading-5 text-slate-400">
                        {quality.items.map((item) => (
                          <li
                            key={item.key}
                            className={`rounded-lg border p-2.5 ${
                              item.blocking
                                ? 'border-amber-300/20 bg-amber-300/5 text-amber-50'
                                : 'border-white/8 text-slate-400'
                            }`}
                          >
                            <p>
                              {item.blocking ? 'Repair check: ' : '• '}
                              {item.message}
                            </p>
                            {item.span ? (
                              <p className="mt-1 text-amber-100">Exact span: “{item.span}”</p>
                            ) : null}
                            {item.suggestedFix ? (
                              <p className="mt-1 text-cyan-200">
                                Suggested fix: {item.suggestedFix}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-white">Quality checks</p>
                      <span className="text-xs font-semibold text-emerald-300">
                        Ready for review · no blockers
                      </span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 p-4">
                  <p className="text-sm font-bold text-white">Review comments</p>
                  {postReviews.length > 0 ? (
                    <ol className="mt-3 grid gap-2 border-l border-white/10 pl-3 text-xs text-slate-400">
                      {postReviews.map((review) => (
                        <li key={review.id}>
                          <span className="font-semibold text-slate-200">
                            {review.action.replaceAll('_', ' ')}
                          </span>
                          {review.note ? ` — ${review.note}` : ''}
                          <span className="ml-2 text-slate-600">
                            {kyivDateTime(review.created_at)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">No review comments yet.</p>
                  )}
                  <form action={commentWeeklySocialAction} className="mt-4 grid gap-2">
                    <input type="hidden" name="social_post_id" value={post.id} />
                    <textarea
                      name="note"
                      rows={2}
                      required
                      maxLength={2000}
                      className={TEXTAREA}
                      aria-label={`Comment on ${channelLabel(channel)}`}
                    />
                    <ActionSubmitButton
                      idleLabel="Comment"
                      pendingLabel="Commenting…"
                      className={SECONDARY}
                    />
                  </form>
                </div>

                <form
                  action={toggleWeeklySocialAction}
                  className="rounded-xl border border-white/10 p-4"
                >
                  <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
                  <input type="hidden" name="social_post_id" value={post.id} />
                  <input type="hidden" name="publish_enabled" value={enabled ? 'false' : 'true'} />
                  <label className={LABEL}>
                    {enabled ? 'Emergency disable reason' : 'Previous disable reason'}
                    <textarea
                      name="disabled_reason"
                      rows={2}
                      required={enabled}
                      defaultValue={post.disabled_reason ?? ''}
                      disabled={!canDisable}
                      className={TEXTAREA}
                    />
                  </label>
                  <ActionSubmitButton
                    idleLabel={enabled ? `Disable ${channelLabel(channel)}` : 'Re-enable channel'}
                    pendingLabel="Updating channel…"
                    disabled={!canDisable}
                    className={enabled ? DANGER : SECONDARY}
                  />
                  {!canDisable ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Only an owner with AAL2 can change channel participation.
                    </p>
                  ) : null}
                </form>
              </aside>
            </div>
          </section>
        );
      })}

      <GenerationJobsSection
        digestId={workspace.digest.id}
        revisionId={workspace.revision?.id ?? null}
        jobs={workspace.generationJobs}
        attempts={workspace.generationAttempts}
        events={workspace.generationEvents}
        tab="social"
      />
    </div>
  );
}

function PdfPanel({
  workspace,
  canEdit,
  canReview,
}: {
  workspace: WeeklyDigestWorkspace;
  canEdit: boolean;
  canReview: boolean;
}) {
  const revision = workspace.revision;
  if (!revision) return <p className={`${PANEL} text-sm text-slate-400`}>No active revision.</p>;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Bilingual A4 editions</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            PDFs are generated asynchronously from the active revision, stored privately and exposed
            publicly only after this revision is published.
          </p>
        </div>
        <span className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-400">
          Cover · contents · stories · examples · sources · QR · page footer
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {(['en', 'uk'] as const).map((locale) => {
          const artifact = artifactFor(workspace.artifacts, 'pdf', locale);
          const previewUrls = artifact ? listFrom(artifact.content, 'preview_urls') : [];
          const job = latestJobForSlot(workspace.generationJobs, 'pdf', {
            slotKey: `pdf:${locale}`,
          });
          return (
            <section key={locale} className="grid content-start gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-white">
                  {locale === 'en' ? 'English PDF' : 'Український PDF'}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {job ? <StatusPill value={job.status} /> : null}
                  <form action={enqueueWeeklyGenerationAction}>
                    <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
                    <input type="hidden" name="revision_id" value={revision.id} />
                    <input type="hidden" name="job_type" value="pdf" />
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="slot_key" value={`pdf:${locale}`} />
                    <ActionSubmitButton
                      idleLabel={artifact ? 'Regenerate PDF' : 'Generate PDF'}
                      pendingLabel="Queueing PDF…"
                      disabled={!canEdit}
                      className={PRIMARY}
                    />
                  </form>
                </div>
              </div>
              {job?.status === 'queued' || job?.status === 'running' ? (
                <p className="rounded-xl border border-cyan-400/20 bg-cyan-400/6 px-3 py-2 text-xs text-cyan-100">
                  {job.status === 'queued'
                    ? 'Queued — reload this tab after the job succeeds to see new page previews.'
                    : 'Generating PDF — reload this tab when status becomes succeeded.'}
                </p>
              ) : null}
              {job?.last_error ? (
                <p className="rounded-xl border border-red-400/25 bg-red-400/8 px-3 py-2 text-xs whitespace-pre-wrap text-red-100">
                  {job.last_error}
                </p>
              ) : null}
              <ArtifactCard
                digestId={workspace.digest.id}
                artifact={artifact}
                reviews={workspace.artifactReviews}
                canReview={canReview}
                label={`${locale.toUpperCase()} A4 edition`}
              />
              {previewUrls.length > 0 ? (
                <details className="rounded-xl border border-white/10 bg-black/10 p-3">
                  <summary className="text-sm font-bold text-slate-300">
                    Page previews ({previewUrls.length})
                  </summary>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {previewUrls.map((url, index) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative aspect-[210/297] overflow-hidden rounded-lg border border-white/10 bg-white"
                      >
                        <Image
                          src={url}
                          alt={`${locale.toUpperCase()} PDF page ${index + 1}`}
                          fill
                          sizes="240px"
                          unoptimized
                          className="object-cover transition group-hover:scale-[1.02]"
                        />
                      </a>
                    ))}
                  </div>
                </details>
              ) : null}
              <ReplacementAssetForm
                workspace={workspace}
                artifactType="pdf"
                slotKey={`pdf:${locale}`}
                locale={locale}
                canEdit={canEdit}
              />
            </section>
          );
        })}
      </div>

      <GenerationJobsSection
        digestId={workspace.digest.id}
        revisionId={workspace.revision?.id ?? null}
        jobs={workspace.generationJobs}
        attempts={workspace.generationAttempts}
        events={workspace.generationEvents}
        tab="pdf"
      />
    </div>
  );
}

/** Same gate as `weekly_generation_waiting_reason` for `video_manifest`. */
function approvedTop3StoryImageCount(workspace: WeeklyDigestWorkspace) {
  let count = 0;
  for (const item of workspace.items) {
    if (item.rank > 3) continue;
    const image = artifactFor(workspace.artifacts, 'story_image', undefined, item.id);
    if (image?.generation_status === 'ready' && image.review_status === 'approved') {
      count += 1;
    }
  }
  return count;
}

function currentCoverIsReady(workspace: WeeklyDigestWorkspace) {
  return artifactFor(workspace.artifacts, 'cover')?.generation_status === 'ready';
}

function VideoPanel({
  workspace,
  canEdit,
  canReview,
}: {
  workspace: WeeklyDigestWorkspace;
  canEdit: boolean;
  canReview: boolean;
}) {
  const revision = workspace.revision;
  if (!revision) return <p className={`${PANEL} text-sm text-slate-400`}>No active revision.</p>;

  const script = artifactFor(workspace.artifacts, 'video_script', 'en');
  const manifest =
    artifactFor(workspace.artifacts, 'video_manifest', 'en') ??
    artifactFor(workspace.artifacts, 'video_manifest', 'neutral');
  const finalVideo = artifactFor(workspace.artifacts, 'video_final', 'en');
  const captionsEn = artifactFor(workspace.artifacts, 'captions', 'en');
  const captionsUk = artifactFor(workspace.artifacts, 'captions', 'uk');
  const thumbnail = artifactFor(workspace.artifacts, 'thumbnail', 'neutral');
  const heygenPreview = artifactFor(workspace.artifacts, 'heygen_preview', 'en');
  const graphicsPreview = artifactFor(workspace.artifacts, 'graphics_preview', 'en');

  const scriptText = textFrom(script?.content, 'script', 'text', 'body');
  const manifestContent = asRecord(manifest?.content);
  const scenes =
    asRecord(manifestContent.longForm).scenes ?? scenesFromVideoScriptContent(script?.content);
  const scenesJson = jsonText(scenes, '[]');
  const captionsEnText = textFrom(captionsEn?.content, 'vtt', 'srt', 'text');
  const captionsUkText = textFrom(captionsUk?.content, 'vtt', 'srt', 'text');
  const scriptJob = latestJobForSlot(workspace.generationJobs, 'video_script');
  const manifestJob = latestJobForSlot(workspace.generationJobs, 'video_manifest');
  const scriptApproved = script?.review_status === 'approved';
  const approvedTop3Images = approvedTop3StoryImageCount(workspace);
  const coverReady = currentCoverIsReady(workspace);
  const stills = workspace.items.map((item) => {
    const image = artifactFor(workspace.artifacts, 'story_image', undefined, item.id);
    return {
      revisionItemId: item.id,
      title: item.title_en,
      imageUrl: image?.external_url ?? null,
      imageReady: image?.review_status === 'approved' && Boolean(image?.external_url),
    };
  });
  const shootPack = buildVideoShootPack({
    digestId: workspace.digest.id,
    scenes,
    stills,
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Shooting package, then one YouTube video</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            This tab is the shoot brief: which service records each scene, the avatar script, and
            the image-to-video prompt. Put the clips into <code>ai-today-brief-video</code> and
            assemble there. The public player uses one YouTube URL plus EN and UK captions — no MP4
            upload here.
          </p>
        </div>
        <span className="rounded-xl border border-cyan-300/20 bg-cyan-300/6 px-3 py-2 text-xs font-semibold text-cyan-100">
          YouTube is the final video storage — no MP4 upload
        </span>
      </div>

      <div className={`${PANEL} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h3 className="text-lg font-bold text-white">
            TV-news script (cold open → anchor → b-roll → outro)
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Dramatizes the approved English article into the scene plan below plus three Ukrainian
            Shorts. Review the generated script, then hand-edit it in the form below if needed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scriptJob ? <StatusPill value={scriptJob.status} /> : null}
          <form action={enqueueWeeklyGenerationAction}>
            <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
            <input type="hidden" name="revision_id" value={revision.id} />
            <input type="hidden" name="job_type" value="video_script" />
            <input type="hidden" name="locale" value="en" />
            <input type="hidden" name="slot_key" value="video-script:en" />
            <ActionSubmitButton
              idleLabel={script ? 'Regenerate script' : 'Generate script'}
              pendingLabel="Queueing script…"
              disabled={!canEdit}
              className={SECONDARY}
            />
          </form>
        </div>
        {script ? (
          <div className="w-full">
            {scriptApproved ? (
              <p className="text-xs text-emerald-200/90">
                Script is already approved. Manifest generation does not wait on another Approve
                here.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                video_manifest cannot generate until this script is approved.
              </p>
            )}
            <ArtifactReview
              digestId={workspace.digest.id}
              artifact={script}
              reviews={workspace.artifactReviews}
              canReview={canReview && script.revision_id === workspace.revision?.id}
            />
          </div>
        ) : null}
      </div>

      <div className={`${PANEL} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h3 className="text-lg font-bold text-white">weekly-video-v3 manifest</h3>
          <p className="mt-1 text-sm text-slate-500">
            Assembles the approved script, three approved Top 3 story images and a ready cover into
            the HeyGen/YouTube handoff. If Generation jobs has no video_manifest row, enqueue it
            here — the job waits until those gates pass.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {manifestJob ? <StatusPill value={manifestJob.status} /> : null}
          <form action={enqueueWeeklyGenerationAction}>
            <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
            <input type="hidden" name="revision_id" value={revision.id} />
            <input type="hidden" name="job_type" value="video_manifest" />
            <input type="hidden" name="locale" value="en" />
            <input type="hidden" name="slot_key" value="video-manifest:en" />
            <ActionSubmitButton
              idleLabel={manifest ? 'Regenerate manifest' : 'Generate manifest'}
              pendingLabel="Queueing manifest…"
              disabled={!canEdit || !scriptApproved}
              className={PRIMARY}
            />
          </form>
        </div>
        {!scriptApproved ? (
          <p className="w-full text-xs text-slate-500">
            Approve the English script above before enqueueing the manifest.
          </p>
        ) : null}
        {manifestJob?.status === 'waiting' ? (
          <div className="w-full rounded-xl border border-amber-400/25 bg-amber-400/8 px-3 py-3 text-sm text-amber-50">
            <p>
              {manifestJob.status_reason ||
                'Waiting for an approved script, three approved Top 3 story images, and a ready cover.'}
            </p>
            {approvedTop3Images < 3 ? (
              <p className="mt-2 text-xs leading-5 text-amber-100/90">
                Approved Top 3 story images: {approvedTop3Images}/3.{' '}
                <Link
                  href={`/admin/weekly/${workspace.digest.id}?tab=visuals`}
                  prefetch={false}
                  className="font-semibold text-amber-50 underline decoration-amber-100/50 underline-offset-2"
                >
                  Open Visuals
                </Link>{' '}
                to generate or upload those stills, then Approve version on each image. Approving
                the script again will not unblock this job.
              </p>
            ) : null}
            {approvedTop3Images === 3 && !coverReady ? (
              <p className="mt-2 text-xs leading-5 text-amber-100/90">
                Top 3 stills are approved. The cover is not ready yet — generate or upload it on{' '}
                <Link
                  href={`/admin/weekly/${workspace.digest.id}?tab=visuals`}
                  prefetch={false}
                  className="font-semibold text-amber-50 underline decoration-amber-100/50 underline-offset-2"
                >
                  Visuals
                </Link>
                .
              </p>
            ) : null}
          </div>
        ) : null}
        {manifestJob?.last_error ? (
          <p className="w-full rounded-xl border border-red-400/25 bg-red-400/8 px-3 py-2 text-xs whitespace-pre-wrap text-red-100">
            {manifestJob.last_error}
          </p>
        ) : null}
      </div>

      <div className={PANEL}>
        <h3 className="text-lg font-bold text-white">Shooting package</h3>
        <p className="mt-1 text-sm text-slate-500">
          Derived from the approved script (and manifest scenes when present). Copy the prompt or
          avatar text, generate in the named service, drop the file on the path shown. Assembly is
          not done in this CMS.
        </p>
        <div className="mt-4">
          <VideoShootPackPanel pack={shootPack} />
        </div>
      </div>

      <form action={saveWeeklyVideoAction} className={PANEL}>
        <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
        <input type="hidden" name="revision_id" value={revision.id} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">Video contract</h3>
            <p className="mt-1 text-sm text-slate-500">
              Changing the script after rendering starts makes the video artifacts stale.
              {scriptApproved
                ? ' The script is already approved — Save here writes a new version that must be re-approved, and it will not generate the waiting manifest.'
                : ''}
            </p>
          </div>
          <label className="grid gap-1 text-xs font-bold text-slate-400">
            Workflow state
            <select
              name="workflow_status"
              defaultValue={
                textFrom(manifest?.metadata, 'workflow_status') ||
                textFrom(script?.metadata, 'workflow_status') ||
                'scripting'
              }
              disabled={!canEdit}
              className={`${FIELD} min-w-44`}
            >
              <option value="scripting">Scripting</option>
              <option value="rendering">Rendering started</option>
              <option value="ready">Final ready</option>
            </select>
          </label>
        </div>

        <div className="mt-6 grid gap-5">
          <label className={LABEL}>
            English narration script
            <textarea
              name="script_en"
              rows={16}
              required
              defaultValue={scriptText}
              disabled={!canEdit}
              className={TEXTAREA}
            />
          </label>
          <label className={LABEL}>
            Scene structure and timings (JSON)
            <textarea
              name="scenes_json"
              rows={10}
              required
              spellCheck={false}
              defaultValue={scenesJson}
              disabled={!canEdit}
              className={`${TEXTAREA} font-mono text-xs`}
            />
          </label>
          <div className="grid gap-5 xl:grid-cols-2">
            <label className={LABEL}>
              English captions (WebVTT or SRT)
              <textarea
                name="captions_en"
                rows={12}
                spellCheck={false}
                defaultValue={captionsEnText}
                disabled={!canEdit}
                className={`${TEXTAREA} font-mono text-xs`}
              />
            </label>
            <label className={LABEL}>
              Ukrainian captions (WebVTT or SRT)
              <textarea
                name="captions_uk"
                rows={12}
                spellCheck={false}
                defaultValue={captionsUkText}
                disabled={!canEdit}
                className={`${TEXTAREA} font-mono text-xs`}
              />
            </label>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <label className={LABEL}>
              HeyGen project URL
              <input
                type="url"
                name="heygen_project_url"
                defaultValue={
                  textFrom(manifest?.content, 'heygen_project_url') ||
                  textFrom(heygenPreview?.metadata, 'project_url')
                }
                disabled={!canEdit}
                className={FIELD}
              />
            </label>
            <label className={LABEL}>
              HeyGen preview URL
              <input
                type="url"
                name="heygen_preview_url"
                defaultValue={heygenPreview?.external_url ?? ''}
                disabled={!canEdit}
                className={FIELD}
              />
            </label>
            <label className={LABEL}>
              Graphics preview URL
              <input
                type="url"
                name="graphics_preview_url"
                defaultValue={graphicsPreview?.external_url ?? ''}
                disabled={!canEdit}
                className={FIELD}
              />
            </label>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <label className={LABEL}>
              Final YouTube URL
              <input
                type="text"
                name="youtube_url"
                defaultValue={finalVideo?.external_url ?? ''}
                disabled={!canEdit}
                className={FIELD}
                placeholder="https://www.youtube.com/watch?v=… (or just paste the 11-char video ID)"
              />
            </label>
            <label className={LABEL}>
              YouTube video ID
              <input
                name="youtube_video_id"
                pattern="[A-Za-z0-9_-]{11}"
                maxLength={11}
                defaultValue={finalVideo?.provider_id ?? ''}
                disabled={!canEdit}
                className={FIELD}
                placeholder="auto-filled from the URL if left blank"
              />
            </label>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_12rem]">
            <label className={LABEL}>
              Thumbnail URL
              <input
                type="url"
                name="thumbnail_url"
                defaultValue={thumbnail?.external_url ?? ''}
                disabled={!canEdit}
                className={FIELD}
                placeholder="auto-filled from YouTube if left blank"
              />
            </label>
            <label className={LABEL}>
              Duration (seconds, optional)
              <input
                type="number"
                min={200}
                max={1200}
                name="duration_seconds"
                defaultValue={finalVideo?.duration_seconds ?? ''}
                disabled={!canEdit}
                className={FIELD}
                placeholder="auto-detected from YouTube if left blank"
              />
            </label>
          </div>
          <span className="text-xs font-normal text-slate-500">
            Fill the YouTube URL/ID above and save — the CMS auto-fills the thumbnail, auto-detects
            the duration from YouTube if you leave that field blank, and stamps it against the
            currently approved script. An approved `weekly-video-v3` manifest for this revision is
            required first.
          </span>
          <details className="rounded-lg border border-white/5 bg-black/20 p-3">
            <summary className="cursor-pointer text-xs font-bold text-slate-400">
              Advanced: bulk import via JSON (optional, for automation)
            </summary>
            <label className={`${LABEL} mt-3`}>
              Render result manifest (`weekly-video-result-v2` JSON)
              <textarea
                name="result_manifest_json"
                rows={14}
                spellCheck={false}
                disabled={!canEdit}
                className={`${TEXTAREA} font-mono text-xs`}
                placeholder={JSON.stringify(
                  {
                    schemaVersion: 'weekly-video-result-v2',
                    digestId: workspace.digest.id,
                    revisionId: revision.id,
                    inputHash:
                      textFrom(manifestContent as Json, 'inputHash') || '<approved inputHash>',
                    youtube: {
                      id: '<youtube-id>',
                      url: 'https://www.youtube.com/watch?v=<youtube-id>',
                      thumbnailUrl: 'https://…',
                      durationSeconds: 420,
                      publishedAt: '<ISO timestamp>',
                    },
                    captions: [
                      { locale: 'en', url: 'https://…/captions-en.vtt' },
                      { locale: 'uk', url: 'https://…/captions-uk.vtt' },
                    ],
                  },
                  null,
                  2,
                )}
              />
              <span className="text-xs font-normal text-slate-500">
                Only needed for scripted/automated imports. Leave blank and use the fields above for
                a normal manual save.
              </span>
            </label>
          </details>
          <div>
            <ActionSubmitButton
              idleLabel="Save video workspace"
              pendingLabel="Saving video…"
              disabled={!canEdit}
              className={PRIMARY}
            />
          </div>
        </div>
      </form>

      <section aria-labelledby="video-review-heading">
        <h3 id="video-review-heading" className="text-lg font-bold text-white">
          Video artifact review
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Script, captions, thumbnail and final YouTube reference are versioned independently.
        </p>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <ArtifactCard
            digestId={workspace.digest.id}
            artifact={script}
            reviews={workspace.artifactReviews}
            canReview={canReview}
            label="English script"
          />
          <ArtifactCard
            digestId={workspace.digest.id}
            artifact={manifest}
            reviews={workspace.artifactReviews}
            canReview={canReview}
            label="weekly-video-v3 manifest"
          />
          <ArtifactCard
            digestId={workspace.digest.id}
            artifact={finalVideo}
            reviews={workspace.artifactReviews}
            canReview={canReview}
            label="Final YouTube video"
          />
          <ArtifactCard
            digestId={workspace.digest.id}
            artifact={captionsEn}
            reviews={workspace.artifactReviews}
            canReview={canReview}
            label="English captions"
          />
          <ArtifactCard
            digestId={workspace.digest.id}
            artifact={captionsUk}
            reviews={workspace.artifactReviews}
            canReview={canReview}
            label="Ukrainian captions"
          />
          <ArtifactCard
            digestId={workspace.digest.id}
            artifact={thumbnail}
            reviews={workspace.artifactReviews}
            canReview={canReview}
            label="Video thumbnail"
            imagePreview
          />
          <ArtifactCard
            digestId={workspace.digest.id}
            artifact={heygenPreview}
            reviews={workspace.artifactReviews}
            canReview={canReview}
            label="HeyGen preview"
          />
          <ArtifactCard
            digestId={workspace.digest.id}
            artifact={graphicsPreview}
            reviews={workspace.artifactReviews}
            canReview={canReview}
            label="Graphics preview"
          />
        </div>
      </section>

      <GenerationJobsSection
        digestId={workspace.digest.id}
        revisionId={workspace.revision?.id ?? null}
        jobs={workspace.generationJobs}
        attempts={workspace.generationAttempts}
        events={workspace.generationEvents}
        tab="video"
      />
    </div>
  );
}

function ReleasePanel({
  workspace,
  blockers,
  canOwnRelease,
}: {
  workspace: WeeklyDigestWorkspace;
  blockers: ReturnType<typeof validateWeeklyDigestPreflight>['blockers'];
  canOwnRelease: boolean;
}) {
  const digest = workspace.digest;
  const revision = workspace.revision;
  const paused = digest.status === 'paused';
  const testEdition = digest.is_test;
  const finalReleaseDisabled = !canOwnRelease || !revision;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,.75fr)]">
      <div className="grid content-start gap-5">
        <HallucinationBoardPanel workspace={workspace} canShip={canOwnRelease} />
        <section className={PANEL} aria-labelledby="release-gate-heading">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="release-gate-heading" className="mr-auto text-xl font-bold text-white">
              Release control
            </h2>
            <StatusPill value={digest.status} />
          </div>
          <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/6 p-4">
            <p className="font-bold text-cyan-100">Editing freezes 15 minutes before release</p>
            <p className="mt-2 text-sm leading-6 text-cyan-100/75">
              Review, text changes, media replacement and re-approval stay open until 15 minutes
              before the scheduled release time (the default cadence is Monday 15:45/16:00 Kyiv, but
              any future date and time can be scheduled). The automated preflight then freezes the
              scheduled revision. To change anything after that gate, an owner pauses the edition,
              edits, runs approval again and reschedules it.
            </p>
          </div>

          {testEdition ? (
            <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/8 p-4 text-sm text-amber-100">
              <p className="font-bold">Test edition — publication locked</p>
              <p className="mt-2 leading-6 text-amber-100/80">
                Approval, scheduling and the automatic preflight run normally. The release worker,
                public website and social delivery are blocked in the database for this edition.
              </p>
            </div>
          ) : null}

          {!canOwnRelease ? (
            <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/6 p-3 text-sm text-amber-100">
              Final approval, scheduling and pause/resume require an owner session with AAL2.
            </p>
          ) : null}

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/8 p-3">
              <dt className="text-xs font-bold text-slate-500 uppercase">Preflight</dt>
              <dd className="mt-1 text-sm font-semibold text-white">
                {kyivDateTime(digest.preflight_at)}
              </dd>
            </div>
            <div className="rounded-xl border border-white/8 p-3">
              <dt className="text-xs font-bold text-slate-500 uppercase">Release</dt>
              <dd className="mt-1 text-sm font-semibold text-white">
                {kyivDateTime(digest.release_at)}
              </dd>
            </div>
          </dl>
        </section>

        <section className={PANEL} aria-labelledby="final-approval-heading">
          <h2 id="final-approval-heading" className="text-lg font-bold text-white">
            1. Final approval{testEdition ? ' (test)' : ''}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Approval confirms the active revision and all currently approved artifact versions. It
            does not publish the edition.
          </p>
          <form action={approveWeeklyDigestAction} className="mt-5 grid gap-4">
            <input type="hidden" name="weekly_digest_id" value={digest.id} />
            <input type="hidden" name="revision_id" value={revision?.id ?? ''} />
            <label className={LABEL}>
              Emergency override reason (leave empty for normal approval)
              <textarea
                name="override_reason"
                rows={3}
                maxLength={2000}
                disabled={finalReleaseDisabled}
                className={TEXTAREA}
                placeholder="Owner-only audited exception; explain why the release is safe despite the listed blockers."
              />
              {blockers.length > 0 ? (
                <span className="text-xs font-normal text-amber-200">
                  {blockers.length} blocker(s) remain. The server requires and audits a valid
                  override reason, and may still reject non-overridable gates.
                </span>
              ) : null}
            </label>
            <div>
              <ActionSubmitButton
                idleLabel={testEdition ? 'Approve test revision' : 'Approve active revision'}
                pendingLabel="Running approval…"
                disabled={finalReleaseDisabled}
                className={PRIMARY}
              />
            </div>
          </form>
        </section>

        <section className={PANEL} aria-labelledby="schedule-release-heading">
          <h2 id="schedule-release-heading" className="text-lg font-bold text-white">
            2. Schedule{testEdition ? ' test preflight' : ''}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Stored in UTC; entered and displayed in Europe/Kyiv so daylight-saving transitions
            remain correct.
          </p>
          <form action={scheduleWeeklyDigestAction} className="mt-5 grid gap-4">
            <input type="hidden" name="weekly_digest_id" value={digest.id} />
            <input type="hidden" name="revision_id" value={revision?.id ?? ''} />
            <input type="hidden" name="time_zone" value="Europe/Kyiv" />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={LABEL}>
                Preflight in Kyiv
                <input
                  type="datetime-local"
                  name="preflight_at_local"
                  required
                  defaultValue={localDateTimeInput(digest.preflight_at)}
                  disabled={finalReleaseDisabled}
                  className={FIELD}
                />
              </label>
              <label className={LABEL}>
                Release in Kyiv
                <input
                  type="datetime-local"
                  name="release_at_local"
                  required
                  defaultValue={localDateTimeInput(digest.release_at)}
                  disabled={finalReleaseDisabled}
                  className={FIELD}
                />
              </label>
            </div>
            <div>
              <ActionSubmitButton
                idleLabel={testEdition ? 'Schedule test preflight' : 'Schedule release'}
                pendingLabel={testEdition ? 'Scheduling test…' : 'Scheduling…'}
                disabled={finalReleaseDisabled || digest.status !== 'approved'}
                className={PRIMARY}
              />
            </div>
          </form>
        </section>

        {!testEdition && digest.status === 'scheduled' ? (
          <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
            <h2 className="text-lg font-bold text-white">Postpone</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Not going to make {kyivDateTime(digest.release_at)}? This pauses, re-approves against
              the current content (a full preflight re-check, same as approving fresh), and
              reschedules to the same time on a later Monday — one click instead of the three steps
              below.
            </p>
            <form action={postponeWeeklyDigestAction} className="mt-5 grid gap-4">
              <input type="hidden" name="weekly_digest_id" value={digest.id} />
              <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
                <label className={LABEL}>
                  Postpone by
                  <select
                    name="weeks"
                    defaultValue="1"
                    disabled={finalReleaseDisabled}
                    className={FIELD}
                  >
                    {[1, 2, 3, 4].map((count) => (
                      <option key={count} value={count}>
                        {count} week{count > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={LABEL}>
                  Reason
                  <textarea
                    name="reason"
                    rows={2}
                    required
                    minLength={10}
                    maxLength={500}
                    disabled={finalReleaseDisabled}
                    className={TEXTAREA}
                    placeholder="Not enough time to finish review this week."
                  />
                </label>
              </div>
              <div>
                <ActionSubmitButton
                  idleLabel="Postpone release"
                  pendingLabel="Postponing…"
                  disabled={finalReleaseDisabled}
                  className={SECONDARY}
                />
              </div>
            </form>
          </section>
        ) : null}

        <section className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5">
          <h2 className="text-lg font-bold text-white">Pause and recover</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Pausing is the safe path for edits after preflight. The reason is preserved in the
            release audit.
          </p>
          <form action={pauseWeeklyDigestAction} className="mt-5 grid gap-4">
            <input type="hidden" name="weekly_digest_id" value={digest.id} />
            <input type="hidden" name="revision_id" value={revision?.id ?? ''} />
            <input type="hidden" name="intent" value={paused ? 'resume' : 'pause'} />
            <label className={LABEL}>
              {paused ? 'Resume note' : 'Pause reason'}
              <textarea
                name="reason"
                rows={3}
                required
                maxLength={2000}
                disabled={finalReleaseDisabled}
                className={TEXTAREA}
              />
            </label>
            <div>
              <ActionSubmitButton
                idleLabel={paused ? 'Resume to review' : 'Pause edition'}
                pendingLabel={paused ? 'Resuming…' : 'Pausing…'}
                disabled={finalReleaseDisabled}
                className={paused ? SECONDARY : DANGER}
              />
            </div>
          </form>
        </section>
      </div>

      <aside className="grid content-start gap-5">
        <section className={PANEL} aria-labelledby="release-blockers-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="release-blockers-heading" className="text-lg font-bold text-white">
              Current blockers
            </h2>
            <span className="text-2xl font-bold text-white">{blockers.length}</span>
          </div>
          {blockers.length ? (
            <div className="mt-4">
              <PreflightBlockerList
                digestId={workspace.digest.id}
                blockers={blockers}
                storyIds={workspace.items.map((item) => item.id)}
                compact
              />
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/6 p-3 text-sm text-emerald-200">
              Preflight is ready to pass.
            </p>
          )}
        </section>

        <section className={PANEL} aria-labelledby="release-audit-heading">
          <h2 id="release-audit-heading" className="text-lg font-bold text-white">
            Audit trail
          </h2>
          <ol className="mt-4 grid gap-4 border-l border-white/10 pl-4">
            {workspace.releaseEvents.slice(0, 20).map((event) => (
              <li key={event.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-white">
                    {event.event_type.replaceAll('_', ' ')}
                  </p>
                  <span className="text-xs text-slate-600">{kyivDateTime(event.created_at)}</span>
                </div>
                {Object.keys(asRecord(event.payload)).length > 0 ? (
                  <details className="mt-1">
                    <summary className="text-xs text-slate-500">Event details</summary>
                    <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-black/30 p-2 text-[11px] text-slate-400">
                      {jsonText(event.payload, '{}')}
                    </pre>
                  </details>
                ) : null}
              </li>
            ))}
          </ol>
          {workspace.releaseEvents.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No events recorded.</p>
          ) : null}
        </section>
      </aside>
    </div>
  );
}

/**
 * Tabs always render the working copy (`active_revision_id`). This banner is
 * for leftover unused latest revisions — historical inactive drafts, or after
 * an intentional go-back. New master runs activate themselves, so this should
 * be rare.
 */
function NewerDraftBanner({
  workspace,
  canEdit,
}: {
  workspace: WeeklyDigestWorkspace;
  canEdit: boolean;
}) {
  const latest = workspace.revisions[0];
  if (!latest || latest.id === workspace.digest.active_revision_id) return null;
  const active = workspace.revisions.find(
    (revision) => revision.id === workspace.digest.active_revision_id,
  );
  const draftReason = draftReasonForRevision(workspace, latest.id);
  const canSwitch =
    canEdit &&
    workspace.digest.status !== 'publishing' &&
    workspace.digest.status !== 'published' &&
    workspace.digest.status !== 'cancelled';
  return (
    <section className="mb-6 rounded-2xl border border-amber-300/30 bg-amber-300/8 p-4 text-sm text-amber-100">
      <p className="font-bold">
        Latest version is not the working copy — Revision {latest.revision_number}
        {latest.title_en ? `: ${latest.title_en}` : ''}
      </p>
      <p className="mt-1 leading-6 text-amber-100/80">
        {draftReason ? `${draftReason}. ` : ''}
        Tabs below still show Revision {active?.revision_number ?? '?'}. Use the latest version
        unless you went back on purpose.
      </p>
      {canSwitch ? (
        <form action={useLatestWeeklyDigestRevisionAction} className="mt-3">
          <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
          <input type="hidden" name="target_revision_id" value={latest.id} />
          <ActionSubmitButton
            idleLabel="Use latest version"
            pendingLabel="Switching…"
            className={PRIMARY}
          />
        </form>
      ) : (
        <Link
          href={`/admin/weekly/${workspace.digest.id}?tab=overview#versions-heading`}
          className="mt-2 inline-block font-semibold text-amber-100 underline underline-offset-2"
        >
          Review Editorial versions →
        </Link>
      )}
    </section>
  );
}

export function WeeklyWorkspace({
  workspace,
  activeTab,
  session,
}: {
  workspace: WeeklyDigestWorkspace;
  activeTab: WeeklyWorkspaceTab;
  session: SocialAdminSession;
}) {
  const canEdit = session.role === 'owner' || session.role === 'editor';
  const canOwnRelease = session.role === 'owner' && session.aal === 'aal2';
  const canReview = session.role === 'owner';
  const storyIds = workspace.items.map((item) => item.id);
  const artifacts: WeeklyPreflightArtifact[] = workspace.artifacts.flatMap((artifact) => {
    if (!ARTIFACT_TYPES.has(artifact.artifact_type as WeeklyArtifactType)) return [];
    const provenanceStoryId =
      artifact.artifact_type === 'research_pack'
        ? workspace.items.find(
            (item) => researchArtifactFor(workspace.artifacts, item)?.id === artifact.id,
          )?.id
        : undefined;
    return [
      {
        artifactType: artifact.artifact_type as WeeklyArtifactType,
        locale: artifact.locale === 'en' || artifact.locale === 'uk' ? artifact.locale : undefined,
        storyId: provenanceStoryId ?? artifact.revision_item_id,
        generationStatus: artifact.generation_status,
        reviewStatus: artifact.review_status,
        stale: artifact.review_status === 'stale',
        contentSimCleared: contentSimClearedFromMetadata(artifact.metadata),
      },
    ];
  });
  const social: WeeklyPreflightSocial[] = workspace.socialPosts.flatMap((post) => {
    if (!Object.hasOwn(WEEKLY_SOCIAL_MATRIX, post.channel)) return [];
    if (post.locale !== 'en' && post.locale !== 'uk') return [];
    return [
      {
        channel: post.channel as keyof typeof WEEKLY_SOCIAL_MATRIX,
        locale: post.locale,
        publishEnabled: post.publish_enabled,
        disabledReason: post.disabled_reason,
        disabledByOwner: post.publish_enabled ? undefined : Boolean(post.disabled_by),
        manualDocumentStatus:
          typeof asRecord(post.meta).document_status === 'string'
            ? (asRecord(post.meta).document_status as string)
            : null,
        status: post.status,
      },
    ];
  });
  const localeMap = Object.fromEntries(
    workspace.localeMap.flatMap((entry) =>
      Object.hasOwn(WEEKLY_SOCIAL_MATRIX, entry.channel) &&
      (entry.locale === 'en' || entry.locale === 'uk')
        ? [[entry.channel, entry.locale]]
        : [],
    ),
  );
  const preflight = validateWeeklyDigestPreflight({ storyIds, artifacts, social, localeMap });
  const requiredSlots = 15 + storyIds.length + Object.keys(WEEKLY_SOCIAL_MATRIX).length;
  const blockedSlots = new Set(preflight.blockers.map((blocker) => blocker.slot)).size;
  const progress = Math.max(
    0,
    Math.min(100, Math.round(((requiredSlots - blockedSlots) / requiredSlots) * 100)),
  );

  return (
    <>
      {workspace.digest.is_test ? (
        <section className="mb-6 rounded-2xl border border-amber-300/30 bg-amber-300/8 p-4 text-sm text-amber-100">
          <p className="font-bold">Test Weekly Digest</p>
          <p className="mt-1 leading-6 text-amber-100/80">
            This edition uses the same seven-day selection, artifacts, review and preflight pipeline
            as production. Public publication and social delivery are permanently disabled.
          </p>
        </section>
      ) : null}
      <NewerDraftBanner workspace={workspace} canEdit={canEdit} />
      {activeTab === 'overview' ? (
        <OverviewPanel
          workspace={workspace}
          blockers={preflight.blockers}
          progress={progress}
          canEdit={canEdit}
          canRebuildSelection={session.role === 'owner'}
          canCreateVisualRefresh={canOwnRelease}
        />
      ) : null}
      {activeTab === 'stories' ? <StoriesPanel workspace={workspace} canEdit={canEdit} /> : null}
      {activeTab === 'research' ? (
        <ResearchPanel workspace={workspace} canEdit={canEdit} canReview={canReview} />
      ) : null}
      {activeTab === 'article' ? (
        <ArticlePanel
          workspace={workspace}
          canEdit={canEdit}
          canReview={canReview}
          canRefreshVisualDirection={canOwnRelease}
        />
      ) : null}
      {activeTab === 'visuals' ? (
        <VisualsPanel
          workspace={workspace}
          canEdit={canEdit}
          canReview={canReview}
          canRefreshVisuals={canOwnRelease}
        />
      ) : null}
      {activeTab === 'social' ? (
        <SocialPanel
          workspace={workspace}
          canEdit={canEdit}
          canReview={canReview}
          canDisable={canOwnRelease}
          canSchedule={canOwnRelease}
        />
      ) : null}
      {activeTab === 'pdf' ? (
        <PdfPanel workspace={workspace} canEdit={canEdit} canReview={canReview} />
      ) : null}
      {activeTab === 'video' ? (
        <VideoPanel workspace={workspace} canEdit={canEdit} canReview={canReview} />
      ) : null}
      {activeTab === 'release' ? (
        <ReleasePanel
          workspace={workspace}
          blockers={preflight.blockers}
          canOwnRelease={canOwnRelease}
        />
      ) : null}
    </>
  );
}
