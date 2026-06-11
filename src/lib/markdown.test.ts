import { describe, expect, it } from 'vitest';
import { markdownToPlainText, parseInlines, parseMarkdown } from './markdown';

describe('parseInlines', () => {
  it('tokenizes bold, code and links between plain text', () => {
    const out = parseInlines('Run `npm i` then **restart** — see [docs](https://ex.com/docs).');
    expect(out).toEqual([
      { kind: 'text', text: 'Run ' },
      { kind: 'code', text: 'npm i' },
      { kind: 'text', text: ' then ' },
      { kind: 'bold', text: 'restart' },
      { kind: 'text', text: ' — see ' },
      { kind: 'link', text: 'docs', href: 'https://ex.com/docs' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('ignores non-http link targets', () => {
    const out = parseInlines('Click [here](javascript:alert(1)) now');
    expect(out).toEqual([{ kind: 'text', text: 'Click [here](javascript:alert(1)) now' }]);
  });

  it('returns one text run for plain input', () => {
    expect(parseInlines('plain sentence')).toEqual([{ kind: 'text', text: 'plain sentence' }]);
  });
});

describe('parseMarkdown', () => {
  it('parses the pipeline subset: headings, paragraphs, lists, fences', () => {
    const md = [
      '### Pricing',
      '',
      'Input costs **$5 / 1M tokens** via the `messages` API.',
      'Second sentence of the same paragraph.',
      '',
      '- First point',
      '- Second `coded` point',
      '',
      '```bash',
      'npm install -g claude',
      '```',
      '',
      '#### Caveats',
      'Limited rollout.',
    ].join('\n');

    const blocks = parseMarkdown(md);
    expect(blocks.map((b) => b.kind)).toEqual([
      'heading',
      'paragraph',
      'list',
      'codeBlock',
      'heading',
      'paragraph',
    ]);

    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 3 });
    expect(blocks[1]).toMatchObject({ kind: 'paragraph' });
    const para = blocks[1] as { inlines: Array<{ kind: string; text: string }> };
    expect(para.inlines.some((i) => i.kind === 'bold' && i.text === '$5 / 1M tokens')).toBe(true);
    // soft line break folds into one paragraph
    expect(para.inlines.at(-1)!.text).toContain('Second sentence');

    const list = blocks[2] as { items: unknown[] };
    expect(list.items).toHaveLength(2);

    expect(blocks[3]).toEqual({
      kind: 'codeBlock',
      language: 'bash',
      code: 'npm install -g claude',
    });
    expect(blocks[4]).toMatchObject({ kind: 'heading', level: 4 });
  });

  it('handles an unterminated fence and empty input', () => {
    expect(parseMarkdown('```\nconst a = 1;')).toEqual([
      { kind: 'codeBlock', language: 'text', code: 'const a = 1;' },
    ]);
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('\n\n')).toEqual([]);
  });

  it('separates a list from a following paragraph without a blank line', () => {
    const blocks = parseMarkdown('- one\n- two\nTail paragraph');
    expect(blocks.map((b) => b.kind)).toEqual(['list', 'paragraph']);
  });
});

describe('markdownToPlainText', () => {
  it('flattens blocks to plain text', () => {
    const text = markdownToPlainText(
      '### Head\n\nBody with **bold** and `code`.\n\n- a\n- b\n\n```js\nx()\n```',
    );
    expect(text).toBe('Head\n\nBody with bold and code.\n\na\nb\n\nx()');
  });
});
