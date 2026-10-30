import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MetricsMiniChart } from './chart-metrics';

const items = [
  { label: 'Hit rate', display: '70%', ratio: 0.7 },
  { label: 'Miss rate', display: '30%', ratio: 0.3 },
];

describe('MetricsMiniChart', () => {
  it('renders a sourced mini chart with a Ukrainian caption and aria description', () => {
    const html = renderToStaticMarkup(
      createElement(MetricsMiniChart, { lang: 'uk', items, sourceName: 'Ключові факти' }),
    );
    expect(html).toContain('data-chart="metrics"');
    expect(html).toContain('Міні-графік метрик');
    expect(html).toContain('Джерело: Ключові факти — Hit rate, Miss rate');
    expect(html).toContain('70%');
    expect(html).toContain('30%');
    const described = /aria-describedby="([^"]+)"/.exec(html);
    expect(described?.[1]).toBeTruthy();
    expect(html).toContain(`id="${described![1]}"`);
    expect(html).toContain('Hit rate: 70%');
  });

  it('renders nothing for a single metric', () => {
    const html = renderToStaticMarkup(
      createElement(MetricsMiniChart, {
        lang: 'en',
        sourceName: 'Key facts',
        items: [{ label: 'Hit rate', display: '70%', ratio: 1 }],
      }),
    );
    expect(html).toBe('');
  });
});
