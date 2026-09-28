'use client';

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { CloseIcon, SearchIcon } from '@/components/icons';

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  onClear?: () => void;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput(
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      onClear,
      id,
      className = '',
      value,
      disabled,
      ...props
    },
    ref,
  ) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const showClear = onClear && value && !disabled;

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-muted text-xs font-medium">
            {label}
          </label>
        )}
        <div className="relative flex w-full items-center">
          {leftIcon && (
            <span
              aria-hidden="true"
              className="text-muted pointer-events-none absolute left-3 inline-flex shrink-0 items-center justify-center"
            >
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            value={value}
            disabled={disabled}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className={`bg-surface border-border text-text placeholder:text-muted/60 min-h-[44px] w-full rounded-lg border text-sm transition focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              leftIcon ? 'pl-9' : 'pl-3.5'
            } ${showClear || rightIcon ? 'pr-9' : 'pr-3.5'} ${
              error ? 'border-error' : ''
            } ${className}`}
            {...props}
          />
          {showClear ? (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear input"
              className="text-muted hover:text-text absolute right-2.5 inline-flex min-h-[44px] min-w-[32px] items-center justify-center"
            >
              <CloseIcon size={14} />
            </button>
          ) : (
            rightIcon && (
              <span
                aria-hidden="true"
                className="text-muted pointer-events-none absolute right-3 inline-flex shrink-0 items-center justify-center"
              >
                {rightIcon}
              </span>
            )
          )}
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-error m-0 text-xs font-medium">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={hintId} className="text-muted m-0 text-xs">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

export interface SearchInputProps
  extends Omit<TextInputProps, 'leftIcon' | 'type'> {
  placeholder?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    {
      placeholder = 'Search...',
      onClear,
      value,
      className = '',
      ...props
    },
    ref,
  ) {
    return (
      <TextInput
        ref={ref}
        type="search"
        leftIcon={<SearchIcon size={16} />}
        placeholder={placeholder}
        onClear={onClear}
        value={value}
        className={`pr-8 ${className}`}
        {...props}
      />
    );
  },
);
