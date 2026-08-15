'use client';

import { useState, type ReactNode } from 'react';
import { ActionSubmitButton } from '@/components/admin/action-submit-button';
import { saveWeeklyOwnerFeedbackAction } from '@/app/admin/(cms)/weekly/actions';
import {
  STORY_IMAGE_SLOT_LABEL,
  storyPromptCopyTargets,
  type StoryImageSlotState,
  type StoryPromptCard,
  type StoryPromptCopyKind,
} from '@/lib/weekly-digest/story-prompt-set';
import {
  OWNER_FEEDBACK_REASON_TAGS,
  OWNER_FEEDBACK_VERDICTS,
  OWNER_FEEDBACK_VERDICT_LABEL_UK,
  type OwnerConceptFeedback,
  type OwnerFeedbackMap,
} from '@/lib/weekly-digest/owner-feedback';

const PANEL = 'rounded-2xl border border-white/10 bg-[#151b20] p-5';
const COPY_BTN =
  'min-h-11 rounded-xl border border-white/15 px-3 text-xs font-bold text-slate-200 transition hover:border-white/30 hover:bg-white/[.04] disabled:opacity-50';
const SAVE_BTN =
  'min-h-11 rounded-xl bg-[#47e4d3] px-4 text-sm font-bold text-[#08211f] transition hover:bg-[#75eee2]';

export function StoryPromptSetPanel({
  itemId,
  prompts,
  policy,
  generatedAt,
  slotState,
  readinessLabel,
  readinessDetail,
  weeklyDigestId,
  promptSetArtifactId,
  imageArtifactId,
  ownerFeedback = {},
  mappingGateIssues = [],
  canEdit = false,
  children,
}: {
  itemId: string;
  prompts: StoryPromptCard[];
  policy: string | null;
  generatedAt: string | null;
  slotState: StoryImageSlotState;
  readinessLabel?: string;
  readinessDetail?: string;
  weeklyDigestId?: string;
  promptSetArtifactId?: string | null;
  imageArtifactId?: string | null;
  ownerFeedback?: OwnerFeedbackMap;
  /** Why every concept failed the mapping gate, when `prompts` is empty (R1.2). */
  mappingGateIssues?: string[];
  canEdit?: boolean;
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
          {readinessLabel ? (
            <p className="mt-2 text-xs font-bold text-cyan-100/90">
              {readinessLabel}
              {readinessDetail ? ` · ${readinessDetail}` : ''}
            </p>
          ) : null}
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
        <p
          className="rounded-xl border border-dashed border-white/15 px-3 py-4 text-sm text-slate-500"
          data-testid="story-prompt-set-empty"
        >
          {mappingGateIssues.length > 0 ? (
            <>
              Every concept failed the mapping gate:{' '}
              <span className="text-slate-300">
                {mappingGateIssues.map((issue) => issue.replaceAll('_', ' ')).join(', ')}
              </span>
              . You can still upload an image now.
            </>
          ) : (
            <>
              Prompts appear after the story illustration job succeeds. You can still upload an
              image now.
            </>
          )}
        </p>
      ) : (
        <div className="grid gap-3">
          {prompts.map((prompt, index) => (
            <PromptCard
              key={`${prompt.conceptLens}-${index}`}
              prompt={prompt}
              index={index}
              weeklyDigestId={weeklyDigestId}
              promptSetArtifactId={promptSetArtifactId}
              imageArtifactId={imageArtifactId}
              feedback={ownerFeedback[prompt.conceptLens]}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
      <div data-testid="story-image-upload-slot">{children}</div>
    </div>
  );
}

function PromptCard({
  prompt,
  index,
  weeklyDigestId,
  promptSetArtifactId,
  imageArtifactId,
  feedback,
  canEdit,
}: {
  prompt: StoryPromptCard;
  index: number;
  weeklyDigestId?: string;
  promptSetArtifactId?: string | null;
  imageArtifactId?: string | null;
  feedback?: OwnerConceptFeedback;
  canEdit: boolean;
}) {
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
      {weeklyDigestId && promptSetArtifactId ? (
        <OwnerFeedbackForm
          weeklyDigestId={weeklyDigestId}
          promptSetArtifactId={promptSetArtifactId}
          imageArtifactId={imageArtifactId}
          prompt={prompt}
          feedback={feedback}
          canEdit={canEdit}
        />
      ) : null}
    </article>
  );
}

function OwnerFeedbackForm({
  weeklyDigestId,
  promptSetArtifactId,
  imageArtifactId,
  prompt,
  feedback,
  canEdit,
}: {
  weeklyDigestId: string;
  promptSetArtifactId: string;
  imageArtifactId?: string | null;
  prompt: StoryPromptCard;
  feedback?: OwnerConceptFeedback;
  canEdit: boolean;
}) {
  const savedLabel = feedback
    ? OWNER_FEEDBACK_VERDICT_LABEL_UK[feedback.verdict]
    : 'немає вердикту';
  return (
    <form
      action={saveWeeklyOwnerFeedbackAction}
      className="grid gap-2 border-t border-white/8 pt-3"
      data-testid="owner-feedback-form"
    >
      <input type="hidden" name="weekly_digest_id" value={weeklyDigestId} />
      <input type="hidden" name="prompt_set_artifact_id" value={promptSetArtifactId} />
      {imageArtifactId ? (
        <input type="hidden" name="image_artifact_id" value={imageArtifactId} />
      ) : null}
      <input type="hidden" name="concept_lens" value={prompt.conceptLens} />
      <input type="hidden" name="prompt_title" value={prompt.title} />
      <input type="hidden" name="canonical" value={prompt.canonical} />
      <p className="text-xs font-bold text-slate-300">
        Вердикт концепту · {savedLabel}
        {feedback?.reasonTags.length ? ` · ${feedback.reasonTags.join(', ')}` : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        {OWNER_FEEDBACK_VERDICTS.map((verdict) => (
          <label
            key={verdict}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-white/12 px-3 text-xs font-bold text-slate-200"
          >
            <input
              type="radio"
              name="verdict"
              value={verdict}
              defaultChecked={feedback?.verdict === verdict}
              required
              disabled={!canEdit}
            />
            {OWNER_FEEDBACK_VERDICT_LABEL_UK[verdict]}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {OWNER_FEEDBACK_REASON_TAGS.map((tag) => (
          <label
            key={tag}
            className="flex items-center gap-1.5 rounded-lg border border-white/8 px-2 py-1 text-[11px] text-slate-400"
          >
            <input
              type="checkbox"
              name="reason_tag"
              value={tag}
              defaultChecked={feedback?.reasonTags.includes(tag)}
              disabled={!canEdit}
            />
            {tag.replaceAll('_', ' ')}
          </label>
        ))}
      </div>
      <ActionSubmitButton
        idleLabel="Зберегти вердикт"
        pendingLabel="Saving…"
        disabled={!canEdit}
        className={SAVE_BTN}
      />
    </form>
  );
}
