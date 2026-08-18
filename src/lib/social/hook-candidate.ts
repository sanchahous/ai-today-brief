import type { SocialChannel } from './types';
import { containsServiceMarkers, serviceMarkerIssueMessage } from './service-markers';

export type HookApplySuccess = {
  ok: true;
  postText: string;
  contentParts: string[];
  firstComment: string | null;
};

export type HookApplyFailure = {
  ok: false;
  reason: string;
};

export type HookApplyResult = HookApplySuccess | HookApplyFailure;

export type HookDraftState = {
  postText: string;
  contentParts: string[];
  firstComment: string | null;
};

function trimPart(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function parseThreadsParts(candidate: string): string[] | null {
  const parts = candidate
    .split(/\s*<PART>\s*/i)
    .map((part) => trimPart(part))
    .filter(Boolean);
  if (parts.length < 3 || parts.length > 5) return null;
  if (parts.some((part) => part.length > 500 || containsServiceMarkers(part))) return null;
  return parts;
}

export function applyHookCandidate(input: {
  channel: SocialChannel;
  candidate: string;
  current: HookDraftState;
}): HookApplyResult {
  const candidate = input.candidate.trim();
  if (!candidate) return { ok: false, reason: 'The selected hook is empty.' };

  if (input.channel === 'instagram') {
    return {
      ok: false,
      reason:
        'Instagram hooks are read-only. Changing the angle regenerates the 7-slide spec and images together.',
    };
  }

  if (input.channel === 'threads') {
    const parts = parseThreadsParts(candidate);
    if (!parts) {
      return {
        ok: false,
        reason:
          'Threads hooks must split into 3–5 non-empty parts of at most 500 characters, without truncating the candidate.',
      };
    }
    return {
      ok: true,
      postText: parts[0],
      contentParts: parts,
      firstComment: null,
    };
  }

  if (containsServiceMarkers(candidate)) {
    return { ok: false, reason: serviceMarkerIssueMessage() };
  }

  if (input.channel === 'x') {
    const reply = input.current.firstComment?.trim() || input.current.contentParts[1] || '';
    return {
      ok: true,
      postText: candidate,
      contentParts: [candidate, reply].filter(Boolean),
      firstComment: reply || null,
    };
  }

  return {
    ok: true,
    postText: candidate,
    contentParts: [],
    firstComment: input.current.firstComment,
  };
}
