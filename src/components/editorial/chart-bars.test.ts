import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ComparisonChart } from './chart-bars';

const items = [
  { label: 'Input price', display: '$3 / 1M tokens', ratio: 0.2 },
  { label: 'Output price', display: '$15 / 1M tokens', ratio: 1 },
];

function render(lang: 'en' | 'uk') {
  return renderToStaticMarkup(
    createElement(ComparisonChart, { lang, items, sourceName: lang === 'uk' ? 'Ключові факти' : 'Key facts' }),
  );
}

function withoutStyle(html: string): string {
  return html.replace(/\sstyle="[^"]*"/g, '');
}

describe('ComparisonChart', () => {
  it('renders source values, a Ukrainian caption and an aria description', () => {
    const html = render('uk');
    expect(html).toContain('data-chart="comparison"');
    expect(html).toContain('Порівняння');
    expect(html).toContain('Міні-графік метрик');
    expect(html).toContain('Джерело: Ключові факти — Input price, Output price');
    expect(html).toContain('$3 / 1M tokens');
    expect(html).toContain('$15 / 1M tokens');
    expect(html).toContain('Кожне число скопійоване з історії.');
    const described = /aria-describedby="([^"]+)"/.exec(html);
    expect(described?.[1]).toBeTruthy();
    expect(html).toContain(`id="${described![1]}"`);
    expect(html).toContain('Input price: $3 / 1M tokens');
  });

  it('keeps derived bar geometry out of the readable text', () => {
    const html = render('en');
    expect(html).toContain('Source: Key facts — Input price, Output price');
    expect(html).toContain('style="width:20%"');
    expect(withoutStyle(html)).not.toContain('20%');
    expect(withoutStyle(html)).not.toContain('0.2');
  });

  it('renders nothing when fewer than two values are supplied', () => {
    const html = renderToStaticMarkup(
      createElement(ComparisonChart, {
        lang: 'uk',
        sourceName: 'Ключові факти',
        items: [{ label: 'Price', display: '$5', ratio: 1 }],
      }),
    );
    expect(html).toBe('');
  });
});
