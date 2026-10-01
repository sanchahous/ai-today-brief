'use client';

import { useId, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { describedBy } from '@/lib/ui/field-a11y';
import { Field, FieldError, FieldHint, FieldLabel, useFieldIds } from './field';
import styles from './fields.module.css';

export interface SegmentedOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SegmentedControlProps {
  label: string;
  name: string;
  options: readonly SegmentedOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
}

const SEGMENT_MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ']);

function stopReadonlySegment(
  event: KeyboardEvent<HTMLInputElement> | MouseEvent<HTMLInputElement>,
  readOnly: boolean,
) {
  if (!readOnly) return;
  if ('key' in event && !SEGMENT_MOVE_KEYS.has(event.key)) return;
  event.preventDefault();
}

function SegmentOption({
  option, name, selected, readOnly, disabled, described, onSelect,
}: {
  option: SegmentedOption;
  name: string;
  selected: boolean;
  readOnly: boolean;
  disabled: boolean;
  described?: string;
  onSelect: (value: string) => void;
}) {
  const id = useId();
  return (
    <label className={styles.segmentOption}>
      <input
        id={id}
        type="radio"
        name={name}
        value={option.value}
        checked={selected}
        disabled={disabled}
        aria-describedby={described}
        onChange={() => onSelect(option.value)}
        onClick={(event) => stopReadonlySegment(event, readOnly)}
        onMouseDown={(event) => stopReadonlySegment(event, readOnly)}
        onKeyDown={(event) => stopReadonlySegment(event, readOnly)}
      />
      <span className={styles.segmentText}>{option.label}</span>
    </label>
  );
}

export function SegmentedControl({
  label, name, options, value, defaultValue, onValueChange, hint, error, disabled = false, readOnly = false, className = '',
}: SegmentedControlProps) {
  const ids = useFieldIds(name);
  const [inner, setInner] = useState(defaultValue ?? options.find((option) => !option.disabled)?.value ?? '');
  const selected = value ?? inner;
  const described = describedBy([hint ? ids.hintId : null, error ? ids.errorId : null]);
  const select = (next: string) => {
    if (readOnly || disabled) return;
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };
  return (
    <Field className={`w-full ${className}`}>
      <FieldLabel id={ids.labelId}>{label}</FieldLabel>
      <div
        role="radiogroup"
        aria-labelledby={ids.labelId}
        aria-describedby={described}
        aria-invalid={error ? true : undefined}
        aria-readonly={readOnly || undefined}
        aria-disabled={disabled || undefined}
        aria-orientation="horizontal"
        className={`${styles.group} ${styles.segment}`}
      >
        {options.map((option) => (
          <SegmentOption
            key={option.value}
            option={option}
            name={name}
            selected={selected === option.value}
            readOnly={readOnly}
            disabled={disabled || Boolean(option.disabled)}
            described={described}
            onSelect={select}
          />
        ))}
      </div>
      <FieldHint id={ids.hintId}>{hint}</FieldHint>
      <FieldError id={ids.errorId}>{error}</FieldError>
    </Field>
  );
}
