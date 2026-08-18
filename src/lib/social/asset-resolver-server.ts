import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  resolvePersistedSocialAssets,
  SOCIAL_ASSET_SIGN_TTL_SEC,
  type SocialArtifactRecord,
  type SocialAssetResolveResult,
} from './asset-resolver';

async function lookupArtifact(id: string): Promise<SocialArtifactRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('weekly_digest_artifacts')
    .select(
      'id,is_current,generation_status,mime_type,width,height,byte_size,storage_bucket,storage_path,external_url,slot_key,artifact_type',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw new Error(`[social-assets] artifact lookup failed: ${error.message}`);
  }
  return data;
}

async function signPath(bucket: string, path: string, expiresInSec: number) {
  const { data, error } = await getSupabaseAdmin().storage.from(bucket).createSignedUrl(path, expiresInSec);
  return error ? null : data.signedUrl;
}

export async function resolveSocialPostAssets(
  assetUrls: unknown,
  options?: { expiresInSec?: number },
): Promise<SocialAssetResolveResult> {
  return resolvePersistedSocialAssets(
    assetUrls,
    { getArtifact: lookupArtifact, signPath },
    { expiresInSec: options?.expiresInSec ?? SOCIAL_ASSET_SIGN_TTL_SEC },
  );
}

export { SOCIAL_ASSET_SIGN_TTL_SEC };
