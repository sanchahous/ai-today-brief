import Link from 'next/link';
import type { ComponentProps } from 'react';
import { actionClassName, type ButtonSize } from '@/lib/ui/action-styles';
import styles from './actions.module.css';

export type TagProps = ComponentProps<typeof Link> & { size?: ButtonSize };

export function Tag({ size = 'sm', className = '', children, ...props }: TagProps) {
  return <Link {...props} data-size={size} data-variant="outline"
    className={`${styles.control} ${actionClassName({ variant: 'outline', size, className: `!rounded-pill ${className}` })}`}>
    {children}
  </Link>;
}
