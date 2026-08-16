import { describe, expect, it } from 'vitest';
import { seedStoryContent, type SeedStorySource } from './seed-content';

function item(over: Partial<SeedStorySource> = {}): SeedStorySource {
  return {
    summary_en: 'IBM open-sourced ALTK-Evolve, an agent memory library.',
    summary_uk: 'IBM відкрила ALTK-Evolve — бібліотеку памʼяті агентів.',
    body_md_en: '### Context passing\n\nBoth approaches agree that experience should not be compressed.',
    body_md_uk: '### Передача контексту\n\nОбидва підходи сходяться на тому, що досвід не варто стискати.',
    takeaways_en: ['Avoid injecting monolithic playbooks', 'Keep rules separate'],
    takeaways_uk: ['Уникайте монолітних плейбуків', 'Тримайте правила окремо'],
    action_items_en: ['Audit your agent prompts for static instructions'],
    action_items_uk: ['Проведіть аудит промптів агентів'],
    when_to_use_en: ['Multi-step ReAct agents that call external APIs'],
    when_to_use_uk: ['Багатокрокові ReAct-агенти, що ходять у зовнішні API'],
    ...over,
  };
}

describe('seedStoryContent', () => {
  it('uses the daily long-form body instead of repeating the summary', () => {
    const seed = seedStoryContent(item(), 'uk');
    expect(seed.body).toContain('Передача контексту');
    expect(seed.body).not.toBe(item().summary_uk);
  });

  it('builds the takeaway from daily takeaways, not from why-it-matters', () => {
    expect(seedStoryContent(item(), 'en').takeaway).toBe(
      'Avoid injecting monolithic playbooks. Keep rules separate.',
    );
  });

  it('fills the practical example from action items', () => {
    expect(seedStoryContent(item(), 'uk').practical).toBe(
      'Проведіть аудит промптів агентів.',
    );
  });

  it('falls back to when-to-use, in the right language, when there are no actions', () => {
    const source = item({ action_items_en: [], action_items_uk: [] });
    expect(seedStoryContent(source, 'en').practical).toBe(
      'Worth reaching for when: Multi-step ReAct agents that call external APIs.',
    );
    expect(seedStoryContent(source, 'uk').practical).toBe(
      'Варто застосовувати, коли: Багатокрокові ReAct-агенти, що ходять у зовнішні API.',
    );
  });

  it('leaves a field empty rather than duplicating a neighbouring one', () => {
    const bare = seedStoryContent(
      item({
        body_md_en: null,
        deep_dive_en: null,
        takeaways_en: null,
        action_items_en: undefined,
        when_to_use_en: 'not an array',
      }),
      'en',
    );
    expect(bare.body).toBe('IBM open-sourced ALTK-Evolve, an agent memory library.');
    expect(bare.practical).toBeNull();
    expect(bare.takeaway).toBeNull();
  });

  it('prefers the deep dive when no markdown body was written', () => {
    const seed = seedStoryContent(
      item({ body_md_en: '   ', deep_dive_en: 'A longer explanation of the mechanism.' }),
      'en',
    );
    expect(seed.body).toBe('A longer explanation of the mechanism.');
  });
});
