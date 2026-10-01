'use client';

import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { describedBy } from '@/lib/ui/field-a11y';
import { Field, FieldError, useFieldIds } from './field';
import styles from './fields.module.css';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> {
  label: ReactNode;
  description?: ReactNode;
  hint?: string;
  error?: string;
  readOnly?: boolean;
}

function stopReadonlySwitch(
  event: { key?: string; preventDefault: () => void },
  readOnly: boolean,
) {
  if (!readOnly) return;
  if (event.key && event.key !== ' ' && event.key !== 'Enter') return;
  event.preventDefault();
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch({
  label, description, hint, error, readOnly = false, id, className = '', checked, defaultChecked, disabled,
  onChange, onClick, onKeyDown, 'aria-describedby': describedExtra, ...props
}, ref) {
  const ids = useFieldIds(id);
  const controlled = checked !== undefined;
  const [inner, setInner] = useState(Boolean(defaultChecked));
  const on = controlled ? Boolean(checked) : inner;
  const described = describedBy([
    description ? ids.hintId : null,
    hint ? `${ids.hintId}-note` : null,
    error ? ids.errorId : null,
    describedExtra,
  ]);
  return (
    <Field className={`w-full ${className}`}>
      <label htmlFor={ids.controlId} className={styles.switchRow}>
        <span className={styles.switchCopy}>
          <span id={ids.labelId} className={styles.label}>{label}</span>
          {description ? <span id={ids.hintId} className={styles.hint}>{description}</span> : null}
        </span>
        <input
          {...props}
          ref={ref}
          id={ids.controlId}
          type="checkbox"
          role="switch"
          checked={on}
          disabled={disabled}
          aria-labelledby={ids.labelId}
          aria-checked={on}
          aria-invalid={error ? true : undefined}
          aria-readonly={readOnly || undefined}
          aria-describedby={described}
          className={styles.switchInput}
          onClick={(event) => { stopReadonlySwitch(event, readOnly); onClick?.(event); }}
          onKeyDown={(event) => { stopReadonlySwitch(event, readOnly); onKeyDown?.(event); }}
          onChange={(event) => {
            if (readOnly) {
              event.preventDefault();
              return;
            }
            if (!controlled) setInner(event.target.checked);
            onChange?.(event);
          }}
        />
      </label>
      {hint ? <p id={`${ids.hintId}-note`} className={styles.hint}>{hint}</p> : null}
      <FieldError id={ids.errorId}>{error}</FieldError>
    </Field>
  );
});
