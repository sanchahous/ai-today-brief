'use client';

import {
  createContext,
  forwardRef,
  useContext,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { describedBy } from '@/lib/ui/field-a11y';
import { Field, FieldError, FieldHint, FieldLabel, useFieldIds } from './field';
import styles from './fields.module.css';

interface RadioGroupState {
  name: string;
  describedBy?: string;
  readOnly: boolean;
  disabled: boolean;
}

const RadioGroupContext = createContext<RadioGroupState | null>(null);

export interface RadioGroupProps {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

const RADIO_MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ']);

function stopReadonlyRadio(
  event: KeyboardEvent<HTMLInputElement> | MouseEvent<HTMLInputElement>,
  readOnly: boolean,
) {
  if (!readOnly) return;
  if ('key' in event && !RADIO_MOVE_KEYS.has(event.key)) return;
  event.preventDefault();
}

export function RadioGroup({
  label, name, hint, error, readOnly = false, disabled = false, className = '', children,
}: RadioGroupProps) {
  const ids = useFieldIds(name);
  const described = describedBy([hint ? ids.hintId : null, error ? ids.errorId : null]);
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
        className={`${styles.group} ${styles.stack}`}
      >
        <RadioGroupContext.Provider value={{ name, describedBy: described, readOnly, disabled }}>
          {children}
        </RadioGroupContext.Provider>
      </div>
      <FieldHint id={ids.hintId}>{hint}</FieldHint>
      <FieldError id={ids.errorId}>{error}</FieldError>
    </Field>
  );
}

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: string;
  badge?: ReactNode;
  readOnly?: boolean;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio({
  label, description, badge, readOnly, id, className = '', checked, disabled, name,
  onClick, onKeyDown, 'aria-describedby': describedExtra, ...props
}, ref) {
  const group = useContext(RadioGroupContext);
  const ids = useFieldIds(id);
  const frozen = readOnly ?? group?.readOnly ?? false;
  const described = describedBy([describedExtra, group?.describedBy]);
  return (
    <label htmlFor={ids.controlId} className={`${styles.choice} ${className}`}>
      <input
        {...props}
        ref={ref}
        id={ids.controlId}
        type="radio"
        name={name ?? group?.name}
        checked={checked}
        disabled={disabled || group?.disabled}
        aria-describedby={described}
        className="sr-only"
        onClick={(event) => { stopReadonlyRadio(event, frozen); onClick?.(event); }}
        onMouseDown={(event) => { stopReadonlyRadio(event, frozen); }}
        onKeyDown={(event) => { stopReadonlyRadio(event, frozen); onKeyDown?.(event); }}
      />
      <span aria-hidden="true" className={`${styles.mark} ${styles.markRound}`}>
        <span className={styles.dot} />
      </span>
      <span className={styles.choiceCopy}>
        <span className={styles.choiceLabel}>{label}</span>
        {description ? <span className={styles.hint}>{description}</span> : null}
      </span>
      {badge ? <span className="shrink-0">{badge}</span> : null}
    </label>
  );
});
