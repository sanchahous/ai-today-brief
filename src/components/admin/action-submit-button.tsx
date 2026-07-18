'use client';

import { useFormStatus } from 'react-dom';
import type { ButtonHTMLAttributes } from 'react';

type ActionSubmitButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'type'
> & {
  idleLabel: string;
  pendingLabel: string;
};

/**
 * Gives every CMS Server Action an immediate, accessible response. It must stay
 * inside the form that owns the action so useFormStatus observes that request.
 */
export function ActionSubmitButton({
  idleLabel,
  pendingLabel,
  disabled = false,
  className = '',
  ...props
}: ActionSubmitButtonProps) {
  const { pending } = useFormStatus();
  const unavailable = disabled || pending;

  return (
    <button
      {...props}
      type="submit"
      disabled={unavailable}
      aria-busy={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span
            aria-hidden="true"
            className="size-3 animate-spin rounded-full border-2 border-current border-r-transparent"
          />
          {pendingLabel}
        </span>
      ) : (
        idleLabel
      )}
    </button>
  );
}
