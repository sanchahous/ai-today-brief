import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { BriefItemDetail } from '@/lib/items';
import { getStrings } from '@/lib/i18n';
import { selectStorySections } from '@/lib/story-sections';
import { StoryBody, type ToolLink } from './story-body';

const payload: Partial<BriefItemDetail> = {
  why: 'WHY_PAYLOAD',
  takeaways: ['TAKEAWAY_PAYLOAD'],
  facts: [{ label: 'FACT_LABEL', value: 'FACT_VALUE' }],
  bodyMd: 'BODY_PAYLOAD',
  deepDive: 'LEGACY_PAYLOAD',
  codeSnippet: { language: 'shell', code: 'CODE_PAYLOAD' },
  whenToUse: ['USE_PAYLOAD'],
  whenNotToUse: ['AVOID_PAYLOAD'],
  actionItems: ['ACTION_PAYLOAD'],
  editorTake: 'EDITOR_PAYLOAD',
  communityReactions: [
    { author: 'AUTHOR_PAYLOAD', quote: 'QUOTE_PAYLOAD', url: 'https://example.org/comment' },
  ],
  citations: [{ title: 'SOURCE_PAYLOAD', url: 'https://example.org/source' }],
};
const tools: ToolLink[] = [{ name: 'CONCEPT_PAYLOAD', href: '/en/concepts/mcp' }];

function render(detail: Partial<BriefItemDetail>, lang: 'en' | 'uk', toolLinks: ToolLink[] = []) {
  return renderToStaticMarkup(createElement(StoryBody, { detail, lang, toolLinks }));
}

describe.each(['en', 'uk'] as const)('article payload sections (%s)', (lang) => {
  const t = getStrings(lang);
  const cases = [
    ['why', t.whyItMatters],
    ['takeaways', t.tldrLabel],
    ['facts', t.factsTitle],
    ['codeSnippet', t.tryItTitle],
    ['whenToUse', t.whenToUseTitle],
    ['whenNotToUse', t.whenNotToUseTitle],
    ['actionItems', t.actionItemsToday],
    ['editorTake', t.editorTakeTitle],
    ['communityReactions', t.communityTitle],
    ['citations', t.sourcesTitle],
  ] as const;

  it.each(cases)(
    'omitting %s removes its heading and section from rendered HTML',
    (field, title) => {
      const detail = { ...payload };
      const heading = renderToStaticMarkup(createElement('span', null, title)).slice(6, -7);
      expect(render(detail, lang)).toContain(heading);
      delete detail[field];
      expect(selectStorySections(detail)[field]).toBe(false);
      expect(render(detail, lang)).not.toContain(heading);
    },
  );

  it('renders no headings or content for an empty payload', () => {
    expect(render({}, lang)).toBe('<div></div>');
    expect(
      render(
        {
          why: '  ',
          bodyMd: '\n',
          deepDive: ' ',
          editorTake: ' ',
          codeSnippet: { language: 'sh', code: '' },
        },
        lang,
      ),
    ).toBe('<div></div>');
    expect(Object.values(selectStorySections({})).every((value) => !value)).toBe(true);
  });

  it('keeps production section order and prefers markdown over legacy text', () => {
    const html = render(payload, lang, tools);
    const markers = [
      'WHY',
      'TAKEAWAY',
      'FACT_VALUE',
      'BODY',
      'CODE',
      'USE',
      'AVOID',
      'ACTION',
      'EDITOR',
      'QUOTE',
      'CONCEPT',
      'SOURCE',
    ].map((marker) => (marker === 'FACT_VALUE' ? marker : `${marker}_PAYLOAD`));
    const offsets = markers.map((marker) => html.indexOf(marker));
    expect(offsets.every((offset) => offset >= 0)).toBe(true);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    expect(html).not.toContain('LEGACY_PAYLOAD');
    expect(html).toContain('href="/en/concepts/mcp"');
    expect(render({ deepDive: 'LEGACY_PAYLOAD' }, lang)).toContain('LEGACY_PAYLOAD');
  });

  it('omits tools with no payload and does not invent concept links', () => {
    expect(selectStorySections({}, 0).tools).toBe(false);
    expect(selectStorySections({}, 1).tools).toBe(true);
    expect(render({}, lang, [{ name: 'Unmapped tool', href: null }])).not.toContain('<a');
  });

  it('draws charts and a process diagram only from values present in the story', () => {
    const html = render(
      {
        facts: [
          { label: 'Input price', value: '$3 / 1M tokens' },
          { label: 'Output price', value: '$15 / 1M tokens' },
          { label: 'Context', value: '200K tokens' },
        ],
        actionItems: ['Read the changelog', 'Try one task'],
      },
      lang,
    );
    const source = lang === 'uk' ? 'Джерело: Ключові факти' : 'Source: Key facts';
    expect(html).toContain('data-chart="comparison"');
    expect(html).toContain('data-chart="key-numbers"');
    expect(html).toContain(source);
    expect(html).toContain('$3 / 1M tokens');
    expect(html).toContain('$15 / 1M tokens');
    expect(html).toContain('200K tokens');
    expect(html).not.toContain('200000');
    expect(html.replace(/\sstyle="[^"]*"/g, '')).not.toContain('20%');
    expect(html).toContain('data-diagram="process"');
    expect(html).toContain('flex-col');
    expect(html).toContain('md:flex-row');
    expect(html).toContain('Read the changelog');
    expect(html).toContain(
      lang === 'uk'
        ? 'Назви кроків узяті з блоку «Що зробити сьогодні».'
        : 'Step names are taken from What to do today.',
    );

    const prose = render(
      {
        facts: [
          { label: 'License', value: 'Apache-2.0' },
          { label: 'Status', value: 'generally available' },
        ],
        actionItems: ['Only one step'],
      },
      lang,
    );
    expect(prose).not.toContain('data-chart');
    expect(prose).not.toContain('data-diagram');
    expect(prose).toContain('Apache-2.0');
    expect(prose).toContain('Only one step');
  });

  it('renders safe tables and keyboard-scrollable code regions', () => {
    const html = render(
      {
        bodyMd:
          '| Name | Value |\n| --- | --- |\n| **Model** | <script> |\n\n```sh\necho test\n```',
      },
      lang,
    );
    expect(html).toContain('<table');
    expect(html).toContain('scope="col"');
    expect(html).toContain('&lt;script&gt;');
    expect(html.match(/tabindex="0"/g)).toHaveLength(2);
    expect(html.match(/overflow-x-auto/g)).toHaveLength(2);
  });
});
