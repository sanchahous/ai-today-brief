import { describe, expect, it } from 'vitest';
import { embedInput } from './embeddings';

describe('embedInput', () => {
  it('trims whitespace', () => {
    expect(embedInput('  hello  ')).toBe('hello');
  });

  it('returns the title as-is when already trimmed', () => {
    expect(embedInput('Claude Code ships MCP server support')).toBe(
      'Claude Code ships MCP server support',
    );
  });

  it('handles an empty string', () => {
    expect(embedInput('')).toBe('');
  });
});
