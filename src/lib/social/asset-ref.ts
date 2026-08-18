import type { PersistedSocialAssetRef, SocialImageMimeType } from './types';

export function isSocialImageMime(value: string | null | undefined): value is SocialImageMimeType {
  return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

export function isPrivateSignedStorageUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.includes('/storage/v1/object/sign/');
  } catch {
    return false;
  }
}

export function isPublicHttpsUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !isPrivateSignedStorageUrl(url);
  } catch {
    return false;
  }
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Parses unknown JSONB `social_posts.asset_urls` into persisted refs. */
export function parsePersistedSocialAssetRefs(value: unknown): PersistedSocialAssetRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const artifactId = optionalString(row.artifactId);
    const url = optionalString(row.url);
    if (!artifactId && !url) return [];
    const mimeType = optionalString(row.mimeType);
    return [
      {
        ...(artifactId ? { artifactId } : {}),
        ...(url ? { url } : {}),
        ...(optionalNumber(row.width) !== undefined ? { width: optionalNumber(row.width) } : {}),
        ...(optionalNumber(row.height) !== undefined ? { height: optionalNumber(row.height) } : {}),
        ...(optionalNumber(row.bytes) !== undefined ? { bytes: optionalNumber(row.bytes) } : {}),
        ...(mimeType ? { mimeType } : {}),
      },
    ];
  });
}
