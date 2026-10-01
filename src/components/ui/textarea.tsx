'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { describedBy } from '@/lib/ui/field-a11y';
import { Field, FieldError, FieldHint, FieldLabel, useFieldIds } from './field';
import styles from './fields.module.css';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({
  label, error, hint, id, className = '', disabled, readOnly, rows = 4,
  'aria-describedby': describedExtra, ...props
}, ref) {
  const ids = useFieldIds(id);
  const described = describedBy([hint ? ids.hintId : null, error ? ids.errorId : null, describedExtra]);
  return (
    <Field className="w-full">
      {label ? <FieldLabel htmlFor={ids.controlId}>{label}</FieldLabel> : null}
      <textarea
        {...props}
        ref={ref}
        id={ids.controlId}
        rows={rows}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-readonly={readOnly || undefined}
        aria-describedby={described}
        className={`${styles.control} ${styles.textarea} ${className}`}
      />
      <FieldHint id={ids.hintId}>{hint}</FieldHint>
      <FieldError id={ids.errorId}>{error}</FieldError>
    </Field>
  );
});
