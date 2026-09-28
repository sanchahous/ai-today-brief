'use client';

import { forwardRef, useId, type SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: SelectOption[];
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { label, options, error, id, className = '', children, ...props },
    ref,
  ) {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-muted text-xs font-medium">
            {label}
          </label>
        )}
        <div className="relative inline-flex w-full items-center">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? 'true' : undefined}
            className={`bg-surface border-border text-text min-h-[44px] w-full appearance-none rounded-lg border py-2 pl-3.5 pr-9 text-sm transition cursor-pointer focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              error ? 'border-error' : ''
            } ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="bg-surface text-text"
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <span
            aria-hidden="true"
            className="text-muted pointer-events-none absolute right-3 inline-flex items-center"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
        {error && (
          <p role="alert" className="text-error m-0 text-xs font-medium">
            {error}
          </p>
        )}
      </div>
    );
  },
);
