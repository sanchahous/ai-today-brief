'use client';

import { useState, type ReactNode } from 'react';
import {
  STORY_IMAGE_SLOT_LABEL,
  storyPromptCopyTargets,
  type StoryImageSlotState,
  type StoryPromptCard,
  type StoryPromptCopyKind,
} from '@/lib/weekly-digest/story-prompt-set';

const PANEL = 'rounded-2xl border border-white/10 bg-[#151b20] p-5';
const COPY_BTN =
  'min-h-11 rounded-xl border border-white/15 px-3 text-xs font-bold text-slate-200 transition hover:border-white/30 hover:bg-white/[.04] disabled:opacity-50';

export function StoryPromptSetPanel({
  itemId,
  prompts,
  policy,
  generatedAt,
  slotState,
  children,
}: {
  itemId: string;
  prompts: StoryPromptCard[];
  policy: string | null;
  generatedAt: string | null;
  slotState: StoryImageSlotState;
  children?: ReactNode;
}) {
  return (
    <div className={`grid gap-4 ${PANEL}`} data-testid="story-prompt-set" data-item-id={itemId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-white">Copy-ready prompts</h3>
          <p className="mt-1 text-xs text-slate-400">
            Copy a concept, generate the image in your tool, then upload it here.
          </p>
        </div>
        <p
          className="rounded-full border border-white/12 px-3 py-1 text-xs font-bold text-cyan-100"
          data-testid="story-image-slot-state"
        >
          {STORY_IMAGE_SLOT_LABEL[slotState]}
        </p>
      </div>
      {policy ? (
        <p className="text-[11px] tracking-wide text-slate-500 uppercase">
          {policy}
          {generatedAt ? ` · ${generatedAt}` : ''}
        </p>
      ) : null}
      {prompts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 px-3 py-4 text-sm text-slate-500">
          Prompts appear after the story illustration job succeeds. You can still upload an image
          now.
        </p>
      ) : (
        <div className="grid gap-3">
          {prompts.map((prompt, index) => (
            <PromptCard key={`${prompt.conceptLens}-${index}`} prompt={prompt} index={index} />
          ))}
        </div>
      )}
      <div data-testid="story-image-upload-slot">{children}</div>
    </div>
  );
}

function PromptCard({ prompt, index }: { prompt: StoryPromptCard; index: number }) {
  const [copied, setCopied] = useState<StoryPromptCopyKind | null>(null);

  async function copy(kind: StoryPromptCopyKind, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <article
      className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
      data-testid="story-prompt-card"
    >
      <div>
        <p className="text-sm font-bold text-white">
          {index + 1}. {prompt.title}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {prompt.conceptLens.replaceAll('_', ' ')} · {prompt.grammar.replaceAll('_', ' ')} ·{' '}
          {prompt.aspectRatio}
        </p>
      </div>
      {prompt.notes.length ? (
        <ul className="grid gap-1 text-xs text-slate-400">
          {prompt.notes.map((note, noteIndex) => (
            <li key={`${noteIndex}-${note}`}>• {note}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {storyPromptCopyTargets(prompt).map((target) => (
          <button
            key={target.kind}
            type="button"
            className={COPY_BTN}
            data-testid={`story-prompt-copy-${target.kind}`}
            onClick={() => {
              void copy(target.kind, target.text);
            }}
          >
            {copied === target.kind ? 'Copied' : target.label}
          </button>
        ))}
      </div>
    </article>
  );
}
