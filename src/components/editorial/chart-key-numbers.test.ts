import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KeyNumbers } from './chart-key-numbers';

describe('KeyNumbers', () => {
  it('copies short story figures and names their source in Ukrainian', () => {
    const html = renderToStaticMarkup(
      createElement(KeyNumbers, {
        lang: 'uk',
        sourceName: 'Ключові факти',
        items: [
          { label: 'Context', display: '200K tokens' },
          { label: 'Price', display: '$20/mo' },
        ],
      }),
    );
    expect(html).toContain('data-chart="key-numbers"');
    expect(html).toContain('Ключові числа');
    expect(html).toContain('Джерело: Ключові факти — Context, Price');
    expect(html).toContain('200K tokens');
    expect(html).toContain('$20/mo');
    expect(html).not.toContain('200000');
    const described = /aria-describedby="([^"]+)"/.exec(html);
    expect(described?.[1]).toBeTruthy();
    expect(html).toContain('Context: 200K tokens');
  });

  it('renders nothing when there are no figures', () => {
    const html = renderToStaticMarkup(
      createElement(KeyNumbers, { lang: 'en', sourceName: 'Key facts', items: [] }),
    );
    expect(html).toBe('');
  });
});
