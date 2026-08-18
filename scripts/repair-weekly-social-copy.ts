/**
 * Rewrite truncated/ungrounded Facebook, Threads, and Instagram copy for one
 * weekly social package, re-render seven Instagram JPEGs, then re-run critic.
 *
 * Usage:
 *   npm run weekly:social:repair-copy -- --package-id <uuid>
 *   npm run weekly:social:repair-copy -- --package-id <uuid> --apply
 *
 * Does not approve, schedule, or enable publishing.
 */
import { createHash } from 'node:crypto';
import { loadEnvConfig } from '@next/env';
import type { Json } from '../src/lib/database.types';
import { isSocialImageMime, parsePersistedSocialAssetRefs } from '../src/lib/social/asset-ref';
import { socialContentHash } from '../src/lib/social/content-hash';
import { attachCriticReport } from '../src/lib/social/critic';
import { readableInstagramParts } from '../src/lib/social/instagram-carousel';
import {
  mergePreservedQualityProvenance,
  runQualityGate,
  socialApprovalBlockers,
} from '../src/lib/social/quality';
import { isSocialChannel, type SocialAsset, type SocialDraft, type SocialLocale } from '../src/lib/social/types';
import { groundedWeeklySocialCopy, instagramStoryRoleFromItem } from '../src/lib/weekly-digest/repair-social-copy';
import { buildWeeklySocialFactSnapshot } from '../src/lib/weekly-digest/social-facts';

loadEnvConfig(process.cwd());

const PRIVATE_BUCKET = 'weekly-digest-private';
const COPY_REPAIR_REASON =
  'Replace truncated/ungrounded social copy with takeaway-grounded copy and re-render Instagram slides.';

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function usage() {
  console.error(
    'Usage: npm run weekly:social:repair-copy -- --package-id <uuid> [--apply]\nDry-run is the default.',
  );
}

function asAssets(value: unknown): SocialAsset[] {
  return parsePersistedSocialAssetRefs(value).map((ref) => ({
    artifactId: ref.artifactId,
    url: ref.url,
    width: ref.width,
    height: ref.height,
    bytes: ref.bytes,
    mimeType: isSocialImageMime(ref.mimeType) ? ref.mimeType : undefined,
  }));
}

function trackedUrlFromPost(post: {
  post_text: string | null;
  content_parts: unknown;
  utm_url: string | null;
  url: string | null;
}) {
  const parts = Array.isArray(post.content_parts)
    ? post.content_parts.filter((part): part is string => typeof part === 'string')
    : [];
  const blob = [post.post_text ?? '', ...parts].join('\n');
  const match = blob.match(/https:\/\/[^\s]+/i);
  return match?.[0] ?? post.utm_url ?? post.url ?? '';
}

function metaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
    p_metadata: { channel: 'instagram', slide_index: input.index, slide_count: 7, sha256: hash, copy_repair: true },
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
  if (socialPackage.kind !== 'weekly_digest') {
    throw new Error('Copy repair only runs on weekly_digest packages.');
  }
  const revisionId = socialPackage.weekly_digest_revision_id;
  const weeklyDigestId = socialPackage.weekly_digest_id;
  if (!revisionId || !weeklyDigestId) {
    throw new Error('Social package is missing weekly_digest_id or weekly_digest_revision_id.');
  }

  const { data: posts, error: postsError } = await db
    .from('social_posts')
    .select(
      'id,channel,status,publish_enabled,scheduled_for,asset_urls,content_parts,post_text,first_comment,alt_text,format,locale,content_version,content_hash,meta,quality_report,utm_url,url',
    )
    .eq('package_id', packageId);
  if (postsError || !posts) throw new Error(postsError?.message ?? 'Social posts could not be loaded.');

  const facebook = posts.find((post) => post.channel === 'facebook');
  const threads = posts.find((post) => post.channel === 'threads');
  const instagram = posts.find((post) => post.channel === 'instagram');
  if (!facebook) throw new Error('Facebook post was not found.');
  if (!threads) throw new Error('Threads post was not found.');
  if (!instagram) throw new Error('Instagram post was not found.');
  const facebookUrl = trackedUrlFromPost(facebook);
  const threadsUrl = trackedUrlFromPost(threads);
  if (!facebookUrl) throw new Error('Facebook post is missing a tracked URL.');
  if (!threadsUrl) throw new Error('Threads post is missing a tracked URL.');

  const { data: weeklyItems, error: itemsError } = await db
    .from('weekly_digest_revision_items')
    .select(
      'id,title_en,title_uk,summary_en,summary_uk,why_en,why_uk,practical_en,practical_uk,takeaway_en,takeaway_uk,source_snapshot',
    )
    .eq('revision_id', revisionId)
    .order('rank');
  if (itemsError) throw new Error(itemsError.message);
  const roleById = new Map(
    (weeklyItems ?? []).flatMap((item) => {
      const role = instagramStoryRoleFromItem(item);
      return role ? [[item.id, role] as const] : [];
    }),
  );

  const { data: artifacts, error: artifactsError } = await db
    .from('weekly_digest_artifacts')
    .select(
      'id,artifact_type,slot_key,is_current,generation_status,review_status,mime_type,width,height,byte_size,revision_item_id,storage_bucket,storage_path,external_url,content,locale',
    )
    .eq('revision_id', revisionId)
    .eq('is_current', true);
  if (artifactsError) throw new Error(artifactsError.message);

  const sources = selectInstagramCarouselSources(artifacts ?? []);
  if (!sources.ok) throw new Error(sources.blocker.message);
  const stories = sources.stories.map((story) => {
    const revisionItemId = story.revisionItemId;
    if (!revisionItemId) throw new Error('An Instagram story image is missing revision_item_id.');
    const role = roleById.get(revisionItemId);
    if (!role) {
      throw new Error(`No grounded copy is defined for story ${revisionItemId}.`);
    }
    return { revisionItemId, role };
  });
  if (stories.length !== 3 || !stories[0] || !stories[1] || !stories[2]) {
    throw new Error('Instagram copy repair needs three story images.');
  }
  const uniqueRoles = new Set(stories.map((story) => story.role));
  if (uniqueRoles.size !== 3) throw new Error('Instagram story images must map to three different copy roles.');

  const copy = groundedWeeklySocialCopy({
    stories: [stories[0], stories[1], stories[2]],
    facebookTrackedUrl: facebookUrl,
    threadsTrackedUrl: threadsUrl,
  });

  const preview = {
    apply,
    packageId,
    instagramCaptionChars: copy.instagram.caption.length,
    facebookChars: copy.facebookUk.length,
    threadsPartChars: copy.threadsUk.map((part) => part.length),
    storyRoles: stories,
    slides: copy.instagram.slides.map((slide) => ({
      kind: slide.kind,
      headline: slide.headline,
      body: 'body' in slide ? slide.body : null,
    })),
  };
  console.log(JSON.stringify(preview, null, 2));
  if (!apply) return;

  const coverRow = (artifacts ?? []).find((artifact) => artifact.id === sources.cover.artifactId);
  const cover = coverRow ? await downloadArtifactBytes(db, coverRow) : null;
  if (!cover) throw new Error('Approved cover bytes could not be downloaded.');
  const storyImages: Array<{ revisionItemId: string; image: Buffer }> = [];
  for (const story of sources.stories) {
    const row = (artifacts ?? []).find((artifact) => artifact.id === story.artifactId);
    const image = row ? await downloadArtifactBytes(db, row) : null;
    if (!image || !story.revisionItemId) throw new Error('Approved story image bytes could not be downloaded.');
    storyImages.push({ revisionItemId: story.revisionItemId, image });
  }
  const rendered = await renderWeeklyInstagramCarousel({
    spec: copy.instagram,
    cover,
    stories: storyImages,
  });
  if (!rendered.ok) {
    throw new Error(rendered.blockers.map((blocker) => blocker.message).join(' '));
  }
  const instagramAssets: SocialAsset[] = [];
  for (const slide of rendered.slides) {
    instagramAssets.push(
      await persistInstagramJpeg({
        db,
        weeklyDigestId,
        revisionId,
        index: slide.index,
        jpeg: slide.jpeg,
      }),
    );
  }

  const articleArtifacts = (artifacts ?? []).filter((artifact) => artifact.artifact_type === 'article');
  const itemFacts = weeklyItems ?? [];
  const currentRevisionItemIds = itemFacts.map((item) => item.id);

  type Target = {
    post: (typeof posts)[number];
    postText: string;
    contentParts: string[];
    assets: SocialAsset[];
    meta: Record<string, unknown>;
    instagramCarousel: typeof copy.instagram | null;
  };
  const instagramMeta = {
    ...metaRecord(instagram.meta),
    instagram_carousel: copy.instagram,
    hook_angle: copy.instagram.angle,
    hook_candidates: copy.instagram.hookCandidates,
  };
  const targets: Target[] = [
    {
      post: facebook,
      postText: copy.facebookUk,
      contentParts: [],
      assets: asAssets(facebook.asset_urls),
      meta: metaRecord(facebook.meta),
      instagramCarousel: null,
    },
    {
      post: threads,
      postText: copy.threadsUk[0],
      contentParts: [...copy.threadsUk],
      assets: asAssets(threads.asset_urls),
      meta: metaRecord(threads.meta),
      instagramCarousel: null,
    },
    {
      post: instagram,
      postText: copy.instagram.caption,
      contentParts: readableInstagramParts(copy.instagram),
      assets: instagramAssets,
      meta: instagramMeta,
      instagramCarousel: copy.instagram,
    },
  ];

  const criticScores: Array<{ channel: string; score: number | null; flags: string[]; blockers: string[] }> = [];
  for (const target of targets) {
    if (!isSocialChannel(target.post.channel)) {
      throw new Error(`Unsupported channel ${target.post.channel}.`);
    }
    const locale: SocialLocale = target.post.locale === 'uk' ? 'uk' : 'en';
    const articleContent =
      articleArtifacts.find((artifact) => artifact.locale === locale)?.content ??
      articleArtifacts.find((artifact) => artifact.locale === 'en')?.content ??
      null;
    const sourceFacts = buildWeeklySocialFactSnapshot({
      locale,
      articleContent,
      items: itemFacts,
    });
    const draft: SocialDraft = {
      channel: target.post.channel,
      locale,
      format: target.post.format ?? 'weekly',
      text: target.postText,
      contentParts: target.contentParts,
      firstComment: target.post.first_comment,
      assets: target.assets,
      altText: target.post.alt_text,
      scheduledFor: target.post.scheduled_for ?? '2099-01-01T10:00:00.000Z',
      sourceApproved: itemFacts.length > 0,
      sourceFacts,
      sourceUrl: target.post.utm_url ?? target.post.url ?? '',
      instagramCarousel: target.instagramCarousel,
      currentRevisionItemIds,
    };
    const gate = runQualityGate(draft);
    if (gate.blocking.length > 0) {
      throw new Error(
        `${target.post.channel} quality blockers: ${gate.blocking.map((issue) => issue.message).join(' · ')}`,
      );
    }
    const report = mergePreservedQualityProvenance(
      await attachCriticReport(draft, gate, db),
      target.post.quality_report,
    );
    const nextVersion = target.post.content_version + 1;
    const contentHash = socialContentHash({
      channel: draft.channel,
      locale: draft.locale,
      format: draft.format,
      text: draft.text,
      firstComment: draft.firstComment,
      contentParts: draft.contentParts,
      assets: draft.assets,
      altText: draft.altText,
      scheduledFor: draft.scheduledFor,
      contentVersion: nextVersion,
      instagramCarousel: draft.instagramCarousel,
    });
    const { error } = await db
      .from('social_posts')
      .update({
        post_text: target.postText,
        content_parts: target.contentParts,
        asset_urls: target.assets as unknown as Json,
        meta: target.meta as Json,
        quality_report: report as unknown as Json,
        content_version: nextVersion,
        content_hash: contentHash,
        status: 'in_review',
      })
      .eq('id', target.post.id);
    if (error) throw new Error(error.message);
    const { error: reviewError } = await db.from('social_post_reviews').insert({
      social_post_id: target.post.id,
      package_id: packageId,
      reviewer_id: null,
      action: 'edited',
      content_version: nextVersion,
      content_hash: contentHash,
      snapshot: { reason: COPY_REPAIR_REASON, channel: target.post.channel },
      note: COPY_REPAIR_REASON,
    });
    if (reviewError) throw new Error(reviewError.message);
    criticScores.push({
      channel: target.post.channel,
      score: report.critic?.score ?? null,
      flags: report.critic?.flags ?? [],
      blockers: socialApprovalBlockers(report).map((issue) => issue.message),
    });
  }

  const { error: packageStatusError } = await db
    .from('social_packages')
    .update({ status: 'in_review' })
    .eq('id', packageId);
  if (packageStatusError) throw new Error(packageStatusError.message);

  console.log(
    JSON.stringify(
      {
        applied: true,
        patched: targets.length,
        instagramJpegs: instagramAssets.length,
        critic: criticScores,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
