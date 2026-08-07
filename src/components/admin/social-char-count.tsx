'use client';

import { useEffect, useState } from 'react';

/**
 * Live character count for a social post textarea, driven by a plain DOM
 * `input` listener rather than lifting the textarea into React state -- the
 * textarea stays an uncontrolled field (matches the rest of this form) and
 * HookCandidatePicker already mutates it directly via the DOM, dispatching
 * an `input` event this listener picks up. Previously this was a static
 * span computed once from the server-rendered post_text, so it never
 * reflected typing or a clicked hook candidate.
 */
export function SocialCharCount({
  id,
  textareaId,
  limit,
  initialLength,
}: {
  id: string;
  textareaId: string;
  limit: number;
  initialLength: number;
}) {
  const [length, setLength] = useState(initialLength);

  useEffect(() => {
    const textarea = document.getElementById(textareaId);
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    const update = () => setLength(textarea.value.length);
    update();
    textarea.addEventListener('input', update);
    return () => textarea.removeEventListener('input', update);
  }, [textareaId]);

  const over = length > limit;
  return (
    <span id={id} className={`text-xs font-normal ${over ? 'font-bold text-red-300' : 'text-slate-500'}`}>
      Current: {length.toLocaleString()} / {limit.toLocaleString()} characters
      {over ? ' — over limit' : ''}
    </span>
  );
}
