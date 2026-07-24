'use server';

import { createHash, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import sharp from 'sharp';
import type { Json } from '@/lib/database.types';
import { requireSocialAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { storageBlob } from '@/lib/storage/binary';
import { getSupabaseServer } from '@/lib/supabase/server';
import { updateVariantAction } from '@/app/admin/actions';
import { composeWeeklySocial } from '@/lib/social/composer';
import { kyivWallClockToUtc, SOCIAL_TIME_ZONE } from '@/lib/social/schedule';
import { normalizeYouTubeVideo } from '@/lib/weekly-digest/video';

function requiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is required.`);
  return value.trim();
}

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function optionalNumber(formData: FormData, key: string) {
  const value = optionalString(formData, key);
  if (!value) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${key} must be a number.`);
  return number;
}

function parseJson(value: string, label: string): Json {
  try {
    return JSON.parse(value) as Json;
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

function jsonArray(value: string, label: string): Json[] {
  if (!value.trim()) return [];
  const parsed = parseJson(value, label);
  if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array.`);
  return parsed;
}

function takeaways(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return [] as string[];
  if (trimmed.startsWith('[')) {
    const parsed = jsonArray(trimmed, 'Key takeaways');
    if (parsed.some((entry) => typeof entry !== 'string')) {
      throw new Error('Every key takeaway must be text.');
    }
    return parsed as string[];
  }
  return trimmed
    .split(/\r?\n/)
    .map((entry) => entry.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean);
}

function alignedStrings(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => (typeof value === 'string' ? value.trim() : ''));
}

function changedOr(current: string | null, value: string | undefined) {
  return value === undefined ? (current ?? '') : value;
}

function revalidateWeeklyAdmin(weeklyDigestId: string) {
  revalidatePath('/admin');
  revalidatePath('/admin/weekly');
  revalidatePath(`/admin/weekly/${weeklyDigestId}`);
}

function kyivDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SOCIAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Test editions use the full editorial and generation pipeline but carry a
 * database-enforced publication lock. One test exists per seven-day window so
 * repeated clicks safely reopen the same evidence set.
 */
export async function createTestWeeklyDigestAction() {
  await requireSocialAdmin({ roles: ['owner'] });
  const now = new Date();
  let result;
  try {
    result = await composeWeeklySocial(kyivDate(now), { now, testMode: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown preparation error.';
    redirect(`/admin/weekly?test_error=${encodeURIComponent(message.slice(0, 300))}`);
  }
  if (!result.weeklyDigestId) {
    redirect(
      `/admin/weekly?test_error=${encodeURIComponent(
        'The test Weekly Digest could not be prepared for this seven-day window.',
      )}`,
    );
  }
  revalidateWeeklyAdmin(result.weeklyDigestId);
  redirect(`/admin/weekly/${result.weeklyDigestId}`);
}

async function editableWorkspace(weeklyDigestId: string, revisionId: string) {
  const db = getSupabaseAdmin();
  const [{ data: digest, error: digestError }, { data: revision, error: revisionError }] =
    await Promise.all([
      db
        .from('weekly_digests')
        .select('*')
        .eq('id', weeklyDigestId)
        .eq('active_revision_id', revisionId)
        .single(),
      db.from('weekly_digest_revisions').select('*').eq('id', revisionId).single(),
    ]);
  if (digestError || !digest) throw new Error('The active Weekly Digest was not found.');
  if (revisionError || !revision) throw new Error('The active revision was not found.');
  const { data: items, error: itemError } = await db
    .from('weekly_digest_revision_items')
    .select('*')
    .eq('revision_id', revisionId)
    .order('rank');
  if (itemError || !items) throw new Error('The revision stories could not be loaded.');
  return { digest, revision, items };
}

export async function saveWeeklyRevisionAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const revisionId = requiredString(formData, 'revision_id');
  const { revision, items } = await editableWorkspace(weeklyDigestId, revisionId);
  const itemIds = alignedStrings(formData, 'item_id');
  const includedIds = new Set(alignedStrings(formData, 'included_item_id'));
  const submitted = {
    rank: alignedStrings(formData, 'item_rank'),
    titleEn: alignedStrings(formData, 'item_title_en'),
    titleUk: alignedStrings(formData, 'item_title_uk'),
    summaryEn: alignedStrings(formData, 'item_summary_en'),
    summaryUk: alignedStrings(formData, 'item_summary_uk'),
    bodyEn: alignedStrings(formData, 'item_body_en'),
    bodyUk: alignedStrings(formData, 'item_body_uk'),
    whyEn: alignedStrings(formData, 'item_why_en'),
    whyUk: alignedStrings(formData, 'item_why_uk'),
    practicalEn: alignedStrings(formData, 'item_practical_en'),
    practicalUk: alignedStrings(formData, 'item_practical_uk'),
    takeawayEn: alignedStrings(formData, 'item_takeaway_en'),
    takeawayUk: alignedStrings(formData, 'item_takeaway_uk'),
    eventDate: alignedStrings(formData, 'item_event_date'),
    sources: alignedStrings(formData, 'item_sources_json'),
  };
  const byId = new Map(items.map((item) => [item.id, item]));
  const nextItems =
    itemIds.length > 0
      ? itemIds
          .flatMap((itemId, index) => {
            const current = byId.get(itemId);
            if (!current || (includedIds.size > 0 && !includedIds.has(itemId))) return [];
            return [
              {
                brief_item_id: current.brief_item_id,
                rank: Number(submitted.rank[index] || current.rank),
                title_en: changedOr(current.title_en, submitted.titleEn[index]),
                title_uk: changedOr(current.title_uk, submitted.titleUk[index]),
                summary_en: changedOr(current.summary_en, submitted.summaryEn[index]),
                summary_uk: changedOr(current.summary_uk, submitted.summaryUk[index]),
                body_en: changedOr(current.body_en, submitted.bodyEn[index]),
                body_uk: changedOr(current.body_uk, submitted.bodyUk[index]),
                why_en: changedOr(current.why_en, submitted.whyEn[index]),
                why_uk: changedOr(current.why_uk, submitted.whyUk[index]),
                practical_en: changedOr(current.practical_en, submitted.practicalEn[index]),
                practical_uk: changedOr(current.practical_uk, submitted.practicalUk[index]),
                takeaway_en: changedOr(current.takeaway_en, submitted.takeawayEn[index]),
                takeaway_uk: changedOr(current.takeaway_uk, submitted.takeawayUk[index]),
                event_date: changedOr(current.event_date, submitted.eventDate[index]) || null,
                sources:
                  submitted.sources[index] === undefined
                    ? current.sources
                    : jsonArray(submitted.sources[index], `Sources for story ${index + 1}`),
                source_snapshot: current.source_snapshot,
              },
            ];
          })
          .sort((a, b) => a.rank - b.rank)
          .map((item, index) => ({ ...item, rank: index + 1 }))
      : items.map((item) => ({
          brief_item_id: item.brief_item_id,
          rank: item.rank,
          title_en: item.title_en,
          title_uk: item.title_uk,
          summary_en: item.summary_en,
          summary_uk: item.summary_uk,
          body_en: item.body_en,
          body_uk: item.body_uk,
          why_en: item.why_en,
          why_uk: item.why_uk,
          practical_en: item.practical_en,
          practical_uk: item.practical_uk,
          takeaway_en: item.takeaway_en,
          takeaway_uk: item.takeaway_uk,
          event_date: item.event_date,
          sources: item.sources,
          source_snapshot: item.source_snapshot,
        }));
  if (nextItems.length < 3 || nextItems.length > 7) {
    throw new Error('A Weekly Digest revision must contain 3 to 7 stories.');
  }

  const titleEn = optionalString(formData, 'title_en') || revision.title_en;
  const titleUk = optionalString(formData, 'title_uk') || revision.title_uk;
  const introEn = formData.has('intro_en')
    ? optionalString(formData, 'intro_en')
    : (revision.intro_en ?? '');
  const introUk = formData.has('intro_uk')
    ? optionalString(formData, 'intro_uk')
    : (revision.intro_uk ?? '');
  const editorNoteEn = formData.has('editor_note_en')
    ? optionalString(formData, 'editor_note_en')
    : (revision.editor_note_en ?? '');
  const editorNoteUk = formData.has('editor_note_uk')
    ? optionalString(formData, 'editor_note_uk')
    : (revision.editor_note_uk ?? '');
  const takeawaysEn = formData.has('key_takeaways_en')
    ? takeaways(optionalString(formData, 'key_takeaways_en'))
    : revision.key_takeaways_en;
  const takeawaysUk = formData.has('key_takeaways_uk')
    ? takeaways(optionalString(formData, 'key_takeaways_uk'))
    : revision.key_takeaways_uk;

  const db = await getSupabaseServer();
  const { data: newRevisionId, error } = await db.rpc('create_weekly_digest_revision', {
    p_weekly_digest_id: weeklyDigestId,
    p_title_en: titleEn,
    p_title_uk: titleUk,
    p_intro_en: introEn,
    p_intro_uk: introUk,
    p_editor_note_en: editorNoteEn,
    p_editor_note_uk: editorNoteUk,
    p_key_takeaways_en: takeawaysEn as Json,
    p_key_takeaways_uk: takeawaysUk as Json,
    p_items: nextItems as unknown as Json,
  });
  if (error) throw new Error(error.message);
  if (typeof newRevisionId !== 'string') {
    throw new Error('The new Weekly Digest revision ID was not returned.');
  }
  for (const [locale, title, intro, editorNote, localeTakeaways] of [
    ['en', titleEn, introEn, editorNoteEn, takeawaysEn],
    ['uk', titleUk, introUk, editorNoteUk, takeawaysUk],
  ] as const) {
    const { error: articleError } = await db.rpc('save_weekly_digest_artifact', {
      p_weekly_digest_id: weeklyDigestId,
      p_revision_id: newRevisionId,
      p_artifact_type: 'article',
      p_locale: locale,
      p_slot_key: `article:${locale}`,
      p_content: {
        title,
        intro,
        editor_note: editorNote,
        key_takeaways: localeTakeaways,
      } as Json,
      p_metadata: {
        format: 'weekly-landing-v2',
        story_count: nextItems.length,
      } as Json,
    });
    if (articleError) throw new Error(articleError.message);
  }
  revalidateWeeklyAdmin(weeklyDigestId);
}

export async function reviewWeeklyArtifactAction(formData: FormData) {
  const decision = requiredString(formData, 'decision');
  const roles = decision === 'approved' ? (['owner'] as const) : (['owner', 'editor'] as const);
  await requireSocialAdmin({ roles });
  if (decision !== 'approved' && decision !== 'changes_requested') {
    throw new Error('Invalid artifact review decision.');
  }
  const artifactId = requiredString(formData, 'artifact_id');
  const expectedVersion = Number(requiredString(formData, 'artifact_version'));
  const expectedHash = requiredString(formData, 'artifact_input_hash');
  const note = optionalString(formData, 'note');
  if (decision === 'changes_requested' && (note.length < 10 || note.length > 2000)) {
    throw new Error('A change request note must contain 10 to 2000 characters.');
  }
  const admin = getSupabaseAdmin();
  const { data: artifact } = await admin
    .from('weekly_digest_artifacts')
    .select('weekly_digest_id,version,input_hash,is_current')
    .eq('id', artifactId)
    .maybeSingle();
  if (
    !artifact?.is_current ||
    artifact.version !== expectedVersion ||
    artifact.input_hash !== expectedHash
  ) {
    throw new Error('This artifact changed while it was being reviewed. Reload before approval.');
  }
  const db = await getSupabaseServer();
  const { error } = await db.rpc('review_weekly_digest_artifact', {
    p_artifact_id: artifactId,
    p_action: decision,
    p_note: note || null,
  });
  if (error) throw new Error(error.message);
  revalidateWeeklyAdmin(artifact.weekly_digest_id);
}

export async function commentWeeklyArtifactAction(formData: FormData) {
  await requireSocialAdmin();
  const artifactId = requiredString(formData, 'artifact_id');
  const note = requiredString(formData, 'note');
  if (note.length > 2000) throw new Error('A comment may contain at most 2000 characters.');
  const admin = getSupabaseAdmin();
  const { data: artifact } = await admin
    .from('weekly_digest_artifacts')
    .select('weekly_digest_id')
    .eq('id', artifactId)
    .maybeSingle();
  if (!artifact) throw new Error('Weekly Digest artifact was not found.');
  const db = await getSupabaseServer();
  const { error } = await db.rpc('comment_weekly_digest_artifact', {
    p_artifact_id: artifactId,
    p_note: note,
  });
  if (error) throw new Error(error.message);
  revalidateWeeklyAdmin(artifact.weekly_digest_id);
}

async function saveArtifact(
  formData: FormData,
  artifact: {
    type: string;
    locale: 'neutral' | 'en' | 'uk';
    slot: string;
    content?: Record<string, Json | undefined>;
    externalUrl?: string;
    provider?: string;
    providerId?: string;
    mimeType?: string;
    durationSeconds?: number | null;
    metadata?: Record<string, Json | undefined>;
  },
) {
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const revisionId = requiredString(formData, 'revision_id');
  const db = await getSupabaseServer();
  const { error } = await db.rpc('save_weekly_digest_artifact', {
    p_weekly_digest_id: weeklyDigestId,
    p_revision_id: revisionId,
    p_artifact_type: artifact.type,
    p_locale: artifact.locale,
    p_slot_key: artifact.slot,
    p_content: (artifact.content ?? {}) as Json,
    p_external_url: artifact.externalUrl || null,
    p_provider: artifact.provider || null,
    p_provider_id: artifact.providerId || null,
    p_mime_type: artifact.mimeType || null,
    p_duration_seconds: artifact.durationSeconds ?? null,
    p_metadata: (artifact.metadata ?? {}) as Json,
  });
  if (error) throw new Error(error.message);
  return weeklyDigestId;
}

function localKyivToIso(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Schedule must use YYYY-MM-DDTHH:mm in Europe/Kyiv.');
  return kyivWallClockToUtc(match[1], Number(match[2]), Number(match[3])).toISOString();
}

export async function saveWeeklyVideoAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const script = optionalString(formData, 'script_en');
  const scenes = optionalString(formData, 'scenes_json');
  const captionsEn = optionalString(formData, 'captions_en');
  const captionsUk = optionalString(formData, 'captions_uk');
  const heygenProjectUrl = optionalString(formData, 'heygen_project_url');
  const heygenPreviewUrl = optionalString(formData, 'heygen_preview_url');
  const graphicsPreviewUrl = optionalString(formData, 'graphics_preview_url');
  const youtubeUrl = optionalString(formData, 'youtube_url');
  const suppliedVideoId = optionalString(formData, 'youtube_video_id');
  const thumbnailUrl = optionalString(formData, 'thumbnail_url');
  const durationSeconds = optionalNumber(formData, 'duration_seconds');
  const workflowStatus = optionalString(formData, 'workflow_status') || 'draft';
  let savedDigestId: string | null = null;
  let saved = false;
  const persist = async (artifact: Parameters<typeof saveArtifact>[1]) => {
    savedDigestId = await saveArtifact(formData, artifact);
    saved = true;
  };

  if (script || scenes) {
    await persist({
      type: 'video_script',
      locale: 'en',
      slot: 'video-script:en',
      content: { script },
      metadata: { workflow_status: workflowStatus },
    });
  }
  if (scenes) {
    await persist({
      type: 'video_manifest',
      locale: 'en',
      slot: 'video-manifest:en',
      content: { scenes: parseJson(scenes, 'Scene structure') },
      metadata: { workflow_status: workflowStatus },
    });
  }
  if (heygenProjectUrl || heygenPreviewUrl) {
    await persist({
      type: 'heygen_preview',
      locale: 'en',
      slot: 'heygen-preview:en',
      externalUrl: heygenPreviewUrl || heygenProjectUrl,
      provider: 'heygen',
      metadata: { project_url: heygenProjectUrl || null, workflow_status: workflowStatus },
    });
  }
  if (graphicsPreviewUrl) {
    await persist({
      type: 'graphics_preview',
      locale: 'en',
      slot: 'graphics-preview:en',
      externalUrl: graphicsPreviewUrl,
      metadata: { workflow_status: workflowStatus },
    });
  }
  if (youtubeUrl || suppliedVideoId) {
    const video = normalizeYouTubeVideo(youtubeUrl || suppliedVideoId);
    if (!video || (suppliedVideoId && suppliedVideoId !== video.videoId)) {
      throw new Error('Enter a valid HTTPS YouTube URL and matching 11-character video ID.');
    }
    await persist({
      type: 'video_final',
      locale: 'en',
      slot: 'video-final:en',
      externalUrl: video.watchUrl,
      provider: 'youtube',
      providerId: video.videoId,
      mimeType: 'text/html',
      durationSeconds,
      metadata: {
        embed_url: video.embedUrl,
        thumbnail_url: thumbnailUrl || video.thumbnailUrl,
        workflow_status: workflowStatus,
        audio_locale: 'en',
      },
    });
  }
  if (captionsEn) {
    await persist({
      type: 'captions',
      locale: 'en',
      slot: 'captions:en',
      content: { vtt: captionsEn },
      mimeType: 'text/vtt',
    });
  }
  if (captionsUk) {
    await persist({
      type: 'captions',
      locale: 'uk',
      slot: 'captions:uk',
      content: { vtt: captionsUk },
      mimeType: 'text/vtt',
    });
  }
  if (youtubeUrl || suppliedVideoId) {
    const video = normalizeYouTubeVideo(youtubeUrl || suppliedVideoId)!;
    await persist({
      type: 'thumbnail',
      locale: 'neutral',
      slot: 'video-thumbnail',
      externalUrl: thumbnailUrl || video.thumbnailUrl,
      provider: 'youtube',
      providerId: video.videoId,
      mimeType: 'image/jpeg',
    });
  } else if (thumbnailUrl) {
    await persist({
      type: 'thumbnail',
      locale: 'neutral',
      slot: 'video-thumbnail',
      externalUrl: thumbnailUrl,
      mimeType: 'image/jpeg',
    });
  }
  if (!saved || !savedDigestId) throw new Error('Enter at least one video field to save.');
  revalidateWeeklyAdmin(savedDigestId);
}

export async function saveWeeklySocialAction(formData: FormData) {
  const intent = optionalString(formData, 'intent') || 'save';
  const session = await requireSocialAdmin({
    roles: intent === 'approved' ? ['owner'] : ['owner', 'editor'],
  });
  const postId = requiredString(formData, 'social_post_id');
  const admin = getSupabaseAdmin();
  const { data: post } = await admin
    .from('social_posts')
    .select('package_id,channel,locale,meta')
    .eq('id', postId)
    .maybeSingle();
  if (
    !post ||
    post.channel !== requiredString(formData, 'channel') ||
    post.locale !== requiredString(formData, 'locale')
  ) {
    throw new Error('The weekly social variant changed. Reload before saving.');
  }
  const cta = optionalString(formData, 'cta');
  const hashtags = optionalString(formData, 'hashtags');
  let postText = requiredString(formData, 'post_text');
  for (const suffix of [cta, hashtags]) {
    if (suffix && !postText.includes(suffix)) postText = `${postText}\n\n${suffix}`;
  }
  const assetUrlsText = optionalString(formData, 'asset_urls_json');
  const assetUrls = assetUrlsText ? jsonArray(assetUrlsText, 'Social assets') : null;
  const url = optionalString(formData, 'url');
  const utmUrl = optionalString(formData, 'utm_url');
  const currentMeta =
    post.meta && typeof post.meta === 'object' && !Array.isArray(post.meta)
      ? (post.meta as Record<string, Json | undefined>)
      : {};
  const linkedinDocumentStatus = optionalString(formData, 'linkedin_document_status');
  const linkedinDocumentNote = optionalString(formData, 'linkedin_document_note');
  if (
    post.channel === 'linkedin' &&
    !['not_started', 'draft_ready', 'ready', 'completed'].includes(linkedinDocumentStatus)
  ) {
    throw new Error('Select a valid LinkedIn document checklist status.');
  }
  if (
    intent === 'approved' &&
    post.channel === 'linkedin' &&
    !['ready', 'completed'].includes(linkedinDocumentStatus)
  ) {
    throw new Error('Prepare the manual LinkedIn PDF/document post before approval.');
  }
  for (const [label, value] of [
    ['URL', url],
    ['UTM URL', utmUrl],
  ] as const) {
    if (value && !/^https:\/\//i.test(value)) throw new Error(`${label} must use HTTPS.`);
  }
  const userDb = await getSupabaseServer();
  const { error: metadataError } = await userDb
    .from('social_posts')
    .update({
      ...(assetUrls ? { asset_urls: assetUrls as Json } : {}),
      ...(url ? { url } : {}),
      ...(utmUrl ? { utm_url: utmUrl } : {}),
      meta: {
        ...currentMeta,
        cta: cta || null,
        hashtags: hashtags || null,
        ...(post.channel === 'linkedin'
          ? {
              document_status: linkedinDocumentStatus,
              document_note: linkedinDocumentNote || null,
            }
          : {}),
      } as Json,
    })
    .eq('id', postId);
  if (metadataError) throw new Error(metadataError.message);
  const mapped = new FormData();
  mapped.set('id', postId);
  mapped.set('post_text', postText);
  mapped.set('first_comment', optionalString(formData, 'first_comment'));
  mapped.set('alt_text', optionalString(formData, 'alt_text'));
  // updateVariantAction performs the single DST-aware Europe/Kyiv → UTC conversion.
  mapped.set('scheduled_for', requiredString(formData, 'scheduled_for_local'));
  await updateVariantAction(mapped);
  if (intent === 'approved') {
    const { error } = await userDb.rpc('approve_social_post', {
      p_social_post_id: postId,
    });
    if (error) throw new Error(error.message);
  }
  if (intent === 'changes_requested') {
    const note = requiredString(formData, 'review_note');
    if (note.length < 10 || note.length > 2000) {
      throw new Error('A review note must contain 10 to 2000 characters.');
    }
    const { data: reviewedPost, error: reviewedPostError } = await admin
      .from('social_posts')
      .select('*')
      .eq('id', postId)
      .single();
    if (reviewedPostError || !reviewedPost) {
      throw new Error('The updated social variant could not be loaded for review.');
    }
    const { error } = await userDb.from('social_post_reviews').insert({
      social_post_id: reviewedPost.id,
      package_id: reviewedPost.package_id,
      reviewer_id: session.userId,
      action: 'rejected',
      content_version: reviewedPost.content_version,
      content_hash: reviewedPost.content_hash,
      snapshot: {
        channel: reviewedPost.channel,
        locale: reviewedPost.locale,
        post_text: reviewedPost.post_text,
        scheduled_for: reviewedPost.scheduled_for,
      } as Json,
      note,
    });
    if (error) throw new Error(error.message);
  }
  const { data: socialPackage } = post.package_id
    ? await admin
        .from('social_packages')
        .select('weekly_digest_id')
        .eq('id', post.package_id)
        .maybeSingle()
    : { data: null };
  if (socialPackage?.weekly_digest_id) revalidateWeeklyAdmin(socialPackage.weekly_digest_id);
}

export async function commentWeeklySocialAction(formData: FormData) {
  await requireSocialAdmin();
  const postId = requiredString(formData, 'social_post_id');
  const note = requiredString(formData, 'note');
  if (note.length > 2000) throw new Error('A comment may contain at most 2000 characters.');
  const admin = getSupabaseAdmin();
  const { data: post } = await admin
    .from('social_posts')
    .select('package_id')
    .eq('id', postId)
    .maybeSingle();
  if (!post?.package_id) throw new Error('Weekly social variant was not found.');
  const { data: socialPackage } = await admin
    .from('social_packages')
    .select('weekly_digest_id')
    .eq('id', post.package_id)
    .eq('kind', 'weekly_digest')
    .maybeSingle();
  if (!socialPackage?.weekly_digest_id) throw new Error('Weekly social package was not found.');
  const db = await getSupabaseServer();
  const { error } = await db.rpc('comment_weekly_social_post', {
    p_social_post_id: postId,
    p_note: note,
  });
  if (error) throw new Error(error.message);
  revalidateWeeklyAdmin(socialPackage.weekly_digest_id);
}

export async function toggleWeeklySocialAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true, roles: ['owner'] });
  const postId = requiredString(formData, 'social_post_id');
  const enabled = requiredString(formData, 'publish_enabled') === 'true';
  const reason = optionalString(formData, 'disabled_reason');
  const db = await getSupabaseServer();
  const { data, error } = await db.rpc('set_weekly_social_publish_enabled', {
    p_social_post_id: postId,
    p_enabled: enabled,
    p_reason: reason || null,
  });
  if (error) throw new Error(error.message);
  const post = Array.isArray(data) ? data[0] : data;
  const packageId =
    post && typeof post === 'object' && 'package_id' in post ? post.package_id : null;
  if (typeof packageId === 'string') {
    const admin = getSupabaseAdmin();
    const { data: socialPackage } = await admin
      .from('social_packages')
      .select('weekly_digest_id')
      .eq('id', packageId)
      .maybeSingle();
    if (socialPackage?.weekly_digest_id) revalidateWeeklyAdmin(socialPackage.weekly_digest_id);
  }
}

export async function enqueueWeeklyGenerationAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const revisionId = requiredString(formData, 'revision_id');
  const jobType = requiredString(formData, 'job_type');
  const allowed = new Set(['pdf', 'cover', 'story_image', 'social_asset']);
  if (!allowed.has(jobType)) throw new Error('Unsupported Weekly Digest generation job.');
  const slotKey = optionalString(formData, 'slot_key');
  const locale = optionalString(formData, 'locale') || 'neutral';
  const revisionItemId = optionalString(formData, 'revision_item_id');
  const requestKey = optionalString(formData, 'request_key') || randomUUID();
  const input = {
    slot_key: slotKey || null,
    locale,
    revision_item_id: revisionItemId || null,
    source_url: optionalString(formData, 'source_url') || null,
    alt_text: optionalString(formData, 'alt_text') || null,
  };
  const db = await getSupabaseServer();
  const { error } = await db.rpc('queue_weekly_digest_generation_job', {
    p_weekly_digest_id: weeklyDigestId,
    p_revision_id: revisionId,
    p_job_type: jobType,
    p_idempotency_key: `weekly:${weeklyDigestId}:${revisionId}:${jobType}:${slotKey}:${requestKey}`,
    p_input: input as Json,
  });
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
  revalidateWeeklyAdmin(weeklyDigestId);
}

export async function uploadWeeklyArtifactAction(formData: FormData) {
  await requireSocialAdmin({ roles: ['owner', 'editor'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const revisionId = requiredString(formData, 'revision_id');
  const artifactType = requiredString(formData, 'artifact_type');
  const slotKey = requiredString(formData, 'slot_key');
  const localeValue = optionalString(formData, 'locale') || 'neutral';
  if (!['neutral', 'en', 'uk'].includes(localeValue)) throw new Error('Invalid artifact locale.');
  const locale = localeValue as 'neutral' | 'en' | 'uk';
  const revisionItemId = optionalString(formData, 'revision_item_id');
  const fileValue = formData.get('file');
  if (!(fileValue instanceof File) || fileValue.size === 0) {
    throw new Error('Select a replacement file.');
  }
  if (fileValue.size > 12 * 1024 * 1024) throw new Error('Replacement files are limited to 12 MB.');
  if (!['cover', 'story_image', 'social_asset', 'thumbnail', 'pdf'].includes(artifactType)) {
    throw new Error('This artifact type cannot be uploaded. Final video remains on YouTube.');
  }

  let bytes = Buffer.from(await fileValue.arrayBuffer());
  let mimeType: string;
  let width: number | null = null;
  let height: number | null = null;
  let extension: string;
  if (artifactType === 'pdf') {
    if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('The file is not a PDF.');
    if (locale === 'neutral') throw new Error('A replacement PDF requires an EN or UK locale.');
    mimeType = 'application/pdf';
    extension = 'pdf';
  } else {
    const focalPoint = optionalString(formData, 'focal_point') || 'attention';
    const dimensions =
      artifactType === 'thumbnail'
        ? { width: 1280, height: 720 }
        : artifactType === 'social_asset'
          ? {
              width: Math.max(320, Math.min(optionalNumber(formData, 'width') ?? 1200, 1920)),
              height: Math.max(320, Math.min(optionalNumber(formData, 'height') ?? 630, 1920)),
            }
          : { width: 1600, height: 900 };
    try {
      bytes = await sharp(bytes)
        .rotate()
        .resize(dimensions.width, dimensions.height, {
          fit: 'cover',
          position: focalPoint,
        })
        .jpeg({ quality: 91, progressive: true })
        .toBuffer();
    } catch {
      throw new Error('The replacement is not a supported image.');
    }
    width = dimensions.width;
    height = dimensions.height;
    mimeType = 'image/jpeg';
    extension = 'jpg';
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const path = `digests/${weeklyDigestId}/revisions/${revisionId}/uploads/binary-v2/${artifactType}/${sha256}.${extension}`;
  const admin = getSupabaseAdmin();
  const { error: uploadError } = await admin.storage
    .from('weekly-digest-private')
    .upload(path, storageBlob(bytes, mimeType), {
      contentType: mimeType,
      cacheControl: '31536000, immutable',
      upsert: false,
    });
  if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) {
    throw new Error(uploadError.message);
  }
  const { data: stored, error: verifyError } = await admin.storage
    .from('weekly-digest-private')
    .download(path);
  if (verifyError || !stored) {
    throw new Error(`Upload verification failed: ${verifyError?.message ?? 'empty file'}`);
  }
  const storedBytes = Buffer.from(await stored.arrayBuffer());
  if (storedBytes.length !== bytes.length || !storedBytes.equals(bytes)) {
    throw new Error('Upload verification failed: stored bytes do not match the selected file.');
  }
  const db = await getSupabaseServer();
  const { error } = await db.rpc('save_weekly_digest_artifact', {
    p_weekly_digest_id: weeklyDigestId,
    p_revision_id: revisionId,
    p_revision_item_id: revisionItemId || null,
    p_artifact_type: artifactType,
    p_locale: locale,
    p_slot_key: slotKey,
    p_generation_status: 'ready',
    p_review_status: 'in_review',
    p_content: {
      alt: optionalString(formData, 'alt_text') || null,
      alt_en: optionalString(formData, 'alt_text_en') || null,
      alt_uk: optionalString(formData, 'alt_text_uk') || null,
    } as Json,
    p_storage_bucket: 'weekly-digest-private',
    p_storage_path: path,
    p_mime_type: mimeType,
    p_width: width,
    p_height: height,
    p_byte_size: bytes.length,
    p_metadata: {
      source: 'manual_upload',
      original_name: fileValue.name,
      focal_point: optionalString(formData, 'focal_point') || null,
      sha256,
    } as Json,
  });
  if (error) throw new Error(error.message);
  revalidateWeeklyAdmin(weeklyDigestId);
}

// Kept as a separate export so the Release tab contract stays stable while
// approval and scheduling remain distinct server-side decisions.
export async function approveWeeklyDigestAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true, roles: ['owner'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const overrideReason = optionalString(formData, 'override_reason');
  const db = await getSupabaseServer();
  const { error } = await db.rpc('approve_weekly_digest', {
    p_weekly_digest_id: weeklyDigestId,
    p_override_reason: overrideReason || null,
  });
  if (error) throw new Error(error.message);
  revalidateWeeklyAdmin(weeklyDigestId);
}

export async function scheduleWeeklyDigestAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true, roles: ['owner'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const releaseAt = localKyivToIso(requiredString(formData, 'release_at_local'));
  const preflightAt = localKyivToIso(requiredString(formData, 'preflight_at_local'));
  if (new Date(releaseAt).getTime() - new Date(preflightAt).getTime() !== 15 * 60_000) {
    throw new Error('Preflight must be Monday 15:45, exactly 15 minutes before release.');
  }
  const db = await getSupabaseServer();
  const { error } = await db.rpc('schedule_weekly_digest', {
    p_weekly_digest_id: weeklyDigestId,
    p_release_at: releaseAt,
  });
  if (error) throw new Error(error.message);
  revalidateWeeklyAdmin(weeklyDigestId);
}

export async function pauseWeeklyDigestAction(formData: FormData) {
  await requireSocialAdmin({ aal2: true, roles: ['owner'] });
  const weeklyDigestId = requiredString(formData, 'weekly_digest_id');
  const intent = requiredString(formData, 'intent');
  const reason = requiredString(formData, 'reason');
  if (reason.length < 10 || reason.length > 500) {
    throw new Error('Pause/resume reason must contain 10 to 500 characters.');
  }
  if (intent !== 'pause' && intent !== 'resume') throw new Error('Invalid release control.');
  const db = await getSupabaseServer();
  const { error } =
    intent === 'pause'
      ? await db.rpc('pause_weekly_digest', {
          p_weekly_digest_id: weeklyDigestId,
          p_reason: reason,
        })
      : await db.rpc('approve_weekly_digest', {
          p_weekly_digest_id: weeklyDigestId,
          p_override_reason: null,
        });
  if (error) throw new Error(error.message);
  revalidateWeeklyAdmin(weeklyDigestId);
}
