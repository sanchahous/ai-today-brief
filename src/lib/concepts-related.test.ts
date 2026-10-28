import { describe, expect, it } from 'vitest';
import { pickRelatedConcepts, type ConceptSummary } from '@/lib/concepts';

function row(slug: string, type: string, category: string | null): ConceptSummary {
  return {
    slug,
    name: slug,
    description: '',
    type,
    category,
    verification: null,
    verifiedAt: null,
  };
}

describe('pickRelatedConcepts', () => {
  it('puts the same shelf kind first and caps the list', () => {
    const all = [
      row('rag', 'concept', 'pattern'),
      row('mcp', 'concept', 'protocol'),
      row('claude-code', 'product', 'ide'),
      row('hooks', 'concept', 'protocol'),
    ];
    const related = pickRelatedConcepts(all, row('mcp', 'concept', 'protocol'), 2);
    expect(related.map((item) => item.slug)).toEqual(['hooks', 'rag']);
  });
});