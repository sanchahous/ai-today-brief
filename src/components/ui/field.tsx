'use client';

import { useId, type ReactNode } from 'react';
import styles from './fields.module.css';

export function useFieldIds(id?: string) {
  const generated = useId();
  const controlId = id && id.length > 0 ? id : generated;
  return {
    controlId,
    hintId: `${controlId}-hint`,
    errorId: `${controlId}-error`,
    labelId: `${controlId}-label`,
  };
}

export function Field({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.field} ${className}`}>{children}</div>;
}

/** A real `<label>` only when it points at one control. Groups use a named div instead. */
export function FieldLabel({
  htmlFor, id, children,
}: { htmlFor?: string; id?: string; children: ReactNode }) {
  if (!htmlFor) return <div id={id} className={styles.label}>{children}</div>;
  return <label id={id} htmlFor={htmlFor} className={styles.label}>{children}</label>;
}

export function FieldHint({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return <p id={id} className={styles.hint}>{children}</p>;
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className={styles.error}>
      <span aria-hidden="true" className={styles.errorMark}>!</span>
      <span>{children}</span>
    </p>
  );
}

/** Move focus to the first invalid, still-enabled control. Read-only fields stay eligible. */
export function focusFirstInvalid(root: ParentNode): boolean {
  const node = root.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)');
  if (!node) return false;
  node.focus();
  return true;
}
