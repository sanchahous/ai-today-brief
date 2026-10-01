export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-accent-fill text-on-accent font-semibold',
  secondary: 'border-line-strong bg-surface-2 text-text',
  outline: 'border-line-strong bg-transparent text-text',
  ghost: 'border-transparent bg-transparent text-muted',
};
const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-(--control-sm) px-3 py-2 text-xs gap-1.5',
  md: 'min-h-(--control-md) px-4 py-2 text-sm gap-2',
  lg: 'min-h-(--control-lg) px-5 py-3 text-base gap-2.5',
};
const ICON_SIZES: Record<ButtonSize, string> = {
  sm: 'w-(--control-sm)', md: 'w-(--control-md)', lg: 'w-(--control-lg)',
};

/** Keep the legacy secondary variant and caller classes while sharing one size contract. */
export function actionClassName({
  variant = 'secondary', size = 'md', iconOnly = false, className = '',
}: {
  variant?: ButtonVariant; size?: ButtonSize; iconOnly?: boolean; className?: string;
} = {}): string {
  return `inline-flex max-w-full shrink-0 items-center justify-center rounded-md border font-medium select-none touch-manipulation ${VARIANTS[variant]} ${SIZES[size]} ${iconOnly ? `${ICON_SIZES[size]} !px-0` : ''} ${className}`.trim();
}
