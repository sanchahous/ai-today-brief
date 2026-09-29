export type ToastTone = 'info' | 'success' | 'error';

export interface ToastInput {
  message: string;
  tone?: ToastTone;
  /** ms; 0 keeps it until dismissed. Errors never auto-dismiss below 8s. */
  duration?: number;
  /** Same key replaces the visible toast instead of stacking. */
  dedupeKey?: string;
}

export interface Toast extends Required<Pick<ToastInput, 'message' | 'tone' | 'duration'>> {
  id: number;
  dedupeKey?: string;
}

export const MAX_VISIBLE_TOASTS = 3;
export const DEFAULT_TOAST_MS = 6000;
export const MIN_ERROR_TOAST_MS = 8000;

export function resolveDuration(tone: ToastTone, duration: number | undefined): number {
  const value = duration ?? DEFAULT_TOAST_MS;
  if (value === 0) return 0;
  return tone === 'error' ? Math.max(value, MIN_ERROR_TOAST_MS) : value;
}

export function addToast(queue: readonly Toast[], input: ToastInput, id: number): Toast[] {
  const tone = input.tone ?? 'info';
  const toast: Toast = {
    id,
    message: input.message,
    tone,
    duration: resolveDuration(tone, input.duration),
    dedupeKey: input.dedupeKey,
  };
  const rest = input.dedupeKey ? queue.filter((t) => t.dedupeKey !== input.dedupeKey) : [...queue];
  return [...rest, toast].slice(-MAX_VISIBLE_TOASTS);
}

export function dismissToast(queue: readonly Toast[], id: number): Toast[] {
  return queue.filter((t) => t.id !== id);
}
