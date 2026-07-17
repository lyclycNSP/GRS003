"use client";

import { useState } from "react";
import styles from "@/app/components/AuthenticatedUI.module.css";

export function CharacterCountTextarea({ name, defaultValue = "", maxLength, minLength, required }: {
  name: string;
  defaultValue?: string;
  maxLength: number;
  minLength?: number;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <span className={styles.textareaWrap}>
      <textarea name={name} maxLength={maxLength} minLength={minLength} required={required} value={value} onChange={(event) => setValue(event.target.value)} />
      <small className={styles.characterCount}>{value.length} / {maxLength}</small>
    </span>
  );
}
