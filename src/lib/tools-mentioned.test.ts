import { describe, expect, it } from 'vitest';
import { extractToolNames } from './tools-mentioned';

describe('extractToolNames', () => {
  it('returns [] for non-array values', () => {
    expect(extractToolNames(null)).toEqual([]);
    expect(extractToolNames(undefined)).toEqual([]);
    expect(extractToolNames('Claude Code')).toEqual([]);
    expect(extractToolNames({ name: 'Claude Code' })).toEqual([]);
    expect(extractToolNames(42)).toEqual([]);
  });

  it('parses the legacy string[] shape', () => {
    expect(extractToolNames(['Claude Code', 'Cursor'])).toEqual(['Claude Code', 'Cursor']);
  });

  it('parses the { name } object shape', () => {
    expect(extractToolNames([{ name: 'MCP' }, { name: 'Anthropic API' }])).toEqual([
      'MCP',
      'Anthropic API',
    ]);
  });

  it('trims names and drops empty or malformed entries', () => {
    expect(
      extractToolNames([
        '  Cursor  ',
        '',
        '   ',
        { name: ' MCP ' },
        { name: '' },
        { name: 7 },
        { label: 'no-name-key' },
        null,
        7,
      ]),
    ).toEqual(['Cursor', 'MCP']);
  });

  it('keeps mixed shapes in input order', () => {
    expect(extractToolNames(['Cursor', { name: 'MCP' }, 'Claude Code'])).toEqual([
      'Cursor',
      'MCP',
      'Claude Code',
    ]);
  });
});
