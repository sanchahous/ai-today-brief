import { describe, expect, it } from 'vitest';
import type { SocialSelectableArtifact } from '@/lib/social/channel-assets';
import { instagramCarouselIssues } from '@/lib/social/instagram-carousel';
import {
  buildRepairPatches,
  instagramSpecFromLegacyParts,
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
    first_comment: channel === 'x' ? 'Read: https://aitodaybrief.com/en/weekly/example?s=token' : null,
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

  it('rebuilds an 8-slide legacy package into a valid 7-slide spec', () => {
    const caption =
      "Hugging Face's Summer 2026 report puts hard numbers on something builders have felt for months: the open-weight frontier is being defined by who gives the most away, not who trains the biggest model. Add Qwen3.8's 95B-active MoE design and IBM's agent memory system matching ACE at one-seventh the token cost, and a pattern emerges — efficiency and openness are the actual competition now. Full breakdown at the link in bio. #OpenSourceAI #LLM #Qwen #AIInfrastructure #MachineLearning";
    const spec = instagramSpecFromLegacyParts({
      caption,
      parts: [
        "Zero out of 178. That's how many Chinese model releases above 20B parameters carried a non-commercial license this year, per Hugging Face's Summer 2026 report. Not a few. Zero.",
        'Meanwhile US labs in the same size class: 41% custom terms, 30% no license declared at all. Only 29% ship Apache or MIT. The labs with the biggest open models are writing the loosest terms.',
        'DeepSeek and Z.ai put 700B to 1.65T parameter models under plain MIT. The largest Chinese open model hit 2.78 trillion parameters this year. The US ceiling stayed under 130B in five of seven months.',
        "Why give away the most expensive artifact in AI? Ecosystem gravity. Qwen derivatives on the Hub now top 150,000 — roughly 2.6x Meta's entire footprint. A permissive frontier model becomes a default developers stop reconsidering.",
        "This week's Qwen3.8 release shows the playbook in action: 2.4 trillion parameters, but only 95 billion fire per token. MoE routing means it runs on standard vLLM or SGLang — not a hyperscaler's private cluster.",
        'And it shipped with a full serving stack on day zero: weights on Hugging Face, five hosted API providers, 1M-token context, three reasoning depths. Not months later after the community reverse-engineers it.',
        "One caveat: 1.5% of Hub repos capture 99.2% of downloads. Licenses only move markets at the top of that curve. But that's exactly where the permissive Chinese releases sit.",
        'The builder takeaway: watch the license column as closely as the parameter count. The real race is whose permissive terms get embedded into downstream pipelines first.',
      ],
      storyIds: ['item-1', 'item-2', 'item-3'],
      hookCandidates: [
        'Zero out of 178.<SLIDE>Meanwhile US labs',
        'Second blob<SLIDE>more',
        'Third blob<CAPTION>caption',
      ],
    });
    expect(spec).not.toBeNull();
    if (!spec) return;
    expect(instagramCarouselIssues(spec, ['item-1', 'item-2', 'item-3'])).toEqual([]);
    expect(spec.slides[0].headline).toBe('Zero out of 178.');
    expect(spec.slides[5].kind).toBe('caveat');
    expect(spec.slides[5].headline.startsWith('One caveat')).toBe(true);
    expect(spec.slides[6].kind).toBe('takeaway');
    expect(spec.slides[6].headline.toLowerCase()).toContain('builder takeaway');
    expect(spec.hookCandidates.some((candidate) => candidate.includes('<SLIDE>'))).toBe(false);
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
