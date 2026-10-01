'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { actionClassName, type ButtonSize, type ButtonVariant } from '@/lib/ui/action-styles';
import styles from './actions.module.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({
  variant = 'ghost', size = 'md', pending = false, disabled = false, type = 'button',
  className = '', children, ...props
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
      className={`${styles.control} ${actionClassName({ variant, size, iconOnly: true, className })}`}
    >
      {pending ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" /> : children}
    </button>
  );
});
