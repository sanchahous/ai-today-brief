import { describe, expect, it } from 'vitest';
import { dailyVisualSocialInputFromStored } from './daily-visual-input';

const snapshot = {
  editorialDate: '2026-08-24',
  leadBriefId: 'brief-1',
  canonicalSlug: 'ai-daily-2026-08-24',
  titleEn: 'The daily title',
  titleUk: 'Щоденний заголовок',
  introEn: 'One concise public intro.',
  introUk: 'Один короткий публічний вступ.',
  stories: [
    {
      id: 'story-1',
      rank: 1,
      titleEn: 'The concrete change',
      titleUk: 'Конкретна зміна',
      summaryEn: 'A component became more efficient.',
      summaryUk: 'Компонент став ефективнішим.',
      whyEn: 'Teams can ship with less cost.',
      whyUk: 'Команди можуть запускати дешевше.',
    },
  ],
};

const direction = {
  displayTitleEn: 'Efficiency becomes the signal',
  displayTitleUk: 'Ефективність стає головним сигналом',
  visualThesisEn: 'A focused change makes a practical AI workflow cheaper and easier to adopt.',
  visualThesisUk: 'Сфокусована зміна робить практичний AI-процес дешевшим і доступнішим.',
  overlayStatEn: null,
  overlayStatUk: null,
  subject: 'a modular computing system',
  action: 'one active path reaches a deployable endpoint',
  setting: 'a calm engineering workspace',
  mechanism: 'a selected route activates only the useful components',
  consequence: 'the result reaches a practical team with less unnecessary load',
  scene:
    'A modular computing system shows one active route reaching a practical endpoint while idle components stay quiet in a calm engineering workspace.',
};

describe('dailyVisualSocialInputFromStored', () => {
  it('uses the frozen cutoff snapshot rather than mutable daily records', () => {
    const input = dailyVisualSocialInputFromStored({
      sourceSnapshot: snapshot,
      direction,
      visualSetId: 'set-1',
      publicUrl: 'https://cdn.example.test/daily/one.webp',
    });
    expect(input.sourceDate).toBe('2026-08-24');
    expect(input.displayTitle.uk).toBe(direction.displayTitleUk);
    expect(input.stories).toHaveLength(1);
    expect(input.lead.slug).toBe('ai-daily-2026-08-24');
  });

  it('rejects incomplete historical direction instead of regenerating from changed content', () => {
    expect(() =>
      dailyVisualSocialInputFromStored({
        sourceSnapshot: snapshot,
        direction: { ...direction, visualThesisEn: '' },
        visualSetId: 'set-1',
        publicUrl: 'https://cdn.example.test/daily/one.webp',
      }),
    ).toThrow('incomplete frozen direction');
  });
});
