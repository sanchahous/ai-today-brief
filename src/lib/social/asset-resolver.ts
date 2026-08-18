import type { QualityIssue, ResolvedSocialAsset } from './types';
import {
  isPrivateSignedStorageUrl,
  isPublicHttpsUrl,
  isSocialImageMime,
  parsePersistedSocialAssetRefs,
} from './asset-ref';

export const SOCIAL_ASSET_SIGN_TTL_SEC = 60 * 60;

export interface SocialArtifactRecord {
  id: string;
  is_current: boolean;
  generation_status: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  byte_size: number | null;
  storage_bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
  slot_key: string;
  artifact_type: string;
}

export interface SocialAssetResolveDeps {
  getArtifact: (id: string) => Promise<SocialArtifactRecord | null>;
  signPath: (bucket: string, path: string, expiresInSec: number) => Promise<string | null>;
}

export type SocialAssetResolveResult = {
  assets: ResolvedSocialAsset[];
  blockers: QualityIssue[];
};

function issue(code: string, message: string): QualityIssue {
  return { code, message, field: 'asset_urls' };
}

function resolvedFrom(
  artifact: SocialArtifactRecord,
  artifactId: string,
  url: string,
): ResolvedSocialAsset {
  return {
    url,
    artifactId,
    mimeType: artifact.mime_type ?? 'image/jpeg',
    ...(typeof artifact.width === 'number' ? { width: artifact.width } : {}),
    ...(typeof artifact.height === 'number' ? { height: artifact.height } : {}),
    ...(typeof artifact.byte_size === 'number' ? { bytes: artifact.byte_size } : {}),
    slotKey: artifact.slot_key,
    artifactType: artifact.artifact_type,
  };
}

async function resolveArtifact(
  artifactId: string,
  deps: SocialAssetResolveDeps,
  expiresInSec: number,
): Promise<{ asset: ResolvedSocialAsset } | { blocker: QualityIssue }> {
  const artifact = await deps.getArtifact(artifactId);
  if (!artifact) {
    return { blocker: issue('asset_missing', `Social asset ${artifactId} was not found.`) };
  }
  if (!artifact.is_current) {
    return { blocker: issue('asset_superseded', `Social asset ${artifactId} is no longer current.`) };
  }
  if (artifact.generation_status !== 'ready') {
    return { blocker: issue('asset_missing', `Social asset ${artifactId} is not ready.`) };
  }
  if (!isSocialImageMime(artifact.mime_type)) {
    return {
      blocker: issue('asset_not_image', `Social asset ${artifactId} is not an image (${artifact.mime_type ?? 'unknown'}).`),
    };
  }
  if (!artifact.storage_bucket || !artifact.storage_path) {
    if (artifact.external_url && isPublicHttpsUrl(artifact.external_url)) {
      return { asset: resolvedFrom(artifact, artifactId, artifact.external_url) };
    }
    return { blocker: issue('asset_missing', `Social asset ${artifactId} has no readable image source.`) };
  }
  const url = await deps.signPath(artifact.storage_bucket, artifact.storage_path, expiresInSec);
  if (!url) {
    return { blocker: issue('asset_sign_failed', `Could not sign social asset ${artifactId}.`) };
  }
  return { asset: resolvedFrom(artifact, artifactId, url) };
}

export async function resolvePersistedSocialAssets(
  value: unknown,
  deps: SocialAssetResolveDeps,
  options?: { expiresInSec?: number },
): Promise<SocialAssetResolveResult> {
  const refs = parsePersistedSocialAssetRefs(value);
  const assets: ResolvedSocialAsset[] = [];
  const blockers: QualityIssue[] = [];
  const expiresInSec = options?.expiresInSec ?? SOCIAL_ASSET_SIGN_TTL_SEC;

  for (const ref of refs) {
    if (ref.artifactId) {
      const resolved = await resolveArtifact(ref.artifactId, deps, expiresInSec);
      if ('blocker' in resolved) blockers.push(resolved.blocker);
      else assets.push(resolved.asset);
      continue;
    }
    if (ref.url && isPrivateSignedStorageUrl(ref.url)) {
      blockers.push(
        issue(
          'asset_stale_url',
          'A private signed URL without artifactId is stale and cannot be used for delivery.',
        ),
      );
      continue;
    }
    if (ref.url && isPublicHttpsUrl(ref.url)) {
      if (!isSocialImageMime(ref.mimeType ?? '')) {
        blockers.push(issue('asset_not_image', 'Legacy social asset MIME must be image/jpeg, image/png, or image/webp.'));
        continue;
      }
      assets.push({
        url: ref.url,
        mimeType: ref.mimeType as ResolvedSocialAsset['mimeType'],
        ...(typeof ref.width === 'number' ? { width: ref.width } : {}),
        ...(typeof ref.height === 'number' ? { height: ref.height } : {}),
        ...(typeof ref.bytes === 'number' ? { bytes: ref.bytes } : {}),
      });
      continue;
    }
    blockers.push(issue('asset_missing', 'A social asset is missing both artifactId and a public HTTPS URL.'));
  }

  return { assets, blockers };
}
