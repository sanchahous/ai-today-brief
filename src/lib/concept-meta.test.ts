import { describe, expect, it } from 'vitest';
import {
  conceptFitTable,
  conceptProcessSteps,
  countPhrase,
  formatVerifiedDate,
  officialHref,
  planConceptSections,
  shelfKind,
  shelfStats,
  conceptIcon,
} from '@/lib/concept-meta';

describe('conceptIcon', () => {
  it('maps known slugs', () => {
    expect(conceptIcon('claude-code', 'tool')).toBe('agents');
    expect(conceptIcon('cursor', 'tool')).toBe('tools');
  });

  it('falls back by type', () => {
    expect(conceptIcon('unknown', 'model')).toBe('models');
    expect(conceptIcon('unknown', 'protocol')).toBe('agents');
    expect(conceptIcon('unknown', 'other')).toBe('tools');
  });
});

describe('shelfKind', () => {
  it('prefers a specific category over the coarse type', () => {
    expect(shelfKind('concept', 'protocol')).toBe('protocol');
    expect(shelfKind('product', 'ide')).toBe('product');
    expect(shelfKind('library', 'sdk')).toBe('library');
  });
});

describe('concept sections', () => {
  it('keeps mockup order and drops sections that have no source text', () => {
    const plan = planConceptSections({
      description: 'An open protocol.',
      body: 'How the host connects.\n\nWhere a server sits.\n\n- Host: The application — Claude\n- Client: One connection — JSON-RPC',
      faqCount: 1,
      verification: 'verified',
    });
    expect(plan.ids).toEqual(['overview', 'how', 'fit', 'faq', 'verification']);
    expect(plan.steps).toEqual([
      { role: 'Host', title: 'The application', detail: 'Claude' },
      { role: 'Client', title: 'One connection', detail: 'JSON-RPC' },
    ]);
    expect(plan.how[0]).toContain('How the host connects.');
    expect(plan.fit[0]).toContain('Where a server sits.');
  });

  it('does not invent a diagram from a single step or an empty body', () => {
    expect(conceptProcessSteps('- Only one')).toEqual([]);
    expect(conceptProcessSteps('Plain paragraphs only.')).toEqual([]);
    const plan = planConceptSections({
      description: '',
      body: 'One paragraph.',
      faqCount: 0,
      verification: null,
    });
    expect(plan.ids).toEqual(['how']);
    expect(plan.steps).toEqual([]);
    expect(plan.table).toBeNull();
  });

  it('reads a markdown table and ignores a javascript official url', () => {
    const table = conceptFitTable(
      '| If you need | Reach for |\n| --- | --- |\n| One tool | Function calling |\n',
    );
    expect(table?.headers).toEqual(['If you need', 'Reach for']);
    expect(table?.rows).toEqual([['One tool', 'Function calling']]);
    expect(officialHref('javascript:alert(1)')).toBeNull();
    expect(officialHref('https://modelcontextprotocol.io/')).toBe(
      'https://modelcontextprotocol.io/',
    );
  });

  it('formats a real timestamp and counts shelf stats from rows', () => {
    expect(formatVerifiedDate('2026-09-23T00:00:00.000Z', 'en', 'long')).toBe('23 September 2026');
    expect(formatVerifiedDate('not-a-date', 'en')).toBeNull();
    expect(formatVerifiedDate(null, 'uk')).toBeNull();
    expect(
      shelfStats([
        { type: 'concept', category: 'protocol', verification: 'verified' },
        { type: 'product', category: 'ide', verification: null },
      ]),
    ).toEqual({ entries: 2, types: 2, verified: 1 });
    expect(countPhrase(5, 'uk', { one: 'стаття', few: 'статті', many: 'статей', other: 'статті' })).toBe(
      '5 статей',
    );
  });
});
