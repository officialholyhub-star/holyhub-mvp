"use client";

import { useState } from "react";
import styles from "./password-input.module.css";

type PasswordInputProps = {
  id: string;
  name: string;
  autoComplete: string;
  minLength?: number;
  required?: boolean;
};

export function PasswordInput({ id, name, autoComplete, minLength, required }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className={styles.control}>
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        className={styles.input}
      />
      <button
        className={styles.toggle}
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={id}
        onClick={() => setVisible((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          {visible ? (
            <>
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 002.8 2.8" />
              <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.2 9.5 6-.4.8-1.3 2-2.6 3.1M6.2 6.2C3.9 7.6 2.7 9.7 2.5 11c.7 1.3 4.1 8 9.5 8 1.1 0 2.1-.2 3-.6" />
            </>
          ) : (
            <>
              <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
              <circle cx="12" cy="12" r="2.5" />
            </>
          )}
        </svg>
      </button>
    </span>
  );
}
