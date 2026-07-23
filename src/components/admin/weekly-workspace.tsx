import Image from 'next/image';
import { ActionSubmitButton } from '@/components/admin/action-submit-button';
import { StatusPill } from '@/components/admin/status-pill';
import type { SocialAdminSession } from '@/lib/admin-auth';
import type { Json } from '@/lib/database.types';
import type {
  WeeklyArtifactAdminRow,
  WeeklyArtifactReviewAdminRow,
  WeeklyDigestWorkspace,
} from '@/lib/weekly-digest/admin-data';
import {
  WEEKLY_SOCIAL_MATRIX,
  type WeeklyArtifactType,
  type WeeklyPreflightArtifact,
  type WeeklyPreflightSocial,
  validateWeeklyDigestPreflight,
} from '@/lib/weekly-digest/preflight';
import {
  approveWeeklyDigestAction,
  commentWeeklyArtifactAction,
  commentWeeklySocialAction,
  enqueueWeeklyGenerationAction,
  pauseWeeklyDigestAction,
  reviewWeeklyArtifactAction,
  saveWeeklyRevisionAction,
  saveWeeklySocialAction,
  saveWeeklyVideoAction,
  scheduleWeeklyDigestAction,
  toggleWeeklySocialAction,
  uploadWeeklyArtifactAction,
} from '@/app/admin/(cms)/weekly/actions';

export const WEEKLY_WORKSPACE_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'stories', label: 'Stories' },
  { id: 'article', label: 'Article UK / EN' },
  { id: 'visuals', label: 'Visuals' },
  { id: 'social', label: 'Social' },
  { id: 'pdf', label: 'PDF' },
  { id: 'video', label: 'Video' },
  { id: 'release', label: 'Release' },
] as const;

export type WeeklyWorkspaceTab = (typeof WEEKLY_WORKSPACE_TABS)[number]['id'];

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

const ARTIFACT_TYPES = new Set<WeeklyArtifactType>([
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
  const messages = [...blocking, ...warnings]
    .map((item) => {
      const record = asRecord(item);
      return typeof record.message === 'string' ? record.message : null;
    })
    .filter((message): message is string => Boolean(message));
  return { blocking: blocking.length, warnings: warnings.length, messages };
}

function formatBytes(value: number | null) {
  if (value === null) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
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
          <div className="flex flex-wrap gap-2">
            <ActionSubmitButton
              name="decision"
              value="approved"
              idleLabel="Approve version"
              pendingLabel="Approving…"
              className={PRIMARY}
            />
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
}: {
  digestId: string;
  artifact: WeeklyArtifactAdminRow | undefined;
  reviews: WeeklyArtifactReviewAdminRow[];
  canReview: boolean;
  label: string;
  imagePreview?: boolean;
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
  const artifactWarnings = listFrom(artifact.metadata, 'warnings');
  const failedChecks = Object.entries(asRecord(asRecord(artifact.metadata).checks))
    .filter(([, passed]) => passed === false)
    .map(([check]) => check);
  const previewUrl =
    imagePreview && artifact.external_url
      ? artifact.external_url
      : imagePreview
        ? previewUrls[0]
        : undefined;

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
            src={previewUrl}
            alt={textFrom(artifact.content, 'alt_text') || `${label} preview`}
            fill
            sizes="(max-width: 768px) 100vw, 520px"
            className="object-cover"
          />
        </div>
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

      <ArtifactReview
        digestId={digestId}
        artifact={artifact}
        reviews={reviews}
        canReview={canReview}
      />
    </article>
  );
}

function OverviewPanel({
  workspace,
  blockers,
  progress,
}: {
  workspace: WeeklyDigestWorkspace;
  blockers: ReturnType<typeof validateWeeklyDigestPreflight>['blockers'];
  progress: number;
}) {
  const unresolvedArtifacts = workspace.artifacts.filter(
    (artifact) => artifact.review_status === 'changes_requested',
  );
  const latestJobs = workspace.generationJobs.slice(0, 5);
  const latestEvents = workspace.releaseEvents.slice(0, 8);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,.6fr)]">
      <div className="grid gap-5">
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
            <ul className="mt-4 grid gap-2">
              {blockers.map((blocker) => (
                <li
                  key={`${blocker.slot}:${blocker.code}`}
                  className="rounded-xl border border-amber-400/20 bg-amber-400/6 px-3 py-2.5 text-sm text-amber-100"
                >
                  <span className="font-bold">{blocker.slot}</span>
                  <span className="text-amber-100/75"> — {blocker.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/6 p-4 text-sm text-emerald-200">
              Every required artifact and enabled social variant is current and approved.
            </p>
          )}
        </section>

        <section className={PANEL} aria-labelledby="jobs-heading">
          <h2 id="jobs-heading" className="text-lg font-bold text-white">
            Generation jobs
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="pb-3">Job</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Attempts</th>
                  <th className="pb-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {latestJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="py-3 font-semibold text-white">{job.job_type}</td>
                    <td className="py-3">
                      <StatusPill value={job.status} />
                    </td>
                    <td className="py-3 text-slate-400">{job.attempts}</td>
                    <td className="py-3 text-slate-400">{kyivDateTime(job.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {latestJobs.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No generation jobs yet.</p>
            ) : null}
          </div>
        </section>
      </div>

      <aside className="grid content-start gap-5">
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
              <dt className="font-bold text-slate-500">Public release</dt>
              <dd className="mt-1 text-white">{kyivDateTime(workspace.digest.release_at)}</dd>
            </div>
          </dl>
          <p className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-300/6 p-3 text-sm leading-6 text-cyan-100">
            Monday is part of the review window. Editors can revise and re-approve until the
            automated 15:45 Kyiv preflight; publication begins at 16:00.
          </p>
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
            Keep 3–7 stories. Saving creates a new immutable revision and marks dependent artifacts
            stale.
          </p>
        </div>
        <ActionSubmitButton
          idleLabel="Save stories as new revision"
          pendingLabel="Creating revision…"
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

              <div className="grid gap-4 md:grid-cols-[8rem_1fr]">
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

function ArticlePanel({
  workspace,
  canEdit,
  canReview,
}: {
  workspace: WeeklyDigestWorkspace;
  canEdit: boolean;
  canReview: boolean;
}) {
  const revision = workspace.revision;
  if (!revision) {
    return <p className={`${PANEL} text-sm text-slate-400`}>No active revision.</p>;
  }
  const articleEn = artifactFor(workspace.artifacts, 'article', 'en');
  const articleUk = artifactFor(workspace.artifacts, 'article', 'uk');

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
            </p>
          </div>
          <ActionSubmitButton
            idleLabel="Save article as new revision"
            pendingLabel="Creating revision…"
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
            <label className={LABEL}>
              Introduction
              <textarea
                name="intro_en"
                rows={6}
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
            <label className={LABEL}>
              Вступ
              <textarea
                name="intro_uk"
                rows={6}
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
    <div className="grid gap-3 rounded-xl border border-white/10 bg-black/10 p-3">
      <form action={uploadWeeklyArtifactAction} className="grid gap-3">
        <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
        <input type="hidden" name="revision_id" value={workspace.revision.id} />
        <input type="hidden" name="artifact_type" value={artifactType} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="slot_key" value={slotKey} />
        {revisionItemId ? (
          <input type="hidden" name="revision_item_id" value={revisionItemId} />
        ) : null}
        <p className="text-sm font-bold text-slate-300">Upload a replacement</p>
        <label className={LABEL}>
          File
          <input
            type="file"
            name="file"
            required
            accept={artifactType === 'pdf' ? 'application/pdf' : 'image/*'}
            disabled={!canEdit}
            className={`${FIELD} file:mr-3 file:rounded-lg file:border-0 file:bg-[#47e4d3]/10 file:px-3 file:py-1 file:font-bold file:text-[#47e4d3]`}
          />
        </label>
        <label className={LABEL}>
          Alt text
          <textarea
            name="alt_text"
            rows={2}
            required={artifactType !== 'pdf'}
            disabled={!canEdit}
            className={TEXTAREA}
          />
        </label>
        {artifactType !== 'pdf' ? (
          <label className={LABEL}>
            Focal point
            <select
              name="focal_point"
              defaultValue="attention"
              disabled={!canEdit}
              className={FIELD}
            >
              <option value="attention">Automatic attention</option>
              <option value="centre">Centre</option>
              <option value="north">Top</option>
              <option value="south">Bottom</option>
              <option value="west">Left</option>
              <option value="east">Right</option>
            </select>
          </label>
        ) : null}
        <ActionSubmitButton
          idleLabel="Upload and stage replacement"
          pendingLabel="Uploading replacement…"
          disabled={!canEdit}
          className={SECONDARY}
        />
      </form>

      <details className="border-t border-white/8 pt-3">
        <summary className="text-xs font-bold text-slate-400">Or import a trusted URL</summary>
        <form action={enqueueWeeklyGenerationAction} className="mt-4 grid gap-3">
          <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
          <input type="hidden" name="revision_id" value={workspace.revision.id} />
          <input type="hidden" name="job_type" value="artifact_promotion" />
          <input type="hidden" name="artifact_type" value={artifactType} />
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slot_key" value={slotKey} />
          {revisionItemId ? (
            <input type="hidden" name="revision_item_id" value={revisionItemId} />
          ) : null}
          <label className={LABEL}>
            Source URL
            <input
              type="url"
              name="source_url"
              required
              placeholder="https://…"
              disabled={!canEdit}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            Alt text
            <textarea
              name="alt_text"
              rows={2}
              required={artifactType !== 'pdf'}
              disabled={!canEdit}
              className={TEXTAREA}
            />
          </label>
          <ActionSubmitButton
            idleLabel="Validate and stage URL"
            pendingLabel="Staging URL…"
            disabled={!canEdit}
            className={SECONDARY}
          />
        </form>
      </details>
    </div>
  );
}

function VisualsPanel({
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
  const cover = artifactFor(workspace.artifacts, 'cover', 'neutral');
  const socialAssets = workspace.artifacts.filter(
    (artifact) => artifact.artifact_type === 'social_asset',
  );

  return (
    <div className="grid gap-7">
      <section aria-labelledby="cover-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="cover-heading" className="text-xl font-bold text-white">
              Weekly cover composition
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              The renderer composes motifs from the selected stories, then applies deterministic
              typography and safe zones for every channel.
            </p>
          </div>
          <form action={enqueueWeeklyGenerationAction}>
            <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
            <input type="hidden" name="revision_id" value={revision.id} />
            <input type="hidden" name="job_type" value="cover" />
            <input type="hidden" name="locale" value="neutral" />
            <input type="hidden" name="slot_key" value="cover:neutral" />
            <ActionSubmitButton
              idleLabel={cover ? 'Regenerate cover' : 'Generate cover'}
              pendingLabel="Queueing cover…"
              disabled={!canEdit}
              className={PRIMARY}
            />
          </form>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <ArtifactCard
            digestId={workspace.digest.id}
            artifact={cover}
            reviews={workspace.artifactReviews}
            canReview={canReview}
            label="Master cover"
            imagePreview
          />
          <div className="grid content-start gap-3">
            <div className={`${PANEL} text-sm text-slate-400`}>
              <p className="font-bold text-white">Automatic checks</p>
              <ul className="mt-3 grid gap-2">
                <li>• resolution and file size</li>
                <li>• text safe zones and contrast</li>
                <li>• Cyrillic-capable embedded fonts</li>
                <li>• required alt text and focal point</li>
              </ul>
            </div>
            <ReplacementAssetForm
              workspace={workspace}
              artifactType="cover"
              slotKey="cover:neutral"
              canEdit={canEdit}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="story-images-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="story-images-heading" className="text-xl font-bold text-white">
              Story illustrations
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Each visual must depict the corresponding news item, not generic AI decoration.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-5 xl:grid-cols-2">
          {workspace.items.map((item) => {
            const artifact = artifactFor(workspace.artifacts, 'story_image', undefined, item.id);
            const slotKey = `story-image:${item.id}`;
            return (
              <div key={item.id} className="grid content-start gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-bold text-white">
                    {item.rank}. {item.title_en}
                  </p>
                  <form action={enqueueWeeklyGenerationAction}>
                    <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
                    <input type="hidden" name="revision_id" value={revision.id} />
                    <input type="hidden" name="job_type" value="story_image" />
                    <input type="hidden" name="locale" value="neutral" />
                    <input type="hidden" name="slot_key" value={slotKey} />
                    <input type="hidden" name="revision_item_id" value={item.id} />
                    <ActionSubmitButton
                      idleLabel={artifact ? 'Regenerate' : 'Generate'}
                      pendingLabel="Queueing…"
                      disabled={!canEdit}
                      className={SECONDARY}
                    />
                  </form>
                </div>
                <ArtifactCard
                  digestId={workspace.digest.id}
                  artifact={artifact}
                  reviews={workspace.artifactReviews}
                  canReview={canReview}
                  label={`Story ${item.rank} illustration`}
                  imagePreview
                />
                <ReplacementAssetForm
                  workspace={workspace}
                  artifactType="story_image"
                  slotKey={slotKey}
                  revisionItemId={item.id}
                  canEdit={canEdit}
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
        </div>
        {socialAssets.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {socialAssets.map((artifact) => (
              <ArtifactCard
                key={artifact.id}
                digestId={workspace.digest.id}
                artifact={artifact}
                reviews={workspace.artifactReviews}
                canReview={canReview}
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
    </div>
  );
}

const SOCIAL_LIMITS: Record<string, number> = {
  telegram: 4096,
  facebook: 63206,
  linkedin: 3000,
  x: 280,
  threads: 500,
  instagram: 2200,
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
  const postsByChannel = new Map(workspace.socialPosts.map((post) => [post.channel, post]));

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
        <p className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-400">
          Times shown in Europe/Kyiv
        </p>
      </div>

      {(
        Object.entries(WEEKLY_SOCIAL_MATRIX) as Array<
          [keyof typeof WEEKLY_SOCIAL_MATRIX, 'en' | 'uk']
        >
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
                Required {locale.toUpperCase()} variant is missing. Regenerate the weekly social
                package.
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
        return (
          <section key={channel} className={PANEL} aria-labelledby={`social-${channel}-heading`}>
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

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,.55fr)]">
              <form action={saveWeeklySocialAction} className="grid gap-4">
                <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
                <input type="hidden" name="revision_id" value={workspace.revision?.id ?? ''} />
                <input type="hidden" name="social_post_id" value={post.id} />
                <input type="hidden" name="channel" value={channel} />
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="time_zone" value="Europe/Kyiv" />
                <label className={LABEL}>
                  Post copy
                  <textarea
                    name="post_text"
                    rows={8}
                    required
                    maxLength={SOCIAL_LIMITS[channel]}
                    defaultValue={post.post_text ?? ''}
                    disabled={!canEdit}
                    className={TEXTAREA}
                    aria-describedby={`social-${channel}-limit`}
                  />
                  <span
                    id={`social-${channel}-limit`}
                    className="text-xs font-normal text-slate-500"
                  >
                    Current: {(post.post_text ?? '').length.toLocaleString()} /{' '}
                    {SOCIAL_LIMITS[channel].toLocaleString()} characters
                  </span>
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className={LABEL}>
                    CTA
                    <input
                      name="cta"
                      defaultValue={typeof meta.cta === 'string' ? meta.cta : ''}
                      disabled={!canEdit}
                      className={FIELD}
                    />
                  </label>
                  <label className={LABEL}>
                    Hashtags
                    <input
                      name="hashtags"
                      defaultValue={typeof meta.hashtags === 'string' ? meta.hashtags : ''}
                      disabled={!canEdit}
                      className={FIELD}
                      placeholder="#AI #WeeklyDigest"
                    />
                  </label>
                </div>
                {channel === 'linkedin' ? (
                  <div className="grid gap-4 rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-4 md:grid-cols-2">
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
                  </div>
                ) : null}
                <label className={LABEL}>
                  First comment
                  <textarea
                    name="first_comment"
                    rows={3}
                    defaultValue={post.first_comment ?? ''}
                    disabled={!canEdit}
                    className={TEXTAREA}
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className={LABEL}>
                    Destination URL
                    <input
                      type="url"
                      name="url"
                      required
                      defaultValue={post.url ?? ''}
                      disabled={!canEdit}
                      className={FIELD}
                    />
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
                <label className={LABEL}>
                  Asset URLs (JSON)
                  <textarea
                    name="asset_urls_json"
                    rows={4}
                    required
                    spellCheck={false}
                    defaultValue={jsonText(post.asset_urls)}
                    disabled={!canEdit}
                    className={`${TEXTAREA} font-mono text-xs`}
                  />
                </label>
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
                    disabled={!canReview}
                    className={PRIMARY}
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
                  {post.url ? (
                    <p className="mt-4 truncate text-xs text-[#47e4d3]">{post.url}</p>
                  ) : null}
                </div>

                <div className="rounded-xl border border-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-white">Quality checks</p>
                    <span
                      className={
                        quality.blocking
                          ? 'text-xs font-bold text-red-300'
                          : 'text-xs font-bold text-emerald-300'
                      }
                    >
                      {quality.blocking} blockers · {quality.warnings} warnings
                    </span>
                  </div>
                  {quality.messages.length ? (
                    <ul className="mt-3 grid gap-2 text-xs leading-5 text-slate-400">
                      {quality.messages.map((message, index) => (
                        <li key={`${message}-${index}`}>• {message}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">No reported quality issues.</p>
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
          return (
            <section key={locale} className="grid content-start gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-white">
                  {locale === 'en' ? 'English PDF' : 'Український PDF'}
                </h3>
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
    </div>
  );
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
  const scenes =
    asRecord(manifest?.content).scenes ??
    asRecord(script?.content).scenes ??
    (manifest ? manifest.content : []);
  const scenesJson = jsonText(scenes, '[]');
  const captionsEnText = textFrom(captionsEn?.content, 'vtt', 'srt', 'text');
  const captionsUkText = textFrom(captionsUk?.content, 'vtt', 'srt', 'text');

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">One assembled YouTube video</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            English narration combines HeyGen avatar scenes with illustrated news scenes. The public
            player uses the same YouTube video on both locales and requires EN and UK captions.
          </p>
        </div>
        <span className="rounded-xl border border-cyan-300/20 bg-cyan-300/6 px-3 py-2 text-xs font-semibold text-cyan-100">
          YouTube is the final video storage — no MP4 upload
        </span>
      </div>

      <form action={saveWeeklyVideoAction} className={PANEL}>
        <input type="hidden" name="weekly_digest_id" value={workspace.digest.id} />
        <input type="hidden" name="revision_id" value={revision.id} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">Video contract</h3>
            <p className="mt-1 text-sm text-slate-500">
              Changing the script after rendering starts makes the video artifacts stale.
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
                required
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
                required
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
                type="url"
                name="youtube_url"
                defaultValue={finalVideo?.external_url ?? ''}
                disabled={!canEdit}
                className={FIELD}
                placeholder="https://www.youtube.com/watch?v=…"
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
              />
            </label>
            <label className={LABEL}>
              Duration (seconds)
              <input
                type="number"
                min={1}
                name="duration_seconds"
                defaultValue={finalVideo?.duration_seconds ?? ''}
                disabled={!canEdit}
                className={FIELD}
              />
            </label>
          </div>
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
        <section className={PANEL} aria-labelledby="release-gate-heading">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="release-gate-heading" className="mr-auto text-xl font-bold text-white">
              Release control
            </h2>
            <StatusPill value={digest.status} />
          </div>
          <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/6 p-4">
            <p className="font-bold text-cyan-100">Monday remains an editorial day</p>
            <p className="mt-2 text-sm leading-6 text-cyan-100/75">
              Review, text changes, media replacement and re-approval are allowed through 15:45
              Europe/Kyiv. The automated preflight then freezes the scheduled revision for the 16:00
              release. To change anything after 15:45, an owner pauses the edition, edits, runs
              approval again and reschedules it.
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
            <ul className="mt-4 grid gap-2 text-sm">
              {blockers.map((blocker) => (
                <li
                  key={`${blocker.slot}:${blocker.code}`}
                  className="rounded-xl border border-amber-400/20 bg-amber-400/6 p-3 text-amber-100"
                >
                  <p className="font-bold">{blocker.slot}</p>
                  <p className="mt-1 text-xs leading-5 text-amber-100/70">{blocker.message}</p>
                </li>
              ))}
            </ul>
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
    return [
      {
        artifactType: artifact.artifact_type as WeeklyArtifactType,
        locale: artifact.locale === 'en' || artifact.locale === 'uk' ? artifact.locale : undefined,
        storyId: artifact.revision_item_id,
        generationStatus: artifact.generation_status,
        reviewStatus: artifact.review_status,
        stale: artifact.review_status === 'stale',
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
  const preflight = validateWeeklyDigestPreflight({ storyIds, artifacts, social });
  const requiredSlots = 9 + storyIds.length + Object.keys(WEEKLY_SOCIAL_MATRIX).length;
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
      {activeTab === 'overview' ? (
        <OverviewPanel workspace={workspace} blockers={preflight.blockers} progress={progress} />
      ) : null}
      {activeTab === 'stories' ? <StoriesPanel workspace={workspace} canEdit={canEdit} /> : null}
      {activeTab === 'article' ? (
        <ArticlePanel workspace={workspace} canEdit={canEdit} canReview={canReview} />
      ) : null}
      {activeTab === 'visuals' ? (
        <VisualsPanel workspace={workspace} canEdit={canEdit} canReview={canReview} />
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
