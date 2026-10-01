'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { CloseIcon, SearchIcon } from '@/components/icons';
import { describedBy, searchFieldCopy } from '@/lib/ui/field-a11y';
import type { Lang } from '@/lib/site';
import { Field, FieldError, FieldHint, FieldLabel, useFieldIds } from './field';
import styles from './fields.module.css';

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  onClear?: () => void;
  clearLabel?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput({
  label, error, hint, leftIcon, rightIcon, onClear, clearLabel, id, className = '', value, disabled, readOnly,
  'aria-describedby': describedExtra, ...props
}, ref) {
  const ids = useFieldIds(id);
  const showClear = Boolean(onClear && value && !disabled && !readOnly);
  const described = describedBy([hint ? ids.hintId : null, error ? ids.errorId : null, describedExtra]);
  return (
    <Field className="w-full">
      {label ? <FieldLabel htmlFor={ids.controlId}>{label}</FieldLabel> : null}
      <div className={styles.affix}>
        {leftIcon ? <span aria-hidden="true" className={`${styles.icon} ${styles.iconStart}`}>{leftIcon}</span> : null}
        <input
          {...props}
          ref={ref}
          id={ids.controlId}
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={error ? true : undefined}
          aria-readonly={readOnly || undefined}
          aria-describedby={described}
          className={`${styles.control} ${leftIcon ? styles.padIcon : ''} ${showClear || rightIcon ? styles.padEnd : ''} ${className}`}
        />
        {showClear ? (
          <button type="button" onClick={onClear} aria-label={clearLabel ?? 'Clear input'} className={styles.clear}>
            <CloseIcon size={16} />
          </button>
        ) : rightIcon ? (
          <span aria-hidden="true" className={`${styles.icon} ${styles.iconEnd}`}>{rightIcon}</span>
        ) : null}
      </div>
      <FieldHint id={ids.hintId}>{hint}</FieldHint>
      <FieldError id={ids.errorId}>{error}</FieldError>
    </Field>
  );
});

export interface SearchInputProps extends Omit<TextInputProps, 'leftIcon' | 'type'> {
  lang?: Lang;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput({
  lang = 'en', placeholder, clearLabel, onClear, ...props
}, ref) {
  const copy = searchFieldCopy(lang);
  return (
    <TextInput
      {...props}
      ref={ref}
      type="search"
      leftIcon={<SearchIcon size={16} />}
      placeholder={placeholder ?? copy.placeholder}
      clearLabel={clearLabel ?? copy.clearLabel}
      onClear={onClear}
    />
  );
});
