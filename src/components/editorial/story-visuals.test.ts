import { describe, expect, it } from 'vitest';
import { buildStoryVisuals } from './story-visuals';

describe('buildStoryVisuals', () => {
  it('charts only comparable story facts and keeps the original strings', () => {
    const visuals = buildStoryVisuals({
      facts: [
        { label: 'Input price', value: '$3 / 1M tokens' },
        { label: 'Output price', value: '$15 / 1M tokens' },
        { label: 'Availability', value: 'GA' },
      ],
    });
    expect(visuals.comparison).toEqual([
      { label: 'Input price', display: '$3 / 1M tokens', ratio: 0.2 },
      { label: 'Output price', display: '$15 / 1M tokens', ratio: 1 },
    ]);
    expect(visuals.metrics).toBeNull();
    expect(visuals.keyNumbers).toBeNull();
    expect(JSON.stringify(visuals)).not.toContain('200000');
  });

  it('puts a second comparable group on the mini chart and leaves other figures as key numbers', () => {
    const visuals = buildStoryVisuals({
      facts: [
        { label: 'Input price', value: '$3 / 1M tokens' },
        { label: 'Output price', value: '$15 / 1M tokens' },
        { label: 'Hit rate', value: '70%' },
        { label: 'Miss rate', value: '30%' },
        { label: 'Seats', value: '4 seats' },
      ],
    });
    expect(visuals.comparison?.map((item) => item.display)).toEqual(['$3 / 1M tokens', '$15 / 1M tokens']);
    expect(visuals.metrics?.map((item) => item.display)).toEqual(['70%', '30%']);
    expect(visuals.keyNumbers).toEqual([{ label: 'Seats', display: '4 seats' }]);
  });

  it('uses key numbers when values are numeric but not comparable, and skips a chart entirely otherwise', () => {
    const mixed = buildStoryVisuals({
      facts: [
        { label: 'Context', value: '200K tokens' },
        { label: 'Price', value: '$20/mo' },
      ],
    });
    expect(mixed.comparison).toBeNull();
    expect(mixed.metrics).toBeNull();
    expect(mixed.keyNumbers).toEqual([
      { label: 'Context', display: '200K tokens' },
      { label: 'Price', display: '$20/mo' },
    ]);

    const prose = buildStoryVisuals({
      facts: [
        { label: 'License', value: 'Apache-2.0' },
        { label: 'Status', value: 'generally available' },
      ],
    });
    expect(prose.comparison).toBeNull();
    expect(prose.metrics).toBeNull();
    expect(prose.keyNumbers).toBeNull();
    expect(prose.steps).toBeNull();
  });

  it('does not compare numbers whose units differ once Cyrillic is preserved', () => {
    const visuals = buildStoryVisuals({
      facts: [
        { label: 'Typed actions', value: '25 дій у брокері' },
        { label: 'Input parsers', value: '13 парсерів вхідних даних' },
      ],
    });
    expect(visuals.comparison).toBeNull();
    expect(visuals.metrics).toBeNull();
    expect(visuals.keyNumbers?.map((item) => item.display)).toEqual(['25 дій у брокері']);
  });

  it('builds a process diagram only from step names that are present, capped at three', () => {
    expect(buildStoryVisuals({ actionItems: ['Only one'] }).steps).toBeNull();
    expect(
      buildStoryVisuals({
        actionItems: [' Read the changelog ', '', 'Try one task', 'Write the signal', 'Ship it'],
      }).steps,
    ).toEqual([
      { title: 'Read the changelog' },
      { title: 'Try one task' },
      { title: 'Write the signal' },
    ]);
  });
});
