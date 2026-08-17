import { describe, expect, it } from 'vitest';
import type { Json } from '@/lib/database.types';
import { SOCIAL_CHANNELS, type SocialChannel } from '@/lib/social/types';
import {
  SOCIAL_COPY_CHECKPOINT_SCHEMA_VERSION,
  socialCopyCheckpointFromOutput,
  socialCopyCheckpointOutput,
  socialCopyCheckpointScore,
  type SocialCopyCheckpoint,
} from './social-checkpoint';
import type { WeeklySocialAdaptation } from './social-adapter';

const inputHash = 'approved-source-hash';
const tokens = Object.fromEntries(
  SOCIAL_CHANNELS.map((channel) => [channel, `${channel}-token`]),
) as Record<SocialChannel, string>;

function adaptation(channel: SocialChannel): WeeklySocialAdaptation {
  return {
    channel,
    locale: channel === 'x' || channel === 'linkedin' || channel === 'instagram' ? 'en' : 'uk',
    format: 'test',
    text: `${channel} copy`,
    contentParts: [],
    firstComment: null,
    assets: [],
    altText: null,
    scheduledFor: '2026-08-18T12:00:00.000Z',
    sourceApproved: true,
    sourceFacts: ['fact'],
    sourceUrl: `https://example.com/${channel}`,
    hookAngle: 'Specific angle',
    hookCandidates: ['Hook one'],
    writer: {
      provider: 'openrouter',
      model: 'test-model',
      fallbackUsed: false,
      usage: { promptTokens: 1, outputTokens: 1, estimatedCostUsd: 0.01 },
    },
  } as WeeklySocialAdaptation;
}

function checkpoint(overrides: Partial<SocialCopyCheckpoint> = {}): SocialCopyCheckpoint {
  return {
    schemaVersion: SOCIAL_COPY_CHECKPOINT_SCHEMA_VERSION,
    inputHash,
    tokens,
    adaptations: { x: adaptation('x') },
    instagramAssets: [],
    linkedinDocumentArtifactId: null,
    socialPackageId: null,
    postIds: {},
    reviewedPostIds: [],
    ...overrides,
  };
}

describe('socialCopyCheckpointFromOutput', () => {
  it('round-trips the versioned durable state', () => {
    const state = checkpoint({
      linkedinDocumentArtifactId: 'artifact-1',
      socialPackageId: 'package-1',
      postIds: { x: 'post-1' },
      reviewedPostIds: ['post-1'],
    });

    expect(
      socialCopyCheckpointFromOutput(
        socialCopyCheckpointOutput(state) as unknown as Json,
        inputHash,
      ),
    ).toEqual(state);
  });

  it('rejects state from a superseded approved article', () => {
    const output = socialCopyCheckpointOutput(checkpoint()) as unknown as Json;
    expect(socialCopyCheckpointFromOutput(output, 'new-source-hash')).toBeNull();
  });

  it('upgrades the legacy v1 channel checkpoint used by existing failed jobs', () => {
    const output = {
      socialCopyCheckpointHash: inputHash,
      tokens,
      adaptations: { x: adaptation('x'), telegram: adaptation('telegram') },
    } as unknown as Json;

    const restored = socialCopyCheckpointFromOutput(output, inputHash);

    expect(restored?.schemaVersion).toBe(SOCIAL_COPY_CHECKPOINT_SCHEMA_VERSION);
    expect(Object.keys(restored?.adaptations ?? {})).toEqual(['telegram', 'x']);
    expect(restored?.instagramAssets).toEqual([]);
    expect(restored?.postIds).toEqual({});
  });

  it('rejects a partial token map so tracked URLs cannot cross jobs', () => {
    const output = {
      socialCopyCheckpointHash: inputHash,
      tokens: { x: 'only-one-token' },
      adaptations: { x: adaptation('x') },
    } as unknown as Json;
    expect(socialCopyCheckpointFromOutput(output, inputHash)).toBeNull();
  });
});

describe('socialCopyCheckpointScore', () => {
  it('prefers the furthest coherent retry-chain state', () => {
    const parent = checkpoint({
      adaptations: Object.fromEntries(
        SOCIAL_CHANNELS.map((channel) => [channel, adaptation(channel)]),
      ),
    });
    const newerButShorterChild = checkpoint({
      adaptations: { x: adaptation('x'), telegram: adaptation('telegram') },
      instagramAssets: [
        {
          artifactId: 'slide-1',
          storagePath: 'slide-1.jpg',
          slideIndex: 1,
          width: 1080,
          height: 1350,
          bytes: 123,
          mimeType: 'image/jpeg',
        },
      ],
    });

    expect(socialCopyCheckpointScore(parent)).toBeGreaterThan(
      socialCopyCheckpointScore(newerButShorterChild),
    );
  });
});
