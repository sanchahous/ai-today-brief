import { describe, expect, it } from 'vitest';
import { instagramCarouselIssues, readableInstagramParts } from '@/lib/social/instagram-carousel';
import { approximateInstagramMeasurer, layoutInstagramSlideText } from '@/lib/social/instagram-layout';
import { CHANNEL_RULES, runQualityGate } from '@/lib/social/quality';
import type { SocialAsset, SocialDraft } from '@/lib/social/types';
import {
  GROUNDED_COPY_FORBIDDEN_CLAIMS,
  groundedWeeklySocialCopy,
  instagramStoryRoleFromItem,
} from './repair-social-copy';

const STORY_IDS = ['item-hf', 'item-priv', 'item-openai'] as const;
const FACEBOOK_URL = 'https://aitodaybrief.com/r/s/facebook-token';
const THREADS_URL = 'https://aitodaybrief.com/r/s/threads-token';
const STORIES = [
  { revisionItemId: 'item-hf', role: 'huggingFace' as const },
  { revisionItemId: 'item-priv', role: 'privaiTe' as const },
  { revisionItemId: 'item-openai', role: 'openaiUltrafast' as const },
] as const;

function landscape(): SocialAsset {
  return {
    artifactId: 'cover',
    width: 1600,
    height: 900,
    mimeType: 'image/jpeg',
    bytes: 80_000,
  };
}

function instagramAssets(): SocialAsset[] {
  return Array.from({ length: 7 }, (_, index) => ({
    artifactId: `slide-${index + 1}`,
    width: 1080,
    height: 1350,
    mimeType: 'image/jpeg' as const,
    bytes: 90_000,
  }));
}

describe('groundedWeeklySocialCopy', () => {
  const copy = groundedWeeklySocialCopy({
    stories: [...STORIES],
    facebookTrackedUrl: FACEBOOK_URL,
    threadsTrackedUrl: THREADS_URL,
  });

  it('keeps Instagram slides inside the hybrid contract and layout box', () => {
    const issues = instagramCarouselIssues(copy.instagram, STORY_IDS);
    expect(issues).toEqual([]);
    expect(copy.instagram.slides[1]?.kind === 'story' && copy.instagram.slides[1].revisionItemId).toBe(
      'item-hf',
    );
    expect(copy.instagram.slides[2]?.kind === 'story' && copy.instagram.slides[2].revisionItemId).toBe(
      'item-priv',
    );
    expect(copy.instagram.slides[3]?.kind === 'story' && copy.instagram.slides[3].revisionItemId).toBe(
      'item-openai',
    );
    const measurer = approximateInstagramMeasurer(0.52);
    for (const slide of copy.instagram.slides) {
      const laidOut = layoutInstagramSlideText({
        kind: slide.kind,
        headline: slide.headline,
        body: slide.kind === 'cover' ? undefined : slide.body,
        measurer,
      });
      expect(laidOut.ok, slide.headline).toBe(true);
    }
  });

  it('omits claims the production critic already rejected', () => {
    const blob = [
      copy.instagram.caption,
      copy.instagram.angle,
      ...readableInstagramParts(copy.instagram),
      copy.facebookUk,
      ...copy.threadsUk,
    ].join('\n');
    for (const claim of GROUNDED_COPY_FORBIDDEN_CLAIMS) {
      expect(blob.includes(claim), claim).toBe(false);
    }
  });

  it('passes the structural quality gate for Instagram, Facebook, and Threads', () => {
    const scheduledFor = '2099-08-24T16:00:00.000Z';
    const facts = [
      'Qwen3.8 activates only 95 billion of its 2.4 trillion parameters per token',
      "IBM Research's agent memory system matches ACE's accuracy",
      'zero of 178 Chinese model releases above 20 billion parameters',
      'PrivAiTe missed up to 2 of 24 secrets',
      'OpenAI Ultrafast claims 14 times the speed',
    ];
    const instagram: SocialDraft = {
      channel: 'instagram',
      locale: 'en',
      format: 'weekly_carousel_7_9',
      text: copy.instagram.caption,
      contentParts: readableInstagramParts(copy.instagram),
      assets: instagramAssets(),
      altText: 'Weekly Digest cover',
      scheduledFor,
      sourceApproved: true,
      sourceFacts: facts,
      sourceUrl: 'https://aitodaybrief.com/en/weekly/example',
      instagramCarousel: copy.instagram,
      currentRevisionItemIds: [...STORY_IDS],
    };
    const facebook: SocialDraft = {
      channel: 'facebook',
      locale: 'uk',
      format: 'weekly_human_narrative',
      text: copy.facebookUk,
      assets: [landscape()],
      altText: 'Обкладинка тижневого дайджесту',
      scheduledFor,
      sourceApproved: true,
      sourceFacts: facts,
      sourceUrl: FACEBOOK_URL,
    };
    const threads: SocialDraft = {
      channel: 'threads',
      locale: 'uk',
      format: 'weekly_thread_3_5',
      text: copy.threadsUk[0],
      contentParts: [...copy.threadsUk],
      assets: [landscape()],
      altText: 'Обкладинка тижневого дайджесту',
      scheduledFor,
      sourceApproved: true,
      sourceFacts: facts,
      sourceUrl: THREADS_URL,
    };
    expect(runQualityGate(instagram).blocking).toEqual([]);
    expect(runQualityGate(facebook).blocking).toEqual([]);
    expect(runQualityGate(threads).blocking).toEqual([]);
    expect(copy.facebookUk).toContain(FACEBOOK_URL);
    expect(copy.threadsUk[0].length).toBeGreaterThanOrEqual(CHANNEL_RULES.threads.minChars);
    expect(copy.threadsUk.every((part) => part.length <= 500)).toBe(true);
  });

  it('maps Hugging Face / PrivAiTe / Ultrafast titles onto story roles', () => {
    expect(instagramStoryRoleFromItem({ id: 'a', title_en: "Hugging Face's Summer 2026 Report" })).toBe(
      'huggingFace',
    );
    expect(instagramStoryRoleFromItem({ id: 'b', title_en: 'New Self-Hosted Proxy PrivAiTe Scrubs Secrets' })).toBe(
      'privaiTe',
    );
    expect(instagramStoryRoleFromItem({ id: 'c', title_en: 'OpenAI Rolls Out Ultrafast Mode on Cerebras' })).toBe(
      'openaiUltrafast',
    );
    expect(instagramStoryRoleFromItem({ id: 'd', title_en: 'Unrelated story' })).toBeNull();
  });
});
