import { describe, expect, it } from 'vitest';
import { conceptIcon } from '@/lib/concept-meta';

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
