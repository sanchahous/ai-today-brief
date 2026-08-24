import { basename, extname } from 'node:path';

export const VISUAL_REFRESH_PUBLIC_ASSET_BUCKET = 'social-assets';

export type WeeklyVisualRefreshPublicPathInput = {
  weeklyDigestId: string;
  refreshRevisionId: string;
  stagedArtifactId: string;
  stagedVersion: number;
  stagedInputHash: string;
  byteSha256: string;
  sourcePath: string;
  mimeType: string | null;
};

function requireUuid(value: string, label: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${label} must be a UUID.`);
  }
  return value.toLowerCase();
}

function requireHex(value: string, label: string, length: number) {
  if (!new RegExp(`^[0-9a-f]{${length}}$`, 'i').test(value)) {
    throw new Error(`${label} must be a ${length}-character hexadecimal hash.`);
  }
  return value.toLowerCase();
}

function safeFileName(path: string, mimeType: string | null) {
  const original = basename(path).replace(/[^a-zA-Z0-9._-]/g, '-');
  if (!original || original === '.' || original === '..') {
    throw new Error('The staged asset must have a safe file name.');
  }
  if (extname(original)) return original;
  if (mimeType === 'image/png') return `${original}.png`;
  if (mimeType === 'image/webp') return `${original}.webp`;
  return `${original}.jpg`;
}

/**
 * A refresh never overwrites a public object.  The source artifact UUID,
 * version and input hash make retries deterministic while the byte checksum
 * makes an accidental cache collision impossible even when a source path is
 * reused by an operator.
 */
export function weeklyVisualRefreshPublicAssetPath(
  input: WeeklyVisualRefreshPublicPathInput,
): string {
  const digestId = requireUuid(input.weeklyDigestId, 'weeklyDigestId');
  const refreshRevisionId = requireUuid(input.refreshRevisionId, 'refreshRevisionId');
  const stagedArtifactId = requireUuid(input.stagedArtifactId, 'stagedArtifactId');
  if (!Number.isInteger(input.stagedVersion) || input.stagedVersion < 1) {
    throw new Error('stagedVersion must be a positive integer.');
  }
  const inputHash = requireHex(input.stagedInputHash, 'stagedInputHash', 32);
  const byteSha256 = requireHex(input.byteSha256, 'byteSha256', 64);
  const fileName = safeFileName(input.sourcePath, input.mimeType);

  return [
    'weekly',
    digestId,
    'visual-refresh',
    refreshRevisionId,
    'staged',
    stagedArtifactId,
    `v${input.stagedVersion}`,
    inputHash,
    byteSha256,
    'binary-v2',
    fileName,
  ].join('/');
}
