'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  function ActionButton(
    {
      variant = 'secondary',
      size = 'md',
      pending = false,
      disabled = false,
      leftIcon,
      rightIcon,
      className = '',
      children,
      ...props
    },
    ref,
  ) {
    const isDisabled = disabled || pending;

    const baseClasses =
      'inline-flex items-center justify-center font-medium transition select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]';

    const sizeClasses: Record<ButtonSize, string> = {
      sm: 'px-3 py-1.5 text-xs rounded-md gap-1.5',
      md: 'px-4 py-2 text-sm rounded-lg gap-2',
      lg: 'px-5 py-2.5 text-base rounded-lg gap-2.5',
    };

    const variantClasses: Record<ButtonVariant, string> = {
      primary:
        'bg-accent text-on-accent font-semibold hover:brightness-105 active:brightness-95 shadow-sm',
      secondary:
        'bg-surface-2 border border-border text-text hover:border-accent hover:text-accent',
      outline:
        'bg-transparent border border-border text-text hover:border-accent hover:text-accent',
      ghost:
        'bg-transparent text-muted hover:text-text hover:bg-surface-2',
    };

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={pending ? 'true' : undefined}
        className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {pending ? (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!pending && rightIcon}
      </button>
    );
  },
);

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      variant = 'ghost',
      size = 'md',
      pending = false,
      disabled = false,
      className = '',
      children,
      ...props
    },
    ref,
  ) {
    const isDisabled = disabled || pending;

    const baseClasses =
      'inline-flex items-center justify-center rounded-lg transition select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] min-w-[44px]';

    const sizeClasses: Record<ButtonSize, string> = {
      sm: 'size-8 p-1',
      md: 'size-10 p-2',
      lg: 'size-12 p-3',
    };

    const variantClasses: Record<ButtonVariant, string> = {
      primary: 'bg-accent text-on-accent hover:brightness-105',
      secondary: 'bg-surface-2 border border-border text-text hover:border-accent',
      outline: 'bg-transparent border border-border text-text hover:border-accent',
      ghost: 'bg-transparent text-muted hover:text-text hover:bg-surface-2',
    };

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={pending ? 'true' : undefined}
        className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {pending ? (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : (
          children
        )}
      </button>
    );
  },
);
