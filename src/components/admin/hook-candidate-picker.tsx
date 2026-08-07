'use client';

/**
 * Lets an editor click a generated hook candidate to load it straight into
 * the "Post copy" textarea of the surrounding channel panel, instead of
 * hand-retyping the one they liked. The candidates render in a sibling
 * <aside>, not inside the <form> itself (see weekly-workspace.tsx's
 * SocialPanel), so this reaches the textarea via the shared
 * `data-social-panel` ancestor rather than React state.
 */
export function HookCandidatePicker({ candidates }: { candidates: string[] }) {
  if (!candidates.length) return null;

  return (
    <details className="mt-4 border-t border-white/8 pt-3" open>
      <summary className="cursor-pointer text-xs font-bold text-cyan-200">
        Compare {candidates.length} generated hooks — click to use
      </summary>
      <ol className="mt-3 grid gap-2 text-xs leading-5 text-slate-400">
        {candidates.map((candidate, index) => (
          <li key={`hook-${index}`}>
            <button
              type="button"
              className="w-full rounded-lg bg-black/20 p-2 text-left transition hover:bg-black/35 hover:text-slate-200"
              onClick={(event) => {
                const panel = event.currentTarget.closest<HTMLElement>('[data-social-panel]');
                const textarea = panel?.querySelector<HTMLTextAreaElement>(
                  'textarea[name="post_text"]',
                );
                if (!textarea) return;
                textarea.value = candidate;
                textarea.focus();
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
