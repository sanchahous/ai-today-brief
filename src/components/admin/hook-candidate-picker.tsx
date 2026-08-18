'use client';

import { useState } from 'react';
import { applyHookCandidate, type HookDraftState } from '@/lib/social/hook-candidate';
import type { SocialChannel } from '@/lib/social/types';

function readDraft(panel: HTMLElement): HookDraftState {
  const postText =
    panel.querySelector<HTMLTextAreaElement>('textarea[name="post_text"]')?.value ?? '';
  const firstComment =
    panel.querySelector<HTMLTextAreaElement>('textarea[name="first_comment"]')?.value ?? '';
  const parts = [1, 2, 3, 4, 5]
    .map((index) => panel.querySelector<HTMLTextAreaElement>(`textarea[name="content_part_${index}"]`)?.value ?? '')
    .map((value) => value.trim())
    .filter(Boolean);
  return { postText, firstComment: firstComment || null, contentParts: parts };
}

function writeDraft(panel: HTMLElement, next: HookDraftState) {
  const postText = panel.querySelector<HTMLTextAreaElement>('textarea[name="post_text"]');
  if (postText) {
    postText.value = next.postText;
    postText.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const firstComment = panel.querySelector<HTMLTextAreaElement>('textarea[name="first_comment"]');
  if (firstComment) {
    firstComment.value = next.firstComment ?? '';
    firstComment.dispatchEvent(new Event('input', { bubbles: true }));
  }
  for (let index = 1; index <= 5; index += 1) {
    const part = panel.querySelector<HTMLTextAreaElement>(`textarea[name="content_part_${index}"]`);
    if (!part) continue;
    part.value = next.contentParts[index - 1] ?? '';
    part.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

export function HookCandidatePicker({
  channel,
  candidates,
}: {
  channel: SocialChannel;
  candidates: string[];
}) {
  const [error, setError] = useState<string | null>(null);
  if (!candidates.length) return null;
  const readOnly = channel === 'instagram';

  return (
    <details className="mt-4 border-t border-white/8 pt-3" open>
      <summary className="cursor-pointer text-xs font-bold text-cyan-200">
        Compare {candidates.length} generated hooks{readOnly ? ' (read-only)' : ' — click to use'}
      </summary>
      {readOnly ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Instagram hooks stay read-only so caption and slides stay aligned. Changing the angle
          regenerates the 7-slide spec and images.
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs text-amber-200" data-hook-error="">
          {error}
        </p>
      ) : null}
      <ol className="mt-3 grid gap-2 text-xs leading-5 text-slate-400">
        {candidates.map((candidate, index) => (
          <li key={`hook-${index}`}>
            <button
              type="button"
              className="w-full rounded-lg bg-black/20 p-2 text-left transition hover:bg-black/35 hover:text-slate-200"
              onClick={(event) => {
                if (readOnly) {
                  setError(
                    'Instagram hooks are read-only. Regenerating social copy is required to change the angle.',
                  );
                  return;
                }
                const panel = event.currentTarget.closest<HTMLElement>('[data-social-panel]');
                if (!panel) return;
                const result = applyHookCandidate({
                  channel,
                  candidate,
                  current: readDraft(panel),
                });
                if (!result.ok) {
                  setError(result.reason);
                  return;
                }
                setError(null);
                writeDraft(panel, result);
                const focusTarget =
                  panel.querySelector<HTMLTextAreaElement>('textarea[name="content_part_1"]') ??
                  panel.querySelector<HTMLTextAreaElement>('textarea[name="post_text"]');
                focusTarget?.focus();
              }}
            >
              <span className="mr-2 font-bold text-slate-200">{index + 1}.</span>
              {candidate}
            </button>
          </li>
        ))}
      </ol>
    </details>
  );
}
