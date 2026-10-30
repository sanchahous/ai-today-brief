import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProcessDiagram } from './diagram-process';

const nodes = [
  { role: 'Host', title: 'The AI application', detail: 'Claude, an IDE, your app' },
  { role: 'Client', title: 'One connection per server', detail: 'JSON-RPC' },
  { role: 'Server', title: 'Tools, resources, prompts', detail: 'GitHub, a database, files' },
];

describe('ProcessDiagram', () => {
  it('stacks three named nodes with arrows and a Ukrainian caption', () => {
    const html = renderToStaticMarkup(
      createElement(ProcessDiagram, {
        lang: 'uk',
        nodes,
        caption: 'Назви кроків узяті з тексту концепту.',
      }),
    );
    expect(html).toContain('data-diagram="process"');
    expect(html).toContain('Як це працює');
    expect(html).toContain('Назви кроків узяті з тексту концепту.');
    expect(html).toContain('Host');
    expect(html).toContain('The AI application');
    expect(html).toContain('JSON-RPC');
    expect(html).toContain('flex-col');
    expect(html).toContain('md:flex-row');
    expect(html).toContain('rotate-90');
    expect(html).toContain('md:rotate-0');
    expect(html.match(/→/g)).toHaveLength(2);
    expect(html).toContain('data-terminal="true"');
    const described = /aria-describedby="([^"]+)"/.exec(html);
    expect(described?.[1]).toBeTruthy();
    expect(html).toContain('Host, The AI application, Claude, an IDE, your app');
  });

  it('renders nothing for a single step and does not invent step numbers', () => {
    const html = renderToStaticMarkup(
      createElement(ProcessDiagram, {
        lang: 'en',
        nodes: [{ title: 'Read the changelog' }],
        caption: 'Step names are taken from What to do today.',
      }),
    );
    expect(html).toBe('');

    const two = renderToStaticMarkup(
      createElement(ProcessDiagram, {
        lang: 'en',
        nodes: [{ title: 'Read the changelog' }, { title: 'Try one task' }],
        caption: 'Step names are taken from What to do today.',
      }),
    );
    expect(two).toContain('How it works');
    expect(two).not.toContain('>01<');
    expect(two).not.toContain('>1<');
  });
});
