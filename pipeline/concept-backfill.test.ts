import { describe, expect, it } from 'vitest';
import {
  buildConceptPrompt,
  buildConceptRevisePrompt,
  buildConceptVerifyPrompt,
  parseConceptDrafts,
  parseConceptVerify,
  type ConceptDraft,
  type ConceptHubRow,
} from './concept-backfill';
import type { EnrichedSource } from './enrich';

const row = (over: Partial<ConceptHubRow> = {}): ConceptHubRow => ({
  slug: 'aider',
  name_en: 'Aider',
  name_uk: 'Aider',
  description_en: 'Terminal pair programming with LLMs',
  type: 'tool',
  official_url: 'https://aider.chat',
  aliases: ['aider-chat'],
  ...over,
});

const source = (over: Partial<EnrichedSource> = {}): EnrichedSource => ({
  ref: 1,
  url: 'https://aider.chat',
  text: 'Aider is AI pair programming in your terminal. It works with Claude and GPT models.',
  ogImage: null,
  comments: [],
  ...over,
});

const draft = (over: Partial<ConceptDraft> = {}): ConceptDraft => ({
  ref: 1,
  body_en: 'Aider is a terminal tool.\n\nUse it for repo-wide edits.',
  body_uk: 'Aider — термінальний інструмент.\n\nВикористовуйте для правок по репо.',
  faq_en: [{ q: 'Aider vs Cursor?', a: 'Terminal vs IDE.' }],
  faq_uk: [{ q: 'Aider чи Cursor?', a: 'Термінал проти IDE.' }],
  unsupported_claims: [],
  ...over,
});

describe('parseConceptDrafts', () => {
  it('parses valid drafts and trims fields', () => {
    const text = JSON.stringify({
      concepts: [
        {
          ref: 1,
          body_en: '  Body EN  ',
          body_uk: 'Body UK',
          faq_en: [{ q: ' Q1 ', a: ' A1 ' }],
          faq_uk: [{ q: 'Q1u', a: 'A1u' }],
        },
      ],
    });
    const drafts = parseConceptDrafts(text, 3);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.body_en).toBe('Body EN');
    expect(drafts[0]!.faq_en).toEqual([{ q: 'Q1', a: 'A1' }]);
    expect(drafts[0]!.unsupported_claims).toEqual([]);
  });

  it('falls back body_uk → body_en and caps FAQ at 3 entries', () => {
    const faq = Array.from({ length: 5 }, (_, i) => ({ q: `Q${i}`, a: `A${i}` }));
    const text = JSON.stringify({
      concepts: [{ ref: 2, body_en: 'EN only', body_uk: '', faq_en: faq, faq_uk: faq }],
    });
    const [d] = parseConceptDrafts(text, 3);
    expect(d!.body_uk).toBe('EN only');
    expect(d!.faq_en).toHaveLength(3);
  });

  it('drops refs outside the batch, empty bodies and malformed entries', () => {
    const text = JSON.stringify({
      concepts: [
        { ref: 9, body_en: 'out of range', body_uk: '', faq_en: [], faq_uk: [] },
        { ref: 1, body_en: '', body_uk: 'no EN body', faq_en: [], faq_uk: [] },
        { ref: '2', body_en: 'string ref is coerced', body_uk: '', faq_en: [], faq_uk: [] },
        'not-an-object',
        { ref: 3, body_en: 'bad faq shapes', body_uk: '', faq_en: [{ q: 1, a: null }, 'x'], faq_uk: null },
      ],
    });
    const drafts = parseConceptDrafts(text, 3);
    expect(drafts.map((d) => d.ref)).toEqual([2, 3]);
    expect(drafts[1]!.faq_en).toEqual([]);
  });

  it('returns [] when the payload has no concepts array', () => {
    expect(parseConceptDrafts('{"nope":true}', 3)).toEqual([]);
  });
});

describe('buildConceptPrompt', () => {
  it('injects source text for enriched refs and the conservative rule otherwise', () => {
    const prompt = buildConceptPrompt([row(), row({ slug: 'vibe', name_en: 'Vibe Coding', official_url: null, aliases: null, description_en: null })], [source()]);
    expect(prompt).toContain('[1] NAME: Aider');
    expect(prompt).toContain('AI pair programming in your terminal');
    expect(prompt).toContain('ALIASES: aider-chat');
    expect(prompt).toContain('[2] NAME: Vibe Coding');
    expect(prompt).toContain('unavailable — write from well-established general knowledge');
    expect(prompt).not.toContain('SHORT DESCRIPTION:  ');
  });
});

describe('buildConceptVerifyPrompt', () => {
  it('lists body, faq and the matching source per ref', () => {
    const prompt = buildConceptVerifyPrompt([
      { draft: draft(), name: 'Aider', sourceText: 'Official text here.' },
      { draft: draft({ ref: 2, faq_en: [] }), name: 'Cursor', sourceText: 'Cursor docs.' },
    ]);
    expect(prompt).toContain('[1] CONCEPT: Aider');
    expect(prompt).toContain('Q: Aider vs Cursor?');
    expect(prompt).toContain('--- [1] ---\nOfficial text here.');
    expect(prompt).toContain('--- [2] ---\nCursor docs.');
  });
});

describe('parseConceptVerify', () => {
  it('maps refs to trimmed claims and drops hallucinated refs', () => {
    const text = JSON.stringify({
      results: [
        { ref: 1, unsupported_claims: ['  invented price  ', ''] },
        { ref: 7, unsupported_claims: ['ghost'] },
        { ref: 2, unsupported_claims: 'not-an-array' },
      ],
    });
    const map = parseConceptVerify(text, new Set([1, 2]));
    expect(map.get(1)).toEqual(['invented price']);
    expect(map.get(2)).toEqual([]);
    expect(map.has(7)).toBe(false);
  });

  it('returns an empty map for a payload without results', () => {
    expect(parseConceptVerify('{}', new Set([1])).size).toBe(0);
  });
});

describe('buildConceptRevisePrompt', () => {
  it('includes the flagged claims and the official text per ref', () => {
    const flagged = [
      { draft: draft({ unsupported_claims: ['invented limit of 5 files'] }), row: row() },
    ];
    const prompt = buildConceptRevisePrompt(flagged, [source()]);
    expect(prompt).toContain('- invented limit of 5 files');
    expect(prompt).toContain('AI pair programming in your terminal');
  });

  it('marks the source unavailable when enrichment has no text', () => {
    const flagged = [{ draft: draft({ unsupported_claims: ['x'] }), row: row() }];
    const prompt = buildConceptRevisePrompt(flagged, [source({ text: null })]);
    expect(prompt).toContain('OFFICIAL PAGE TEXT:\n(unavailable)');
  });
});
