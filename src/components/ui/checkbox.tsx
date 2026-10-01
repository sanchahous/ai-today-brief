'use client';

import {
  forwardRef,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { CheckIcon } from '@/components/icons';
import { describedBy } from '@/lib/ui/field-a11y';
import type { Lang } from '@/lib/site';
import { Field, FieldError, FieldHint, useFieldIds } from './field';
import styles from './fields.module.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: string;
  hint?: string;
  error?: string;
  glyph?: ReactNode;
  /** Sets `--cat-color` for the category glyph. */
  glyphColor?: string;
  count?: number;
  lang?: Lang;
  tintColor?: string;
  badge?: ReactNode;
  readOnly?: boolean;
}

function stopReadonlyToggle(
  event: KeyboardEvent<HTMLInputElement> | MouseEvent<HTMLInputElement>,
  readOnly: boolean,
) {
  if (readOnly && ('key' in event ? event.key === ' ' : true)) event.preventDefault();
}

function ChoiceMark({ round, tint }: { round?: boolean; tint?: string }) {
  // Inline colour is the optional category tint; the default fill stays on tokens.
  const style = tint ? { backgroundColor: tint, borderColor: tint } as CSSProperties : undefined;
  return (
    <span aria-hidden="true" className={`${styles.mark} ${round ? styles.markRound : ''}`} style={style}>
      {round ? <span className={styles.dot} /> : <CheckIcon size={14} strokeWidth={2.5} className={styles.tick} />}
    </span>
  );
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({
  label, description, hint, error, glyph, glyphColor, count, lang = 'en', tintColor, badge, readOnly = false,
  id, className = '', checked, disabled, onClick, onKeyDown, 'aria-describedby': describedExtra, ...props
}, ref) {
  const ids = useFieldIds(id);
  const described = describedBy([hint ? ids.hintId : null, error ? ids.errorId : null, describedExtra]);
  // CSS custom properties are not enumerated by React's CSSProperties type.
  const rowStyle = glyphColor ? { '--cat-color': glyphColor } as CSSProperties : undefined;
  return (
    <Field className="w-full">
      <label htmlFor={ids.controlId} className={`${styles.choice} ${className}`} style={rowStyle}>
        <input
          {...props}
          ref={ref}
          id={ids.controlId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-readonly={readOnly || undefined}
          aria-describedby={described}
          className="sr-only"
          onClick={(event) => { stopReadonlyToggle(event, readOnly); onClick?.(event); }}
          onKeyDown={(event) => { stopReadonlyToggle(event, readOnly); onKeyDown?.(event); }}
        />
        <ChoiceMark tint={checked ? tintColor : undefined} />
        {glyph ? <span aria-hidden="true" className={styles.glyph}>{glyph}</span> : null}
        <span className={styles.choiceCopy}>
          <span className={styles.choiceLabel}>{label}</span>
          {description ? <span className={styles.hint}>{description}</span> : null}
        </span>
        {typeof count === 'number' ? <span className={styles.count}>{new Intl.NumberFormat(lang).format(count)}</span> : null}
        {badge ? <span className="shrink-0">{badge}</span> : null}
      </label>
      <FieldHint id={ids.hintId}>{hint}</FieldHint>
      <FieldError id={ids.errorId}>{error}</FieldError>
    </Field>
  );
});
