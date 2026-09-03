import { asSocialClickUrl, firstHttpUrl } from './tracked-url';

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 256;

function clipPlain(value: string, maximum: number): string {
  const chars = [...value.replace(/\s+/g, ' ').trim()];
  if (chars.length <= maximum) return chars.join('');
  const budget = Math.max(1, maximum);
  let sliced = chars.slice(0, budget).join('');
  const lastSpace = sliced.lastIndexOf(' ');
  if (lastSpace > Math.floor(budget * 0.5)) sliced = sliced.slice(0, lastSpace);
  return sliced.trimEnd();
}

export function compactLinkedInComment(comment: string): string {
  const url = firstHttpUrl(comment);
  if (!url) return comment.trim();
  const compact = asSocialClickUrl(url);
  const lead = comment
    .replace(url, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*$/g, '')
    .trim();
  if (!lead) return compact;
  return `${lead}\n\n${compact}`;
}

export function linkedInArticleContent(input: {
  text: string;
  firstComment: string | null;
  thumbnail?: string | null;
}): {
  article: { source: string; title: string; description: string; thumbnail?: string };
} | null {
  const raw = firstHttpUrl(input.firstComment ?? '');
  if (!raw) return null;
  const titleSource =
    input.text.split('\n').find((line) => line.trim())?.trim() || 'AI Today Brief';
  const article: { source: string; title: string; description: string; thumbnail?: string } = {
    source: asSocialClickUrl(raw),
    title: clipPlain(titleSource, TITLE_MAX),
    description: clipPlain(input.text, DESCRIPTION_MAX),
  };
  if (input.thumbnail) article.thumbnail = input.thumbnail;
  return { article };
}
