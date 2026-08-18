import { describe, expect, it } from 'vitest';
import type { SocialSelectableArtifact } from '@/lib/social/channel-assets';
import {
  buildRepairPatches,
  planWeeklySocialPackageRepair,
  type RepairSocialPackage,
  type RepairSocialPost,
} from './repair-social-package';

const PDF_URL =
  'https://example.supabase.co/storage/v1/object/sign/weekly-digest-private/linkedin-document:en.pdf?token=old';

function artifact(overrides: Partial<SocialSelectableArtifact>): SocialSelectableArtifact {
  return {
    id: 'landscape',
    artifact_type: 'social_asset',
    slot_key: 'social-landscape:en',
    is_current: true,
    generation_status: 'ready',
    review_status: 'approved',
    mime_type: 'image/jpeg',
    width: 1200,
    height: 630,
    byte_size: 80_000,
    revision_item_id: null,
    ...overrides,
  };
}

function post(channel: RepairSocialPost['channel'], overrides: Partial<RepairSocialPost> = {}): RepairSocialPost {
  return {
    id: `${channel}-post`,
    channel,
    status: 'in_review',
    publish_enabled: false,
    scheduled_for: '2099-08-18T13:00:00.000Z',
    asset_urls: [{ url: PDF_URL, mimeType: 'application/pdf' }],
    content_parts: channel === 'threads' ? ['One', 'Two', 'Three?'] : [],
    post_text: `${channel} copy that is long enough for repair hashing.`,
    first_comment: channel === 'x' ? 'Read: https://aitodaybrief.com/r/s/token' : null,
    alt_text: 'Weekly cover',
    format: 'weekly',
    locale: 'en',
    content_version: 1,
    content_hash: 'old',
    meta: channel === 'linkedin' ? { document_status: 'draft_ready' } : {},
    ...overrides,
  };
}

function artifacts(): SocialSelectableArtifact[] {
  return [
    artifact({ id: 'landscape', slot_key: 'social-landscape:en' }),
    artifact({
      id: 'pdf',
      slot_key: 'linkedin-document:en',
      mime_type: 'application/pdf',
      width: null,
      height: null,
      byte_size: 200_000,
    }),
    artifact({ id: 'cover', artifact_type: 'cover', slot_key: 'cover:neutral', width: 1600, height: 900 }),
    artifact({
      id: 'story-1',
      artifact_type: 'story_image',
      slot_key: 'story:1',
      revision_item_id: 'item-1',
      width: 1600,
      height: 900,
    }),
    artifact({
      id: 'story-2',
      artifact_type: 'story_image',
      slot_key: 'story:2',
      revision_item_id: 'item-2',
      width: 1600,
      height: 900,
    }),
    artifact({
      id: 'story-3',
      artifact_type: 'story_image',
      slot_key: 'story:3',
      revision_item_id: 'item-3',
      width: 1600,
      height: 900,
    }),
  ];
}

function pack(): RepairSocialPackage {
  return {
    id: 'pkg',
    weekly_digest_id: 'digest',
    weekly_digest_revision_id: 'rev',
    status: 'in_review',
    kind: 'weekly_digest',
  };
}

const CHANNELS = ['telegram', 'facebook', 'x', 'threads', 'linkedin', 'instagram'] as const;

function posts(overrides: Partial<Record<(typeof CHANNELS)[number], Partial<RepairSocialPost>>> = {}) {
  return CHANNELS.map((channel) => post(channel, overrides[channel]));
}

describe('planWeeklySocialPackageRepair', () => {
  it('proposes five image-ref swaps and seven Instagram JPEGs, then is idempotent', () => {
    const allPosts = posts({
      instagram: {
        asset_urls: [],
        content_parts: [
          'Cover headline',
          'Story one\nBody one',
          'Story two\nBody two',
          'Story three\nBody three',
          'Comparison\nBody',
          'Caveat\nBody',
          'Takeaway\nBody',
        ],
        post_text: `${'A useful Instagram caption grounded in the approved eval. '.repeat(5)}`,
      },
    });
    const planned = planWeeklySocialPackageRepair({
      socialPackage: pack(),
      posts: allPosts,
      artifacts: artifacts(),
      revisionIsCurrent: true,
      now: new Date('2026-08-18T10:00:00.000Z'),
    });
    expect(planned.ok).toBe(true);
    expect(planned.imageRefChanges).toBe(5);
    expect(planned.instagramJpegs).toBe(7);
    expect(planned.mutations.some((mutation) => mutation.type === 'ensure_linkedin_document')).toBe(true);

    const instagramAssets = Array.from({ length: 7 }, (_, index) => ({
      artifactId: `slide-${index + 1}`,
      width: 1080,
      height: 1350,
      mimeType: 'image/jpeg' as const,
      bytes: 40_000,
    }));
    const patches = buildRepairPatches({ posts: allPosts, plan: planned, instagramAssets });
    expect(patches).toHaveLength(6);

    const repairedPosts = allPosts.map((row) => {
      const patch = patches.find((entry) => entry.id === row.id);
      return patch
        ? {
            ...row,
            asset_urls: patch.asset_urls,
            meta: patch.meta,
            post_text: patch.post_text,
            content_parts: patch.content_parts,
            content_version: patch.content_version,
            content_hash: patch.content_hash,
            status: patch.status,
          }
        : row;
    });
    const carouselArtifacts = instagramAssets.map((asset, index) =>
      artifact({
        id: asset.artifactId,
        slot_key: `instagram-carousel:${index + 1}:en`,
        width: 1080,
        height: 1350,
        byte_size: 40_000,
      }),
    );
    const again = planWeeklySocialPackageRepair({
      socialPackage: pack(),
      posts: repairedPosts,
      artifacts: [...artifacts(), ...carouselArtifacts],
      revisionIsCurrent: true,
      now: new Date('2026-08-18T10:00:00.000Z'),
    });
    expect(again.ok).toBe(true);
    expect(again.mutations).toEqual([]);
    expect(again.imageRefChanges).toBe(0);
    expect(again.instagramJpegs).toBe(0);
  });

  it('refuses to run while publishing is enabled', () => {
    const planned = planWeeklySocialPackageRepair({
      socialPackage: pack(),
      posts: posts({ telegram: { publish_enabled: true } }),
      artifacts: artifacts(),
      revisionIsCurrent: true,
    });
    expect(planned.ok).toBe(false);
    expect(planned.blockers.join(' ')).toMatch(/Pause publishing/i);
  });
});
