'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { addToast, dismissToast, type Toast, type ToastInput } from '@/lib/ui/toast-store';

interface ToastApi {
  toast: (input: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_CLASS: Record<Toast['tone'], string> = {
  info: 'border-line',
  success: 'border-success',
  error: 'border-error',
};

function ToastItem({ toast, onDismiss, dismissLabel }: { toast: Toast; onDismiss: () => void; dismissLabel: string }) {
  const [paused, setPaused] = useState(false);

  // Auto-dismiss pauses while hovered or focused (WCAG 2.2.1 timing adjustable).
  useEffect(() => {
    if (toast.duration === 0 || paused) return undefined;
    const t = setTimeout(onDismiss, toast.duration);
    return () => clearTimeout(t);
  }, [toast.duration, paused, onDismiss]);

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`bg-raised text-text rounded-card pointer-events-auto flex items-start gap-3 border py-3 pr-2 pl-4 text-sm shadow-[var(--shadow-pop)] ${TONE_CLASS[toast.tone]}`}
    >
      <p className="m-0 flex-1 py-2">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={dismissLabel}
        className="text-muted hover:text-text inline-flex size-[44px] shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

export interface ToastProviderProps {
  children: ReactNode;
  /** Localised accessible name for the close button. */
  dismissLabel?: string;
}

/** Mount once near the root. `useToast().toast({ message, tone })` from any client component. */
export function ToastProvider({ children, dismissLabel = 'Dismiss notification' }: ToastProviderProps) {
  const [queue, setQueue] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    setQueue((q) => addToast(q, input, id));
    return id;
  }, []);
  const dismiss = useCallback((id: number) => setQueue((q) => dismissToast(q, id)), []);
  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[var(--z-toast)] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-4 sm:w-96"
      >
        {queue.map((t) => (
          <ToastItem key={t.id} toast={t} dismissLabel={dismissLabel} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
