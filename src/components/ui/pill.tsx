'use client';

import { Button, type ActionButtonProps } from './button';
import styles from './actions.module.css';

export interface PillProps extends Omit<ActionButtonProps, 'variant' | 'aria-pressed'> {
  pressed: boolean;
}

export function Pill({ pressed, className = '', ...props }: PillProps) {
  return <Button {...props} variant="outline" aria-pressed={pressed} className={`${styles.pill} !rounded-pill ${className}`} />;
}
