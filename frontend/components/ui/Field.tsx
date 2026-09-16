import { useId, type InputHTMLAttributes } from "react";
import styles from "./ui.module.css";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  inputClassName?: string;
}

export function Field({ label, hint, error, inputClassName, ...input }: Props) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <label className={styles.field} htmlFor={id}>
      {label}
      <input
        id={id}
        className={inputClassName ? `${styles.input} ${inputClassName}` : styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        {...input}
      />
      {hint && (
        <span id={hintId} className={styles.fieldHint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className={styles.fieldError} role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
