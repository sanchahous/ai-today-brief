'use client';

import { forwardRef, type KeyboardEvent, type MouseEvent, type SelectHTMLAttributes } from 'react';
import { describedBy } from '@/lib/ui/field-a11y';
import { Field, FieldError, FieldHint, FieldLabel, useFieldIds } from './field';
import styles from './fields.module.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: SelectOption[];
  error?: string;
  hint?: string;
  /** Native `<select>` has no read-only mode; this blocks value changes while keeping focus. */
  readOnly?: boolean;
}

const SELECT_CHANGE_KEYS = new Set(['ArrowUp', 'ArrowDown', ' ', 'Enter', 'Home', 'End']);

function stopReadonlySelectKey(event: KeyboardEvent<HTMLSelectElement>, readOnly: boolean) {
  if (readOnly && SELECT_CHANGE_KEYS.has(event.key)) event.preventDefault();
}

function stopReadonlySelectOpen(event: MouseEvent<HTMLSelectElement>, readOnly: boolean) {
  if (readOnly) event.preventDefault();
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({
  label, options, error, hint, id, className = '', children, disabled, readOnly,
  'aria-describedby': describedExtra, onKeyDown, onMouseDown, ...props
}, ref) {
  const ids = useFieldIds(id);
  const frozen = Boolean(readOnly);
  const described = describedBy([hint ? ids.hintId : null, error ? ids.errorId : null, describedExtra]);
  return (
    <Field className="w-full">
      {label ? <FieldLabel htmlFor={ids.controlId}>{label}</FieldLabel> : null}
      <div className={styles.affix}>
        <select
          {...props}
          ref={ref}
          id={ids.controlId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-readonly={frozen || undefined}
          aria-describedby={described}
          onKeyDown={(event) => { stopReadonlySelectKey(event, frozen); onKeyDown?.(event); }}
          onMouseDown={(event) => { stopReadonlySelectOpen(event, frozen); onMouseDown?.(event); }}
          className={`${styles.control} ${styles.select} ${className}`}
        >
          {options ? options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          )) : children}
        </select>
        <span aria-hidden="true" className={`${styles.icon} ${styles.iconEnd}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>
      <FieldHint id={ids.hintId}>{hint}</FieldHint>
      <FieldError id={ids.errorId}>{error}</FieldError>
    </Field>
  );
});
