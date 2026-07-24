import { describe, expect, it } from 'vitest';
import { createWeeklyEditorialDraft, type WeeklyEditorialSourceItem } from './editorial-draft';

function item(overrides: Partial<WeeklyEditorialSourceItem> = {}): WeeklyEditorialSourceItem {
  return {
    id: 'story-1',
    category_slug: 'optimization',
    title_en: 'Server-side compaction reduces long-context overhead',
    title_uk: 'Серверна компактизація зменшує витрати довгого контексту',
    summary_en: 'The service removes older context while preserving the active conversation.',
    summary_uk: 'Сервіс прибирає старіший контекст, зберігаючи активну розмову.',
    why_matters_en: 'Teams can reduce long-running agent cost and latency.',
    why_matters_uk: 'Команди можуть зменшити вартість і затримку довгих агентних сесій.',
    facts_en: [
      { label: 'Execution', value: 'Compaction is handled on the server.' },
      { text: 'The active conversation is preserved.' },
    ],
    facts_uk: [
      { label: 'Виконання', value: 'Компактизація виконується на сервері.' },
      { text: 'Активна розмова зберігається.' },
    ],
    ...overrides,
  };
}

function issueItems() {
  return [
    item(),
    item({
      id: 'story-2',
      category_slug: 'agents-and-mcp',
      title_en: 'Agent integration update',
      title_uk: 'Оновлення інтеграції агентів',
    }),
    item({
      id: 'story-3',
      category_slug: 'models-and-research',
      title_en: 'Model benchmark update',
      title_uk: 'Оновлення бенчмарку моделі',
    }),
  ];
}

describe('createWeeklyEditorialDraft', () => {
  it('uses supplied bilingual summaries and facts without external generation', () => {
    const draft = createWeeklyEditorialDraft(issueItems());
    const story = draft.stories[0];

    expect(story).toMatchObject({
      id: 'story-1',
      body_en:
        'The service removes older context while preserving the active conversation. Execution: Compaction is handled on the server. The active conversation is preserved.',
      body_uk:
        'Сервіс прибирає старіший контекст, зберігаючи активну розмову. Виконання: Компактизація виконується на сервері. Активна розмова зберігається.',
      takeaway_en: 'Teams can reduce long-running agent cost and latency.',
      takeaway_uk: 'Команди можуть зменшити вартість і затримку довгих агентних сесій.',
    });
  });

  it('uses deterministic category-specific practical templates', () => {
    const draft = createWeeklyEditorialDraft(issueItems());

    expect(draft.stories[0].practical_en).toContain('cost, latency, and output quality');
    expect(draft.stories[0].practical_uk).toContain('вартість, затримку та якість результату');
    expect(draft.stories[1].practical_en).toContain('explicit permissions');
    expect(draft.stories[2].practical_uk).toContain('репрезентативному навантаженні');
  });

  it('creates bilingual issue framing and one takeaway per selected story', () => {
    const draft = createWeeklyEditorialDraft(issueItems());

    expect(draft.editor_note_en).toContain('3 approved developments');
    expect(draft.editor_note_en).toContain('optimization, agents and MCP, models and research');
    expect(draft.editor_note_uk).toContain('3 перевірених новин');
    expect(draft.key_takeaways_en).toHaveLength(3);
    expect(draft.key_takeaways_uk).toHaveLength(3);
    expect(draft.key_takeaways_en[1]).toContain('Agent integration update');
    expect(draft.key_takeaways_uk[2]).toContain('Оновлення бенчмарку моделі');
  });

  it('falls back to the factual summary and a safe generic action for sparse or unknown categories', () => {
    const sparse = issueItems();
    sparse[0] = item({
      category_slug: 'future-category',
      why_matters_en: null,
      why_matters_uk: null,
      facts_en: null,
      facts_uk: null,
    });

    const draft = createWeeklyEditorialDraft(sparse);

    expect(draft.stories[0].body_en).toBe(
      'The service removes older context while preserving the active conversation.',
    );
    expect(draft.stories[0].takeaway_uk).toBe(
      'Сервіс прибирає старіший контекст, зберігаючи активну розмову.',
    );
    expect(draft.stories[0].practical_en).toContain('small, reversible research task');
  });

  it('is deterministic and enforces the Weekly Digest story range', () => {
    const stories = issueItems();

    expect(createWeeklyEditorialDraft(stories)).toEqual(createWeeklyEditorialDraft(stories));
    expect(() => createWeeklyEditorialDraft(stories.slice(0, 2))).toThrow('3 to 7 stories');
    expect(() =>
      createWeeklyEditorialDraft(
        Array.from({ length: 8 }, (_, index) => item({ id: String(index) })),
      ),
    ).toThrow('3 to 7 stories');
  });
});
