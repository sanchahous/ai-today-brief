/**
 * Dry-run (default) or apply a controlled repair of one weekly social package.
 *
 * Usage:
 *   npm run weekly:social:repair -- --package-id <uuid>
 *   npm run weekly:social:repair -- --package-id <uuid> --apply
 *
 * Does not approve, schedule, or enable publishing.
 */
import { createHash } from 'node:crypto';
import { loadEnvConfig } from '@next/env';
import type { Json } from '../src/lib/database.types';

loadEnvConfig(process.cwd());

const PRIVATE_BUCKET = 'weekly-digest-private';

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function usage() {
  console.error(
    'Usage: npm run weekly:social:repair -- --package-id <uuid> [--apply]\nDry-run is the default. --apply writes only when preconditions pass.',
  );
}

async function downloadArtifactBytes(
  db: ReturnType<typeof import('../src/lib/supabase-admin').getSupabaseAdmin>,
  artifact: {
    storage_bucket: string | null;
    storage_path: string | null;
    external_url: string | null;
  },
) {
  if (artifact.storage_bucket && artifact.storage_path) {
    const { data, error } = await db.storage.from(artifact.storage_bucket).download(artifact.storage_path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  if (!artifact.external_url?.startsWith('http')) return null;
  const response = await fetch(artifact.external_url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

async function persistInstagramJpeg(input: {
  db: ReturnType<typeof import('../src/lib/supabase-admin').getSupabaseAdmin>;
  weeklyDigestId: string;
  revisionId: string;
  index: number;
  jpeg: Buffer;
}) {
  const { storageBlob } = await import('../src/lib/storage/binary');
  const hash = createHash('sha256').update(input.jpeg).digest('hex');
  const path =
    `digests/${input.weeklyDigestId}/revisions/${input.revisionId}/social/instagram/` +
    `${hash}/slide-${input.index}.jpg`;
  const upload = await input.db.storage.from(PRIVATE_BUCKET).upload(path, storageBlob(input.jpeg, 'image/jpeg'), {
    contentType: 'image/jpeg',
    cacheControl: '31536000, immutable',
    upsert: false,
  });
  if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) {
    throw new Error(`Instagram slide upload failed: ${upload.error.message}`);
  }
  const { data, error } = await input.db.rpc('save_weekly_digest_artifact', {
    p_weekly_digest_id: input.weeklyDigestId,
    p_revision_id: input.revisionId,
    p_revision_item_id: null,
    p_artifact_type: 'social_asset',
    p_locale: 'en',
    p_slot_key: `instagram-carousel:${input.index}:en`,
    p_generation_status: 'ready',
    p_review_status: 'in_review',
    p_content: { alt: `Weekly Digest carousel slide ${input.index}` },
    p_storage_bucket: PRIVATE_BUCKET,
    p_storage_path: path,
    p_external_url: null,
    p_provider: null,
    p_provider_id: null,
    p_mime_type: 'image/jpeg',
    p_width: 1080,
    p_height: 1350,
    p_byte_size: input.jpeg.length,
    p_metadata: { channel: 'instagram', slide_index: input.index, slide_count: 7, sha256: hash, repair: true },
  });
  if (error) throw new Error(`Instagram artifact save failed: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Instagram artifact RPC did not return an ID.');
  return {
    artifactId: data,
    width: 1080,
    height: 1350,
    bytes: input.jpeg.length,
    mimeType: 'image/jpeg' as const,
  };
}

async function main() {
  const packageId = argValue('--package-id');
  const apply = hasFlag('--apply');
  if (!packageId) {
    usage();
    process.exitCode = 1;
    return;
  }

  const { getSupabaseAdmin } = await import('../src/lib/supabase-admin');
  const {
    planWeeklySocialPackageRepair,
    buildRepairPatches,
    SOCIAL_REPAIR_REASON,
  } = await import('../src/lib/weekly-digest/repair-social-package');
  const { selectInstagramCarouselSources } = await import('../src/lib/social/channel-assets');
  const { renderWeeklyInstagramCarousel } = await import('../src/lib/weekly-digest/instagram-carousel-render');

  const db = getSupabaseAdmin();
  const { data: socialPackage, error: packageError } = await db
    .from('social_packages')
    .select('id,weekly_digest_id,weekly_digest_revision_id,status,kind')
    .eq('id', packageId)
    .maybeSingle();
  if (packageError || !socialPackage) {
    throw new Error(packageError?.message ?? `Social package ${packageId} was not found.`);
  }
  const { data: posts, error: postsError } = await db
    .from('social_posts')
    .select(
      'id,channel,status,publish_enabled,scheduled_for,asset_urls,content_parts,post_text,first_comment,alt_text,format,locale,content_version,content_hash,meta',
    )
    .eq('package_id', packageId);
  if (postsError || !posts) throw new Error(postsError?.message ?? 'Social posts could not be loaded.');

  const revisionId = socialPackage.weekly_digest_revision_id;
  const { data: digest } = socialPackage.weekly_digest_id
    ? await db
        .from('weekly_digests')
        .select('active_revision_id')
        .eq('id', socialPackage.weekly_digest_id)
        .maybeSingle()
    : { data: null };
  const { data: artifacts, error: artifactsError } = revisionId
    ? await db
        .from('weekly_digest_artifacts')
        .select(
          'id,artifact_type,slot_key,is_current,generation_status,review_status,mime_type,width,height,byte_size,revision_item_id,storage_bucket,storage_path,external_url',
        )
        .eq('revision_id', revisionId)
        .eq('is_current', true)
    : { data: [], error: null };
  if (artifactsError) throw new Error(artifactsError.message);

  const plan = planWeeklySocialPackageRepair({
    socialPackage,
    posts,
    artifacts: artifacts ?? [],
    revisionIsCurrent: Boolean(revisionId && digest?.active_revision_id === revisionId),
  });

  console.log(
    JSON.stringify(
      {
        apply,
        packageId,
        ok: plan.ok,
        blockers: plan.blockers,
        imageRefChanges: plan.imageRefChanges,
        instagramJpegs: plan.instagramJpegs,
        mutations: plan.mutations,
        scheduleHints: plan.scheduleHints,
      },
      null,
      2,
    ),
  );

  if (!apply) return;
  if (!plan.ok) {
    throw new Error(`Repair preconditions failed: ${plan.blockers.join(' ')}`);
  }
  if (plan.mutations.length === 0) {
    console.log(JSON.stringify({ applied: false, reason: 'already repaired' }));
    return;
  }

  const instagramMutation = plan.mutations.find((mutation) => mutation.type === 'regenerate_instagram');
  let instagramAssets: Awaited<ReturnType<typeof persistInstagramJpeg>>[] | undefined;
  if (instagramMutation && instagramMutation.type === 'regenerate_instagram') {
    if (!instagramMutation.spec || !socialPackage.weekly_digest_id || !revisionId) {
      throw new Error('Instagram repair is missing a carousel spec or revision.');
    }
    const sources = selectInstagramCarouselSources(artifacts ?? []);
    if (!sources.ok) throw new Error(sources.blocker.message);
    const coverRow = (artifacts ?? []).find((artifact) => artifact.id === sources.cover.artifactId);
    const cover = coverRow ? await downloadArtifactBytes(db, coverRow) : null;
    if (!cover) throw new Error('Approved cover bytes could not be downloaded.');
    const stories: Array<{ revisionItemId: string; image: Buffer }> = [];
    for (const story of sources.stories) {
      const row = (artifacts ?? []).find((artifact) => artifact.id === story.artifactId);
      const image = row ? await downloadArtifactBytes(db, row) : null;
      if (!image || !story.revisionItemId) throw new Error('Approved story image bytes could not be downloaded.');
      stories.push({ revisionItemId: story.revisionItemId, image });
    }
    const rendered = await renderWeeklyInstagramCarousel({
      spec: instagramMutation.spec,
      cover,
      stories,
    });
    if (!rendered.ok) {
      throw new Error(rendered.blockers.map((blocker) => blocker.message).join(' '));
    }
    instagramAssets = [];
    for (const slide of rendered.slides) {
      instagramAssets.push(
        await persistInstagramJpeg({
          db,
          weeklyDigestId: socialPackage.weekly_digest_id,
          revisionId,
          index: slide.index,
          jpeg: slide.jpeg,
        }),
      );
    }
  }

  const patches = buildRepairPatches({ posts, plan, instagramAssets });
  for (const patch of patches) {
    const { error } = await db
      .from('social_posts')
      .update({
        asset_urls: patch.asset_urls as Json,
        meta: patch.meta as Json,
        post_text: patch.post_text,
        content_parts: patch.content_parts,
        content_version: patch.content_version,
        content_hash: patch.content_hash,
        status: patch.status,
      })
      .eq('id', patch.id);
    if (error) throw new Error(error.message);
    const { error: reviewError } = await db.from('social_post_reviews').insert({
      social_post_id: patch.id,
      package_id: packageId,
      reviewer_id: null,
      action: 'edited',
      content_version: patch.content_version,
      content_hash: patch.content_hash,
      snapshot: { reason: SOCIAL_REPAIR_REASON, channel: posts.find((post) => post.id === patch.id)?.channel },
      note: SOCIAL_REPAIR_REASON,
    });
    if (reviewError) throw new Error(reviewError.message);
  }

  const { error: packageStatusError } = await db
    .from('social_packages')
    .update({ status: 'in_review' })
    .eq('id', packageId);
  if (packageStatusError) throw new Error(packageStatusError.message);

  console.log(JSON.stringify({ applied: true, patched: patches.length, instagramJpegs: instagramAssets?.length ?? 0 }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
