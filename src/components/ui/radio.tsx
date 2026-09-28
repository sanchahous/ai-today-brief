'use client';

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

export interface RadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: string;
  badge?: ReactNode;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  {
    label,
    description,
    badge,
    id,
    checked,
    disabled,
    className = '',
    onChange,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const radioId = id ?? generatedId;

  return (
    <label
      htmlFor={radioId}
      className={`group relative flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5 transition select-none hover:bg-surface-2 ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${className}`}
    >
      <span className="relative flex size-5 shrink-0 items-center justify-center">
        <input
          ref={ref}
          id={radioId}
          type="radio"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="peer sr-only"
          {...props}
        />
        <span
          aria-hidden="true"
          className="border-border bg-surface peer-checked:border-accent peer-focus-visible:outline-accent flex size-5 items-center justify-center rounded-full border transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
        >
          {checked && (
            <span className="bg-accent size-2.5 rounded-full transition-transform" />
          )}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-text text-sm font-medium leading-snug">
          {label}
        </span>
        {description && (
          <span className="text-muted text-xs leading-normal">
            {description}
          </span>
        )}
      </span>
      {badge && <span className="ml-auto shrink-0">{badge}</span>}
    </label>
  );
});
