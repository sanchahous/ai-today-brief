'use client';

import { useState, type CSSProperties } from 'react';
import type { Lang } from '@/lib/site';
import {
  TrustLabel,
  SourceList,
  Callout,
  ReadingLayout,
  TableOfContents,
  KeyFacts,
  Takeaways,
  WhenGrid,
  ActionList,
  CodeFigure,
  DataTable,
  Faq,
  RelatedContent,
  DigestCard,
  EditorialHero,
  SleeveArt,
  VideoFacade,
  SectionDivider,
  CodePanel,
} from '@/components/editorial';
import { MarkdownBody } from '@/components/markdown-body';
import { Byline } from '@/components/byline';
import { ItemShareBar } from '@/components/item-share-bar';

export function ArticlePatternsCatalog() {
  const [lang, setLang] = useState<Lang>('en');

  const tocItems = [
    { id: 'section-1', title: 'Why it matters', level: 2 },
    { id: 'section-2', title: 'Deep dive architecture', level: 2 },
    { id: 'section-2-1', title: 'Process isolation', level: 3 },
    { id: 'section-2-2', title: 'Tool delegation', level: 3 },
    { id: 'section-3', title: 'Key takeaways', level: 2 },
  ];

  const longText = lang === 'en' 
    ? 'The quick brown fox jumps over the lazy dog. This is a very long paragraph to demonstrate the measure limit in the reading layout. It should wrap nicely at around 60-75 characters to ensure optimal readability. Good typography is essential for a great reading experience, especially on long-form editorial content. Anthropic introduced sub-agents for Claude Code with isolated working context and reactive IPC wakeups, preventing memory pollution in terminal sessions.'
    : 'Швидка коричнева лисиця стрибає через лінивого собаку. Це дуже довгий абзац, щоб продемонструвати обмеження ширини рядка у макеті для читання. Він має гарно переноситися на рівні 60-75 символів для забезпечення оптимальної зручності читання. Хороша типографіка є важливою для чудового досвіду читання, особливо для довгих редакційних матеріалів. Anthropic представила субагентів для Claude Code з ізольованим робочим простором та реактивними сповіщеннями.';


  const accentSamples = [
    { name: 'agents', token: '--cat-agents' },
    { name: 'tools', token: '--cat-tools' },
    { name: 'cost', token: '--cat-cost' },
    { name: 'tutorials', token: '--cat-tutorials' },
    { name: 'creative', token: '--cat-creative' },
  ];
  const sampleMarkdown =
    lang === 'en'
      ? '### Why the schema moves into code\n\nOne **typed source of truth** replaces hand-written YAML. Read the [release notes](https://example.org) and call `Model.create!` directly.\n\n- Strict inputs for every endpoint\n- Generated SDKs that never drift\n\n| Tool | Context | Price |\n| --- | --- | --- |\n| Alpha | 200k | $3 |\n| Beta | 1M | $5 |\n\n```ruby\nclass AccountCreate < AbstractMethod\n  string :name\nend\n```\n\n### Rolling it out\n\n#### Start small\n\nPick one endpoint, ship it behind a flag and compare the generated spec.'
      : '### Чому схема переїжджає в код\n\nОдне **типізоване джерело правди** замінює ручні YAML. Прочитайте [нотатки до релізу](https://example.org) і викликайте `Model.create!` напряму.\n\n- Сувора валідація входів для кожного ендпоінта\n- Згенеровані SDK, що не розходяться зі схемою\n\n| Інструмент | Контекст | Ціна |\n| --- | --- | --- |\n| Альфа | 200k | $3 |\n| Бета | 1M | $5 |\n\n```ruby\nclass AccountCreate < AbstractMethod\n  string :name\nend\n```\n\n### Як запроваджувати\n\n#### Почніть із малого\n\nОберіть один ендпоінт, випустіть його за прапорцем і порівняйте згенеровану специфікацію.';

  return (
    <div className="space-y-12 mt-12 pt-12 border-t border-line reading">
      <div className="flex flex-wrap items-center gap-2 mb-8">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">Language for Patterns:</span>
        <button
          type="button"
          onClick={() => setLang('en')}
          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium transition ${
            lang === 'en' ? 'border-transparent bg-accent-fill text-on-accent' : 'border-line text-muted hover:text-text'
          }`}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => setLang('uk')}
          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium transition ${
            lang === 'uk' ? 'border-transparent bg-accent-fill text-on-accent' : 'border-line text-muted hover:text-text'
          }`}
        >
          UK
        </button>
      </div>

      <div className="space-y-4">
        <h3 className="font-serif text-lg">EditorialHero</h3>
        <EditorialHero
          level={2}
          eyebrow={lang === 'en' ? 'Feature' : 'Стаття'}
          title={lang === 'en' ? 'Claude Code Sub-Agents Architecture' : 'Архітектура субагентів у Claude Code'}
          dek={longText.slice(0, 150) + '...'}
          meta={
            <Byline 
              lang={lang} 
              initials="OK" 
              authorName="Oleksandr K" 
              role={lang === 'en' ? 'Editor' : 'Редактор'} 
              publishedAt="2026-10-04" 
              minutes={5} 
              hasAiDisclosure 
            />
          }
        />
      </div>

      <div className="reading prose max-w-none">
        <div className="space-y-4">
          <h3 className="font-serif text-lg mt-0">TrustLabel & AiDisclosureNote</h3>
          <div className="flex gap-4 flex-wrap not-prose">
            <TrustLabel lang={lang} level="verified" />
            <TrustLabel lang={lang} level="partially-verified" />
            <TrustLabel lang={lang} level="sponsored" />
            <TrustLabel lang={lang} level="ai-assisted" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-serif text-lg">ReadingLayout (TOC, Body, Tools)</h3>
        <div className="border border-line rounded-xl p-4 bg-surface">
          <ReadingLayout
            toc={<TableOfContents lang={lang} items={tocItems} />}
            content={
              <>
                <h2 id="section-1">Why it matters</h2>
                <p>{longText}</p>
                <Callout lang={lang} variant="why-it-matters">
                  {longText.slice(0, 100)}
                </Callout>
                
                <h2 id="section-2">Deep dive architecture</h2>
                <p>{longText}</p>
                
                <h3 id="section-2-1">Process isolation</h3>
                <CodeFigure
                  lang={lang}
                  language="typescript"
                  code={`function helloWorld() {\n  console.log("Hello");\n}\n\n// Very long line to trigger horizontal scrolling in the code block and verify that it does not overflow the page on small screens.\nhelloWorld();`}
                  caption="Example code block"
                />
                
                <h3 id="section-2-2">Tool delegation</h3>
                <DataTable title="Comparison Table" caption="A complex data table with horizontal scrolling">
                  <thead>
                    <tr>
                      <th className="p-2 border-b">Feature</th>
                      <th className="p-2 border-b">Claude Code</th>
                      <th className="p-2 border-b">Cursor</th>
                      <th className="p-2 border-b">Very Long Column Header To Trigger Scroll</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 border-b">Sub-agents</td>
                      <td className="p-2 border-b">Yes</td>
                      <td className="p-2 border-b">No</td>
                      <td className="p-2 border-b">Some extra data here to make the table wide enough</td>
                    </tr>
                  </tbody>
                </DataTable>
                
                <h2 id="section-3">Key takeaways</h2>
                <Takeaways lang={lang} items={[
                  'Sub-agents run in separate conversations with isolated context windows.',
                  'Tool delegation passes only required inputs and returns concise outputs.',
                  'Reactive IPC wakeups eliminate wasteful polling loops.'
                ]} />
              </>
            }
            tools={
              <div className="flex flex-col gap-4">
                <ItemShareBar lang={lang} pageUrl="/test" title="Test" postId="123" />
              </div>
            }
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-serif text-lg">Article accent system (per-category --article-accent)</h3>
        <p className="text-muted text-sm">
          Every block reads <code>--article-accent</code> from its article wrapper (the category colour) and falls back to
          the brand accent. Same markup, five categories.
        </p>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {accentSamples.map((sample) => (
            <div
              key={sample.name}
              className="border-line bg-bg rounded-xl border p-4 sm:p-5"
              style={{ '--article-accent': `var(${sample.token})` } as CSSProperties}
            >
              <p className="text-muted font-mono text-xs uppercase">{sample.name}</p>
              <Callout lang={lang} variant="why-it-matters" headingLevel={2}>
                <p className="m-0">{longText.slice(0, 120)}</p>
              </Callout>
              <Takeaways
                lang={lang}
                items={['Typed inputs replace YAML.', 'Generated SDKs stay in sync.', 'Roll out one endpoint first.']}
              />
              <KeyFacts
                lang={lang}
                facts={[
                  { term: 'Spec', definition: 'OpenAPI 3.1' },
                  { term: 'Language', definition: 'Ruby with Sorbet' },
                ]}
              />
              <MarkdownBody markdown={sampleMarkdown} lang={lang} />
              <SectionDivider />
              <CodePanel code={'npm run build'} language="shell" label="Code" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-serif text-lg">Various Callouts</h3>
        <Callout lang={lang} variant="definition">{longText}</Callout>
        <Callout lang={lang} variant="editor-take">{longText}</Callout>
        <Callout lang={lang} variant="limits">{longText}</Callout>
      </div>

      <div className="space-y-4">
        <h3 className="font-serif text-lg">KeyFacts</h3>
        <KeyFacts lang={lang} facts={[
          { term: 'Sub-agent', definition: 'An isolated AI process.' },
          { term: 'IPC', definition: 'Inter-process communication.' }
        ]} />
      </div>

      <div className="space-y-4">
        <h3 className="font-serif text-lg">WhenGrid</h3>
        <WhenGrid lang={lang} useCases={['Complex tasks', 'Large context']} avoidCases={['Simple queries', 'Fast responses']} />
      </div>

      <div className="space-y-4">
        <h3 className="font-serif text-lg">ActionList</h3>
        <ActionList lang={lang} items={[
          { id: '1', title: 'Update CLI', description: 'Run npm update to get the latest version', href: '#' },
          { id: '2', title: 'Check docs', description: 'Read the migration guide' }
        ]} />
      </div>

      <div className="space-y-4">
        <h3 className="font-serif text-lg">SourceList</h3>
        <SourceList lang={lang} sources={[
          { id: '1', author: 'Anthropic', title: 'Claude Code release notes', url: 'https://anthropic.com/news', date: '2026-10-01' }
        ]} />
      </div>

      <div className="space-y-4">
        <h3 className="font-serif text-lg">Faq</h3>
        <Faq lang={lang} items={[
          { id: '1', question: 'How to install?', answer: 'Use npm i -g @anthropic-ai/claude-code' },
          { id: '2', question: 'Is it free?', answer: 'Yes, but you pay for API usage.' }
        ]} />
      </div>

      <div className="space-y-4">
        <h3 className="font-serif text-lg">DigestCard</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DigestCard
            lang={lang}
            id="digest-daily-1"
            href="#"
            type="daily"
            date="2026-10-04"
            itemCount={12}
            minutes={5}
            isToday={true}
          />
          <DigestCard
            lang={lang}
            id="digest-weekly-1"
            href="#"
            type="weekly"
            date="2026-10-04"
            issueNumber={42}
            period="Sep 30 - Oct 4"
            thesis="The rise of sub-agents and tool delegation."
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-serif text-lg">VideoFacade</h3>
        <div className="max-w-[400px]">
          <VideoFacade
            lang={lang}
            videoId="dQw4w9WgXcQ"
            thumbnailUrl="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800"
            title="Video tutorial"
          />
        </div>
      </div>
      
      <div className="space-y-4">
        <h3 className="font-serif text-lg">RelatedContent</h3>
        <RelatedContent
          lang={lang}
          related={[
            {
              id: '1',
              href: '#',
              title: 'Previous deep dive on Cursor',
              summary: '',
              date: '2026-09-01',
              categorySlug: 'agents',
              categoryName: 'Agents',
              categoryColor: null,
              readMinutes: 5,
              hasVideo: false,
              why: '',
              takeaways: [],
              imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
            }
          ]}
          prev={{ title: 'Prev story', href: '#' }}
          next={{ title: 'Next story', href: '#' }}
        />
      </div>

    </div>
  );
}
