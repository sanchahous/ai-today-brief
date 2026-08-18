import { describe, expect, it } from 'vitest';
import { resolvePersistedSocialAssets, type SocialArtifactRecord } from './asset-resolver';

const signed = 'https://example.supabase.co/storage/v1/object/sign/weekly-digest-private/a.jpg?token=old';

function imageArtifact(overrides: Partial<SocialArtifactRecord> = {}): SocialArtifactRecord {
  return {
    id: 'art-1',
    is_current: true,
    generation_status: 'ready',
    mime_type: 'image/jpeg',
    width: 1200,
    height: 630,
    byte_size: 80_000,
    storage_bucket: 'weekly-digest-private',
    storage_path: 'digests/a/landscape.jpg',
    external_url: null,
    slot_key: 'social-landscape:en',
    artifact_type: 'social_asset',
    ...overrides,
  };
}

describe('resolvePersistedSocialAssets', () => {
  it('signs a current image artifact and does not mutate the stored ref', async () => {
    const artifacts = new Map([['art-1', imageArtifact()]]);
    const writes: string[] = [];
    const result = await resolvePersistedSocialAssets(
      [{ artifactId: 'art-1', mimeType: 'image/jpeg', width: 1200, height: 630, bytes: 80_000 }],
      {
        getArtifact: async (id) => artifacts.get(id) ?? null,
        signPath: async () => 'https://cdn.example/fresh.jpg?token=new',
      },
    );
    expect(result.blockers).toEqual([]);
    expect(result.assets[0]?.url).toBe('https://cdn.example/fresh.jpg?token=new');
    expect(result.assets[0]?.artifactId).toBe('art-1');
    expect(writes).toEqual([]);
  });

  it('rejects superseded and non-image artifacts', async () => {
    const superseded = await resolvePersistedSocialAssets([{ artifactId: 'old' }], {
      getArtifact: async () => imageArtifact({ id: 'old', is_current: false }),
      signPath: async () => 'https://cdn.example/nope.jpg',
    });
    expect(superseded.blockers.map((issue) => issue.code)).toContain('asset_superseded');

    const pdf = await resolvePersistedSocialAssets([{ artifactId: 'pdf' }], {
      getArtifact: async () =>
        imageArtifact({
          id: 'pdf',
          mime_type: 'application/pdf',
          slot_key: 'linkedin-document:en',
        }),
      signPath: async () => 'https://cdn.example/doc.pdf',
    });
    expect(pdf.blockers.map((issue) => issue.code)).toContain('asset_not_image');
  });

  it('treats a private signed URL without artifactId as stale', async () => {
    const result = await resolvePersistedSocialAssets([{ url: signed, mimeType: 'application/pdf' }], {
      getArtifact: async () => null,
      signPath: async () => null,
    });
    expect(result.blockers.map((issue) => issue.code)).toEqual(['asset_stale_url']);
    expect(result.assets).toEqual([]);
  });

  it('keeps a legacy public HTTPS image', async () => {
    const result = await resolvePersistedSocialAssets(
      [{ url: 'https://cdn.example/public.jpg', mimeType: 'image/jpeg', width: 1200, height: 630 }],
      {
        getArtifact: async () => {
          throw new Error('legacy public assets must not hit storage');
        },
        signPath: async () => {
          throw new Error('legacy public assets must not be signed');
        },
      },
    );
    expect(result.blockers).toEqual([]);
    expect(result.assets[0]?.url).toBe('https://cdn.example/public.jpg');
  });
});
