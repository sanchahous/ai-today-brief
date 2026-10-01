import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CategoryGlyph } from './icons';
import { CategoryBadge } from './ui/category-badge';
import { CategoryThumb } from './category-thumb';
import { CategoryBanner } from './category-banner';
import { FilterChip } from './ui/chip';
import { categoryMeta } from '@/lib/category-meta';

const prototype = readFileSync('artifacts/after-hours/app.js', 'utf8');
const slugs = ['tools-and-releases', 'tutorials-and-guides', 'optimization', 'agents-and-mcp',
  'vibe-coding', 'creative-ai', 'local-llms', 'career-and-money', 'models-and-research'];

describe('category presentation', () => {
  it.each(slugs)('ports the prototype glyph and hides it from assistive technology: %s', (slug) => {
    const meta = categoryMeta(slug);
    const markup = renderToStaticMarkup(createElement(CategoryGlyph, { icon: meta.icon }));
    const glyph = prototype.split(`  ${meta.tokenKey}: '`)[1]?.split("',")[0];
    expect(glyph).toBeDefined();
    // Compare each shape attribute; React serializes empty SVG tags with closing tags.
    for (const attribute of glyph?.matchAll(/\b(?:d|cx|cy|r|x|y|width|height|rx|ry|transform)="[^"]+"/g) ?? []) {
      expect(markup).toContain(attribute[0]);
    }
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('focusable="false"');
  });

  it('resolves DB colours at every reusable presentation boundary', () => {
    const slug = 'tools-and-releases';
    const color = '#47E4D3';
    const elements = [
      createElement(CategoryBadge, { slug, name: 'Tools', color }),
      createElement(CategoryThumb, { slug, name: 'Tools', color, icon: 'tools' }),
      createElement(FilterChip, { categorySlug: slug, label: 'Tools', categoryColor: color }),
    ];
    for (const element of elements) {
      const markup = renderToStaticMarkup(element);
      expect(markup).toContain('var(--cat-tools)');
      expect(markup).not.toContain(color);
    }
    const banner = renderToStaticMarkup(createElement(CategoryBanner, { slug, name: 'Tools', color, icon: 'tools' }));
    expect(banner).toContain('var(--art-tools)');
    expect(banner).not.toContain(color);
    expect(banner).not.toContain('var(--cat-tools)');
  });

  it('omits a nameless badge and renders a neutral unknown category', () => {
    expect(renderToStaticMarkup(createElement(CategoryBadge, { slug: null, name: null, color: null }))).toBe('');
    expect(renderToStaticMarkup(createElement(CategoryBadge, { slug: 'new', name: 'New', color: null }))).toContain('var(--muted)');
  });
});
