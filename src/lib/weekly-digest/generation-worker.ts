import 'server-only';

import { createHash } from 'node:crypto';
import { pdf as openPdf } from 'pdf-to-img';
import sharp from 'sharp';
import type { Json } from '@/lib/database.types';
import { SITE_URL } from '@/lib/site';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateEditorialIllustration } from '../../../pipeline/card-image';
import { alertWeeklyDigestIssue } from './alerts';
import { renderWeeklyDigestPdf, type WeeklyPdfInput } from './pdf';
import { renderWeeklyVisualSet, type WeeklyVisualInput, type WeeklyVisualLocale } from './visuals';
import { storageBlob } from '@/lib/storage/binary';

const PRIVATE_BUCKET = 'weekly-digest-private';
const MAX_JOBS = 10;

interface RpcError {
  message: string;
}

interface UntypedRpcClient {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: RpcError | null }>;
}

interface ClaimedGenerationJob {
  id: string;
  weekly_digest_id: string;
  revision_id: string;
  job_type: string;
  attempts: number;
  input: Json;
}

function rpcClient() {
  return getSupabaseAdmin() as unknown as UntypedRpcClient;
}

function asRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

function text(value: Json | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringArray(value: Json | null | undefined) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    : [];
}

function safeMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, 1800);
}

function retryableGenerationFailure(message: string) {
  return /\b(?:429|5\d\d)\b|timed? out|timeout|fetch failed|network|econnreset|eai_again|temporar(?:y|ily)|rate limit|connection reset/i.test(
    message,
  );
}

async function claimGenerationJobs(limit: number): Promise<ClaimedGenerationJob[]> {
  const { data, error } = await rpcClient().rpc('claim_weekly_digest_generation_jobs', {
    p_job_types: ['pdf', 'cover', 'story_image', 'social_asset'],
    p_limit: Math.max(1, Math.min(Math.trunc(limit), MAX_JOBS)),
  });
  if (error) throw new Error(`[weekly-generation] claim: ${error.message}`);
  if (!Array.isArray(data)) return [];
  return data.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (
      typeof row.id !== 'string' ||
      typeof row.weekly_digest_id !== 'string' ||
      typeof row.revision_id !== 'string' ||
      typeof row.job_type !== 'string' ||
      typeof row.attempts !== 'number'
    ) {
      return [];
    }
    return [
      {
        id: row.id,
        weekly_digest_id: row.weekly_digest_id,
        revision_id: row.revision_id,
        job_type: row.job_type,
        attempts: row.attempts,
        input: (row.input ?? {}) as Json,
      },
    ];
  });
}

async function finishGenerationJob(
  jobId: string,
  succeeded: boolean,
  output: Record<string, Json | undefined>,
  errorMessage: string | null,
  artifactId?: string | null,
) {
  const { error } = await rpcClient().rpc('finish_weekly_digest_generation_job', {
    p_job_id: jobId,
    p_succeeded: succeeded,
    p_output: output,
    p_error: errorMessage,
    p_artifact_id: artifactId ?? null,
  });
  if (error) throw new Error(`[weekly-generation] finish: ${error.message}`);
}

async function uploadPrivate(
  path: string,
  bytes: Buffer,
  contentType: string,
  cacheControl = '31536000, immutable',
) {
  const db = getSupabaseAdmin();
  const { error } = await db.storage
    .from(PRIVATE_BUCKET)
    .upload(path, storageBlob(bytes, contentType), {
      contentType,
      cacheControl,
      upsert: false,
    });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`[weekly-generation] upload: ${error.message}`);
  }
  const { data: stored, error: verifyError } = await db.storage.from(PRIVATE_BUCKET).download(path);
  if (verifyError || !stored) {
    throw new Error(
      `[weekly-generation] upload verification: ${verifyError?.message ?? 'empty file'}`,
    );
  }
  const storedBytes = Buffer.from(await stored.arrayBuffer());
  if (storedBytes.length !== bytes.length || !storedBytes.equals(bytes)) {
    throw new Error('[weekly-generation] upload verification: stored bytes do not match source.');
  }
}

async function saveGeneratedArtifact(input: {
  weeklyDigestId: string;
  revisionId: string;
  revisionItemId?: string | null;
  artifactType: string;
  locale: 'neutral' | 'en' | 'uk';
  slotKey: string;
  content?: Record<string, Json | undefined>;
  storagePath?: string | null;
  externalUrl?: string | null;
  provider?: string | null;
  providerId?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  byteSize?: number | null;
  metadata?: Record<string, Json | undefined>;
}) {
  const { data, error } = await rpcClient().rpc('save_weekly_digest_artifact', {
    p_weekly_digest_id: input.weeklyDigestId,
    p_revision_id: input.revisionId,
    p_revision_item_id: input.revisionItemId ?? null,
    p_artifact_type: input.artifactType,
    p_locale: input.locale,
    p_slot_key: input.slotKey,
    p_generation_status: 'ready',
    p_review_status: 'in_review',
    p_content: input.content ?? {},
    p_storage_bucket: input.storagePath ? PRIVATE_BUCKET : null,
    p_storage_path: input.storagePath ?? null,
    p_external_url: input.externalUrl ?? null,
    p_provider: input.provider ?? null,
    p_provider_id: input.providerId ?? null,
    p_mime_type: input.mimeType ?? null,
    p_width: input.width ?? null,
    p_height: input.height ?? null,
    p_byte_size: input.byteSize ?? null,
    p_metadata: input.metadata ?? {},
  });
  if (error) throw new Error(`[weekly-generation] save artifact: ${error.message}`);
  if (typeof data !== 'string') throw new Error('Artifact RPC did not return an ID.');
  return data;
}

async function signedArtifactUrl(artifact: {
  external_url: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
}) {
  if (artifact.external_url?.startsWith('http')) return artifact.external_url;
  if (!artifact.storage_bucket || !artifact.storage_path) return null;
  const { data, error } = await getSupabaseAdmin()
    .storage.from(artifact.storage_bucket)
    .createSignedUrl(artifact.storage_path, 180);
  return error ? null : data.signedUrl;
}

async function loadGenerationContext(job: ClaimedGenerationJob) {
  const db = getSupabaseAdmin();
  const [digestResult, revisionResult, itemsResult, artifactsResult] = await Promise.all([
    db
      .from('weekly_digests')
      .select('*')
      .eq('id', job.weekly_digest_id)
      .eq('active_revision_id', job.revision_id)
      .single(),
    db.from('weekly_digest_revisions').select('*').eq('id', job.revision_id).single(),
    db
      .from('weekly_digest_revision_items')
      .select('*')
      .eq('revision_id', job.revision_id)
      .order('rank'),
    db
      .from('weekly_digest_artifacts')
      .select('*')
      .eq('revision_id', job.revision_id)
      .eq('is_current', true),
  ]);
  if (digestResult.error || !digestResult.data) throw new Error('Active digest was not found.');
  if (revisionResult.error || !revisionResult.data) throw new Error('Revision was not found.');
  if (itemsResult.error || !itemsResult.data) throw new Error('Revision stories were not found.');
  if (artifactsResult.error || !artifactsResult.data) throw new Error('Artifacts were not found.');
  return {
    digest: digestResult.data,
    revision: revisionResult.data,
    items: itemsResult.data,
    artifacts: artifactsResult.data,
  };
}

function sourceFromJson(value: Json) {
  if (!Array.isArray(value)) return { name: 'Source', url: SITE_URL };
  for (const entry of value) {
    const row = asRecord(entry);
    const url = text(row.url) ?? text(row.source_url);
    if (url?.startsWith('http')) {
      return { name: text(row.name) ?? text(row.source_name) ?? 'Source', url };
    }
  }
  return { name: 'Source', url: SITE_URL };
}

function snapshotImage(value: Json) {
  const row = asRecord(value);
  const editorial = asRecord(row.editorial_selection);
  return (
    text(row.card_image_url) ??
    text(row.image_url) ??
    text(row.og_image_url) ??
    text(editorial.image_url)
  );
}

async function generatePdf(job: ClaimedGenerationJob) {
  const context = await loadGenerationContext(job);
  const input = asRecord(job.input);
  const locale = text(input.locale);
  if (locale !== 'en' && locale !== 'uk') throw new Error('PDF locale must be en or uk.');
  const localized = (en: string | null, uk: string | null) =>
    locale === 'uk' ? (uk ?? '') : (en ?? '');
  const artifactByStory = new Map(
    context.artifacts
      .filter((artifact) => artifact.artifact_type === 'story_image' && artifact.revision_item_id)
      .map((artifact) => [artifact.revision_item_id!, artifact]),
  );
  const coverArtifact =
    context.artifacts.find(
      (artifact) => artifact.artifact_type === 'cover' && artifact.locale === locale,
    ) ?? context.artifacts.find((artifact) => artifact.artifact_type === 'cover');
  const videoArtifact = context.artifacts.find(
    (artifact) => artifact.artifact_type === 'video_final',
  );
  const [coverImageUrl, storyImageUrls] = await Promise.all([
    coverArtifact ? signedArtifactUrl(coverArtifact) : null,
    Promise.all(
      context.items.map(async (item) => {
        const artifact = artifactByStory.get(item.id);
        return artifact ? signedArtifactUrl(artifact) : snapshotImage(item.source_snapshot);
      }),
    ),
  ]);
  const pdfInput: WeeklyPdfInput = {
    locale,
    issueLabel:
      locale === 'uk'
        ? `Випуск ${context.revision.revision_number}`
        : `Issue ${context.revision.revision_number}`,
    title: localized(context.revision.title_en, context.revision.title_uk),
    intro: localized(context.revision.intro_en, context.revision.intro_uk),
    editorNote: localized(context.revision.editor_note_en, context.revision.editor_note_uk),
    weekStart: context.digest.week_start,
    weekEnd: context.digest.week_end,
    webUrl: `${SITE_URL}/${locale}/weekly/${context.digest.slug}`,
    videoUrl: videoArtifact?.external_url ?? null,
    coverImageUrl,
    keyTakeaways: stringArray(
      locale === 'uk' ? context.revision.key_takeaways_uk : context.revision.key_takeaways_en,
    ),
    stories: context.items.map((item, index) => {
      const source = sourceFromJson(item.sources);
      return {
        rank: item.rank,
        title: localized(item.title_en, item.title_uk),
        summary: localized(item.summary_en, item.summary_uk),
        body: localized(item.body_en, item.body_uk),
        why: localized(item.why_en, item.why_uk),
        practical: localized(item.practical_en, item.practical_uk),
        takeaway: localized(item.takeaway_en, item.takeaway_uk),
        sourceName: source.name,
        sourceUrl: source.url,
        eventDate: item.event_date,
        imageUrl: storyImageUrls[index],
        imageAlt: localized(item.title_en, item.title_uk),
      };
    }),
  };
  const pdf = await renderWeeklyDigestPdf(pdfInput);
  const hash = createHash('sha256').update(pdf).digest('hex');
  // Do not reuse a path written by an earlier job. A previously corrupted
  // immutable upload must never be mistaken for this job's verified output.
  const outputKey = `${hash}-${job.id}`;
  const path = `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/pdf/${locale}/${outputKey}.pdf`;
  await uploadPrivate(path, pdf, 'application/pdf');
  const previewPaths: string[] = [];
  const document = await openPdf(pdf, { scale: 1.15 });
  try {
    if (document.length > 40) {
      throw new Error(`PDF preview safety limit exceeded (${document.length} pages).`);
    }
    for (let pageNumber = 1; pageNumber <= document.length; pageNumber += 1) {
      const png = await document.getPage(pageNumber);
      const preview = await sharp(png).webp({ quality: 82, effort: 4 }).toBuffer();
      const previewPath =
        `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/pdf/` +
        `${locale}/previews/${outputKey}/page-${String(pageNumber).padStart(3, '0')}.webp`;
      await uploadPrivate(previewPath, preview, 'image/webp');
      previewPaths.push(previewPath);
    }
  } finally {
    await document.destroy();
  }
  const artifactId = await saveGeneratedArtifact({
    weeklyDigestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    artifactType: 'pdf',
    locale,
    slotKey: `pdf:${locale}`,
    storagePath: path,
    mimeType: 'application/pdf',
    byteSize: pdf.length,
    content: {
      title: pdfInput.title,
      web_url: pdfInput.webUrl,
      preview_paths: previewPaths,
    },
    metadata: {
      format: 'A4',
      renderer: 'pdfkit-weekly-v2',
      sha256: hash,
      story_count: context.items.length,
      page_count: previewPaths.length,
    },
  });
  return { artifactId, output: { locale, path, byte_size: pdf.length, sha256: hash } };
}

async function generateStoryImage(job: ClaimedGenerationJob) {
  const context = await loadGenerationContext(job);
  const input = asRecord(job.input);
  const revisionItemId = text(input.revision_item_id);
  const item = context.items.find((candidate) => candidate.id === revisionItemId);
  if (!item) throw new Error('Story image job requires a valid revision_item_id.');
  const requestedSourceUrl = text(input.source_url);
  let source: Buffer;
  let sourceKind = 'generated';
  let sourceUrl: string | null = null;

  if (requestedSourceUrl?.startsWith('http')) {
    const response = await fetch(requestedSourceUrl, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Story image source returned ${response.status}.`);
    source = Buffer.from(await response.arrayBuffer());
    sourceUrl = requestedSourceUrl;
    sourceKind = 'editor_url';
  } else {
    const generatedSource = await generateEditorialIllustration(
      {
        title: item.title_en,
        summary: item.summary_en,
        seedKey: `${job.weekly_digest_id}:${job.revision_id}:${item.id}:${job.id}`,
      },
      {
        geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? '',
        geminiImageModel: process.env.GEMINI_IMAGE_MODEL?.trim(),
        geminiModel: process.env.GEMINI_MODEL?.trim(),
        openRouterApiKey:
          process.env.OPEN_ROUTER_API_KEY?.trim() ?? process.env.OPENROUTER_API_KEY?.trim(),
        cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim(),
        cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN?.trim(),
        cloudflareImageModel: process.env.CLOUDFLARE_IMAGE_MODEL?.trim(),
      },
    );

    if (generatedSource) {
      source = generatedSource;
    } else {
      const fallbackUrl = snapshotImage(item.source_snapshot);
      if (!fallbackUrl?.startsWith('http')) {
        throw new Error(
          'Illustration generation failed and the story has no reviewed source image fallback.',
        );
      }
      const response = await fetch(fallbackUrl, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Story image fallback returned ${response.status}.`);
      source = Buffer.from(await response.arrayBuffer());
      sourceUrl = fallbackUrl;
      sourceKind = 'source_fallback';
    }
  }

  if (source.length > 15 * 1024 * 1024) throw new Error('Story image source exceeds 15 MB.');
  const image = await sharp(source)
    .rotate()
    .resize(1600, 900, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 90, progressive: true })
    .toBuffer();
  const hash = createHash('sha256').update(image).digest('hex');
  const path = `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/stories/${item.id}/${hash}-${job.id}.jpg`;
  await uploadPrivate(path, image, 'image/jpeg');
  const artifactId = await saveGeneratedArtifact({
    weeklyDigestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    revisionItemId: item.id,
    artifactType: 'story_image',
    locale: 'neutral',
    slotKey: `story-image:${item.id}`,
    storagePath: path,
    mimeType: 'image/jpeg',
    width: 1600,
    height: 900,
    byteSize: image.length,
    content: {
      alt_en: text(input.alt_text) ?? item.title_en,
      alt_uk: text(input.alt_text_uk) ?? item.title_uk,
    },
    metadata: {
      source_kind: sourceKind,
      source_url: sourceUrl,
      focal_point: text(input.focal_point) ?? 'attention',
      prompt_policy: 'story-specific-editorial-v2',
    },
  });
  return { artifactId, output: { path, byte_size: image.length, sha256: hash } };
}

async function generateCover(job: ClaimedGenerationJob) {
  const context = await loadGenerationContext(job);
  const input = asRecord(job.input);
  const localeValue = text(input.locale);
  const locale: WeeklyVisualLocale = localeValue === 'uk' ? 'uk' : 'en';
  const storyArtifacts = new Map(
    context.artifacts
      .filter((artifact) => artifact.artifact_type === 'story_image' && artifact.revision_item_id)
      .map((artifact) => [artifact.revision_item_id!, artifact]),
  );
  const stories = await Promise.all(
    context.items.map(async (item) => {
      const artifact = storyArtifacts.get(item.id);
      return {
        id: item.id,
        title: locale === 'uk' ? item.title_uk : item.title_en,
        imageUrl:
          (artifact ? await signedArtifactUrl(artifact) : null) ??
          snapshotImage(item.source_snapshot),
      };
    }),
  );
  const visualInput: WeeklyVisualInput = {
    digestId: job.weekly_digest_id,
    revisionId: job.revision_id,
    locale,
    issueLabel:
      locale === 'uk'
        ? `Випуск ${context.revision.revision_number}`
        : `Issue ${context.revision.revision_number}`,
    title: locale === 'uk' ? context.revision.title_uk : context.revision.title_en,
    altText:
      text(input.alt_text) ??
      (locale === 'uk'
        ? 'Композиція головних новин тижневого AI-дайджесту.'
        : 'A composition of the Weekly AI Digest lead stories.'),
    stories,
  };
  const variants = await renderWeeklyVisualSet(visualInput);
  let primaryArtifactId: string | null = null;
  const artifactIds: string[] = [];
  for (const variant of variants) {
    const path = `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/visuals/${locale}/${variant.contentHash}-${job.id}/${variant.slot}.jpg`;
    await uploadPrivate(path, variant.bytes, variant.mimeType);
    const primary = variant.slot === 'web_hero';
    const artifactId = await saveGeneratedArtifact({
      weeklyDigestId: job.weekly_digest_id,
      revisionId: job.revision_id,
      artifactType: primary ? 'cover' : 'social_asset',
      locale: primary ? 'neutral' : locale,
      slotKey: primary ? 'cover:main' : `cover:${variant.slot}:${locale}`,
      storagePath: path,
      mimeType: variant.mimeType,
      width: variant.width,
      height: variant.height,
      byteSize: variant.bytes.length,
      content: {
        alt: variant.altText,
        alt_en: locale === 'en' ? variant.altText : null,
        alt_uk: locale === 'uk' ? variant.altText : null,
      },
      metadata: {
        visual_slot: variant.slot,
        source_story_ids: variant.sourceStoryIds,
        warnings: variant.warnings,
        checks: variant.checks,
        sha256: variant.contentHash,
      },
    });
    if (primary) primaryArtifactId = artifactId;
    artifactIds.push(artifactId);
  }
  return {
    artifactId: primaryArtifactId,
    output: { locale, artifact_ids: artifactIds, variant_count: variants.length },
  };
}

async function generateCoverDerivatives(job: ClaimedGenerationJob) {
  const context = await loadGenerationContext(job);
  const cover = context.artifacts.find(
    (artifact) =>
      artifact.artifact_type === 'cover' &&
      artifact.is_current &&
      artifact.generation_status === 'ready' &&
      artifact.review_status === 'approved',
  );
  if (!cover) throw new Error('Approve the current master cover before generating derivatives.');
  const coverUrl = await signedArtifactUrl(cover);
  if (!coverUrl) throw new Error('The approved master cover has no readable source.');
  const response = await fetch(coverUrl, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Master cover returned ${response.status}.`);
  const source = Buffer.from(await response.arrayBuffer());
  if (source.length > 20 * 1024 * 1024) throw new Error('Master cover exceeds 20 MB.');

  const variants = [
    { slot: 'open-graph', width: 1200, height: 630 },
    { slot: 'social-landscape', width: 1200, height: 630 },
    { slot: 'instagram-post', width: 1080, height: 1350 },
    { slot: 'stories', width: 1080, height: 1920 },
  ] as const;
  const artifactIds: string[] = [];
  for (const variant of variants) {
    const portrait = variant.height > variant.width;
    const background = portrait
      ? await sharp(source)
          .resize(variant.width, variant.height, { fit: 'cover', position: 'attention' })
          .blur(22)
          .modulate({ brightness: 0.48, saturation: 0.8 })
          .toBuffer()
      : source;
    const foreground = portrait
      ? await sharp(source)
          .resize(variant.width, variant.height, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer()
      : null;
    const image = await sharp(background)
      .resize(variant.width, variant.height, {
        fit: portrait ? 'fill' : 'cover',
        position: 'attention',
      })
      .composite(foreground ? [{ input: foreground, left: 0, top: 0 }] : [])
      .jpeg({ quality: 89, progressive: true })
      .toBuffer();
    const hash = createHash('sha256').update(image).digest('hex');
    const path =
      `digests/${job.weekly_digest_id}/revisions/${job.revision_id}/visuals/` +
      `derivatives/${hash}-${job.id}/${variant.slot}.jpg`;
    await uploadPrivate(path, image, 'image/jpeg');
    artifactIds.push(
      await saveGeneratedArtifact({
        weeklyDigestId: job.weekly_digest_id,
        revisionId: job.revision_id,
        artifactType: 'social_asset',
        locale: 'neutral',
        slotKey: `cover:${variant.slot}:neutral`,
        storagePath: path,
        mimeType: 'image/jpeg',
        width: variant.width,
        height: variant.height,
        byteSize: image.length,
        content: {
          alt: text(asRecord(cover.content).alt) ?? 'Weekly Digest cover',
        },
        metadata: {
          source_cover_artifact_id: cover.id,
          derivative_slot: variant.slot,
          sha256: hash,
        },
      }),
    );
  }
  return {
    artifactId: artifactIds[0] ?? null,
    output: { source_cover_artifact_id: cover.id, artifact_ids: artifactIds },
  };
}

async function runGenerationJob(job: ClaimedGenerationJob) {
  if (job.job_type === 'pdf') return generatePdf(job);
  if (job.job_type === 'story_image') return generateStoryImage(job);
  if (job.job_type === 'cover') return generateCover(job);
  if (job.job_type === 'social_asset') return generateCoverDerivatives(job);
  throw new Error(`Unsupported generation job type: ${job.job_type}`);
}

export async function runWeeklyDigestGenerationJobs(limit = 5) {
  const jobs = await claimGenerationJobs(limit);
  const results: Array<{
    id: string;
    outcome: 'succeeded' | 'failed';
    artifactId?: string | null;
    error?: string;
  }> = [];
  for (const job of jobs) {
    try {
      const result = await runGenerationJob(job);
      await finishGenerationJob(job.id, true, result.output, null, result.artifactId);
      results.push({ id: job.id, outcome: 'succeeded', artifactId: result.artifactId });
    } catch (error) {
      const message = safeMessage(error);
      const retryable = retryableGenerationFailure(message);
      try {
        await finishGenerationJob(job.id, false, { retryable }, message, null);
      } catch (finishError) {
        await alertWeeklyDigestIssue({
          weeklyDigestId: job.weekly_digest_id,
          phase: 'generation',
          message: `${message}; ${safeMessage(finishError)}`.slice(0, 1800),
        });
        results.push({
          id: job.id,
          outcome: 'failed',
          error: `${message}; ${safeMessage(finishError)}`.slice(0, 1800),
        });
        continue;
      }
      if (!retryable || job.attempts >= 5) {
        await alertWeeklyDigestIssue({
          weeklyDigestId: job.weekly_digest_id,
          phase: 'generation',
          message,
        });
      }
      results.push({ id: job.id, outcome: 'failed', error: message });
    }
  }
  return { claimed: jobs.length, results };
}
