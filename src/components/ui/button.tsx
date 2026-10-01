'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { actionClassName, type ButtonSize, type ButtonVariant } from '@/lib/ui/action-styles';
import styles from './actions.module.css';

export type { ButtonSize, ButtonVariant } from '@/lib/ui/action-styles';
export { IconButton, type IconButtonProps } from './icon-button';

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ActionButtonProps>(function Button({
  variant = 'secondary', size = 'md', pending = false, disabled = false, type = 'button',
  leftIcon, rightIcon, className = '', children, ...props
}, ref) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || props['aria-busy'] || undefined}
      data-size={size}
      data-variant={variant}
      className={`${styles.control} ${actionClassName({ variant, size, className })}`}
    >
      {pending ? <span aria-hidden="true" className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" /> : leftIcon}
      <span className="min-w-0">{children}</span>
      {!pending && rightIcon}
    </button>
  );
});

/** Compatibility for existing consumers; both exports share the same implementation. */
export const ActionButton = Button;
