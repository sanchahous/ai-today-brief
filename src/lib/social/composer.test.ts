import { describe, expect, it } from 'vitest';
import { telegramSeed, topStorySeeds } from './composer';
import { runQualityGate } from './quality';
import type { SocialChannel, SocialDraft } from './types';

type SourceItem = Parameters<typeof topStorySeeds>[0];
type SourceBrief = Parameters<typeof telegramSeed>[0];
type Cadence = Parameters<typeof topStorySeeds>[4];

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const cadence: Cadence = {
  telegram: { days: EVERY_DAY, hour: 21, minute: 0 },
  x: { days: EVERY_DAY, hour: 17, minute: 0 },
  threads: { days: EVERY_DAY, hour: 18, minute: 0 },
  linkedin: { days: EVERY_DAY, hour: 10, minute: 0 },
  instagram: { days: EVERY_DAY, hour: 19, minute: 0 },
  facebook: { days: EVERY_DAY, hour: 19, minute: 30 },
};
const tokens: Record<SocialChannel, string> = {
  telegram: '11111111-1111-4111-8111-111111111111',
  x: '22222222-2222-4222-8222-222222222222',
  threads: '33333333-3333-4333-8333-333333333333',
  linkedin: '44444444-4444-4444-8444-444444444444',
  instagram: '55555555-5555-4555-8555-555555555555',
  facebook: '66666666-6666-4666-8666-666666666666',
};

// Long enough that every channel has to shorten it — the case that used to
// end in an ellipsis or a cut-off tracked URL.
const LONG_EN =
  'Anthropic shipped a new agent sandbox that isolates every tool call in its own short-lived container. ' +
  'Teams can now pin network egress per tool, replay a failed step from a snapshot, and cap spend per run. ' +
  'Early adopters report fewer flaky end-to-end runs and clearer audit trails for security reviews. ' +
  'The release also adds a cost dashboard that splits tokens by tool, which makes runaway loops visible within minutes.';
const LONG_UK =
  'Anthropic випустила нову пісочницю для агентів, яка ізолює кожен виклик інструмента в окремому короткоживучому контейнері. ' +
  'Команди тепер можуть обмежувати мережевий доступ для кожного інструмента, повторювати збійний крок зі знімка й обмежувати витрати на запуск. ' +
  'Перші користувачі повідомляють про менше нестабільних наскрізних прогонів і зрозуміліші журнали для безпекових перевірок.';

const item: SourceItem = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  brief_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  rank: 1,
  slug: 'anthropic-agent-sandbox',
  impact_level: 'high',
  category_slug: 'agents',
  title_en: 'Anthropic ships an isolated sandbox for agent tool calls',
  title_uk: 'Anthropic випустила ізольовану пісочницю для викликів інструментів агента',
  summary_en: LONG_EN,
  summary_uk: LONG_UK,
  why_matters_en: LONG_EN,
  why_matters_uk: LONG_UK,
  social_hook_en: 'Every tool call now runs in its own container, with egress and spend limits per step.',
  social_hook_uk: 'Кожен виклик інструмента тепер працює у власному контейнері.',
  facts_en: ['Each tool call runs in its own container.', 'Spend can be capped per run.'],
  facts_uk: ['Кожен виклик працює в окремому контейнері.'],
  card_image_url: null,
  review_status: 'approved',
};

const brief: SourceBrief = {
  id: item.brief_id,
  date: '2026-10-28',
  edition: 1,
  slug: 'agent-sandboxes-and-cost-control',
  title_en: 'Agent sandboxes and cost control',
  title_uk: 'Пісочниці агентів і контроль витрат',
};

const now = new Date('2026-10-28T06:00:00Z');

function asDraft(seed: ReturnType<typeof telegramSeed>): SocialDraft {
  return {
    channel: seed.channel,
    locale: seed.locale,
    format: seed.format,
    text: seed.text,
    firstComment: seed.firstComment ?? null,
    contentParts: seed.contentParts,
    assets: [],
    scheduledFor: seed.scheduledFor,
    sourceApproved: true,
    sourceFacts: ['Each tool call runs in its own container.'],
    sourceUrl: seed.sourceUrl,
  };
}

describe('social composer copy passes its own quality gate', () => {
  const seeds = [
    telegramSeed(brief, [item, { ...item, id: 'c', rank: 2 }], '2026-10-28', now, tokens.telegram, cadence.telegram),
    ...topStorySeeds(item, '2026-10-28', now, tokens, cadence),
  ];

  // Instagram needs a rendered 4:5 asset, which the asset pipeline adds later.
  for (const seed of seeds.filter((value) => value.channel !== 'instagram')) {
    it(`${seed.channel} has no blocking issues`, () => {
      const report = runQualityGate(asDraft(seed), now);
      expect(report.blocking.map((issue) => issue.code)).toEqual([]);
    });
  }

  it('never shortens copy with an ellipsis', () => {
    for (const seed of seeds) {
      expect([seed.text, ...(seed.contentParts ?? [])].join(' ')).not.toMatch(/…|\.{3}/);
    }
  });

  it('keeps the tracked URL intact where the channel carries one', () => {
    const byChannel = new Map(seeds.map((seed) => [seed.channel, seed]));
    expect(byChannel.get('threads')?.contentParts?.at(-1)).toContain(tokens.threads);
    expect(byChannel.get('linkedin')?.firstComment).toContain(tokens.linkedin);
    expect(byChannel.get('linkedin')?.text).not.toMatch(/https?:\/\//);
    expect(byChannel.get('facebook')?.text).toContain(tokens.facebook);
  });
});
