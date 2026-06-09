import { describe, expect, it } from 'vitest';
import {
  buildConceptNameIndex,
  resolveConceptSlugs,
  toolNamesFromJsonb,
} from './concept-link';

describe('buildConceptNameIndex', () => {
  it('maps names and aliases to slug', () => {
    const index = buildConceptNameIndex([
      {
        slug: 'claude-code',
        name_en: 'Claude Code',
        name_uk: 'Claude Code',
        aliases: ['claude code', 'claudecode'],
      },
    ]);
    expect(index.get('claude code')).toBe('claude-code');
    expect(index.get('claudecode')).toBe('claude-code');
  });
});

describe('toolNamesFromJsonb', () => {
  it('reads string and object forms', () => {
    expect(toolNamesFromJsonb(['Cursor', { name: 'MCP' }])).toEqual(['Cursor', 'MCP']);
  });
});

describe('resolveConceptSlugs', () => {
  it('dedupes matched slugs', () => {
    const index = buildConceptNameIndex([
      { slug: 'cursor', name_en: 'Cursor', name_uk: 'Cursor', aliases: ['cursor ide'] },
    ]);
    expect(resolveConceptSlugs(['Cursor', 'cursor ide', 'Unknown'], index)).toEqual(['cursor']);
  });
});
