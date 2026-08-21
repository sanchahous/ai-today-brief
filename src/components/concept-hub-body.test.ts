import { describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';
import { linkConceptMentions, type MentionableConcept } from './concept-hub-body';

const concepts: MentionableConcept[] = [
  { name: 'Model Context Protocol', slug: 'mcp' },
  { name: 'MCP', slug: 'mcp' },
  { name: 'RAG', slug: 'rag' },
];

function hrefs(nodes: ReturnType<typeof linkConceptMentions>): string[] {
  return nodes
    .filter((n): n is ReactElement => typeof n === 'object' && n !== null && 'props' in n)
    .map((el) => String((el.props as { href: string }).href));
}

describe('linkConceptMentions', () => {
  it('links a concept mention to its internal hub path', () => {
    const nodes = linkConceptMentions('RAG pipelines ground answers in sources.', 'en', concepts);
    expect(hrefs(nodes)).toEqual(['/en/concepts/rag']);
  });

  it('prefers the longest name so MCP does not shadow the full phrase', () => {
    const nodes = linkConceptMentions(
      'The Model Context Protocol standardizes tool calls.',
      'en',
      concepts,
    );
    // Same slug as the "MCP" alias → linked once, and the linked text is the
    // full phrase (proves MCP did not consume part of it).
    expect(hrefs(nodes)).toEqual(['/en/concepts/mcp']);
    const linkedText = nodes
      .filter((n): n is ReactElement => typeof n === 'object' && n !== null && 'props' in n)
      .map((el) => String((el.props as { children: unknown }).children))
      .join('');
    expect(linkedText).toBe('Model Context Protocol');
  });

  it('links each concept at most once per paragraph', () => {
    const nodes = linkConceptMentions('RAG here. RAG again.', 'en', concepts);
    expect(hrefs(nodes)).toHaveLength(1);
  });

  it('does not match inside a longer word', () => {
    const nodes = linkConceptMentions('The SCRAPED data was useless.', 'en', concepts);
    expect(hrefs(nodes)).toEqual([]);
  });

  it('never emits an external or non-concept href', () => {
    const nodes = linkConceptMentions('RAG and MCP and Model Context Protocol.', 'uk', concepts);
    for (const href of hrefs(nodes)) {
      expect(href).toMatch(/^\/(en|uk)\/concepts\/[\w-]+$/);
    }
  });

  it('returns the paragraph unchanged when no concepts match', () => {
    const nodes = linkConceptMentions('Plain text with no mentions.', 'en', concepts);
    expect(nodes).toEqual(['Plain text with no mentions.']);
  });
});
