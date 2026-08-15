import 'server-only';

import { basename, extname } from 'node:path';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { storageBlob } from '@/lib/storage/binary';

const PUBLIC_BUCKET = 'social-assets';
// story_prompt_set is copy-ready text and must never be promoted as a public image.
const PUBLIC_IMAGE_TYPES = new Set(['cover', 'story_image', 'social_asset', 'thumbnail']);

function safeName(path: string, mimeType: string | null) {
  const original = basename(path).replace(/[^a-zA-Z0-9._-]/g, '-');
  if (extname(original)) return original;
  if (mimeType === 'image/png') return `${original}.png`;
  if (mimeType === 'image/webp') return `${original}.webp`;
  return `${original}.jpg`;
}

export async function promoteWeeklyDigestPublicAssets(weeklyDigestId: string) {
  const db = getSupabaseAdmin();
  const { data: digest, error: digestError } = await db
    .from('weekly_digests')
    .select('active_revision_id')
    .eq('id', weeklyDigestId)
    .single();
  if (digestError || !digest?.active_revision_id) {
    throw new Error('[weekly-release] active revision was not found for asset promotion.');
  }
  const { data: artifacts, error: artifactError } = await db
    .from('weekly_digest_artifacts')
    .select(
      'id,artifact_type,slot_key,input_hash,storage_bucket,storage_path,external_url,mime_type,metadata',
    )
    .eq('weekly_digest_id', weeklyDigestId)
    .eq('revision_id', digest.active_revision_id)
    .eq('is_current', true)
    .eq('generation_status', 'ready')
    .eq('review_status', 'approved');
  if (artifactError) throw new Error(`[weekly-release] assets: ${artifactError.message}`);

  let promoted = 0;
  for (const artifact of artifacts ?? []) {
    if (!PUBLIC_IMAGE_TYPES.has(artifact.artifact_type) || artifact.external_url) continue;
    if (!artifact.storage_bucket || !artifact.storage_path) {
      if (artifact.artifact_type === 'cover' || artifact.artifact_type === 'story_image') {
        throw new Error(`[weekly-release] ${artifact.slot_key} has no publishable image.`);
      }
      continue;
    }
    const { data: source, error: downloadError } = await db.storage
      .from(artifact.storage_bucket)
      .download(artifact.storage_path);
    if (downloadError || !source) {
      throw new Error(
        `[weekly-release] ${artifact.slot_key} download failed: ${downloadError?.message ?? 'empty file'}`,
      );
    }
    const bytes = Buffer.from(await source.arrayBuffer());
    const publicPath = `weekly/${weeklyDigestId}/${digest.active_revision_id}/${artifact.input_hash}/binary-v2/${safeName(
      artifact.storage_path,
      artifact.mime_type,
    )}`;
    const { error: uploadError } = await db.storage
      .from(PUBLIC_BUCKET)
      .upload(publicPath, storageBlob(bytes, artifact.mime_type ?? 'image/jpeg'), {
        contentType: artifact.mime_type ?? 'image/jpeg',
        cacheControl: '31536000, immutable',
        upsert: false,
      });
    if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) {
      throw new Error(`[weekly-release] ${artifact.slot_key} promotion: ${uploadError.message}`);
    }
    const { data: stored, error: verifyError } = await db.storage
      .from(PUBLIC_BUCKET)
      .download(publicPath);
    if (verifyError || !stored) {
      throw new Error(
        `[weekly-release] ${artifact.slot_key} promotion verification: ${verifyError?.message ?? 'empty file'}`,
      );
    }
    const storedBytes = Buffer.from(await stored.arrayBuffer());
    if (storedBytes.length !== bytes.length || !storedBytes.equals(bytes)) {
      throw new Error(
        `[weekly-release] ${artifact.slot_key} promotion verification: bytes mismatch.`,
      );
    }
    const externalUrl = db.storage.from(PUBLIC_BUCKET).getPublicUrl(publicPath).data.publicUrl;
    const previousMetadata =
      artifact.metadata &&
      typeof artifact.metadata === 'object' &&
      !Array.isArray(artifact.metadata)
        ? artifact.metadata
        : {};
    const { error: updateError } = await db
      .from('weekly_digest_artifacts')
      .update({
        external_url: externalUrl,
        metadata: {
          ...previousMetadata,
          public_bucket: PUBLIC_BUCKET,
          public_path: publicPath,
          promoted_at: new Date().toISOString(),
        },
      })
      .eq('id', artifact.id)
      .eq('input_hash', artifact.input_hash)
      .eq('is_current', true);
    if (updateError) {
      throw new Error(`[weekly-release] ${artifact.slot_key} URL update: ${updateError.message}`);
    }
    promoted += 1;
  }
  return { promoted };
}
