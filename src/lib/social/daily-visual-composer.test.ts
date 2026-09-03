import { describe, expect, it } from 'vitest';
import {
  buildDailyVisualSocialDrafts,
  dailyVisualPackageGenerationVersion,
  dailyVisualSocialMatrix,
  planDailyVisualPackageRecovery,
  planDailyVisualSupersession,
  type DailyVisualSocialInput,
} from './daily-visual-composer';
import type { SocialAsset, SocialChannel } from './types';

const INPUT: DailyVisualSocialInput = {
  sourceDate: '2026-08-25',
  visualSetId: 'candidate-9f95',
  selectedPublicMasterUrl: 'https://cdn.example/daily-master.jpg',
  displayTitle: {
    en: 'Efficiency, not raw scale',
    uk: 'Не масштаб, а ефективність',
  },
  visualThesis: {
    en: 'The important AI shift is how much useful work teams can deliver with less inference cost and more open access.',
    uk: 'Головний зсув у AI — скільки корисної роботи команди можуть отримати з меншими витратами інференсу та відкритішим доступом.',
  },
  stories: [
    {
      id: 'story-qwen',
      approved: true,
      title: { en: 'Qwen release', uk: 'Реліз Qwen' },
      whatChanged: {
        en: 'Alibaba published an open-weight mixture-of-experts model with a smaller active parameter set per token.',
        uk: 'Alibaba опублікувала відкриту mixture-of-experts модель з меншою активною частиною параметрів на токен.',
      },
      whyItMatters: {
        en: 'Large-model capability can become practical without paying for every parameter on every request.',
        uk: 'Можливості великої моделі можуть стати практичними без оплати за кожен параметр у кожному запиті.',
      },
    },
    {
      id: 'story-memory',
      approved: true,
      title: { en: 'Agent memory', uk: 'Пам’ять агентів' },
      whatChanged: {
        en: 'A new memory library extracts selected rules instead of replaying a full rulebook for every task.',
        uk: 'Нова бібліотека пам’яті витягує потрібні правила замість повторення повного збірника для кожного завдання.',
      },
      whyItMatters: {
        en: 'Teams can evaluate whether compact context keeps quality while reducing inference spend.',
        uk: 'Команди можуть перевірити, чи компактний контекст зберігає якість і зменшує витрати на інференс.',
      },
    },
    {
      id: 'story-open',
      approved: true,
      title: { en: 'Open model licences', uk: 'Відкриті ліцензії моделей' },
      whatChanged: {
        en: 'A market report highlighted more permissive commercial licensing in a large group of model releases.',
        uk: 'Ринковий звіт показав більше ліцензій, що дозволяють комерційне використання у великій групі релізів моделей.',
      },
      whyItMatters: {
        en: 'Openness changes which technical choices can move from evaluation into a real product.',
        uk: 'Відкритість змінює, які технічні рішення можуть перейти з оцінки у реальний продукт.',
      },
    },
  ],
  lead: { briefId: 'brief-1', slug: 'ai-daily-2026-08-25', briefItemId: 'story-qwen' },
};

function assetsFor(channel: SocialChannel): SocialAsset[] {
  const size =
    channel === 'instagram' ? { width: 1080, height: 1350 } : { width: 1200, height: 630 };
  const count = channel === 'instagram' ? 5 : 1;
  return Array.from({ length: count }, (_, index) => ({
    url: `https://cdn.example/${channel}-${index + 1}.jpg`,
    mimeType: 'image/jpeg' as const,
    width: size.width,
    height: channel === 'telegram' ? 675 : size.height,
    bytes: 30_000,
  }));
}

const CHANNELS: SocialChannel[] = ['telegram', 'x', 'threads', 'linkedin', 'instagram', 'facebook'];

const TRACKING = {
  tokens: Object.fromEntries(CHANNELS.map((channel) => [channel, `token-${channel}`])) as Record<
    SocialChannel,
    string
  >,
  urls: Object.fromEntries(
    CHANNELS.map((channel) => [channel, `https://aitodaybrief.com/en/ai-daily-2026-08-25?s=token-${channel}`]),
  ) as Record<SocialChannel, string>,
};

describe('daily visual social composer', () => {
  it('creates the fixed six-channel locale matrix without cadence filtering', () => {
    expect(dailyVisualSocialMatrix()).toEqual([
      { channel: 'telegram', locale: 'uk' },
      { channel: 'facebook', locale: 'uk' },
      { channel: 'threads', locale: 'uk' },
      { channel: 'x', locale: 'en' },
      { channel: 'linkedin', locale: 'en' },
      { channel: 'instagram', locale: 'en' },
    ]);
  });

  it('builds six platform-native, QA-clean drafts and a five-slide Instagram carousel', async () => {
    const drafts = await buildDailyVisualSocialDrafts(INPUT, {
      packageId: 'package-1',
      now: new Date('2026-08-24T10:00:00.000Z'),
      tracking: TRACKING,
      renderAssets: async ({ channel }) => assetsFor(channel),
    });

    expect(drafts).toHaveLength(6);
    expect(drafts.map((draft) => draft.channel)).toEqual([
      'telegram',
      'facebook',
      'threads',
      'x',
      'linkedin',
      'instagram',
    ]);
    expect(
      drafts.flatMap((draft) =>
        (draft.qualityReport?.blocking ?? []).map((issue) => `${draft.channel}:${issue.code}`),
      ),
    ).toEqual([]);

    const instagram = drafts.find((draft) => draft.channel === 'instagram');
    const instagramCarousel = instagram?.instagramCarousel;
    const dailyInstagramCarousel =
      instagramCarousel && 'kind' in instagramCarousel && instagramCarousel.kind === 'daily_visual'
        ? instagramCarousel
        : null;
    expect(instagram?.assets).toHaveLength(5);
    expect(instagram?.contentParts).toHaveLength(5);
    expect(dailyInstagramCarousel?.kind).toBe('daily_visual');
    expect(dailyInstagramCarousel?.slides).toHaveLength(5);
    expect(dailyInstagramCarousel?.slides[0]).toMatchObject({
      kind: 'cover',
      headline: INPUT.displayTitle.en,
      body: null,
    });
    expect(instagram?.text).toContain('link in bio');

    const x = drafts.find((draft) => draft.channel === 'x');
    expect(x?.text).not.toContain('http');
    expect(x?.firstComment).toContain('s=token-x');
    expect(x?.contentParts).toHaveLength(2);

    const threads = drafts.find((draft) => draft.channel === 'threads');
    expect(threads?.contentParts).toHaveLength(4);
    expect(threads?.contentParts?.every((part) => part.length <= 500)).toBe(true);
    expect(threads?.contentParts?.at(-1)).toContain('s=token-threads');

    const telegram = drafts.find((draft) => draft.channel === 'telegram');
    expect(telegram?.text).toContain('Головний сигнал дня');
    expect(telegram?.text).toContain(INPUT.stories[0]!.whatChanged.uk);
    expect(telegram?.text).not.toContain(INPUT.visualThesis.uk);
    expect(telegram?.text).toContain('Повний щоденний бриф');

    const linkedIn = drafts.find((draft) => draft.channel === 'linkedin');
    expect(linkedIn?.text).toContain(INPUT.stories[0]!.whatChanged.en);
    expect(linkedIn?.text).not.toContain(INPUT.visualThesis.en);
    expect(linkedIn?.text).toContain('One decision-relevant example:');
    expect(linkedIn?.firstComment).toContain('s=token-linkedin');
  });

  it('keeps a single-story daily package platform-native instead of flagging it as blind cross-posting', async () => {
    const drafts = await buildDailyVisualSocialDrafts(
      { ...INPUT, stories: INPUT.stories.slice(0, 1) },
      {
        packageId: 'package-one-story',
        now: new Date('2026-08-24T10:00:00.000Z'),
        tracking: TRACKING,
        renderAssets: async ({ channel }) => assetsFor(channel),
      },
    );
    expect(
      drafts.flatMap((draft) =>
        (draft.qualityReport?.blocking ?? []).map((issue) => `${draft.channel}:${issue.code}`),
      ),
    ).toEqual([]);
  });

  it('binds an idempotent social package to the selected immutable master', () => {
    const primary = dailyVisualPackageGenerationVersion(INPUT);
    expect(dailyVisualPackageGenerationVersion({ ...INPUT })).toBe(primary);
    expect(
      dailyVisualPackageGenerationVersion({
        ...INPUT,
        selectedPublicMasterUrl: 'https://cdn.example/daily-master-replacement.webp',
      }),
    ).not.toBe(primary);
  });

  it('reuses only a complete candidate package and never auto-rebuilds a live partial package', () => {
    const posts = dailyVisualSocialMatrix().map(({ channel }, index) => ({
      id: `post-${index}`,
      package_id: 'package-1',
      status: 'in_review',
      channel,
      content_version: 1,
      content_hash: `hash-${index}`,
      scheduled_for: null,
    }));

    expect(
      planDailyVisualPackageRecovery({
        posts,
        generatedReviewPostIds: posts.map((post) => post.id),
      }),
    ).toEqual({ action: 'reuse', postIds: posts.map((post) => post.id) });
    expect(
      planDailyVisualPackageRecovery({
        posts,
        generatedReviewPostIds: posts.slice(0, -1).map((post) => post.id),
      }),
    ).toEqual({ action: 'rebuild', cancellablePostIds: posts.map((post) => post.id) });
    expect(
      planDailyVisualPackageRecovery({
        posts: [{ ...posts[0]!, status: 'needs_reconciliation' }, ...posts.slice(1)],
        generatedReviewPostIds: posts.map((post) => post.id),
      }),
    ).toMatchObject({ action: 'blocked' });
  });

  it('preserves packages containing published, publishing, or ambiguous posts', () => {
    const plan = planDailyVisualSupersession({
      packages: [
        { id: 'safe', status: 'in_review', generation_version: 'daily-visual-v1:safe' },
        { id: 'posted', status: 'in_review', generation_version: 'daily-visual-v1:posted' },
        { id: 'publishing', status: 'in_review', generation_version: 'daily-visual-v1:publishing' },
        { id: 'ambiguous', status: 'in_review', generation_version: 'daily-visual-v1:ambiguous' },
        { id: 'mixed', status: 'in_review', generation_version: 'daily-visual-v1:mixed' },
      ],
      posts: [
        {
          id: 'safe-1',
          package_id: 'safe',
          status: 'in_review',
          channel: 'telegram',
          content_version: 1,
          content_hash: 'hash',
          scheduled_for: null,
        },
        {
          id: 'safe-2',
          package_id: 'safe',
          status: 'scheduled',
          channel: 'facebook',
          content_version: 1,
          content_hash: 'hash',
          scheduled_for: null,
        },
        {
          id: 'posted-1',
          package_id: 'posted',
          status: 'posted',
          channel: 'telegram',
          content_version: 1,
          content_hash: 'hash',
          scheduled_for: null,
        },
        {
          id: 'publishing-1',
          package_id: 'publishing',
          status: 'publishing',
          channel: 'facebook',
          content_version: 1,
          content_hash: 'hash',
          scheduled_for: null,
        },
        {
          id: 'ambiguous-1',
          package_id: 'ambiguous',
          status: 'needs_reconciliation',
          channel: 'threads',
          content_version: 1,
          content_hash: 'hash',
          scheduled_for: null,
        },
        {
          id: 'mixed-posted',
          package_id: 'mixed',
          status: 'posted',
          channel: 'telegram',
          content_version: 1,
          content_hash: 'hash',
          scheduled_for: null,
        },
        {
          id: 'mixed-draft',
          package_id: 'mixed',
          status: 'in_review',
          channel: 'instagram',
          content_version: 1,
          content_hash: 'hash',
          scheduled_for: null,
        },
      ],
    });

    expect(plan.eligiblePackageIds).toEqual(['safe', 'mixed']);
    expect(plan.cancellablePostIds).toEqual(['safe-1', 'safe-2', 'mixed-draft']);
    expect(plan.preservedPackageIds).toEqual(['posted', 'publishing', 'ambiguous', 'mixed']);
  });
});
