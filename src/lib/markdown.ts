/**
 * Minimal markdown parser for the constrained subset our pipeline generates in
 * `body_md_*` (see pipeline/summarize.ts prompt): `###`/`####` headings,
 * paragraphs, `- ` bullet lists, fenced code blocks, and inline **bold**,
 * `code` and [text](url) links. Dependency-free on purpose — the input is our
 * own generated content, not arbitrary user markdown, and the renderer emits
 * React elements (never raw HTML), so there is no injection surface.
 */

export type MdInline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string };

export type MdBlock =
  | { kind: 'heading'; level: 3 | 4; inlines: MdInline[] }
  | { kind: 'paragraph'; inlines: MdInline[] }
  | { kind: 'list'; items: MdInline[][] }
  | { kind: 'codeBlock'; language: string; code: string };

const INLINE_TOKEN =
  /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*)|(\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;

/** Tokenize one line/segment into inline runs. */
export function parseInlines(text: string): MdInline[] {
  const out: MdInline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_TOKEN)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: 'text', text: text.slice(last, idx) });
    const token = m[0];
    if (token.startsWith('`')) {
      out.push({ kind: 'code', text: token.slice(1, -1) });
    } else if (token.startsWith('**')) {
      out.push({ kind: 'bold', text: token.slice(2, -2) });
    } else {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      if (link) out.push({ kind: 'link', text: link[1]!, href: link[2]! });
      else out.push({ kind: 'text', text: token });
    }
    last = idx + token.length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

export function parseMarkdown(md: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = md.replace(/\r\n/g, '\n').split('\n');

  let paragraph: string[] = [];
  let list: MdInline[][] | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    blocks.push({ kind: 'paragraph', inlines: parseInlines(paragraph.join(' ').trim()) });
    paragraph = [];
  };
  const flushList = (): void => {
    if (!list || list.length === 0) {
      list = null;
      return;
    }
    blocks.push({ kind: 'list', items: list });
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    const fence = trimmed.match(/^```\s*(\S*)\s*$/);
    if (fence) {
      flushParagraph();
      flushList();
      const language = fence[1] || 'text';
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
        code.push(lines[i]!);
        i++;
      }
      blocks.push({ kind: 'codeBlock', language, code: code.join('\n').trimEnd() });
      continue;
    }

    const heading = trimmed.match(/^(#{3,4})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: 'heading',
        level: heading[1]!.length === 3 ? 3 : 4,
        inlines: parseInlines(heading[2]!),
      });
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      list ??= [];
      list.push(parseInlines(bullet[1]!));
      continue;
    }

    if (trimmed === '') {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks;
}

/** Plain-text projection (search snippets, schema articleBody, read time). */
export function markdownToPlainText(md: string): string {
  return parseMarkdown(md)
    .map((b) => {
      if (b.kind === 'codeBlock') return b.code;
      if (b.kind === 'list') {
        return b.items.map((item) => item.map((i) => i.text).join('')).join('\n');
      }
      return b.inlines.map((i) => i.text).join('');
    })
    .join('\n\n')
    .trim();
}
