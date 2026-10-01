import { describe, expect, it } from 'vitest';
import { actionClassName } from './action-styles';

describe('action class composition', () => {
  it('keeps the default secondary and caller-provided layout classes', () => {
    expect(actionClassName()).toContain('bg-surface-2');
    expect(actionClassName({ className: 'w-full' })).toContain('w-full');
  });
  it.each(['primary', 'secondary', 'outline', 'ghost'] as const)('composes %s in every control size without missing classes', (variant) => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const button = actionClassName({ variant, size });
      expect(button).toContain(`min-h-(--control-${size})`);
      expect(button).not.toMatch(/undefined|null/);
      const icon = actionClassName({ variant, size, iconOnly: true });
      expect(icon).toContain(`w-(--control-${size})`);
      expect(icon).toContain('!px-0');
    }
  });
  it('uses the fill palette for primary and preserves outline/ghost semantics', () => {
    expect(actionClassName({ variant: 'primary' })).toContain('bg-accent-fill text-on-accent');
    expect(actionClassName({ variant: 'outline' })).toContain('border-line-strong bg-transparent');
    expect(actionClassName({ variant: 'ghost' })).toContain('border-transparent bg-transparent');
  });
});
