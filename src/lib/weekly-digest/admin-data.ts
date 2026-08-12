import 'server-only';

import { cache } from 'react';
import type { Database, Json } from '@/lib/database.types';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type Tables = Database['public']['Tables'];
type Row<Name extends keyof Tables> = Tables[Name]['Row'];

export type WeeklyDigestAdminRow = Row<'weekly_digests'>;
export type WeeklyRevisionAdminRow = Row<'weekly_digest_revisions'>;
export type WeeklyRevisionItemAdminRow = Row<'weekly_digest_revision_items'>;
export type WeeklyArtifactAdminRow = Row<'weekly_digest_artifacts'>;
export type WeeklyArtifactReviewAdminRow = Row<'weekly_digest_artifact_reviews'>;
export type WeeklyGenerationJobAdminRow = Row<'weekly_digest_generation_jobs'>;
export type WeeklyGenerationAttemptAdminRow = Row<'weekly_digest_generation_attempts'>;
export type WeeklyGenerationEventAdminRow = Row<'weekly_digest_generation_events'>;
export type WeeklyGenerationCostAdminRow = Row<'generation_cost_events'>;
export type WeeklyReleaseEventAdminRow = Row<'weekly_digest_release_events'>;
export type WeeklySocialPackageAdminRow = Row<'social_packages'>;
export type WeeklySocialPostAdminRow = Row<'social_posts'>;
export type WeeklySocialPostReviewAdminRow = Row<'social_post_reviews'>;
export type WeeklyLocaleMapAdminRow = Row<'weekly_locale_map'>;
export type WeeklyEngagementEventAdminRow = Row<'weekly_digest_engagement_events'>;
export type WeeklyStoryDirectionAdminRow = Row<'weekly_digest_story_directions'>;

export interface WeeklyDigestWorkspace {
  digest: WeeklyDigestAdminRow;
  revision: WeeklyRevisionAdminRow | null;
  revisions: WeeklyRevisionAdminRow[];
  items: WeeklyRevisionItemAdminRow[];
  artifacts: WeeklyArtifactAdminRow[];
  artifactReviews: WeeklyArtifactReviewAdminRow[];
  generationJobs: WeeklyGenerationJobAdminRow[];
  generationAttempts: WeeklyGenerationAttemptAdminRow[];
  generationEvents: WeeklyGenerationEventAdminRow[];
  generationCosts: WeeklyGenerationCostAdminRow[];
  releaseEvents: WeeklyReleaseEventAdminRow[];
  socialPackage: WeeklySocialPackageAdminRow | null;
  socialPosts: WeeklySocialPostAdminRow[];
  socialPostReviews: WeeklySocialPostReviewAdminRow[];
  localeMap: WeeklyLocaleMapAdminRow[];
  engagementEvents: WeeklyEngagementEventAdminRow[];
  storyDirections: WeeklyStoryDirectionAdminRow[];
}

function assertQuery<T>(
  label: string,
  result: { data: T | null; error: { message: string } | null },
): T {
  if (result.error) throw new Error(`[weekly-admin] ${label}: ${result.error.message}`);
  if (result.data === null) throw new Error(`[weekly-admin] ${label}: no data`);
  return result.data;
}

function jsonRecord(value: Json): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

function provenanceResearchArtifactId(item: WeeklyRevisionItemAdminRow) {
  const contentStudio = jsonRecord(jsonRecord(item.source_snapshot).content_studio ?? {});
  const value = contentStudio.research_artifact_id;
  return typeof value === 'string' && value ? value : null;
}

async function withPrivatePreviewUrls(artifacts: WeeklyArtifactAdminRow[]) {
  const db = getSupabaseAdmin();
  return Promise.all(
    artifacts.map(async (artifact): Promise<WeeklyArtifactAdminRow> => {
      if (!artifact.storage_bucket) return artifact;
      const content = jsonRecord(artifact.content);
      const previewPaths = Array.isArray(content.preview_paths)
        ? content.preview_paths.filter(
            (value): value is string => typeof value === 'string' && Boolean(value),
          )
        : [];
      const [artifactUrlResult, ...previewResults] = await Promise.all([
        artifact.storage_path
          ? db.storage.from(artifact.storage_bucket).createSignedUrl(artifact.storage_path, 3600)
          : Promise.resolve({ data: null, error: null }),
        ...previewPaths.map((path) =>
          db.storage.from(artifact.storage_bucket!).createSignedUrl(path, 3600),
        ),
      ]);
      const previewUrls = previewResults.flatMap((result) =>
        result.error || !result.data?.signedUrl ? [] : [result.data.signedUrl],
      );
      const signedArtifactUrl =
        artifact.external_url ??
        (artifactUrlResult.error ? null : (artifactUrlResult.data?.signedUrl ?? null));
      // Bust browser/CDN caches when a new artifact version reuses a similar preview slot.
      const versionedUrl = signedArtifactUrl
        ? `${signedArtifactUrl}${signedArtifactUrl.includes('?') ? '&' : '?'}v=${artifact.version}`
        : null;
      const versionedPreviews = previewUrls.map(
        (url) => `${url}${url.includes('?') ? '&' : '?'}v=${artifact.version}`,
      );
      return {
        ...artifact,
        external_url: versionedUrl,
        content:
          versionedPreviews.length > 0
            ? ({ ...content, preview_urls: versionedPreviews } as Json)
            : artifact.content,
      };
    }),
  );
}

export const getWeeklyDigestAdminList = cache(async () => {
  const db = getSupabaseAdmin();
  const result = await db
    .from('weekly_digests')
    .select('*')
    .order('week_start', { ascending: false })
    .limit(52);
  return assertQuery('digest list', result);
});

export const getWeeklyDigestWorkspace = cache(
  async (weeklyDigestId: string): Promise<WeeklyDigestWorkspace | null> => {
    const db = getSupabaseAdmin();
    const digestResult = await db
      .from('weekly_digests')
      .select('*')
      .eq('id', weeklyDigestId)
      .maybeSingle();
    if (digestResult.error) {
      throw new Error(`[weekly-admin] digest: ${digestResult.error.message}`);
    }
    const digest = digestResult.data;
    if (!digest) return null;

    const [
      revisionsResult,
      jobsResult,
      generationCostsResult,
      eventsResult,
      packageResult,
      localeMapResult,
      engagementResult,
      storyDirectionsResult,
    ] = await Promise.all([
      db
        .from('weekly_digest_revisions')
        .select('*')
        .eq('weekly_digest_id', digest.id)
        .order('revision_number', { ascending: false }),
      db
        .from('weekly_digest_generation_jobs')
        .select('*')
        .eq('weekly_digest_id', digest.id)
        .order('created_at', { ascending: false })
        .limit(50),
      digest.active_revision_id
        ? db
            .from('generation_cost_events')
            .select('*')
            .eq('weekly_digest_id', digest.id)
            .eq('revision_id', digest.active_revision_id)
            .order('created_at', { ascending: false })
            .limit(1000)
        : Promise.resolve({ data: [] as WeeklyGenerationCostAdminRow[], error: null }),
      db
        .from('weekly_digest_release_events')
        .select('*')
        .eq('weekly_digest_id', digest.id)
        .order('created_at', { ascending: false })
        .limit(100),
      digest.active_revision_id
        ? db
            .from('social_packages')
            .select('*')
            .eq('weekly_digest_id', digest.id)
            .eq('weekly_digest_revision_id', digest.active_revision_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null as WeeklySocialPackageAdminRow | null, error: null }),
      db
        .from('weekly_locale_map')
        .select('*')
        .eq('enabled', true)
        .eq('is_default', true)
        .order('channel'),
      db
        .from('weekly_digest_engagement_events')
        .select('*')
        .eq('weekly_digest_id', digest.id)
        .order('occurred_at', { ascending: false })
        .limit(500),
      db.from('weekly_digest_story_directions').select('*').eq('weekly_digest_id', digest.id),
    ]);

    const revisions = assertQuery('revisions', revisionsResult);
    const generationJobs = assertQuery('generation jobs', jobsResult);
    const generationCosts = generationCostsResult.error ? [] : (generationCostsResult.data ?? []);
    const releaseEvents = assertQuery('release events', eventsResult);
    // Tolerate this table not existing yet (migration not deployed) rather
    // than 500ing the whole workspace over an additive, optional feature --
    // "no angles saved" degrades identically to "table not migrated yet."
    const storyDirections = storyDirectionsResult.error ? [] : (storyDirectionsResult.data ?? []);
    const localeMap = assertQuery('weekly locale map', localeMapResult);
    const engagementEvents = assertQuery('weekly engagement events', engagementResult);
    if (packageResult.error) {
      throw new Error(`[weekly-admin] social package: ${packageResult.error.message}`);
    }
    const socialPackage = packageResult.data;
    const generationJobIds = generationJobs.map((job) => job.id);
    const [generationAttemptsResult, generationEventsResult] = await Promise.all([
      generationJobIds.length > 0
        ? db
            .from('weekly_digest_generation_attempts')
            .select('*')
            .in('job_id', generationJobIds)
            .order('started_at', { ascending: false })
            .limit(150)
        : Promise.resolve({ data: [] as WeeklyGenerationAttemptAdminRow[], error: null }),
      generationJobIds.length > 0
        ? db
            .from('weekly_digest_generation_events')
            .select('*')
            .in('job_id', generationJobIds)
            .order('id', { ascending: false })
            .limit(250)
        : Promise.resolve({ data: [] as WeeklyGenerationEventAdminRow[], error: null }),
    ]);
    // These tables are additive during rollout. The rest of the workspace is
    // still usable until the migration reaches an environment.
    const generationAttempts = generationAttemptsResult.error
      ? []
      : (generationAttemptsResult.data ?? []);
    const generationEvents = generationEventsResult.error
      ? []
      : (generationEventsResult.data ?? []);
    const revision =
      revisions.find((candidate) => candidate.id === digest.active_revision_id) ?? null;

    const [itemsResult, artifactsResult, socialPostsResult] = await Promise.all([
      revision
        ? db
            .from('weekly_digest_revision_items')
            .select('*')
            .eq('revision_id', revision.id)
            .order('rank')
        : Promise.resolve({ data: [] as WeeklyRevisionItemAdminRow[], error: null }),
      revision
        ? db
            .from('weekly_digest_artifacts')
            .select('*')
            .eq('revision_id', revision.id)
            .eq('is_current', true)
            .order('slot_key')
        : Promise.resolve({ data: [] as WeeklyArtifactAdminRow[], error: null }),
      socialPackage
        ? db
            .from('social_posts')
            .select('*')
            .eq('package_id', socialPackage.id)
            .order('scheduled_for')
        : Promise.resolve({ data: [] as WeeklySocialPostAdminRow[], error: null }),
    ]);

    const items = assertQuery('revision items', itemsResult);
    const activeArtifacts = assertQuery('artifacts', artifactsResult);
    const provenanceResearchIds = items
      .map(provenanceResearchArtifactId)
      .filter((value): value is string => Boolean(value))
      .filter((value) => !activeArtifacts.some((artifact) => artifact.id === value));
    const provenanceArtifactsResult = provenanceResearchIds.length
      ? await db
          .from('weekly_digest_artifacts')
          .select('*')
          .in('id', provenanceResearchIds)
          .eq('artifact_type', 'research_pack')
      : { data: [] as WeeklyArtifactAdminRow[], error: null };
    const artifacts = await withPrivatePreviewUrls([
      ...activeArtifacts,
      ...assertQuery('provenance research artifacts', provenanceArtifactsResult),
    ]);
    const socialPosts = assertQuery('social posts', socialPostsResult);
    const socialPostIds = socialPosts.map((post) => post.id);
    const socialReviewsResult =
      socialPostIds.length > 0
        ? await db
            .from('social_post_reviews')
            .select('*')
            .in('social_post_id', socialPostIds)
            .order('created_at', { ascending: false })
        : { data: [] as WeeklySocialPostReviewAdminRow[], error: null };
    const artifactIds = artifacts.map((artifact) => artifact.id);
    const reviewsResult =
      artifactIds.length > 0
        ? await db
            .from('weekly_digest_artifact_reviews')
            .select('*')
            .in('artifact_id', artifactIds)
            .order('created_at', { ascending: false })
        : { data: [] as WeeklyArtifactReviewAdminRow[], error: null };

    return {
      digest,
      revision,
      revisions,
      items,
      artifacts,
      artifactReviews: assertQuery('artifact reviews', reviewsResult),
      generationJobs,
      generationAttempts,
      generationEvents,
      generationCosts,
      releaseEvents,
      socialPackage,
      socialPosts,
      socialPostReviews: assertQuery('social post reviews', socialReviewsResult),
      localeMap,
      engagementEvents,
      storyDirections,
    };
  },
);
