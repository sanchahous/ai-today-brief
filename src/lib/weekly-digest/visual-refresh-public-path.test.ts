import { describe, expect, it } from 'vitest';
import {
  VISUAL_REFRESH_PUBLIC_ASSET_BUCKET,
  weeklyVisualRefreshPublicAssetPath,
} from './visual-refresh-public-path';

const ids = {
  digest: '11111111-1111-4111-8111-111111111111',
  revision: '22222222-2222-4222-8222-222222222222',
  artifact: '33333333-3333-4333-8333-333333333333',
};

describe('weekly visual-refresh public asset path', () => {
  it('uses a deterministic immutable namespace with artifact, version, and hashes', () => {
    expect(
      weeklyVisualRefreshPublicAssetPath({
        weeklyDigestId: ids.digest,
        refreshRevisionId: ids.revision,
        stagedArtifactId: ids.artifact,
        stagedVersion: 4,
        stagedInputHash: 'a'.repeat(32),
        byteSha256: 'b'.repeat(64),
        sourcePath: 'digests/input/final image.webp',
        mimeType: 'image/webp',
      }),
    ).toBe(
      `weekly/${ids.digest}/visual-refresh/${ids.revision}/staged/${ids.artifact}/v4/${'a'.repeat(32)}/${'b'.repeat(64)}/binary-v2/final-image.webp`,
    );
    expect(VISUAL_REFRESH_PUBLIC_ASSET_BUCKET).toBe('social-assets');
  });

  it('rejects paths that could not be safely fenced by the SQL promotion RPC', () => {
    expect(() =>
      weeklyVisualRefreshPublicAssetPath({
        weeklyDigestId: ids.digest,
        refreshRevisionId: ids.revision,
        stagedArtifactId: ids.artifact,
        stagedVersion: 0,
        stagedInputHash: 'not-a-hash',
        byteSha256: 'b'.repeat(64),
        sourcePath: 'image.jpg',
        mimeType: 'image/jpeg',
      }),
    ).toThrow('stagedVersion');
  });
});
