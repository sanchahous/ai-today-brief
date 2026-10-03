'use client';

import { useState } from 'react';
import type { Lang } from '@/lib/site';
import {
  StoryCard,
  StoryRow,
  CategoryBanner,
  type StoryCardItem,
  type StoryCardLayout,
} from '@/components/editorial';

const SAMPLE_EN_WITH_IMAGE: StoryCardItem = {
  id: 'claude-code-subagent-memory-isolation-en',
  href: '/en/news/agents-and-mcp/claude-code-subagent-memory-isolation',
  title:
    'Claude Code Sub-Agents: Deep Architecture of Process Isolation, Tool Delegation, and Deterministic Reactive Context Wakeups Across Long-Running CLI Coding Sessions',
  summary:
    'Anthropic introduced sub-agents for Claude Code with isolated working context and reactive IPC wakeups, preventing memory pollution in terminal sessions.',
  date: '2026-10-03',
  categorySlug: 'agents-and-mcp',
  categoryName: 'Agents & MCP',
  categoryColor: null,
  readMinutes: 6,
  hasVideo: true,
  why: 'Sub-agents prevent memory pollution in long-running terminal coding sessions, dramatically reducing token churn while preserving parent context.',
  takeaways: [
    'Sub-agents run in separate conversations with isolated context windows.',
    'Tool delegation passes only required inputs and returns concise outputs.',
    'Reactive IPC wakeups eliminate wasteful polling loops.',
  ],
  imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
};

const SAMPLE_UK_WITH_IMAGE: StoryCardItem = {
  id: 'claude-code-subagent-memory-isolation-uk',
  href: '/uk/news/agents-and-mcp/claude-code-subagent-memory-isolation-uk',
  title:
    'Субагенти в Claude Code: глибока архітектура ізоляції процесів, делегування інструментів та реактивного відновлення контексту в тривалих термінальних сесіях розробки',
  summary:
    'Anthropic представила субагентів для Claude Code з ізольованим робочим простором та реактивними сповіщеннями, що усуває засмічення контексту.',
  date: '2026-10-03',
  categorySlug: 'agents-and-mcp',
  categoryName: 'Агенти та MCP',
  categoryColor: null,
  readMinutes: 6,
  hasVideo: true,
  why: 'Субагенти запобігають переповненню контексту у великих репозиторіях і тривалих термінальних сесіях, кардинально знижуючи витрати токенів.',
  takeaways: [
    'Субагенти виконуються в ізольованих гілках і діалогах.',
    'Делегування інструментів зберігає контекст батьківського агента чистим.',
    'Реактивні сигнали пробудження усувають циклічне опитування.',
  ],
  imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
};

const SAMPLE_EN_NO_IMAGE: StoryCardItem = {
  ...SAMPLE_EN_WITH_IMAGE,
  id: 'claude-code-subagent-no-image-en',
  imageUrl: null,
};

const SAMPLE_UK_NO_IMAGE: StoryCardItem = {
  ...SAMPLE_UK_WITH_IMAGE,
  id: 'claude-code-subagent-no-image-uk',
  imageUrl: null,
};

const LAYOUTS: readonly StoryCardLayout[] = ['standard', 'lead', 'row', 'withoutImage'] as const;

export function EditorialCatalog() {
  const [lang, setLang] = useState<Lang>('en');
  const [themeMode, setThemeMode] = useState<'both' | 'night' | 'day'>('both');
  const [imageMode, setImageMode] = useState<'banner' | 'withImage' | 'both'>('both');
  const [selectedLayout, setSelectedLayout] = useState<StoryCardLayout | 'all'>('all');

  const enItem = imageMode === 'withImage' ? SAMPLE_EN_WITH_IMAGE : SAMPLE_EN_NO_IMAGE;
  const ukItem = imageMode === 'withImage' ? SAMPLE_UK_WITH_IMAGE : SAMPLE_UK_NO_IMAGE;

  function renderCards(currentLang: Lang, itemToUse: StoryCardItem) {
    const layoutsToRender = selectedLayout === 'all' ? LAYOUTS : [selectedLayout];

    return (
      <div className="space-y-6">
        {layoutsToRender.map((layout) => (
          <div key={`${currentLang}-${layout}`} className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-muted">
              <span>
                variant = <strong>{layout}</strong> · lang = {currentLang} · 3+ lines title
              </span>
              <span>{itemToUse.imageUrl && layout !== 'withoutImage' ? 'with image' : 'CategoryBanner fallback'}</span>
            </div>
            {layout === 'row' ? (
              <StoryRow item={itemToUse} rank={1} lang={currentLang} showSave />
            ) : (
              <StoryCard item={itemToUse} layout={layout} lang={currentLang} showSave />
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderThemeBox(theme: 'night' | 'day') {
    const isDay = theme === 'day';
    const currentItem = lang === 'uk' ? ukItem : enItem;

    return (
      <div
        data-theme={theme}
        className={`rounded-card border border-border p-6 transition-colors ${
          isDay ? 'theme-light bg-bg text-text' : 'bg-bg text-text'
        }`}
      >
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-serif text-lg font-semibold capitalize">
            {theme} Theme {isDay ? '☀ (Day / .theme-light)' : '☾ (Night / Brand default)'}
          </h3>
          <span className="text-xs font-mono text-muted">WCAG AA Verified</span>
        </div>
        {renderCards(lang, currentItem)}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Language:</span>
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium transition ${
              lang === 'en'
                ? 'border-transparent bg-accent-fill text-on-accent'
                : 'border-border text-muted hover:text-text'
            }`}
          >
            EN (English)
          </button>
          <button
            type="button"
            onClick={() => setLang('uk')}
            className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium transition ${
              lang === 'uk'
                ? 'border-transparent bg-accent-fill text-on-accent'
                : 'border-border text-muted hover:text-text'
            }`}
          >
            UK (Українська)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Theme:</span>
          {(['both', 'night', 'day'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setThemeMode(mode)}
              className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition ${
                themeMode === mode
                  ? 'border-transparent bg-accent-fill text-on-accent'
                  : 'border-border text-muted hover:text-text'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Variant:</span>
          <button
            type="button"
            onClick={() => setSelectedLayout('all')}
            className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium transition ${
              selectedLayout === 'all'
                ? 'border-transparent bg-accent-fill text-on-accent'
                : 'border-border text-muted hover:text-text'
            }`}
          >
            All 4
          </button>
          {LAYOUTS.map((layout) => (
            <button
              key={layout}
              type="button"
              onClick={() => setSelectedLayout(layout)}
              className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                selectedLayout === layout
                  ? 'border-transparent bg-accent-fill text-on-accent'
                  : 'border-border text-muted hover:text-text'
              }`}
            >
              {layout}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Media:</span>
          {(['banner', 'withImage', 'both'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setImageMode(m)}
              className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                imageMode === m
                  ? 'border-transparent bg-accent-fill text-on-accent'
                  : 'border-border text-muted hover:text-text'
              }`}
            >
              {m === 'banner' ? 'CategoryBanner (без зображення)' : m === 'withImage' ? 'With Image' : 'Both'}
            </button>
          ))}
        </div>
      </div>

      {/* CategoryBanner Showcase */}
      <div className="rounded-card border border-border bg-surface p-6">
        <h3 className="mb-2 font-serif text-lg">CategoryBanner — Deterministic Brass Grooves (Без зображення)</h3>
        <p className="mb-4 text-xs text-muted">
          Same story ID produces identical groove tilt, shift, and signal dot coordinates across renders.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <span className="text-2xs font-mono text-muted">variant=&quot;card&quot; (16/10) · tools</span>
            <CategoryBanner id="sample-tools-1" slug="tools-and-releases" name="Tools & Releases" />
          </div>
          <div className="space-y-1">
            <span className="text-2xs font-mono text-muted">variant=&quot;hero&quot; (16/7) · agents</span>
            <CategoryBanner id="sample-agents-2" slug="agents-and-mcp" name="Agents & MCP" variant="hero" hasVideo />
          </div>
          <div className="space-y-1">
            <span className="text-2xs font-mono text-muted">variant=&quot;thumb&quot; (1/1) · vibe</span>
            <CategoryBanner id="sample-vibe-3" slug="vibe-coding" name="Vibe Coding" variant="thumb" />
          </div>
        </div>
      </div>

      {/* Render Themes */}
      <div className="space-y-8">
        {(themeMode === 'both' || themeMode === 'night') && renderThemeBox('night')}
        {(themeMode === 'both' || themeMode === 'day') && renderThemeBox('day')}
      </div>
    </div>
  );
}
